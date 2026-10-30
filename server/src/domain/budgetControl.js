const toMinorUnits=value=>{
 const text=String(value??'0').trim();
 if(!/^-?\d+(?:\.\d{1,2})?$/.test(text))return null;
 const negative=text.startsWith('-');
 const unsigned=negative?text.slice(1):text;
 const [whole,decimal='']=unsigned.split('.');
 const amount=BigInt(whole)*100n+BigInt((decimal+'00').slice(0,2));
 return negative?-amount:amount;
};
const money=value=>{const negative=value<0n;const amount=negative?-value:value;return (negative?'-':'')+(amount/100n).toString()+'.'+(amount%100n).toString().padStart(2,'0');};

export function budgetPeriodRange(date,period){
 const year=date.getUTCFullYear();
 if(period==='annual')return {start:new Date(Date.UTC(year,0,1)),end:new Date(Date.UTC(year,11,31,23,59,59,999))};
 const monthNames=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'];
 let month=monthNames.indexOf(period);
 if(month>=0)return {start:new Date(Date.UTC(year,month,1)),end:new Date(Date.UTC(year,month+1,0,23,59,59,999))};
 const quarter=({q1:0,q2:3,q3:6,q4:9})[period];
 if(quarter!==undefined)return {start:new Date(Date.UTC(year,quarter,1)),end:new Date(Date.UTC(year,quarter+3,0,23,59,59,999))};
 throw new Error('Unsupported budget period');
}

export function selectApplicableBudget(budgets,date){
 const month=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'][date.getUTCMonth()];
 const quarter='q'+(Math.floor(date.getUTCMonth()/3)+1);
 const priorities=[month,quarter,'annual'];
 for(const period of priorities){
  const match=budgets.find(item=>item.period===period&&Number(item.fiscalYear)===date.getUTCFullYear()&&item.status==='approved');
  if(match)return match;
 }
 return null;
}

export function budgetPostingDecision({budgetAmount,postedAmount,proposedAmount}){
 const budget=toMinorUnits(budgetAmount),posted=toMinorUnits(postedAmount),proposed=toMinorUnits(proposedAmount);
 if(budget===null||posted===null||proposed===null||budget<=0n||proposed<0n)return {allowed:false,reason:'invalid_amount'};
 const projected=posted+proposed;
 return {allowed:projected<=budget,budget:money(budget),posted:money(posted),proposed:money(proposed),projected:money(projected),remaining:money(budget-projected)};
}
