const moneyMinor=value=>{
 const text=String(value??'').trim();
 if(!/^\d+(?:\.\d{1,2})?$/.test(text))return null;
 const [whole,decimal='']=text.split('.');
 return BigInt(whole)*100n+BigInt((decimal+'00').slice(0,2));
};
export const supplierNameError=value=>!String(value||'').trim()? 'Supplier name is required':String(value).trim().length>160?'Supplier name must be 160 characters or fewer':null;
export const supplierInvoiceError=({invoiceNumber,amount,dueDate,invoiceDate})=>{
 if(!String(invoiceNumber||'').trim()||String(invoiceNumber).trim().length>80)return 'A valid supplier invoice number is required';
 const minor=moneyMinor(amount);
 if(minor===null||minor<=0n)return 'Invoice amount must be a positive value with no more than two decimal places';
 if(!invoiceDate||Number.isNaN(new Date(invoiceDate).getTime()))return 'A valid invoice date is required';
 if(dueDate&&Number.isNaN(new Date(dueDate).getTime()))return 'A valid due date is required';
 if(dueDate&&new Date(dueDate)<new Date(invoiceDate))return 'Due date cannot be earlier than invoice date';
 return null;
};
export const supplierPaymentError=({amount,outstanding,requesterId,approverId,confirmerId})=>{
 const value=moneyMinor(amount),balance=moneyMinor(outstanding);
 if(value===null||value<=0n)return 'Payment amount must be positive and use no more than two decimal places';
 if(balance===null||balance<=0n)return 'There is no outstanding approved invoice balance';
 if(value>balance)return 'Payment exceeds the outstanding approved invoice balance';
 if(requesterId&&approverId&&String(requesterId)===String(approverId))return 'The requester cannot approve their own supplier payment';
 if(confirmerId&&((requesterId&&String(requesterId)===String(confirmerId))||(approverId&&String(approverId)===String(confirmerId))))return 'Payment confirmation must be performed by a different user from the requester and approver';
 return null;
};
export const supplierDecisionError=({status,decision,actorId,createdBy,approvals=[]})=>{
 if(status!=='submitted')return 'Only submitted supplier records can be decided';
 if(String(actorId)===String(createdBy))return 'The requester cannot approve or reject their own submission';
 if(approvals.some(item=>String(item.actor)===String(actorId)))return 'You have already participated in this decision';
 if(!['approve','reject'].includes(decision))return 'Decision must be approve or reject';
 return null;
};
export const invoicePaymentStatus=({amount,paid})=>{
 const total=moneyMinor(amount),settled=moneyMinor(paid);
 if(total===null||settled===null||settled<0n||settled>total)return 'invalid';
 if(settled===0n)return 'approved';
 if(settled===total)return 'paid';
 return 'partially_paid';
};
export const moneyToMinor=moneyMinor;

export const supplierQuoteError=({quoteNumber,amount,currency,requestCurrency,deliveryDays,validUntil,now=new Date()})=>{
 if(!String(quoteNumber||'').trim()||String(quoteNumber).trim().length>80)return 'A valid supplier quote reference is required';
 const minor=moneyMinor(amount);
 if(minor===null||minor<=0n)return 'Quoted amount must be positive and use no more than two decimal places';
 if(!/^[A-Z]{3}$/.test(String(currency||'').toUpperCase())||String(currency).toUpperCase()!==String(requestCurrency||'').toUpperCase())return 'Quotation currency must match the approved purchase request';
 if(!Number.isInteger(Number(deliveryDays))||Number(deliveryDays)<0||Number(deliveryDays)>3650)return 'Delivery days must be a whole number between 0 and 3,650';
 const expiry=new Date(validUntil),today=new Date(now.toISOString().slice(0,10));
 if(!validUntil||Number.isNaN(expiry.getTime())||expiry<today)return 'A valid future quotation expiry date is required';
 return null;
};
