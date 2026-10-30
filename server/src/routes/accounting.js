import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth } from '../middleware/auth.js';
import { accessibleOrganisationIds, assertOrganisationAccess } from '../middleware/organisationScope.js';
import { LedgerAccount, JournalEntry, Budget, BankReconciliation, AuditLog } from '../models/domain.js';
import { Organisation } from '../models/index.js';
import { buildFinancialStatements } from '../domain/financialStatements.js';

const router=Router();
router.use(requireAuth);
const financeRoles=new Set(['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin','treasurer']);
const approvers=new Set(['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor']);
const cents=value=>{
 const text=String(value??'0');
 if(!/^\d+(?:\.\d{1,2})?$/.test(text))return null;
 const [whole,decimal='']=text.split('.');
 return BigInt(whole)*100n+BigInt((decimal+'00').slice(0,2));
};
const amountText=value=>{const negative=value<0n;const n=negative?-value:value;return (negative?'-':'')+(n/100n).toString()+'.'+(n%100n).toString().padStart(2,'0');};
const canFinance=req=>financeRoles.has(req.user.role);

router.get('/statements',async(req,res,next)=>{try{
 if(!canFinance(req))return res.status(403).json({message:'Finance access denied'});
 const accessibleIds=await accessibleOrganisationIds(req.user);
 let organisationsFilter={_id:{$in:accessibleIds},status:{$ne:'archived'}};
 if(req.query.organisation){
  if(!mongoose.isValidObjectId(req.query.organisation)||!accessibleIds.some(id=>String(id)===String(req.query.organisation)))return res.status(403).json({message:'Organisation outside your authorised scope'});
  organisationsFilter={_id:req.query.organisation,status:{$ne:'archived'}};
 }
 const now=new Date();
 const fromText=String(req.query.from||`${now.getUTCFullYear()}-01-01`);
 const toText=String(req.query.to||now.toISOString().slice(0,10));
 const validDate=value=>/^\d{4}-\d{2}-\d{2}$/.test(value)&&!Number.isNaN(new Date(value+'T00:00:00.000Z').getTime())&&new Date(value+'T00:00:00.000Z').toISOString().slice(0,10)===value;
 if(!validDate(fromText)||!validDate(toText)||fromText>toText)return res.status(400).json({message:'Use valid from/to dates in YYYY-MM-DD format with from on or before to'});
 const fromDate=new Date(fromText+'T00:00:00.000Z');
 const toDate=new Date(toText+'T23:59:59.999Z');
 const organisations=await Organisation.find(organisationsFilter).select('name code currency').sort({name:1}).lean();
 const organisationIds=organisations.map(org=>org._id);
 const [accounts,ledgerTotals]=await Promise.all([
  LedgerAccount.find({organisation:{$in:organisationIds}}).select('organisation code name type').sort({code:1}).lean(),
  JournalEntry.aggregate([
   {$match:{organisation:{$in:organisationIds},status:'posted',entryDate:{$lte:toDate}}},
   {$unwind:'$lines'},
   {$group:{_id:{organisation:'$organisation',account:'$lines.account'},debit:{$sum:'$lines.debit'},credit:{$sum:'$lines.credit'},periodDebit:{$sum:{$cond:[{$gte:['$entryDate',fromDate]},'$lines.debit',{$toDecimal:'0'}]}},periodCredit:{$sum:{$cond:[{$gte:['$entryDate',fromDate]},'$lines.credit',{$toDecimal:'0'}]}}}}
  ])
 ]);
 const statements=buildFinancialStatements({organisations,accounts,ledgerTotals,from:fromText,to:toText});
 res.set('Cache-Control','no-store');
 res.json({statements,generatedAt:new Date().toISOString(),source:'posted_journals_only'});
}catch(error){next(error);}});

router.get('/accounts',async(req,res,next)=>{try{
 if(!canFinance(req))return res.status(403).json({message:'Finance access denied'});
 const ids=await accessibleOrganisationIds(req.user);
 const accounts=await LedgerAccount.find({organisation:{$in:ids}}).populate('parent','code name').sort({code:1}).lean();
 res.json({accounts});
}catch(e){next(e);}});
router.post('/accounts',async(req,res,next)=>{try{
 if(!canFinance(req))return res.status(403).json({message:'Finance access denied'});
 const {organisation,code,name,type,normalBalance,parent}=req.body;
 const org=organisation||(req.user.organisation?._id??req.user.organisation);
 if(!mongoose.isValidObjectId(org)||!(await assertOrganisationAccess(req.user,org)))return res.status(403).json({message:'Organisation outside your authorised scope'});
 if(!String(code||'').trim()||!String(name||'').trim()||!['asset','liability','equity','income','expense'].includes(type))return res.status(400).json({message:'Account code, name and valid account type are required'});
 const balance=normalBalance||(['asset','expense'].includes(type)?'debit':'credit');
 if(!['debit','credit'].includes(balance))return res.status(400).json({message:'Invalid normal balance'});
 if(parent){const p=await LedgerAccount.findOne({_id:parent,organisation:org});if(!p)return res.status(400).json({message:'Parent account must belong to this organisation'});}
 const account=await LedgerAccount.create({organisation:org,code:String(code).trim(),name:String(name).trim(),type,normalBalance:balance,parent:parent||null});
 await AuditLog.create({organisation:org,actor:req.user._id,action:'create',entity:'ledger_account',recordId:account._id,summary:'Created account '+account.code+' '+account.name});
 res.status(201).json({account});
}catch(e){next(e);}});
router.post('/accounts/seed-defaults',async(req,res,next)=>{try{
 if(!canFinance(req))return res.status(403).json({message:'Finance access denied'});
 const org=req.body.organisation||(req.user.organisation?._id??req.user.organisation);
 if(!mongoose.isValidObjectId(org)||!(await assertOrganisationAccess(req.user,org)))return res.status(403).json({message:'Organisation outside your authorised scope'});
 const defaults=[
  ['1000','Cash on Hand','asset','debit'],['1010','Bank Account','asset','debit'],['1020','M-Pesa Clearing','asset','debit'],['1100','Accounts Receivable','asset','debit'],
  ['2000','Accounts Payable','liability','credit'],['2100','Restricted Funds Payable','liability','credit'],['3000','Accumulated Fund','equity','credit'],
  ['4000','Tithes','income','credit'],['4010','Offerings','income','credit'],['4020','Donations','income','credit'],['4030','Missions Giving','income','credit'],['4090','Other Income','income','credit'],
  ['5000','Staff and Ministry Allowances','expense','debit'],['5010','Worship and Ministry','expense','debit'],['5020','Missions and Evangelism','expense','debit'],['5030','Utilities','expense','debit'],['5040','Rent and Facilities','expense','debit'],['5050','Benevolence and Welfare','expense','debit'],['5060','Transport','expense','debit'],['5070','Repairs and Maintenance','expense','debit'],['5080','Administration','expense','debit']
 ];
 const result=await LedgerAccount.bulkWrite(defaults.map(([code,name,type,normalBalance])=>({updateOne:{filter:{organisation:org,code},update:{$setOnInsert:{organisation:org,code,name,type,normalBalance,active:true,system:true}},upsert:true}})));
 await AuditLog.create({organisation:org,actor:req.user._id,action:'seed',entity:'ledger_account',summary:'Installed standard NCBI chart of accounts'});
 const accounts=await LedgerAccount.find({organisation:org}).sort({code:1}).lean();
 res.json({created:result.upsertedCount||0,accounts});
}catch(e){next(e);}});
router.patch('/accounts/:id/status',async(req,res,next)=>{try{
 if(!canFinance(req))return res.status(403).json({message:'Finance access denied'});
 if(typeof req.body.active!=='boolean')return res.status(400).json({message:'Active must be true or false'});
 const ids=await accessibleOrganisationIds(req.user);
 const account=await LedgerAccount.findOne({_id:req.params.id,organisation:{$in:ids}});
 if(!account)return res.status(404).json({message:'Account not found'});
 account.active=req.body.active;await account.save();res.json({account});
}catch(e){next(e);}});

router.get('/journals',async(req,res,next)=>{try{
 if(!canFinance(req))return res.status(403).json({message:'Finance access denied'});
 const ids=await accessibleOrganisationIds(req.user);
 const journals=await JournalEntry.find({organisation:{$in:ids}}).sort({entryDate:-1,createdAt:-1}).limit(200).populate('lines.account','code name type').populate('createdBy','fullName').populate('approvedBy','fullName').lean();
 res.json({journals});
}catch(e){next(e);}});
router.post('/journals',async(req,res,next)=>{try{
 if(!canFinance(req))return res.status(403).json({message:'Finance access denied'});
 const {organisation,entryNumber,entryDate,description,lines}=req.body;
 const org=organisation||(req.user.organisation?._id??req.user.organisation);
 if(!mongoose.isValidObjectId(org)||!(await assertOrganisationAccess(req.user,org)))return res.status(403).json({message:'Organisation outside your authorised scope'});
 if(!String(entryNumber||'').trim()||!String(description||'').trim()||!Array.isArray(lines)||lines.length<2||!entryDate||Number.isNaN(new Date(entryDate).getTime()))return res.status(400).json({message:'Entry number, date, description and at least two lines are required'});
 let debitTotal=0n,creditTotal=0n;
 const normalized=[];
 for(const line of lines){
  const debit=cents(line.debit||'0'),credit=cents(line.credit||'0');
  if(!mongoose.isValidObjectId(line.account)||debit===null||credit===null||((debit>0n)===(credit>0n)))return res.status(400).json({message:'Each journal line must have one positive debit or credit and a valid account'});
  debitTotal+=debit;creditTotal+=credit;normalized.push({account:line.account,debit:amountText(debit),credit:amountText(credit),memo:String(line.memo||'').slice(0,180)});
 }
 if(debitTotal===0n||debitTotal!==creditTotal)return res.status(400).json({message:'Journal entry must balance with equal positive debits and credits'});
 const accountIds=[...new Set(normalized.map(line=>String(line.account)))];
 const accounts=await LedgerAccount.find({_id:{$in:accountIds},organisation:org,active:true}).select('_id');
 if(accounts.length!==accountIds.length)return res.status(400).json({message:'Every account must be active and belong to the selected organisation'});
 const journal=await JournalEntry.create({organisation:org,entryNumber:String(entryNumber).trim(),entryDate:new Date(entryDate),description:String(description).trim(),lines:normalized,createdBy:req.user._id,status:'submitted'});
 await AuditLog.create({organisation:org,actor:req.user._id,action:'submit',entity:'journal_entry',recordId:journal._id,summary:'Submitted journal '+journal.entryNumber});
 res.status(201).json({journal});
}catch(e){next(e);}});
router.post('/journals/:id/post',async(req,res,next)=>{try{
 if(!approvers.has(req.user.role))return res.status(403).json({message:'Independent finance approval permission required'});
 const ids=await accessibleOrganisationIds(req.user);
 const journal=await JournalEntry.findOne({_id:req.params.id,organisation:{$in:ids}});
 if(!journal)return res.status(404).json({message:'Journal entry not found'});
 if(String(journal.createdBy)===String(req.user._id))return res.status(403).json({message:'The creator cannot post their own journal'});
 if(journal.status!=='submitted')return res.status(409).json({message:'Only submitted journal entries can be posted'});
 journal.status='posted';journal.approvedBy=req.user._id;journal.postedAt=new Date();await journal.save();
 await AuditLog.create({organisation:journal.organisation,actor:req.user._id,action:'post',entity:'journal_entry',recordId:journal._id,summary:'Posted journal '+journal.entryNumber});
 res.json({journal});
}catch(e){next(e);}});
router.post('/journals/:id/reject',async(req,res,next)=>{try{
 if(!approvers.has(req.user.role))return res.status(403).json({message:'Independent finance approval permission required'});
 const ids=await accessibleOrganisationIds(req.user);const journal=await JournalEntry.findOne({_id:req.params.id,organisation:{$in:ids}});
 if(!journal)return res.status(404).json({message:'Journal entry not found'});
 if(String(journal.createdBy)===String(req.user._id))return res.status(403).json({message:'The creator cannot reject their own journal'});
 if(journal.status!=='submitted')return res.status(409).json({message:'Only submitted journal entries can be rejected'});
 journal.status='rejected';journal.approvedBy=req.user._id;await journal.save();res.json({journal});
}catch(e){next(e);}});

router.get('/budgets',async(req,res,next)=>{try{
 if(!canFinance(req))return res.status(403).json({message:'Finance access denied'});
 const ids=await accessibleOrganisationIds(req.user);const filter={organisation:{$in:ids}};
 if(req.query.year)filter.fiscalYear=Number(req.query.year);
 const budgets=await Budget.find(filter).populate('account','code name type').populate('organisation','name code').sort({fiscalYear:-1,period:1}).lean();
 res.json({budgets});
}catch(e){next(e);}});
router.post('/budgets',async(req,res,next)=>{try{
 if(!canFinance(req))return res.status(403).json({message:'Finance access denied'});
 const {organisation,account,fiscalYear,period='annual',amount,notes}=req.body;
 const org=organisation||(req.user.organisation?._id??req.user.organisation);
 const value=cents(amount);
 if(!mongoose.isValidObjectId(org)||!(await assertOrganisationAccess(req.user,org)))return res.status(403).json({message:'Organisation outside your authorised scope'});
 if(!mongoose.isValidObjectId(account)||!Number.isInteger(Number(fiscalYear))||value===null||value<=0n)return res.status(400).json({message:'Valid account, fiscal year and positive budget are required'});
 const ledger=await LedgerAccount.findOne({_id:account,organisation:org,type:'expense',active:true});
 if(!ledger)return res.status(400).json({message:'Budget must be assigned to an active expense account'});
 const budget=await Budget.create({organisation:org,account,fiscalYear:Number(fiscalYear),period,amount:amountText(value),notes,createdBy:req.user._id});
 res.status(201).json({budget});
}catch(e){next(e);}});

router.get('/reconciliations',async(req,res,next)=>{try{
 if(!canFinance(req))return res.status(403).json({message:'Finance access denied'});
 const ids=await accessibleOrganisationIds(req.user);const reconciliations=await BankReconciliation.find({organisation:{$in:ids}}).populate('bankAccount','code name').populate('reconciledBy','fullName').sort({statementDate:-1}).lean();
 res.json({reconciliations});
}catch(e){next(e);}});
router.post('/reconciliations',async(req,res,next)=>{try{
 if(!canFinance(req))return res.status(403).json({message:'Finance access denied'});
 const {organisation,bankAccount,statementDate,statementBalance,notes}=req.body;
 const org=organisation||(req.user.organisation?._id??req.user.organisation),balance=cents(statementBalance);
 if(!mongoose.isValidObjectId(org)||!(await assertOrganisationAccess(req.user,org)))return res.status(403).json({message:'Organisation outside your authorised scope'});
 if(!mongoose.isValidObjectId(bankAccount)||!statementDate||Number.isNaN(new Date(statementDate).getTime())||balance===null)return res.status(400).json({message:'Bank account, statement date and valid statement balance are required'});
 const account=await LedgerAccount.findOne({_id:bankAccount,organisation:org,type:'asset',active:true});
 if(!account)return res.status(400).json({message:'Select an active asset account representing the bank balance'});
 const reconciliation=await BankReconciliation.create({organisation:org,bankAccount,statementDate:new Date(statementDate),statementBalance:amountText(balance),notes});
 res.status(201).json({reconciliation});
}catch(e){next(e);}});
router.post('/reconciliations/:id/reconcile',async(req,res,next)=>{try{
 if(!approvers.has(req.user.role))return res.status(403).json({message:'Independent finance approval permission required'});
 const ids=await accessibleOrganisationIds(req.user);const reconciliation=await BankReconciliation.findOne({_id:req.params.id,organisation:{$in:ids}});
 if(!reconciliation)return res.status(404).json({message:'Reconciliation not found'});
 if(reconciliation.status==='reconciled')return res.status(409).json({message:'This statement is already reconciled'});
 const cutoff=new Date(reconciliation.statementDate);cutoff.setUTCHours(23,59,59,999);const journals=await JournalEntry.find({organisation:reconciliation.organisation,status:'posted',entryDate:{$lte:cutoff},'lines.account':reconciliation.bankAccount}).select('lines').lean();
 let book=0n;
 for(const journal of journals)for(const line of journal.lines)if(String(line.account)===String(reconciliation.bankAccount)){book+=(cents(line.debit)||0n)-(cents(line.credit)||0n);}
 const statement=cents(reconciliation.statementBalance);
 reconciliation.bookBalance=amountText(book);reconciliation.difference=amountText(statement-book);
 if(statement!==book){await reconciliation.save();return res.status(409).json({message:'Statement does not reconcile to posted ledger balance',bookBalance:amountText(book),difference:amountText(statement-book)});}
 reconciliation.status='reconciled';reconciliation.reconciledBy=req.user._id;reconciliation.reconciledAt=new Date();await reconciliation.save();
 res.json({reconciliation});
}catch(e){next(e);}});
export default router;
