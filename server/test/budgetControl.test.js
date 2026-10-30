import test from 'node:test';
import assert from 'node:assert/strict';
import { budgetPeriodRange, budgetPostingDecision, selectApplicableBudget } from '../src/domain/budgetControl.js';

test('budget selection prefers the most specific approved period',()=>{
 const date=new Date('2026-05-18T12:00:00.000Z');
 const budgets=[
  {period:'annual',fiscalYear:2026,status:'approved',amount:'100000.00'},
  {period:'q2',fiscalYear:2026,status:'approved',amount:'30000.00'},
  {period:'may',fiscalYear:2026,status:'approved',amount:'9000.00'},
  {period:'may',fiscalYear:2026,status:'submitted',amount:'1.00'}
 ];
 assert.equal(selectApplicableBudget(budgets,date).amount,'9000.00');
 assert.equal(selectApplicableBudget(budgets.filter(item=>item.period!=='may'),date).period,'q2');
 assert.equal(selectApplicableBudget(budgets.filter(item=>item.period==='annual'),date).period,'annual');
 assert.equal(selectApplicableBudget([],date),null);
});

test('budget periods use UTC calendar boundaries',()=>{
 const date=new Date('2026-05-18T12:00:00.000Z');
 const range=budgetPeriodRange(date,'q2');
 assert.equal(range.start.toISOString(),'2026-04-01T00:00:00.000Z');
 assert.equal(range.end.toISOString(),'2026-06-30T23:59:59.999Z');
 const month=budgetPeriodRange(date,'may');
 assert.equal(month.start.toISOString(),'2026-05-01T00:00:00.000Z');
 assert.equal(month.end.toISOString(),'2026-05-31T23:59:59.999Z');
});

test('journal posting is allowed within budget and blocked above it using exact cents',()=>{
 assert.equal(budgetPostingDecision({budgetAmount:'1000.00',postedAmount:'700.10',proposedAmount:'299.90'}).allowed,true);
 const result=budgetPostingDecision({budgetAmount:'1000.00',postedAmount:'700.10',proposedAmount:'300.00'});
 assert.equal(result.allowed,false);
 assert.equal(result.projected,'1000.10');
 assert.equal(result.remaining,'-0.10');
});

test('budget posting decision rejects malformed monetary values',()=>{
 assert.equal(budgetPostingDecision({budgetAmount:'1.001',postedAmount:'0.00',proposedAmount:'0.01'}).reason,'invalid_amount');
 assert.equal(budgetPostingDecision({budgetAmount:'0.00',postedAmount:'0.00',proposedAmount:'0.01'}).reason,'invalid_amount');
});
