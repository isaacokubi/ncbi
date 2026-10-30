import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { Organisation, Member, Attendance, FinanceTransaction, User } from '../models/index.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { accessibleOrganisationIds, assertOrganisationAccess } from '../middleware/organisationScope.js';
import { validateAttendanceInput } from '../domain/attendancePolicy.js';
import { SequenceCounter, AuditLog } from '../models/domain.js';
import { attendanceWorkspaceFilter } from '../domain/dashboardPolicy.js';
import { passwordLengthError } from '../domain/authPolicy.js';
import { memberTransferError } from '../domain/memberTransferPolicy.js';

const router = Router(); router.use(requireAuth);
const roleRank={super_admin:100,international_executive:90,national_admin:80,regional_overseer:70,district_pastor:60,branch_pastor:50,branch_admin:45,treasurer:35,department_leader:25,member:10};
const userManagers=['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin'];
router.get('/users',async(req,res,next)=>{
 try{
  if(!userManagers.includes(req.user.role))return res.status(403).json({message:'User administration permission required'});
  const ids=await accessibleOrganisationIds(req.user);
  const users=await User.find({organisation:{$in:ids}}).select('fullName email role organisation active createdAt').populate('organisation','name code level').sort({createdAt:-1}).lean();
  res.json({users});
 }catch(e){next(e);}
});
router.post('/users',async(req,res,next)=>{
 try{
  if(!userManagers.includes(req.user.role))return res.status(403).json({message:'User administration permission required'});
  const {fullName,email,password,role,organisation,memberProfile}=req.body;
  if(!fullName||!email||!password||!role||!organisation)return res.status(400).json({message:'Name, email, temporary password, role and organisation are required'});
  const passwordError=passwordLengthError(password,'Temporary password');
  if(passwordError)return res.status(400).json({message:passwordError});
  if(!Object.hasOwn(roleRank,role)||roleRank[role]>=roleRank[req.user.role])return res.status(403).json({message:'You cannot assign a role equal to or above your own authority'});
  if(!(await assertOrganisationAccess(req.user,organisation)))return res.status(403).json({message:'Organisation outside your authorised scope'});
  const org=await Organisation.findById(organisation);
  const allowedLevels={international_executive:['international'],national_admin:['national'],regional_overseer:['regional'],district_pastor:['district'],branch_pastor:['branch'],branch_admin:['branch'],treasurer:['branch','district','regional','national'],department_leader:['branch','district','regional','national'],member:['branch','district','regional','national']};
  if(allowedLevels[role]&&!allowedLevels[role].includes(org?.level))return res.status(400).json({message:'The selected role is not valid at this organisation level'});
  if(role==='member'&&!memberProfile)return res.status(400).json({message:'A member account must be linked to an existing member profile'});
  if(memberProfile){
    if(role!=='member')return res.status(400).json({message:'Only member accounts can be linked to a member profile'});
    const linked=await Member.findOne({_id:memberProfile,homeOrganisation:organisation}).select('_id').lean();
    if(!linked)return res.status(400).json({message:'The selected member profile must belong to the same organisation'});
    const alreadyLinked=await User.findOne({memberProfile}).select('_id').lean();
    if(alreadyLinked)return res.status(409).json({message:'This member profile already has a portal account'});
  }
  const passwordHash=await bcrypt.hash(String(password),12);
  const user=await User.create({fullName:String(fullName).trim(),email:String(email).trim().toLowerCase(),passwordHash,role,organisation,memberProfile:memberProfile||null,active:true});
  res.status(201).json({user:{id:user.id,fullName:user.fullName,email:user.email,role:user.role,organisation:user.organisation,active:user.active}});
 }catch(e){next(e);}
});
router.patch('/users/:id/status',async(req,res,next)=>{
 try{
  if(!userManagers.includes(req.user.role))return res.status(403).json({message:'User administration permission required'});
  if(typeof req.body.active!=='boolean')return res.status(400).json({message:'Active must be true or false'});
  const ids=await accessibleOrganisationIds(req.user);
  const target=await User.findOne({_id:req.params.id,organisation:{$in:ids}});
  if(!target)return res.status(404).json({message:'User not found'});
  if(String(target._id)===String(req.user._id))return res.status(409).json({message:'You cannot deactivate your own account'});
  if(roleRank[target.role]>=roleRank[req.user.role])return res.status(403).json({message:'You cannot change an account at or above your authority'});
  target.active=req.body.active;await target.save();
  res.json({user:{id:target.id,fullName:target.fullName,email:target.email,role:target.role,active:target.active}});
 }catch(e){next(e);}
});
router.get('/organisations', async (req,res,next)=>{
  try { const ids=await accessibleOrganisationIds(req.user); const organisations=await Organisation.find({_id:{$in:ids}}).sort({level:1,name:1}).lean(); res.json({organisations}); }
  catch(e){next(e);}
});
router.post('/organisations',allowRoles('super_admin','international_executive','national_admin','regional_overseer','district_pastor'),async(req,res,next)=>{
  try{
    const {name,code,level,parent,country,currency,contactEmail,phone}=req.body;
    const levels=['international','national','regional','district','branch'];
    if(!name||!code||!levels.includes(level)) return res.status(400).json({message:'Name, code and valid level are required'});
    if(level==='international'&& !['super_admin','international_executive'].includes(req.user.role)) return res.status(403).json({message:'Only international leadership can create the top organisation'});
    if(level!=='international'){
      if(!parent||!(await assertOrganisationAccess(req.user,parent))) return res.status(403).json({message:'Parent organisation outside your authorised scope'});
      const parentOrg=await Organisation.findById(parent);
      const expected=levels[levels.indexOf(level)-1];
      if(!parentOrg||parentOrg.level!==expected) return res.status(400).json({message:`${level} must be created under a ${expected} organisation`});
    }
    const organisation=await Organisation.create({name,code,level,parent:parent||null,country,currency,contactEmail,phone,status:'pending'});
    res.status(201).json({organisation});
  }catch(e){next(e);}
});
router.patch('/organisations/:id/status',allowRoles('super_admin','international_executive','national_admin'),async(req,res,next)=>{
  try{
    if(!['active','suspended','archived'].includes(req.body.status)) return res.status(400).json({message:'Invalid organisation status'});
    if(!(await assertOrganisationAccess(req.user,req.params.id))) return res.status(403).json({message:'Organisation outside your authorised scope'});
    const organisation=await Organisation.findByIdAndUpdate(req.params.id,{status:req.body.status},{new:true,runValidators:true});
    if(!organisation) return res.status(404).json({message:'Organisation not found'});
    res.json({organisation});
  }catch(e){next(e);}
});
router.get('/members',async(req,res,next)=>{
  try{const ids=await accessibleOrganisationIds(req.user);const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(1,Number(req.query.limit)||25));const filter={homeOrganisation:{$in:ids}};if(req.query.status)filter.status=req.query.status;const [members,total]=await Promise.all([Member.find(filter).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).lean(),Member.countDocuments(filter)]);res.json({members,pagination:{page,limit,total,pages:Math.ceil(total/limit)}});}
  catch(e){next(e);}
});
router.post('/members',async(req,res,next)=>{
  try{if(!['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin'].includes(req.user.role))return res.status(403).json({message:'Membership registration permission required'});const {firstName,lastName,phone,email,status,profilePhotoUrl,residentialLocation,emergencyContactName,emergencyContactRelationship,emergencyContactPhone,householdReference,baptisedAt,baptismChurch}=req.body;if(!firstName||!lastName)return res.status(400).json({message:'First and last name are required'});const organisationId=req.user.organisation._id??req.user.organisation;
    const memberStatus=status||'visitor';
    let membershipNumber;
    if(memberStatus!=='visitor'){
      const organisation=await Organisation.findById(organisationId).select('code').lean();
      if(!organisation)return res.status(409).json({message:'Member organisation is unavailable'});
      const sequence=await SequenceCounter.findOneAndUpdate({key:'membership:'+String(organisationId)},{$inc:{value:1}},{new:true,upsert:true,setDefaultsOnInsert:true});
      membershipNumber='NCBI-'+organisation.code+'-'+String(sequence.value).padStart(6,'0');
    }
    const member=await Member.create({firstName,lastName,phone,email,status:memberStatus,membershipNumber,profilePhotoUrl,residentialLocation,emergencyContactName,emergencyContactRelationship,emergencyContactPhone,householdReference,baptisedAt,baptismChurch,homeOrganisation:organisationId});res.status(201).json({member});}
  catch(e){next(e);}
});
router.post('/members/:id/convert',async(req,res,next)=>{
  try{
    if(!['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin'].includes(req.user.role))return res.status(403).json({message:'Visitor conversion permission required'});
    const ids=await accessibleOrganisationIds(req.user);
    const member=await Member.findOne({_id:req.params.id,homeOrganisation:{$in:ids}});
    if(!member)return res.status(404).json({message:'Visitor not found'});
    if(member.status!=='visitor')return res.status(409).json({message:'Only visitor records can be converted'});
    const nextStatus=req.body.status||'new_believer';
    if(!['new_believer','member'].includes(nextStatus))return res.status(400).json({message:'Conversion status must be new_believer or member'});
    const organisation=await Organisation.findById(member.homeOrganisation).select('code').lean();
    if(!organisation)return res.status(409).json({message:'The member organisation is unavailable'});
    const sequence=await SequenceCounter.findOneAndUpdate(
      {key:'membership:'+String(member.homeOrganisation)},
      {$inc:{value:1}},
      {new:true,upsert:true,setDefaultsOnInsert:true}
    );
    member.membershipNumber=member.membershipNumber||('NCBI-'+organisation.code+'-'+String(sequence.value).padStart(6,'0'));
    member.status=nextStatus;
    member.joinedAt=member.joinedAt||new Date();
    await member.save();
    await AuditLog.create({organisation:member.homeOrganisation,actor:req.user._id,action:'visitor-converted',entity:'member',recordId:member._id,summary:'Visitor converted to '+nextStatus,metadata:{membershipNumber:member.membershipNumber}});
    res.json({member});
  }catch(e){next(e);}
});
router.patch('/members/:id',async(req,res,next)=>{
  try{
    const ids=await accessibleOrganisationIds(req.user);
    const member=await Member.findOne({_id:req.params.id,homeOrganisation:{$in:ids}});
    if(!member)return res.status(404).json({message:'Member not found'});
    if(!['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin'].includes(req.user.role))return res.status(403).json({message:'Membership update permission required'});
    for(const key of ['firstName','lastName','phone','email','dateOfBirth','gender','status','joinedAt','ministries','assignedPastor','profilePhotoUrl','residentialLocation','emergencyContactName','emergencyContactRelationship','emergencyContactPhone','householdReference','baptisedAt','baptismChurch']) if(req.body[key]!==undefined) member[key]=req.body[key];
    await member.save();
    res.json({member});
  }catch(e){next(e);}
});
router.get('/attendance',async(req,res,next)=>{
  try{
    const ids=await accessibleOrganisationIds(req.user);
    const page=Math.max(1,Number(req.query.page)||1),limit=Math.min(100,Math.max(1,Number(req.query.limit)||25));
    const filter=attendanceWorkspaceFilter(req.user,ids);
    if(req.query.from||req.query.to)filter.heldAt={...(req.query.from?{$gte:new Date(req.query.from)}:{}),...(req.query.to?{$lte:new Date(req.query.to)}:{})};
    if(req.query.activity){const safe=String(req.query.activity).slice(0,80).replace(/[^a-z0-9 ]/gi,'');filter.activityName={$regex:safe,$options:'i'};}
    const [records,total]=await Promise.all([Attendance.find(filter).sort({heldAt:-1}).skip((page-1)*limit).limit(limit).populate('member','firstName lastName membershipNumber').populate('organisation','name code').populate('recordedBy','fullName').lean(),Attendance.countDocuments(filter)]);
    res.json({attendance:records,pagination:{page,limit,total,pages:Math.ceil(total/limit)}});
  }catch(e){next(e);}
});
router.post('/members/:id/transfer',allowRoles('super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor'),async(req,res,next)=>{
  try {
    const { toOrganisation, note } = req.body;
    if (!toOrganisation || !(await assertOrganisationAccess(req.user, toOrganisation))) return res.status(403).json({ message: 'Destination outside your authorised scope' });
    const member = await Member.findById(req.params.id);
    if (!member || !(await assertOrganisationAccess(req.user, member.homeOrganisation))) return res.status(404).json({ message: 'Member not found' });
    const destination = await Organisation.findById(toOrganisation).select('_id level status name code').lean();
    const actorOrganisation = req.user.organisation?._id ?? req.user.organisation;
    const transferError = memberTransferError({ member, destination, actorOrganisation });
    if (transferError) return res.status(409).json({ message: transferError });
    const sourceOrganisation = member.homeOrganisation;
    member.transferHistory.push({ from: sourceOrganisation, to: destination._id, approvedBy: req.user._id, transferredAt: new Date(), note: String(note || '').trim().slice(0, 500) });
    member.homeOrganisation = destination._id;
    await member.save();
    await User.updateOne({ memberProfile: member._id, role: 'member' }, { $set: { organisation: destination._id } });
    await AuditLog.create({ organisation: sourceOrganisation, actor: req.user._id, action: 'member.transferred', entity: 'member', recordId: member._id, summary: 'Member transferred to ' + destination.name, metadata: { from: String(sourceOrganisation), to: String(destination._id) } });
    res.json({ member });
  } catch (e) { next(e); }
});
router.post('/attendance',async(req,res,next)=>{
  try{
    if(!['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin','department_leader'].includes(req.user.role))return res.status(403).json({message:'Attendance recording permission required'});
    const validation=validateAttendanceInput(req.body);
    if(!validation.valid)return res.status(400).json({message:validation.message});
    const org=req.body.organisation||(req.user.organisation?._id??req.user.organisation);
    if(!(await assertOrganisationAccess(req.user,org)))return res.status(403).json({message:'Organisation outside your authorised scope'});
    const {member}=validation.value;
    if(member){
      const allowed=await Member.findOne({_id:member,homeOrganisation:org}).select('_id').lean();
      if(!allowed)return res.status(403).json({message:'Member must belong to the selected attendance organisation'});
    }
    const attendance=await Attendance.create({...validation.value,organisation:org,recordedBy:req.user._id});
    res.status(201).json({attendance});
  }catch(e){next(e);}
});
router.get('/attendance/summary',async(req,res,next)=>{
  try{const ids=await accessibleOrganisationIds(req.user);const month=new Date();month.setDate(1);month.setHours(0,0,0,0);const [members,attendance,transactions]=await Promise.all([Member.countDocuments({homeOrganisation:{$in:ids},status:{$in:['member','worker','minister']}}),Attendance.countDocuments({organisation:{$in:ids},heldAt:{$gte:month}}),FinanceTransaction.aggregate([{$match:{organisation:{$in:ids},status:'confirmed',direction:'income',occurredAt:{$gte:month}}},{$group:{_id:'$currency',total:{$sum:{$toDouble:'$amount'}}}}])]);res.json({members,attendanceRecordsThisMonth:attendance,confirmedIncomeThisMonth:transactions});}
  catch(e){next(e);}
});
export default router;
