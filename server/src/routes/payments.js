import { Router } from 'express';
import mongoose from 'mongoose';
import { timingSafeEqual } from 'node:crypto';
import { requireAuth } from '../middleware/auth.js';
import { accessibleOrganisationIds, assertOrganisationAccess } from '../middleware/organisationScope.js';
import { LedgerAccount, PaymentIntent, JournalEntry, AuditLog } from '../models/domain.js';
import { FinanceTransaction } from '../models/index.js';
import { normalizeKenyanPhone, requestStkPush } from '../services/daraja.js';

const router=Router();
const financeRoles=new Set(['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin','treasurer']);
const approvers=new Set(['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor']);
const moneyCents=value=>{const text=String(value??'');if(!/^\d+(?:\.\d{1,2})?$/.test(text))return null;const [w,d='']=text.split('.');return BigInt(w)*100n+BigInt((d+'00').slice(0,2));};
const moneyText=value=>(value/100n).toString()+'.'+(value%100n).toString().padStart(2,'0');

router.post('/mpesa/callback/:secret',async(req,res)=>{\n const expected=Buffer.from(process.env.MPESA_CALLBACK_SECRET||'');const supplied=Buffer.from(String(req.params.secret||''));if(!expected.length||expected.length!==supplied.length||!timingSafeEqual(expected,supplied))return res.status(404).json({message:'Not found'});
 const callback=req.body?.Body?.stkCallback;
 if(!callback?.CheckoutRequestID)return res.status(200).json({ResultCode:0,ResultDesc:'Callback received'});
 try{
  const payment=await PaymentIntent.findOne({checkoutRequestId:String(callback.CheckoutRequestID)});
  if(!payment)return res.status(200).json({ResultCode:0,ResultDesc:'Unknown checkout reference acknowledged'});
  if(payment.status==='paid')return res.status(200).json({ResultCode:0,ResultDesc:'Already processed'});
  if(Number(callback.ResultCode)!==0){
   payment.status='failed';payment.responseDescription=String(callback.ResultDesc||'Payment was not completed').slice(0,180);payment.callbackReceivedAt=new Date();await payment.save();
   return res.status(200).json({ResultCode:0,ResultDesc:'Failure callback recorded'});
  }
  const items=callback.CallbackMetadata?.Item||[];
  const get=name=>items.find(item=>item.Name===name)?.Value;
  const paidAmount=moneyCents(get('Amount'));
  const paidPhone=normalizeKenyanPhone(get('PhoneNumber'));
  const expectedAmount=moneyCents(payment.amount);
  if(paidAmount===null||paidAmount!==expectedAmount||paidPhone!==payment.phoneNumber){
   payment.status='failed';payment.responseDescription='Callback amount or phone did not match the payment request';payment.callbackReceivedAt=new Date();await payment.save();
   return res.status(200).json({ResultCode:0,ResultDesc:'Payment details did not match'});
  }
  const claimed=await PaymentIntent.findOneAndUpdate({_id:payment._id,status:{$in:['initiated','accepted']}},{$set:{status:'processing',callbackReceivedAt:new Date()}},{new:true});
  if(!claimed)return res.status(200).json({ResultCode:0,ResultDesc:'Callback already being processed'});
  const receipt=String(get('MpesaReceiptNumber')||'');
  if(!receipt){await PaymentIntent.updateOne({_id:payment._id},{$set:{status:'accepted',responseDescription:'Successful callback omitted receipt number'}});return res.status(200).json({ResultCode:0,ResultDesc:'Receipt details pending'});}
  let journal=await JournalEntry.findOne({sourceType:'mpesa_payment',sourceId:payment._id});
  if(!journal){
   journal=await JournalEntry.create({organisation:payment.organisation,entryNumber:'MPESA-'+String(payment._id),entryDate:new Date(),description:'M-Pesa payment '+receipt+' · '+payment.accountReference,status:'posted',lines:[{account:payment.debitAccount,debit:String(payment.amount),credit:'0.00'},{account:payment.creditAccount,debit:'0.00',credit:String(payment.amount)}],createdBy:payment.createdBy,postedAt:new Date(),sourceType:'mpesa_payment',sourceId:payment._id});
  }
  let transaction=await FinanceTransaction.findOne({organisation:payment.organisation,reference:receipt});
  if(!transaction){
   transaction=await FinanceTransaction.create({organisation:payment.organisation,direction:'income',category:'M-Pesa contribution',amount:String(payment.amount),currency:'KES',occurredAt:new Date(),status:'confirmed',paymentMethod:'mpesa',reference:receipt,description:'M-Pesa contribution · '+payment.accountReference,debitAccount:payment.debitAccount,creditAccount:payment.creditAccount,journalEntry:journal._id,createdBy:payment.createdBy});
  }
  payment.status='paid';payment.mpesaReceipt=receipt;payment.transactionDate=new Date();payment.financeTransaction=transaction._id;payment.journalEntry=journal._id;payment.responseDescription=String(callback.ResultDesc||'Payment completed').slice(0,180);await payment.save();
  await AuditLog.create({organisation:payment.organisation,actor:payment.createdBy,action:'mpesa_callback_confirmed',entity:'mpesa_payment',recordId:payment._id,summary:'M-Pesa payment confirmed: '+receipt});
  return res.status(200).json({ResultCode:0,ResultDesc:'Payment recorded'});
 }catch(error){
  await PaymentIntent.updateOne({checkoutRequestId:String(callback.CheckoutRequestID),status:'processing'},{$set:{status:'accepted',responseDescription:'Callback processing will be retried'}});
  return res.status(200).json({ResultCode:0,ResultDesc:'Callback acknowledged for retry'});
 }
});

router.use(requireAuth);
router.post('/mpesa/stk-push',async(req,res,next)=>{try{
 if(!financeRoles.has(req.user.role))return res.status(403).json({message:'Finance permission required'});
 const {organisation,phone,amount,accountReference,description,debitAccount,creditAccount}=req.body;
 const org=organisation||(req.user.organisation?._id??req.user.organisation);
 if(!mongoose.isValidObjectId(org)||!(await assertOrganisationAccess(req.user,org)))return res.status(403).json({message:'Organisation outside your authorised scope'});
 const normalizedPhone=normalizeKenyanPhone(phone),value=moneyCents(amount);
 if(!normalizedPhone||value===null||value<=0n||value%100n!==0n)return res.status(400).json({message:'Enter a valid Kenyan mobile number and a positive whole-KES amount'});
 if(!String(accountReference||'').trim()||!mongoose.isValidObjectId(debitAccount)||!mongoose.isValidObjectId(creditAccount))return res.status(400).json({message:'Account reference and both ledger accounts are required'});
 const accounts=await LedgerAccount.find({_id:{$in:[debitAccount,creditAccount]},organisation:org,active:true});
 const debit=accounts.find(a=>String(a._id)===String(debitAccount)),credit=accounts.find(a=>String(a._id)===String(creditAccount));
 if(!debit||!credit||debit.type!=='asset'||credit.type!=='income')return res.status(400).json({message:'M-Pesa giving must debit an active asset account and credit an active income account'});
 const payment=await PaymentIntent.create({organisation:org,amount:moneyText(value),phoneNumber:normalizedPhone,accountReference:String(accountReference).slice(0,12),description:String(description||'Church contribution').slice(0,100),debitAccount,creditAccount,createdBy:req.user._id,status:'initiated'});
 try{
  const response=await requestStkPush({phone:normalizedPhone,amount:Number(value/100n),accountReference:payment.accountReference,description:payment.description});
  payment.status='accepted';payment.merchantRequestId=response.MerchantRequestID;payment.checkoutRequestId=response.CheckoutRequestID;payment.responseDescription=response.ResponseDescription;await payment.save();
  res.status(202).json({payment:{id:payment.id,status:payment.status,phoneNumber:payment.phoneNumber,amount:String(payment.amount),checkoutRequestId:payment.checkoutRequestId,responseDescription:payment.responseDescription}});
 }catch(error){payment.status='failed';payment.responseDescription=String(error.message||'STK push failed').slice(0,180);await payment.save();return res.status(502).json({message:payment.responseDescription});}
}catch(e){next(e);}});
router.get('/mpesa/payments',async(req,res,next)=>{try{
 if(!financeRoles.has(req.user.role))return res.status(403).json({message:'Finance permission required'});
 const ids=await accessibleOrganisationIds(req.user);
 const payments=await PaymentIntent.find({organisation:{$in:ids}}).sort({createdAt:-1}).limit(100).populate('createdBy','fullName').populate('financeTransaction','reference status').lean();
 res.json({payments});
}catch(e){next(e);}});
router.get('/mpesa/payments/:id',async(req,res,next)=>{try{
 if(!financeRoles.has(req.user.role))return res.status(403).json({message:'Finance permission required'});
 const ids=await accessibleOrganisationIds(req.user);
 const payment=await PaymentIntent.findOne({_id:req.params.id,organisation:{$in:ids}}).populate('createdBy','fullName').populate('financeTransaction','reference status').lean();
 if(!payment)return res.status(404).json({message:'Payment request not found'});
 res.json({payment});
}catch(e){next(e);}});
export default router;
