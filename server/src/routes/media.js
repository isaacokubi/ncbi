import { Router, raw } from 'express';
import rateLimit from 'express-rate-limit';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { OperationsRecord, MediaAsset, AuditLog } from '../models/domain.js';
import { requireAuth } from '../middleware/auth.js';
import { uploadChurchMedia, churchMediaDeliveryUrl } from '../services/cloudinary.js';
import { accessibleOrganisationIds, assertOrganisationAccess } from '../middleware/organisationScope.js';

const router = Router();
const managers = new Set(['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin']);
const headquarters = new Set(['super_admin','international_executive','national_admin']);
const reviewers = new Set(['super_admin','international_executive','national_admin','regional_overseer']);
const MAX_VIDEO_BYTES = 100 * 1024 * 1024;
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_AUDIO_BYTES = 50 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 25 * 1024 * 1024;
const upload = raw({ type: 'application/octet-stream', limit: MAX_VIDEO_BYTES });
const mediaUploadLimit = rateLimit({ windowMs: 15 * 60 * 1000, limit: 20, standardHeaders: true, legacyHeaders: false, message: { message: 'Too many media uploads. Please try again later.' } });
const signatures = {
 'image/jpeg': b => b[0]===255 && b[1]===216 && b[2]===255,
 'image/png': b => b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])),
 'image/webp': b => b.subarray(0,4).toString()==='RIFF' && b.subarray(8,12).toString()==='WEBP',
 'video/mp4': b => b.length>12 && b.subarray(4,8).toString()==='ftyp',
 'video/webm': b => b.length>4 && b.subarray(0,4).equals(Buffer.from([0x1a,0x45,0xdf,0xa3])),
 'audio/mpeg': b => b.length>3 && (b.subarray(0,3).toString()==='ID3'||(b[0]===255&&(b[1]&0xe0)===0xe0)),
 'audio/mp4': b => b.length>12 && b.subarray(4,8).toString()==='ftyp',
 'audio/wav': b => b.length>12 && b.subarray(0,4).toString()==='RIFF' && b.subarray(8,12).toString()==='WAVE',
 'audio/ogg': b => b.length>4 && b.subarray(0,4).toString()==='OggS',
 'application/pdf': b => b.length>5 && b.subarray(0,5).toString()==='%PDF-'
};
const extensions = {'image/jpeg':'.jpg','image/png':'.png','image/webp':'.webp','video/mp4':'.mp4','video/webm':'.webm','audio/mpeg':'.mp3','audio/mp4':'.m4a','audio/wav':'.wav','audio/ogg':'.ogg','application/pdf':'.pdf'};
function safeName(value,ext){const base=path.basename(String(value||'church-media')).replace(/[\r\n"]/g,'').replace(/[^a-zA-Z0-9._ -]/g,'_').slice(0,110);return (base.replace(/\.[^.]*$/,'')||'church-media')+ext;}
export function parseByteRange(header,size){
 if(!header)return null;
 const match=/^bytes=(\d*)-(\d*)$/.exec(String(header).trim());
 if(!match||(!match[1]&&!match[2])||!Number.isSafeInteger(size)||size<1)return {invalid:true};
 let start,end;
 if(!match[1]){const suffix=Number(match[2]);if(!Number.isSafeInteger(suffix)||suffix<1)return {invalid:true};start=Math.max(0,size-suffix);end=size-1;}
 else{start=Number(match[1]);end=match[2]?Number(match[2]):size-1;if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||end<start)return {invalid:true};end=Math.min(end,size-1);}
 return {start,end};
}
async function sendMedia(res,asset,{inline=true,publicAccess=false}={}){
 res.set({'X-Content-Type-Options':'nosniff','Cache-Control':publicAccess?'public, max-age=300':'private, no-store'});
 if(asset.provider==='cloudinary'&&asset.cloudinaryPublicId){
  const url=churchMediaDeliveryUrl(asset);
  if(!url)return res.status(404).json({message:'Media is not available'});
  return res.redirect(302,url);
 }
 // Backward compatibility for previously uploaded files on the persistent disk.
 const root=path.resolve(process.env.CHURCH_MEDIA_STORAGE_DIR||process.env.DOCUMENT_STORAGE_DIR||'');
 if(!root||!path.isAbsolute(root))return res.status(503).json({message:'Legacy media storage is not configured'});
 const target=path.resolve(root,asset.storageKey);
 if(path.dirname(target)!==root)return res.status(404).json({message:'Media not found'});
 const bytes=await readFile(target);
 if(bytes.length!==asset.size||createHash('sha256').update(bytes).digest('hex')!==asset.checksum)return res.status(404).json({message:'Media integrity verification failed'});
 const etag='"'+asset.checksum+'"';
 res.set({'Content-Type':asset.mimeType,'Content-Disposition':(inline?'inline':'attachment')+'; filename="'+safeName(asset.originalName,extensions[asset.mimeType])+'"','Accept-Ranges':'bytes','ETag':etag});
 let range=parseByteRange(res.req.headers.range,asset.size);
 if(res.req.headers['if-range']&&res.req.headers['if-range']!==etag)range=null;
 if(range?.invalid){res.set('Content-Range','bytes */'+asset.size);return res.status(416).end();}
 if(range){const part=bytes.subarray(range.start,range.end+1);res.status(206).set({'Content-Range':`bytes ${range.start}-${range.end}/${asset.size}`,'Content-Length':String(part.length)});return res.end(part);}
 res.set('Content-Length',String(asset.size));return res.end(bytes);
}

// Public endpoints expose approved, explicitly public media only.
router.get('/public',async(req,res,next)=>{try{const page=Math.max(1,Math.min(20,Number(req.query.page)||1));const limit=24;const filter={entity:'church_media',status:'active',visibility:'public'};if(req.query.organisation&&mongoose.isValidObjectId(req.query.organisation))filter.organisation=req.query.organisation;const [records,total]=await Promise.all([OperationsRecord.find(filter).sort({createdAt:-1}).skip((page-1)*limit).limit(limit).populate('organisation','name code level').lean(),OperationsRecord.countDocuments(filter)]);const assets=records.length?await MediaAsset.find({record:{$in:records.map(x=>x._id)},status:'active'}).select('-storageKey -__v').lean():[];const byId=new Map(assets.map(x=>[String(x.record),x]));res.set('Cache-Control','public, max-age=60');res.json({items:records.filter(x=>byId.has(String(x._id))).map(x=>({id:x._id,title:x.title,description:x.data?.description||'',kind:x.data?.kind||'image',eventDate:x.startAt||null,createdAt:x.createdAt,organisation:x.organisation,mediaUrl:'/media/public/'+x._id+'/file',mimeType:byId.get(String(x._id)).mimeType})),pagination:{page,limit,total,pages:Math.ceil(total/limit)}});}catch(e){next(e);}});
router.get('/public/:id/file',async(req,res,next)=>{try{if(!mongoose.isValidObjectId(req.params.id))return res.status(404).json({message:'Media not found'});const record=await OperationsRecord.findOne({_id:req.params.id,entity:'church_media',status:'active',visibility:'public'}).select('_id organisation').lean();if(!record)return res.status(404).json({message:'Media not found'});const asset=await MediaAsset.findOne({record:record._id,organisation:record.organisation,status:'active'}).select('+storageKey').lean();if(!asset)return res.status(404).json({message:'Media not found'});return sendMedia(res,asset,{inline:true,publicAccess:true});}catch(e){next(e);}});

router.use(requireAuth);
router.get('/manage',async(req,res,next)=>{try{if(!managers.has(req.user.role))return res.status(403).json({message:'Media workspace access denied'});const ids=await accessibleOrganisationIds(req.user);const requestedEntity=req.query.entity==='sermon'?'sermon':'church_media';const records=await OperationsRecord.find({entity:requestedEntity,organisation:{$in:ids},status:{$ne:'archived'}}).sort({createdAt:-1}).limit(150).populate('organisation','name code level').populate('createdBy','fullName').lean();const assets=records.length?await MediaAsset.find({record:{$in:records.map(x=>x._id)},status:'active'}).select('-storageKey -__v').lean():[];const byId=new Map(assets.map(x=>[String(x.record),x]));res.set('Cache-Control','private, no-store');res.json({items:records.filter(x=>requestedEntity==='sermon'||byId.has(String(x._id))).map(x=>{const asset=byId.get(String(x._id));return {id:x._id,title:x.title,description:x.data?.description||'',kind:x.data?.kind||'image',status:x.status,visibility:x.visibility,createdAt:x.createdAt,organisation:x.organisation,createdBy:x.createdBy,mimeType:asset?.mimeType||null,size:asset?.size||0,fileUrl:asset?'/media/'+x._id+'/file':null};})});}catch(e){next(e);}});
router.post('/',mediaUploadLimit,upload,async(req,res,next)=>{let created;let createdRecord;let cloudinaryAsset;try{
 if(!managers.has(req.user.role))return res.status(403).json({message:'You cannot upload church media'});
 if(!Buffer.isBuffer(req.body)||!req.body.length)return res.status(400).json({message:'Choose a file to upload'});
 const mime=String(req.get('x-media-type')||'').toLowerCase();
 if(!signatures[mime]||!signatures[mime](req.body))return res.status(415).json({message:'Choose a valid PDF, JPG, PNG, WebP, MP4, WebM, MP3, M4A, WAV or OGG file'});
 const isVideo=mime.startsWith('video/');const isAudio=mime.startsWith('audio/');const isDocument=mime==='application/pdf';
 const limit=isVideo?MAX_VIDEO_BYTES:isAudio?MAX_AUDIO_BYTES:isDocument?MAX_DOCUMENT_BYTES:MAX_IMAGE_BYTES;
 if(req.body.length>limit)return res.status(413).json({message:isVideo?'Videos must be 100 MB or smaller':isAudio?'Audio files must be 50 MB or smaller':isDocument?'PDF files must be 25 MB or smaller':'Photos must be 15 MB or smaller'});
 let title;let description;let originalName;
 try{title=decodeURIComponent(req.get('x-media-title')||'').trim();description=decodeURIComponent(req.get('x-media-description')||'').trim();originalName=decodeURIComponent(req.get('x-media-name')||'church-media');}catch{return res.status(400).json({message:'Media title, description or filename is malformed'});}
 if(!title||title.length>160||description.length>1200)return res.status(400).json({message:'Enter a title (maximum 160 characters) and description (maximum 1,200 characters)'});
 if(req.get('x-media-consent')!=='confirmed')return res.status(400).json({message:'Confirm that NCBI has permission to publish everyone identifiable in this media'});
 const organisation=req.get('x-media-organisation')||String(req.user.organisation?._id??req.user.organisation);
 const resourceEntity=req.get('x-media-entity')==='sermon'?'sermon':'church_media';
 if(!mongoose.isValidObjectId(organisation)||!(await assertOrganisationAccess(req.user,organisation)))return res.status(403).json({message:'Selected church unit is outside your authorised scope'});
 const publishNow=headquarters.has(req.user.role)&&req.get('x-media-publish')==='true';
 // Cloudinary is the primary and mandatory destination for all new church media.
 cloudinaryAsset=await uploadChurchMedia(req.body,{mimeType:mime,isVideo,isAudio,isDocument,originalName});
 const record=await OperationsRecord.create({organisation,entity:resourceEntity,title,status:resourceEntity==='sermon'?'active':publishNow?'active':'pending',visibility:resourceEntity==='sermon'?'organisation':publishNow?'public':'organisation',owner:req.user._id,createdBy:req.user._id,updatedBy:req.user._id,data:{kind:isVideo?'video':isAudio?'audio':isDocument?'document':'image',description,submittedForPublication:resourceEntity==='church_media',consentConfirmedAt:new Date(),storageProvider:'cloudinary'}});
 createdRecord=record;
 const checksum=createHash('sha256').update(req.body).digest('hex');
 created=await MediaAsset.create({organisation,record:record._id,storageKey:'cloudinary:'+cloudinaryAsset.publicId,provider:'cloudinary',cloudinaryPublicId:cloudinaryAsset.publicId,cloudinaryResourceType:cloudinaryAsset.resourceType,cloudinaryFormat:cloudinaryAsset.format,secureUrl:cloudinaryAsset.secureUrl,originalName:safeName(originalName,extensions[mime]),mimeType:mime,size:req.body.length,optimizedSize:cloudinaryAsset.bytes||req.body.length,checksum,uploadedBy:req.user._id});
 await AuditLog.create({organisation,actor:req.user._id,action:publishNow?'church-media-published':'church-media-submitted',entity:'church_media',recordId:record._id,summary:publishNow?'Published church media':'Submitted church media for headquarters review',metadata:{mimeType:mime,originalSize:req.body.length,storedSize:cloudinaryAsset.bytes||req.body.length,storageProvider:'cloudinary',publicId:cloudinaryAsset.publicId}});
 res.status(201).json({item:{id:record._id,title,description,kind:isVideo?'video':'image',status:record.status,visibility:record.visibility,organisation,createdAt:record.createdAt,storageProvider:'cloudinary',originalSize:req.body.length,storedSize:cloudinaryAsset.bytes||req.body.length}});
 }catch(e){
 if(created?._id)await MediaAsset.deleteOne({_id:created._id}).catch(()=>{});
 if(createdRecord?._id)await OperationsRecord.deleteOne({_id:createdRecord._id}).catch(()=>{});
 // Cloudinary upload failures are surfaced; uploaded assets are retained for recovery rather than silently discarded.
 next(e);
 }});

router.get('/:id/file',async(req,res,next)=>{try{if(!managers.has(req.user.role))return res.status(403).json({message:'Church media access denied'});if(!mongoose.isValidObjectId(req.params.id))return res.status(404).json({message:'Media not found'});const ids=await accessibleOrganisationIds(req.user);const record=await OperationsRecord.findOne({_id:req.params.id,entity:{$in:['church_media','sermon']},organisation:{$in:ids},status:{$ne:'archived'}}).select('_id organisation').lean();if(!record)return res.status(404).json({message:'Media not found'});const asset=await MediaAsset.findOne({record:record._id,status:'active'}).select('+storageKey').lean();if(!asset)return res.status(404).json({message:'Media not found'});return sendMedia(res,asset,{inline:true,publicAccess:false});}catch(e){next(e);}});
router.patch('/:id/decision',async(req,res,next)=>{try{if(!reviewers.has(req.user.role))return res.status(403).json({message:'Only headquarters reviewers can moderate branch media'});if(!mongoose.isValidObjectId(req.params.id))return res.status(404).json({message:'Media not found'});const decision=req.body?.decision;const ids=await accessibleOrganisationIds(req.user);const record=await OperationsRecord.findOne({_id:req.params.id,entity:'church_media',organisation:{$in:ids},status:'pending'});if(!record)return res.status(404).json({message:'Pending media not found'});if(!['approve','reject'].includes(decision))return res.status(400).json({message:'Decision must be approve or reject'});const note=String(req.body?.note||'').trim();if(decision==='reject'&&!note)return res.status(400).json({message:'A reason is required when rejecting media'});record.status=decision==='approve'?'active':'archived';record.visibility=decision==='approve'?'public':'private';record.updatedBy=req.user._id;record.data={...record.data,moderationNote:note||'',moderatedAt:new Date(),moderatedBy:String(req.user._id)};await record.save();await AuditLog.create({organisation:record.organisation,actor:req.user._id,action:'church-media-'+decision,entity:'church_media',recordId:record._id,summary:decision==='approve'?'Approved and published church media':'Rejected church media submission',metadata:{note}});res.json({success:true,status:record.status});}catch(e){next(e);}});
router.delete('/:id',async(req,res,next)=>{try{if(!reviewers.has(req.user.role)&&!headquarters.has(req.user.role))return res.status(403).json({message:'Only headquarters reviewers can archive public media'});if(!mongoose.isValidObjectId(req.params.id))return res.status(404).json({message:'Media not found'});const ids=await accessibleOrganisationIds(req.user);const record=await OperationsRecord.findOne({_id:req.params.id,entity:'church_media',organisation:{$in:ids},status:{$ne:'archived'}});if(!record)return res.status(404).json({message:'Media not found'});record.status='archived';record.visibility='private';record.updatedBy=req.user._id;await record.save();await AuditLog.create({organisation:record.organisation,actor:req.user._id,action:'church-media-archived',entity:'church_media',recordId:record._id,summary:'Archived church media'});res.json({success:true});}catch(e){next(e);}});
export default router;
