import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth, allowRoles } from '../middleware/auth.js';
const router = Router();
const Branding = mongoose.models.NcbiBranding || mongoose.model('NcbiBranding', new mongoose.Schema({ key: { type: String, unique: true, default: 'global' }, logoData: { type: String, required: true }, heroImageData: { type: String, default: '' }, updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' } }, { timestamps: true }));
router.put('/logo', requireAuth, allowRoles('super_admin','national_admin'), async (req,res,next) => { try { const value=req.body?.logoData; if(typeof value!=='string'||!value.startsWith('data:image/')) return res.status(400).json({message:'Choose a valid image.'}); const parts=value.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/); if(!parts) return res.status(400).json({message:'Only JPG, PNG and WebP images are supported.'}); const bytes=Buffer.from(parts[2],'base64'); if(!bytes.length||bytes.length>1048576) return res.status(413).json({message:'Logo must be 1 MB or smaller.'}); const type=parts[1]; const valid=type==='jpeg'?(bytes[0]===255&&bytes[1]===216&&bytes[2]===255):type==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP'); if(!valid)return res.status(400).json({message:'Image data does not match its file type.'}); const saved=await Branding.findOneAndUpdate({key:'global'},{$set:{logoData:value,updatedBy:req.user._id}},{upsert:true,new:true}).select('logoData updatedAt'); res.set('Cache-Control','no-store'); res.json({logoUrl:saved.logoData,updatedAt:saved.updatedAt}); } catch(error){next(error);} });
export default router;

router.put('/hero-image', requireAuth, allowRoles('super_admin','national_admin'), async (req,res,next) => {
 try {
  const value=req.body?.imageData;
  const parts=typeof value==='string'&&value.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
  if(!parts)return res.status(400).json({message:'Choose a JPG, PNG or WebP portrait image.'});
  const bytes=Buffer.from(parts[2],'base64');
  if(!bytes.length||bytes.length>3145728)return res.status(413).json({message:'Homepage portrait must be 3 MB or smaller.'});
  const type=parts[1];
  const valid=type==='jpeg'?(bytes[0]===255&&bytes[1]===216&&bytes[2]===255):type==='png'?bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])):(bytes.toString('ascii',0,4)==='RIFF'&&bytes.toString('ascii',8,12)==='WEBP');
  if(!valid)return res.status(400).json({message:'Image data does not match its file type.'});
  const saved=await Branding.findOneAndUpdate({key:'global'},{$set:{heroImageData:value,updatedBy:req.user._id},$setOnInsert:{logoData:'/ncbi-logo.jpg'}},{upsert:true,new:true}).select('heroImageData updatedAt');
  res.set('Cache-Control','no-store');res.json({heroImageUrl:saved.heroImageData,updatedAt:saved.updatedAt});
 }catch(error){next(error);}
});
