const baseUrl=()=>process.env.MPESA_ENV==='production'?'https://api.safaricom.co.ke':'https://sandbox.safaricom.co.ke';
function required(){
 const keys=['MPESA_CONSUMER_KEY','MPESA_CONSUMER_SECRET','MPESA_SHORTCODE','MPESA_PASSKEY','MPESA_CALLBACK_URL','MPESA_CALLBACK_SECRET'];
 const missing=keys.filter(key=>!process.env[key]);
 if(missing.length)throw new Error('M-Pesa is not configured. Missing: '+missing.join(', '));
 if(!/^https:\/\//i.test(process.env.MPESA_CALLBACK_URL))throw new Error('MPESA_CALLBACK_URL must be a public HTTPS URL');\n if(process.env.MPESA_CALLBACK_SECRET.length<32)throw new Error('MPESA_CALLBACK_SECRET must be at least 32 characters');\n const callbackPath=new URL(process.env.MPESA_CALLBACK_URL).pathname;if(!callbackPath.endsWith('/mpesa/callback/'+process.env.MPESA_CALLBACK_SECRET))throw new Error('MPESA_CALLBACK_URL must end with /mpesa/callback/ followed by MPESA_CALLBACK_SECRET');
}
export function normalizeKenyanPhone(value){
 const digits=String(value||'').replace(/\D/g,'');
 if(/^0[17]\d{8}$/.test(digits))return '254'+digits.slice(1);
 if(/^[17]\d{8}$/.test(digits))return '254'+digits;
 if(/^254[17]\d{8}$/.test(digits))return digits;
 return null;
}
export async function darajaToken(){
 required();
 const credentials=Buffer.from(process.env.MPESA_CONSUMER_KEY+':'+process.env.MPESA_CONSUMER_SECRET).toString('base64');
 const response=await fetch(baseUrl()+'/oauth/v1/generate?grant_type=client_credentials',{headers:{Authorization:'Basic '+credentials}});
 const data=await response.json().catch(()=>({}));
 if(!response.ok||!data.access_token)throw new Error(data.errorMessage||'Unable to authenticate with Daraja');
 return data.access_token;
}
export async function requestStkPush({phone,amount,accountReference,description}){
 required();
 const token=await darajaToken();
 const timestamp=new Date().toISOString().replace(/[-:TZ.]/g,'').slice(0,14);
 const shortcode=process.env.MPESA_SHORTCODE;
 const password=Buffer.from(shortcode+process.env.MPESA_PASSKEY+timestamp).toString('base64');
 const response=await fetch(baseUrl()+'/mpesa/stkpush/v1/processrequest',{
  method:'POST',
  headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},
  body:JSON.stringify({
   BusinessShortCode:shortcode,Password:password,Timestamp:timestamp,
   TransactionType:process.env.MPESA_TRANSACTION_TYPE||'CustomerPayBillOnline',
   Amount:amount,PartyA:phone,PartyB:shortcode,PhoneNumber:phone,
   CallBackURL:process.env.MPESA_CALLBACK_URL,
   AccountReference:String(accountReference).slice(0,12),
   TransactionDesc:String(description||'Church contribution').slice(0,100)
  })
 });
 const data=await response.json().catch(()=>({}));
 if(!response.ok||String(data.ResponseCode)!=='0')throw new Error(data.errorMessage||data.ResponseDescription||'Daraja STK push request failed');
 return data;
}
