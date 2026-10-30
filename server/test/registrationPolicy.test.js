import test from 'node:test';
import assert from 'node:assert/strict';
import { registrationDecisionError } from '../src/domain/registrationPolicy.js';

const memberApplication = { registrationCategory: 'member', organisation: 'branch-a' };
const visitorApplication = { registrationCategory: 'non_member', organisation: 'branch-a' };

test('branch pastor can decide member applications only in own branch', () => {
  assert.equal(registrationDecisionError({ role: 'branch_pastor', organisation: 'branch-a' }, memberApplication), null);
  assert.match(registrationDecisionError({ role: 'branch_pastor', organisation: 'branch-b' }, memberApplication), /assigned branch/);
  assert.match(registrationDecisionError({ role: 'branch_pastor', organisation: 'branch-a' }, visitorApplication), /member applications/);
});

test('branch administrator can decide non-member applications in own branch', () => {
  assert.equal(registrationDecisionError({ role: 'branch_admin', organisation: 'branch-a' }, visitorApplication), null);
  assert.match(registrationDecisionError({ role: 'branch_admin', organisation: 'branch-b' }, visitorApplication), /assigned branch/);
  assert.match(registrationDecisionError({ role: 'branch_admin', organisation: 'branch-a' }, memberApplication), /Member applications/);
});

test('national and platform administrators can decide non-member applications', () => {
  for (const role of ['super_admin', 'international_executive', 'national_admin']) {
    assert.equal(registrationDecisionError({ role }, visitorApplication), null);
    assert.match(registrationDecisionError({ role }, memberApplication), /Member applications/);
  }
});

test('unapproved roles cannot decide registrations', () => {
  assert.match(registrationDecisionError({ role: 'treasurer', organisation: 'branch-a' }, visitorApplication), /permission required/);
});
