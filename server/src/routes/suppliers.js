import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.js';
import { accessibleOrganisationIds, assertOrganisationAccess } from '../middleware/organisationScope.js';
import { AuditLog, LedgerAccount, JournalEntry, Budget, Supplier, PurchaseRequest, PurchaseQuote, SupplierInvoice, SupplierPayment, FinanceApprovalPolicy } from '../models/domain.js';
import { approvalProgress } from '../domain/approvalMatrix.js';
import { budgetPeriodRange, selectApplicableBudget, budgetPostingDecision } from '../domain/budgetControl.js';
import { supplierNameError, supplierInvoiceError, supplierPaymentError, supplierDecisionError, invoicePaymentStatus, moneyToMinor, supplierQuoteError } from '../domain/supplierWorkflow.js';

const router=Router();
router.use(requireAuth);
const financeRoles=new Set(['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin','treasurer']);
const approverRoles=new Set(['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor']);
const orgFor=(req,value)=>value||(req.user.organisation?._id??req.user.organisation);
const audit=async(req,org,action,entity,record,summary,metadata={})=>AuditLog.create({organisation:org,actor:req.user._id,action,entity,recordId:record._id,summary,metadata});
const scopedIds=req=>accessibleOrganisationIds(req.user);
const validCurrency=value=>/^[A-Z]{3}$/.test(String(value||'').toUpperCase());
const asAmount=value=>String(value??'').trim();
const resolveApprovalPolicy=async(organisation,transactionType,amount)=>FinanceApprovalPolicy.findOne({organisation,transactionType,active:true,minimumAmount:{$lte:amount},$or:[{maximumAmount:null},{maximumAmount:{$gte:amount}}]}).lean();
const applyApprovalDecision=({record,policy,actor,decision,note})=>{
 record.approvals=record.approvals||[];
 const required=policy?.requiredApprovals||1;
 const progress=approvalProgress({approvals:record.approvals,actorId:actor._id,decision,requiredApprovals:required});
 if(!progress.allowed)return {error:progress.reason};
 record.approvals.push({actor:actor._id,role:actor.role,decision,note,decidedAt:new Date()});
 if(decision==='reject'){record.status='rejected';record.decidedBy=actor._id;record.decisionNote=note;}
 else if(progress.complete){record.status='approved';record.approvedBy=actor._id;record.approvedAt=new Date();record.decidedBy=actor._id;record.decisionNote=note;}
 return {complete:progress.complete,remaining:progress.remaining};
};

router.get('/suppliers',async(req,res,next)=>{try{
 if(!financeRoles.has(req.user.role))return res.status(403).json({message:'Supplier register access denied'});
 const ids=await scopedIds(req),filter={organisation:{$in:ids}};
 if(req.query.status)filter.status=String(req.query.status);
 const suppliers=await Supplier.find(filter).sort({name:1}).lean();
 res.set('Cache-Control','no-store');res.json({suppliers});
}catch(e){next(e);}});
router.post('/suppliers',async(req,res,next)=>{try{
 if(!financeRoles.has(req.user.role))return res.status(403).json({message:'Supplier register access denied'});
 const org=orgFor(req,req.body.organisation);
 if(!mongoose.isValidObjectId(org)||!(await assertOrganisationAccess(req.user,org)))return res.status(403).json({message:'Organisation outside your authorised scope'});
 const name=String(req.body.name||'').trim(),error=supplierNameError(name);
 if(error)return res.status(400).json({message:error});
 const supplier=await Supplier.create({organisation:org,name,contactName:req.body.contactName,email:req.body.email,phone:req.body.phone,taxPin:req.body.taxPin,address:req.body.address,notes:req.body.notes,createdBy:req.user._id,updatedBy:req.user._id});
 await audit(req,org,'supplier_create','supplier',supplier,'Registered supplier');
 res.status(201).json({supplier});
}catch(e){next(e);}});
router.patch('/suppliers/:id',async(req,res,next)=>{try{
 if(!financeRoles.has(req.user.role))return res.status(403).json({message:'Supplier register access denied'});
 const ids=await scopedIds(req),supplier=await Supplier.findOne({_id:req.params.id,organisation:{$in:ids}});
 if(!supplier)return res.status(404).json({message:'Supplier not found'});
 const allowed=['name','contactName','email','phone','taxPin','address','notes','status'];
 for(const key of allowed)if(Object.hasOwn(req.body,key))supplier[key]=req.body[key];
 const error=supplierNameError(supplier.name);if(error)return res.status(400).json({message:error});
 if(!['active','suspended'].includes(supplier.status))return res.status(400).json({message:'Invalid supplier status'});
 supplier.updatedBy=req.user._id;await supplier.save();
 await audit(req,supplier.organisation,'supplier_update','supplier',supplier,'Updated supplier details');
 res.json({supplier});
}catch(e){next(e);}});

router.get('/purchase-requests',async(req,res,next)=>{try{
 if(!financeRoles.has(req.user.role))return res.status(403).json({message:'Procurement access denied'});
 const ids=await scopedIds(req),filter={organisation:{$in:ids}};
 if(req.query.status)filter.status=String(req.query.status);
 const requests=await PurchaseRequest.find(filter).populate('supplier','name').populate('createdBy','fullName').populate('approvedBy','fullName').populate('selectedQuote').sort({createdAt:-1}).lean();
 res.json({purchaseRequests:requests});
}catch(e){next(e);}});
router.get('/purchase-requests/:id/quotes',async(req,res,next)=>{try{
 if(!financeRoles.has(req.user.role))return res.status(403).json({message:'Procurement quotation access denied'});
 const ids=await scopedIds(req),purchaseRequest=await PurchaseRequest.findOne({_id:req.params.id,organisation:{$in:ids}}).select('_id organisation selectedQuote purchaseOrderNumber status');
 if(!purchaseRequest)return res.status(404).json({message:'Purchase request not found'});
 const quotes=await PurchaseQuote.find({organisation:purchaseRequest.organisation,purchaseRequest:purchaseRequest._id}).populate('supplier','name').populate('createdBy','fullName').populate('decidedBy','fullName').sort({amount:1,createdAt:1}).lean();
 res.json({quotes,purchaseRequest});
}catch(e){next(e);}});
router.post('/purchase-requests/:id/quotes',async(req,res,next)=>{try{
 if(!financeRoles.has(req.user.role))return res.status(403).json({message:'Procurement quotation access denied'});
 const ids=await scopedIds(req),purchaseRequest=await PurchaseRequest.findOne({_id:req.params.id,organisation:{$in:ids}});
 if(!purchaseRequest)return res.status(404).json({message:'Purchase request not found'});
 if(!['submitted','approved'].includes(purchaseRequest.status)||purchaseRequest.selectedQuote)return res.status(409).json({message:'Quotes can only be added before a purchase order is issued'});
 const {supplier,quoteNumber,amount,currency=purchaseRequest.currency,deliveryDays,validUntil,terms,documentReference}=req.body;
 const validation=supplierQuoteError({quoteNumber,amount,currency,requestCurrency:purchaseRequest.currency,deliveryDays,validUntil});
 if(!mongoose.isValidObjectId(supplier)||validation)return res.status(400).json({message:validation||'Select a valid supplier'});
 const days=Number(deliveryDays),expiry=new Date(validUntil);
 const vendor=await Supplier.findOne({_id:supplier,organisation:purchaseRequest.organisation,status:'active'}).select('_id');
 if(!vendor)return res.status(400).json({message:'Select an active supplier in this organisation'});
 const quote=await PurchaseQuote.create({organisation:purchaseRequest.organisation,purchaseRequest:purchaseRequest._id,supplier,quoteNumber:String(quoteNumber).trim(),currency:String(currency).toUpperCase(),amount:asAmount(amount),deliveryDays:days,validUntil:expiry,terms:String(terms||'').slice(0,1000),documentReference:String(documentReference||'').slice(0,300),createdBy:req.user._id});
 await audit(req,purchaseRequest.organisation,'purchase_quote_submit','purchase_quote',quote,'Submitted supplier quotation',{purchaseRequest:purchaseRequest.requestNumber,amount:asAmount(amount),currency});
 res.status(201).json({quote});
}catch(e){if(e?.code===11000)return res.status(409).json({message:'A quotation from this supplier is already registered for this purchase request'});next(e);}});
router.post('/purchase-requests/:id/select-quote',async(req,res,next)=>{try{
 if(!approverRoles.has(req.user.role))return res.status(403).json({message:'Independent procurement approval permission required to select a quotation'});
 const ids=await scopedIds(req),session=await mongoose.startSession();let result;
 try{await session.withTransaction(async()=>{
  const purchaseRequest=await PurchaseRequest.findOne({_id:req.params.id,organisation:{$in:ids},status:'approved',selectedQuote:null}).session(session);
  if(!purchaseRequest)throw Object.assign(new Error('Purchase request must be approved and have no purchase order before selecting a quotation'),{status:409});
  const quote=await PurchaseQuote.findOne({_id:req.body.quote,organisation:purchaseRequest.organisation,purchaseRequest:purchaseRequest._id,status:'submitted'}).session(session);
  if(!quote)throw Object.assign(new Error('Quotation not found or already decided'),{status:404});
  if(String(quote.currency)!==purchaseRequest.currency||moneyToMinor(String(quote.amount))>moneyToMinor(String(purchaseRequest.amount)))throw Object.assign(new Error('Selected quotation exceeds the approved request amount or uses a different currency; obtain a revised approval first'),{status:409});
  purchaseRequest.supplier=quote.supplier;purchaseRequest.selectedQuote=quote._id;purchaseRequest.status='ordered';purchaseRequest.purchaseOrderNumber='PO-'+purchaseRequest.requestNumber;purchaseRequest.orderedAt=new Date();await purchaseRequest.save({session});
  quote.status='selected';quote.decidedBy=req.user._id;quote.decidedAt=new Date();await quote.save({session});
  await PurchaseQuote.updateMany({organisation:purchaseRequest.organisation,purchaseRequest:purchaseRequest._id,status:'submitted',_id:{$ne:quote._id}},{$set:{status:'rejected',decisionNote:'Another quotation was selected'}},{session});
  result={purchaseRequest,quote};
 });}finally{await session.endSession();}
 await audit(req,result.purchaseRequest.organisation,'purchase_order_created','purchase_request',result.purchaseRequest,'Selected supplier quotation and generated purchase order',{purchaseOrderNumber:result.purchaseRequest.purchaseOrderNumber,quote:result.quote._id});
 res.json(result);
}catch(e){if(e?.name==='VersionError')return res.status(409).json({message:'Another approver changed this purchase request. Reload and retry.'});if(e?.status)return res.status(e.status).json({message:e.message});next(e);}});
router.post('/purchase-requests',async(req,res,next)=>{try{
 if(!financeRoles.has(req.user.role))return res.status(403).json({message:'Procurement access denied'});
 const org=orgFor(req,req.body.organisation),{supplier,requestNumber,description,currency='KES',amount}=req.body;
 if(!mongoose.isValidObjectId(org)||!(await assertOrganisationAccess(req.user,org)))return res.status(403).json({message:'Organisation outside your authorised scope'});
 const minor=moneyToMinor(amount);
 if(!mongoose.isValidObjectId(supplier)||!String(requestNumber||'').trim()||!String(description||'').trim()||minor===null||minor<=0n||!validCurrency(currency))return res.status(400).json({message:'Supplier, request number, description, positive amount and ISO currency are required'});
 const vendor=await Supplier.findOne({_id:supplier,organisation:org,status:'active'}).select('_id');
 if(!vendor)return res.status(400).json({message:'Select an active supplier in this organisation'});
 const purchaseRequest=await PurchaseRequest.create({organisation:org,supplier,requestNumber:String(requestNumber).trim(),description:String(description).trim(),currency:String(currency).toUpperCase(),amount:asAmount(amount),createdBy:req.user._id});
 await audit(req,org,'purchase_request_submit','purchase_request',purchaseRequest,'Submitted purchase request',{amount:asAmount(amount),currency});
 res.status(201).json({purchaseRequest});
}catch(e){next(e);}});
router.post('/purchase-requests/:id/decision',async(req,res,next)=>{try{
 if(!approverRoles.has(req.user.role))return res.status(403).json({message:'Independent procurement approval permission required'});
 const decision=String(req.body.decision||''),note=String(req.body.note||'').trim().slice(0,500),ids=await scopedIds(req);
 const item=await PurchaseRequest.findOne({_id:req.params.id,organisation:{$in:ids}});
 if(!item)return res.status(404).json({message:'Purchase request not found'});
 const error=supplierDecisionError({status:item.status,decision,actorId:req.user._id,createdBy:item.createdBy,approvals:item.approvals||[]});
 if(error)return res.status(409).json({message:error});
 if(decision==='reject'&&!note)return res.status(400).json({message:'A rejection reason is required'});
 const policy=await resolveApprovalPolicy(item.organisation,'purchase_request',item.amount);
 if(policy&&!policy.approverRoles.includes(req.user.role))return res.status(403).json({message:'Your role is not authorised by the purchase request approval matrix'});
 if(!policy&&!approverRoles.has(req.user.role))return res.status(403).json({message:'Independent procurement approval permission required'});
 const progress=applyApprovalDecision({record:item,policy,actor:req.user,decision,note});
 if(progress.error)return res.status(409).json({message:progress.error});
 await item.save();
 await audit(req,item.organisation,'purchase_request_'+decision,'purchase_request',item,'Purchase request '+(decision==='reject'?'rejected':progress.complete?'approved':'approval recorded'),{note,remainingApprovals:progress.remaining});
 res.json({purchaseRequest:item,approvalProgress:{complete:progress.complete,remaining:progress.remaining}});
}catch(e){if(e?.name==='VersionError')return res.status(409).json({message:'This record changed while you were processing it. Reload the latest record and retry.'});next(e);}});

router.get('/invoices',async(req,res,next)=>{try{
 if(!financeRoles.has(req.user.role))return res.status(403).json({message:'Supplier invoice access denied'});
 const ids=await scopedIds(req),filter={organisation:{$in:ids}};
 if(req.query.status)filter.status=String(req.query.status);
 const invoices=await SupplierInvoice.find(filter).populate('supplier','name').populate('purchaseRequest','requestNumber').populate('expenseAccount','code name').populate('payableAccount','code name').populate('approvedBy','fullName').sort({invoiceDate:-1}).lean();
 const payments=await SupplierPayment.aggregate([{$match:{organisation:{$in:ids},status:'paid'}},{$group:{_id:'$invoice',paid:{$sum:{$toDecimal:'$amount'}}}}]);
 const paidMap=new Map(payments.map(x=>[String(x._id),String(x.paid)]));
 res.json({invoices:invoices.map(x=>({...x,paidAmount:paidMap.get(String(x._id))||'0',paymentStatus:invoicePaymentStatus({amount:String(x.amount),paid:paidMap.get(String(x._id))||'0'})}))});
}catch(e){next(e);}});
router.post('/invoices',async(req,res,next)=>{try{
 if(!financeRoles.has(req.user.role))return res.status(403).json({message:'Supplier invoice access denied'});
 const org=orgFor(req,req.body.organisation),{supplier,purchaseRequest,invoiceNumber,invoiceDate,dueDate,amount,currency='KES',expenseAccount,payableAccount}=req.body;
 if(!mongoose.isValidObjectId(org)||!(await assertOrganisationAccess(req.user,org)))return res.status(403).json({message:'Organisation outside your authorised scope'});
 const validation=supplierInvoiceError({invoiceNumber,amount,invoiceDate,dueDate});
 if(validation||!mongoose.isValidObjectId(supplier)||!mongoose.isValidObjectId(expenseAccount)||!mongoose.isValidObjectId(payableAccount)||!validCurrency(currency))return res.status(400).json({message:validation||'Supplier, expense account, payable account and valid ISO currency are required'});
 const vendor=await Supplier.findOne({_id:supplier,organisation:org,status:'active'}).select('_id');
 if(!vendor)return res.status(400).json({message:'Select an active supplier in this organisation'});
 const accounts=await LedgerAccount.find({_id:{$in:[expenseAccount,payableAccount]},organisation:org,active:true});
 const expense=accounts.find(a=>String(a._id)===String(expenseAccount)),payable=accounts.find(a=>String(a._id)===String(payableAccount));
 if(!expense||expense.type!=='expense'||!payable||payable.type!=='liability')return res.status(400).json({message:'Invoice posting requires an active expense account and an active liability account from this organisation'});
 if(purchaseRequest){
  if(!mongoose.isValidObjectId(purchaseRequest))return res.status(400).json({message:'Invalid purchase request'});
  const po=await PurchaseRequest.findOne({_id:purchaseRequest,organisation:org,supplier,status:{$in:['approved','ordered']}}).populate('selectedQuote');
  if(!po)return res.status(400).json({message:'Linked purchase request must be approved and belong to this supplier'});
  if(String(po.currency)!==String(currency).toUpperCase()||moneyToMinor(amount)>moneyToMinor(String(po.selectedQuote?.amount||po.amount)))return res.status(400).json({message:'Invoice currency and amount must not exceed the approved purchase request'});
 }
 const invoice=await SupplierInvoice.create({organisation:org,supplier,purchaseRequest:purchaseRequest||null,invoiceNumber:String(invoiceNumber).trim(),invoiceDate:new Date(invoiceDate),dueDate:dueDate?new Date(dueDate):null,currency:String(currency).toUpperCase(),amount:asAmount(amount),expenseAccount,payableAccount,createdBy:req.user._id});
 await audit(req,org,'supplier_invoice_submit','supplier_invoice',invoice,'Submitted supplier invoice',{invoiceNumber,amount:asAmount(amount),currency});
 res.status(201).json({invoice});
}catch(e){next(e);}});
router.post('/invoices/:id/decision',async(req,res,next)=>{try{
 if(!approverRoles.has(req.user.role))return res.status(403).json({message:'Independent invoice approval permission required'});
 const decision=String(req.body.decision||''),note=String(req.body.note||'').trim().slice(0,500),ids=await scopedIds(req);
 const invoice=await SupplierInvoice.findOne({_id:req.params.id,organisation:{$in:ids}});
 if(!invoice)return res.status(404).json({message:'Supplier invoice not found'});
 const error=supplierDecisionError({status:invoice.status,decision,actorId:req.user._id,createdBy:invoice.createdBy,approvals:invoice.approvals||[]});
 if(error)return res.status(409).json({message:error});
 if(decision==='reject'&&!note)return res.status(400).json({message:'A rejection reason is required'});
 const policy=await resolveApprovalPolicy(invoice.organisation,'supplier_invoice',invoice.amount);
 if(policy&&!policy.approverRoles.includes(req.user.role))return res.status(403).json({message:'Your role is not authorised by the supplier invoice approval matrix'});
 if(!policy&&!approverRoles.has(req.user.role))return res.status(403).json({message:'Independent invoice approval permission required'});
 const progress=applyApprovalDecision({record:invoice,policy,actor:req.user,decision,note});
 if(progress.error)return res.status(409).json({message:progress.error});
 if(decision==='approve'&&!progress.complete){
  await invoice.save();
  await audit(req,invoice.organisation,'supplier_invoice_approve','supplier_invoice',invoice,'Supplier invoice approval recorded',{note,remainingApprovals:progress.remaining});
  return res.json({invoice,approvalProgress:{complete:false,remaining:progress.remaining}});
 }
 if(decision==='approve'){
  const expenseAccount=await LedgerAccount.findOne({_id:invoice.expenseAccount,organisation:invoice.organisation,active:true,type:'expense'});
  if(!expenseAccount)return res.status(409).json({message:'The invoice expense account is no longer active'});
  const budgets=await Budget.find({organisation:invoice.organisation,account:invoice.expenseAccount,fiscalYear:invoice.invoiceDate.getUTCFullYear(),status:'approved'}).lean();
  const applicable=selectApplicableBudget(budgets,invoice.invoiceDate);
  if(applicable){
   const range=budgetPeriodRange(invoice.invoiceDate,applicable.period);
   const journals=await JournalEntry.find({organisation:invoice.organisation,status:'posted',entryDate:{$gte:range.start,$lte:range.end},'lines.account':invoice.expenseAccount}).select('lines').lean();
   let posted=0n;
   for(const journal of journals)for(const line of journal.lines)if(String(line.account)===String(invoice.expenseAccount))posted+=(moneyToMinor(String(line.debit))||0n)-(moneyToMinor(String(line.credit))||0n);
   const decisionResult=budgetPostingDecision({budgetAmount:String(applicable.amount),postedAmount:(posted/100n).toString()+'.'+(posted%100n).toString().padStart(2,'0'),proposedAmount:String(invoice.amount)});
   if(!decisionResult.allowed)return res.status(409).json({message:'Approving this supplier invoice would exceed the approved expense budget',budget:decisionResult});
  }
  const existing=await JournalEntry.findOne({sourceType:'supplier_invoice',sourceId:invoice._id});
  if(!existing){
   const entry=await JournalEntry.create({organisation:invoice.organisation,entryNumber:'SI-'+String(invoice._id),entryDate:invoice.invoiceDate,description:'Supplier invoice '+invoice.invoiceNumber,status:'posted',lines:[{account:invoice.expenseAccount,debit:String(invoice.amount),credit:'0.00'},{account:invoice.payableAccount,debit:'0.00',credit:String(invoice.amount)}],createdBy:invoice.createdBy,approvedBy:req.user._id,postedAt:new Date(),sourceType:'supplier_invoice',sourceId:invoice._id});
   invoice.journalEntry=entry._id;
  }
  invoice.status='approved';invoice.approvedBy=req.user._id;invoice.approvedAt=new Date();
 }else { invoice.status='rejected';invoice.decidedBy=req.user._id;invoice.decisionNote=note; }
 await invoice.save();
 await audit(req,invoice.organisation,'supplier_invoice_'+decision,'supplier_invoice',invoice,'Supplier invoice '+invoice.status,{note,journalEntry:invoice.journalEntry||null});
 res.json({invoice});
}catch(e){if(e?.name==='VersionError')return res.status(409).json({message:'This record changed while you were processing it. Reload the latest record and retry.'});next(e);}});

router.get('/payments',async(req,res,next)=>{try{
 if(!financeRoles.has(req.user.role))return res.status(403).json({message:'Supplier payment access denied'});
 const ids=await scopedIds(req),filter={organisation:{$in:ids}};
 if(req.query.status)filter.status=String(req.query.status);
 const payments=await SupplierPayment.find(filter).populate({path:'invoice',populate:{path:'supplier',select:'name'}}).populate('createdBy','fullName').populate('approvedBy','fullName').populate('confirmedBy','fullName').populate('journalEntry','entryNumber').sort({createdAt:-1}).lean();
 res.json({payments});
}catch(e){next(e);}});
router.post('/payments',async(req,res,next)=>{try{
 if(!financeRoles.has(req.user.role))return res.status(403).json({message:'Supplier payment access denied'});
 const org=orgFor(req,req.body.organisation),{invoice,amount,paymentMethod='bank_transfer',reference}=req.body;
 if(!mongoose.isValidObjectId(org)||!(await assertOrganisationAccess(req.user,org)))return res.status(403).json({message:'Organisation outside your authorised scope'});
 if(!mongoose.isValidObjectId(invoice)||!['bank_transfer','cash','cheque','mpesa','other'].includes(paymentMethod))return res.status(400).json({message:'Valid invoice and payment method are required'});
 const bill=await SupplierInvoice.findOne({_id:invoice,organisation:org,status:{$in:['approved','partially_paid']}});
 if(!bill)return res.status(400).json({message:'Only approved invoices with an outstanding balance can be paid'});
 const paidRows=await SupplierPayment.aggregate([{$match:{invoice:bill._id,status:'paid'}},{$group:{_id:null,total:{$sum:{$toDecimal:'$amount'}}}}]);
 const paid=paidRows[0]?.total?String(paidRows[0].total):'0.00';
 const outstanding=(moneyToMinor(String(bill.amount))-moneyToMinor(paid));
 const amountMinor=moneyToMinor(amount);
 const error=supplierPaymentError({amount,outstanding:(outstanding/100n).toString()+'.'+(outstanding%100n).toString().padStart(2,'0'),requesterId:req.user._id});
 if(error)return res.status(400).json({message:error});
 const payment=await SupplierPayment.create({organisation:org,invoice:bill._id,amount:asAmount(amount),currency:bill.currency,paymentMethod,reference,createdBy:req.user._id});
 await audit(req,org,'supplier_payment_submit','supplier_payment',payment,'Submitted supplier payment',{invoice:bill.invoiceNumber,amount:asAmount(amount),currency:bill.currency});
 res.status(201).json({payment});
}catch(e){next(e);}});
router.post('/payments/:id/decision',async(req,res,next)=>{try{
 const decision=String(req.body.decision||''),note=String(req.body.note||'').trim().slice(0,500);
 if(!['approve','reject'].includes(decision)||!approverRoles.has(req.user.role))return res.status(403).json({message:'Independent supplier payment approval permission required'});
 const ids=await scopedIds(req),payment=await SupplierPayment.findOne({_id:req.params.id,organisation:{$in:ids}});
 if(!payment)return res.status(404).json({message:'Supplier payment not found'});
 const error=supplierDecisionError({status:payment.status,decision,actorId:req.user._id,createdBy:payment.createdBy,approvals:payment.approvals||[]});
 if(error)return res.status(409).json({message:error});
 if(decision==='reject'&&!note)return res.status(400).json({message:'A rejection reason is required'});
 const policy=await resolveApprovalPolicy(payment.organisation,'supplier_payment',payment.amount);
 if(policy&&!policy.approverRoles.includes(req.user.role))return res.status(403).json({message:'Your role is not authorised by the supplier payment approval matrix'});
 if(!policy&&!approverRoles.has(req.user.role))return res.status(403).json({message:'Independent supplier payment approval permission required'});
 const progress=applyApprovalDecision({record:payment,policy,actor:req.user,decision,note});
 if(progress.error)return res.status(409).json({message:progress.error});
 await payment.save();
 if(decision==='approve'&&!progress.complete){
  await audit(req,payment.organisation,'supplier_payment_approve','supplier_payment',payment,'Supplier payment approval recorded',{note,remainingApprovals:progress.remaining});
  return res.json({payment,approvalProgress:{complete:false,remaining:progress.remaining}});
 }
 await audit(req,payment.organisation,'supplier_payment_'+decision,'supplier_payment',payment,'Supplier payment '+payment.status,{note});
 res.json({payment});
}catch(e){if(e?.name==='VersionError')return res.status(409).json({message:'This record changed while you were processing it. Reload the latest record and retry.'});next(e);}});
router.post('/payments/:id/confirm',async(req,res,next)=>{try{
 if(!financeRoles.has(req.user.role))return res.status(403).json({message:'Supplier payment confirmation permission required'});
 const ids=await scopedIds(req),payment=await SupplierPayment.findOne({_id:req.params.id,organisation:{$in:ids}});
 if(!payment)return res.status(404).json({message:'Supplier payment not found'});
 if(payment.status!=='approved')return res.status(409).json({message:'Only approved supplier payments can be confirmed'});
 const invoice=await SupplierInvoice.findOne({_id:payment.invoice,organisation:payment.organisation});
 if(!invoice||!['approved','partially_paid'].includes(invoice.status))return res.status(409).json({message:'The linked invoice is not payable'});
 const rows=await SupplierPayment.aggregate([{$match:{invoice:invoice._id,status:'paid',_id:{$ne:payment._id}}},{$group:{_id:null,total:{$sum:{$toDecimal:'$amount'}}}}]);
 const paid=rows[0]?.total?String(rows[0].total):'0.00';
 const outstanding=moneyToMinor(String(invoice.amount))-moneyToMinor(paid);
 const error=supplierPaymentError({amount:String(payment.amount),outstanding:(outstanding/100n).toString()+'.'+(outstanding%100n).toString().padStart(2,'0'),requesterId:payment.createdBy,approverId:payment.approvedBy,confirmerId:req.user._id});
 if(error)return res.status(409).json({message:error});
 const bankAccount=req.body.bankAccount;
 if(!mongoose.isValidObjectId(bankAccount))return res.status(400).json({message:'Select the bank or cash asset account used for settlement'});
 const bank=await LedgerAccount.findOne({_id:bankAccount,organisation:payment.organisation,active:true,type:'asset'});
 const payable=await LedgerAccount.findOne({_id:invoice.payableAccount,organisation:payment.organisation,active:true,type:'liability'});
 if(!bank||!payable)return res.status(400).json({message:'Settlement requires an active asset account and the invoice liability account'});
 let journal=await JournalEntry.findOne({sourceType:'supplier_payment',sourceId:payment._id});
 if(!journal)journal=await JournalEntry.create({organisation:payment.organisation,entryNumber:'SP-'+String(payment._id),entryDate:new Date(),description:'Settlement of supplier invoice '+invoice.invoiceNumber,status:'posted',lines:[{account:payable._id,debit:String(payment.amount),credit:'0.00'},{account:bank._id,debit:'0.00',credit:String(payment.amount)}],createdBy:payment.createdBy,approvedBy:payment.approvedBy,postedAt:new Date(),sourceType:'supplier_payment',sourceId:payment._id});
 payment.status='paid';payment.confirmedBy=req.user._id;payment.confirmedAt=new Date();payment.journalEntry=journal._id;await payment.save();
 const totalPaid=moneyToMinor(paid)+moneyToMinor(String(payment.amount));
 invoice.status=invoicePaymentStatus({amount:String(invoice.amount),paid:(totalPaid/100n).toString()+'.'+(totalPaid%100n).toString().padStart(2,'0')});
 await invoice.save();
 await audit(req,payment.organisation,'supplier_payment_confirm','supplier_payment',payment,'Supplier payment confirmed and posted',{invoice:invoice.invoiceNumber,journalEntry:journal._id});
 res.json({payment,invoice,journalEntry:journal});
}catch(e){if(e?.name==='VersionError')return res.status(409).json({message:'This record changed while you were processing it. Reload the latest record and retry.'});next(e);}});
export default router;
