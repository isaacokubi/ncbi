const minorUnits=value=>{
 const text=String(value??'0').trim();
 if(!/^\d+(?:\.\d{1,2})?$/.test(text))return null;
 const [whole,decimal='']=text.split('.');
 return BigInt(whole)*100n+BigInt((decimal+'00').slice(0,2));
};
export function approvalPolicyRangeError(minimumAmount,maximumAmount){
 const minimum=minorUnits(minimumAmount);
 const maximum=maximumAmount===null||maximumAmount===''?null:minorUnits(maximumAmount);
 if(minimum===null||minimum<0n)return 'Minimum amount must be a valid non-negative amount with up to two decimal places';
 if(maximumAmount!==null&&maximumAmount!==''&&(maximum===null||maximum<minimum))return 'Maximum amount must be valid and greater than or equal to the minimum amount';
 return null;
}
export function approvalPolicyOverlaps(existing,candidate){
 const aMin=minorUnits(existing.minimumAmount),bMin=minorUnits(candidate.minimumAmount);
 const aMax=existing.maximumAmount===null?null:minorUnits(existing.maximumAmount);
 const bMax=candidate.maximumAmount===null?null:minorUnits(candidate.maximumAmount);
 if(aMin===null||bMin===null||aMax===null&&existing.maximumAmount!==null||bMax===null&&candidate.maximumAmount!==null)return true;
 return (aMax===null||bMin<=aMax)&&(bMax===null||aMin<=bMax);
}
export function approvalProgress({approvals=[],actorId,decision,requiredApprovals=1}){
 if(!['approve','reject'].includes(decision))return {allowed:false,reason:'Invalid approval decision'};
 if(approvals.some(item=>String(item.actor)===String(actorId)))return {allowed:false,reason:'An approver may participate only once'};
 if(decision==='reject')return {allowed:true,complete:true,status:'rejected'};
 const count=approvals.filter(item=>item.decision==='approve').length+1;
 return {allowed:true,complete:count>=requiredApprovals,status:count>=requiredApprovals?'approved':'submitted',remaining:Math.max(0,requiredApprovals-count)};
}
