import test from 'node:test';
import assert from 'node:assert/strict';
import { validateAttendanceInput } from '../src/domain/attendancePolicy.js';

const memberId = '507f1f77bcf86cd799439011';

test('attendance input trims valid member records and applies a default category', () => {
  const result = validateAttendanceInput({ activityName: ' Sunday Service ', heldAt: '2026-10-25T08:00:00Z', member: memberId });
  assert.equal(result.valid, true);
  assert.equal(result.value.activityName, 'Sunday Service');
  assert.equal(result.value.category, 'other');
  assert.equal(result.value.member, memberId);
  assert.equal(result.value.visitorName, undefined);
});

test('attendance input accepts a named visitor without a member id', () => {
  const result = validateAttendanceInput({ activityName: 'Midweek Service', category: 'midweek_service', heldAt: '2026-10-28T17:00:00Z', visitorName: '  Jane Doe  ' });
  assert.equal(result.valid, true);
  assert.equal(result.value.visitorName, 'Jane Doe');
  assert.equal(result.value.member, null);
});

test('attendance input rejects missing, ambiguous and malformed people', () => {
  const base = { activityName: 'Sunday Service', heldAt: '2026-10-25T08:00:00Z' };
  for (const input of [base, { ...base, member: memberId, visitorName: 'Jane' }, { ...base, member: 'not-an-id' }]) {
    assert.equal(validateAttendanceInput(input).valid, false);
  }
});

test('attendance input rejects invalid dates, categories and oversized fields', () => {
  const base = { activityName: 'Sunday Service', heldAt: '2026-10-25T08:00:00Z', visitorName: 'Jane' };
  for (const input of [{ ...base, heldAt: 'not-a-date' }, { ...base, category: 'unknown' }, { ...base, activityName: 'x'.repeat(81) }, { ...base, visitorName: 'x'.repeat(121) }]) {
    assert.equal(validateAttendanceInput(input).valid, false);
  }
});
