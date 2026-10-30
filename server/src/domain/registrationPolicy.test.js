import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationDecisionError, registrationScopeError } from './registrationPolicy.js';

const org = value => ({ _id: value });
const target = (organisation, registrationCategory = 'official', requestedRole = 'branch_pastor') => ({
  organisation, registrationCategory, requestedRole
});

test('regional and district leaders can review applications within their authorised subtree', () => {
  assert.equal(registrationScopeError({ role: 'regional_overseer', organisation: org('region-a') }, target('branch-a'), ['region-a', 'district-a', 'branch-a']), null);
  assert.equal(registrationScopeError({ role: 'district_pastor', organisation: org('district-a') }, target('branch-a'), ['district-a', 'branch-a']), null);
});

test('leaders cannot approve applications outside their organisation subtree', () => {
  const error = registrationScopeError({ role: 'national_admin', organisation: org('national-a') }, target('branch-b'), ['national-a', 'branch-a']);
  assert.match(error, /outside your authorised scope/);
});

test('branch pastors can only review member applications in their own branch', () => {
  const pastor = { role: 'branch_pastor', organisation: org('branch-a') };
  assert.equal(registrationScopeError(pastor, target('branch-a', 'member'), []), null);
  assert.match(registrationScopeError(pastor, target('branch-b', 'member'), []), /assigned branch/);
  assert.match(registrationScopeError(pastor, target('branch-a', 'official'), []), /assigned branch/);
});

test('official role approval still enforces role hierarchy', () => {
  assert.equal(registrationDecisionError({ role: 'district_pastor' }, target('branch-a', 'official', 'branch_pastor')), null);
  assert.match(registrationDecisionError({ role: 'branch_admin' }, target('branch-a', 'official', 'national_admin')), /not authorised/);
});
