import test from 'node:test';
import assert from 'node:assert/strict';
import { financeTransition, financeDecisionError, budgetTransition, budgetDecisionError, isValidPositiveAmount } from '../src/domain/financePolicy.js';

test('finance workflow requires approval before confirmation', () => {
  assert.deepEqual(financeTransition('submitted','confirm'), { allowed: false, status: 'submitted' });
  assert.deepEqual(financeTransition('submitted','approve'), { allowed: true, status: 'approved' });
  assert.deepEqual(financeTransition('approved','confirm'), { allowed: true, status: 'confirmed' });
});
test('finance workflow rejects invalid transitions and unknown decisions', () => {
  assert.equal(financeTransition('confirmed','approve').allowed, false);
  assert.equal(financeTransition('rejected','confirm').allowed, false);
  assert.equal(financeTransition('submitted','something-else').allowed, false);
});
test('amount validation accepts finite positive amounts only', () => {
  assert.equal(isValidPositiveAmount('1250.50'), true);
  for (const value of [0,-1,'NaN',Infinity,'',null,100000000001]) assert.equal(isValidPositiveAmount(value), false);
});
test('finance approval and confirmation require distinct people', () => {
  const transaction = { status: 'approved', createdBy: 'requester', approvedBy: 'approver' };
  assert.match(financeDecisionError(transaction, 'approve', 'requester'), /creator cannot approve/);
  assert.match(financeDecisionError(transaction, 'confirm', 'requester'), /other than the requester/);
  assert.match(financeDecisionError(transaction, 'confirm', 'approver'), /other than the requester and approver/);
  assert.equal(financeDecisionError(transaction, 'confirm', 'confirmer'), null);
});
test('only another authorised person can void a confirmed transaction', () => {
  const transaction = { status: 'confirmed', createdBy: 'requester' };
  assert.match(financeDecisionError(transaction, 'void', 'requester'), /requester cannot void/);
  assert.equal(financeDecisionError(transaction, 'void', 'finance_lead'), null);
});
test('budget approval is a one-way decision and the requester cannot decide it', () => {
  assert.deepEqual(budgetTransition('submitted', 'approve'), { allowed: true, status: 'approved' });
  assert.deepEqual(budgetTransition('submitted', 'reject'), { allowed: true, status: 'rejected' });
  assert.equal(budgetTransition('approved', 'reject').allowed, false);
  assert.equal(budgetTransition('submitted', 'void').allowed, false);
  assert.match(budgetDecisionError({ createdBy: 'requester' }, 'requester'), /requester cannot approve/);
  assert.equal(budgetDecisionError({ createdBy: 'requester' }, 'independent_approver'), null);
});
