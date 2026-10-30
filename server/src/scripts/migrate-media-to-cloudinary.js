import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { MediaAsset } from '../models/domain.js';
import { uploadChurchMedia } from '../services/cloudinary.js';

const rootValue=process.env.CHURCH_MEDIA_STORAGE_DIR||process.env.DOCUMENT_STORAGE_DIR;
if(!rootValue||!path.isAbsolute(rootValue))throw new Error('Set CHURCH_MEDIA_STORAGE_DIR to the existing persistent media directory before migration.');
const root=path.resolve(rootValue);
await connectDatabase();
let migrated=0;
let failed=0;
try{
 const cursor=MediaAsset.find({provider:{$ne:'cloudinary'}}).select('+storageKey').cursor();
 for await(const asset of cursor){
  try{
   const file=path.resolve(root,asset.storageKey);
   if(path.dirname(file)!==root)throw new Error('Unsafe legacy media path');
   const buffer=await readFile(file);
   if(buffer.length!==asset.size)throw new Error('Legacy media size does not match its stored metadata');
   const isVideo=asset.mimeType.startsWith('video/');
   const uploaded=await uploadChurchMedia(buffer,{mimeType:asset.mimeType,isVideo,originalName:asset.originalName});
   asset.provider='cloudinary';
   asset.cloudinaryPublicId=uploaded.publicId;
   asset.cloudinaryResourceType=uploaded.resourceType;
   asset.cloudinaryFormat=uploaded.format;
   asset.secureUrl=uploaded.secureUrl;
   asset.optimizedSize=uploaded.bytes||buffer.length;
   asset.storageKey='cloudinary:'+uploaded.publicId;
   await asset.save();
   migrated++;
   console.info('Migrated church media',String(asset._id),uploaded.publicId);
  }catch(error){failed++;console.error('Could not migrate church media',String(asset._id),error.message);}
 }
 console.info(JSON.stringify({migrated,failed}));
 if(failed)process.exitCode=1;
}finally{await mongoose.disconnect();}
