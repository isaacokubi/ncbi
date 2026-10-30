import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAnnouncementRecord } from './announcementPolicy.js';

const valid = { title: 'Sunday service update', data: { message: 'The service begins at 9:00 AM.', audience: 'congregation', category: 'service_update' }, visibility: 'organisation' };

test('accepts valid internal announcements from branch leadership', () => {
  assert.equal(validateAnnouncementRecord(valid, { role: 'branch_admin' }).valid, true);
});

test('only headquarters administrators may publish public announcements', () => {
  const publicNotice = { ...valid, visibility: 'public' };
  assert.equal(validateAnnouncementRecord(publicNotice, { role: 'branch_admin' }).status, 403);
  assert.equal(validateAnnouncementRecord(publicNotice, { role: 'national_admin' }).valid, true);
});

test('branch leadership cannot modify or archive already-public notices', () => {
  assert.equal(validateAnnouncementRecord(valid, { role: 'branch_pastor' }, { existingPublic: true }).status, 403);
});

test('requires a bounded message and supported audience/category', () => {
  assert.equal(validateAnnouncementRecord({ ...valid, data: { message: '' } }, { role: 'national_admin' }).valid, false);
  assert.equal(validateAnnouncementRecord({ ...valid, data: { message: 'Hello', audience: 'everyone' } }, { role: 'national_admin' }).valid, false);
  assert.equal(validateAnnouncementRecord({ ...valid, data: { message: 'Hello', category: 'unsupported' } }, { role: 'national_admin' }).valid, false);
  assert.equal(validateAnnouncementRecord({ ...valid, title: 'x'.repeat(181) }, { role: 'national_admin' }).valid, false);
});
