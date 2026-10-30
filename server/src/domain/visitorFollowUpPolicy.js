const methods=new Set(['phone','sms','whatsapp','email','in_person']);
const outcomes=new Set(['not_contacted','no_answer','connected','invited','attending','not_interested','wrong_contact']);
const statuses=new Set(['pending','in_progress','completed','closed']);
export function validateVisitorFollowUp(input,now=new Date()) {
 if(!input||typeof input!=='object'||Array.isArray(input)) return {valid:false,message:'Follow-up details are required'};
 const contactMethod=String(input.contactMethod||'').trim(), outcome=String(input.outcome||'').trim(), status=String(input.status||'in_progress').trim(), note=String(input.note||'').trim();
 if(!methods.has(contactMethod)) return {valid:false,message:'Choose a supported contact method'};
 if(!outcomes.has(outcome)) return {valid:false,message:'Choose a valid follow-up outcome'};
 if(!statuses.has(status)) return {valid:false,message:'Choose a valid follow-up status'};
 if(note.length>1000) return {valid:false,message:'Follow-up note must be 1,000 characters or fewer'};
 let nextFollowUpAt=null;
 if(input.nextFollowUpAt){nextFollowUpAt=new Date(input.nextFollowUpAt);if(Number.isNaN(nextFollowUpAt.getTime())||nextFollowUpAt<=now)return {valid:false,message:'Next follow-up must be a valid future date and time'};}
 if(!['completed','closed'].includes(status)&&!nextFollowUpAt)return {valid:false,message:'Schedule the next follow-up or complete/close the follow-up'};
 return {valid:true,value:{contactMethod,outcome,status,note,nextFollowUpAt}};
}
