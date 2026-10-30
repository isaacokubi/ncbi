import { v2 as cloudinary } from 'cloudinary';
import { randomUUID } from 'node:crypto';

function configured(){
 const cloudName=process.env.CLOUDINARY_CLOUD_NAME;
 const apiKey=process.env.CLOUDINARY_API_KEY;
 const apiSecret=process.env.CLOUDINARY_API_SECRET;
 if(!cloudName||!apiKey||!apiSecret)throw Object.assign(new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY and CLOUDINARY_API_SECRET on the server.'),{status:503});
 cloudinary.config({cloud_name:cloudName,api_key:apiKey,api_secret:apiSecret,secure:true});
 return cloudinary;
}

export function uploadChurchMedia(buffer,{mimeType,isVideo,isAudio=false,isDocument=false,originalName}){
 const client=configured();
 const resourceType=isDocument?'raw':(isVideo||isAudio)?'video':'image';
 const publicId='ncbi/church-media/'+randomUUID()+(isDocument?'.pdf':'');
 const transformation=isDocument||isAudio?[]:isVideo
  ?[{quality:'auto:good',video_codec:'h264',width:1920,height:1080,crop:'limit',format:'mp4'}]
  :[{quality:'auto:good',width:1920,height:1920,crop:'limit',format:'webp'}];
 return new Promise((resolve,reject)=>{
  const stream=client.uploader.upload_stream({
   resource_type:resourceType,
   public_id:publicId,
   overwrite:false,
   use_filename:false,
   unique_filename:true,
   filename_override:String(originalName||'church-media').slice(0,140),
   transformation,
   tags:['ncbi','church-media']
  },(error,result)=>{
   if(error)return reject(Object.assign(new Error('Cloudinary could not store this media. Please retry.'),{cause:error,status:502}));
   if(!result?.public_id||!result?.secure_url)return reject(Object.assign(new Error('Cloudinary returned an incomplete upload result.'),{status:502}));
   resolve({publicId:result.public_id,resourceType:result.resource_type,format:result.format,secureUrl:result.secure_url,bytes:result.bytes});
  });
  stream.on('error',reject);
  stream.end(buffer);
 });
}

export function churchMediaDeliveryUrl(asset){
 const client=configured();
 const isRaw=asset.cloudinaryResourceType==='raw'||asset.mimeType==='application/pdf';
 const isVideo=asset.cloudinaryResourceType==='video'||String(asset.mimeType||'').startsWith('video/');
 const isAudio=String(asset.mimeType||'').startsWith('audio/');
 const resourceType=isRaw?'raw':(isVideo||isAudio)?'video':'image';
 const transformations=isRaw||isAudio?[]:isVideo?[{quality:'auto:good',video_codec:'h264',width:1920,height:1080,crop:'limit',format:'mp4'}]:[{quality:'auto:good',fetch_format:'auto',width:1920,height:1920,crop:'limit'}];
 return client.url(asset.cloudinaryPublicId,{secure:true,resource_type:resourceType,transformation:transformations,format:isVideo?'mp4':undefined});
}
