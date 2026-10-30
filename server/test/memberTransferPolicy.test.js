import test from 'node:test';
import assert from 'node:assert/strict';
import { memberTransferError } from '../src/domain/memberTransferPolicy.js';

const member = { homeOrganisation: 'branch-a' };
const actorOrganisation = 'district-a';

test('allows transfer to a different active branch', () => {
  assert.equal(memberTransferError({ member, destination: { _id: 'branch-b', level: 'branch', status: 'active' }, actorOrganisation }), null);
});

test('rejects non-branch, inactive and same-branch destinations', () => {
  assert.match(memberTransferError({ member, destination: { _id: 'district-b', level: 'district', status: 'active' }, actorOrganisation }), /active NCBI branch/);
  assert.match(memberTransferError({ member, destination: { _id: 'branch-b', level: 'branch', status: 'suspended' }, actorOrganisation }), /active NCBI branch/);
  assert.match(memberTransferError({ member, destination: { _id: 'branch-a', level: 'branch', status: 'active' }, actorOrganisation }), /already belongs/);
});

test('requires a verified actor organisation', () => {
  assert.match(memberTransferError({ member, destination: { _id: 'branch-b', level: 'branch', status: 'active' } }), /organisation could not be verified/);
});
