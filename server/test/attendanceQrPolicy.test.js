import test from 'node:test';
import assert from 'node:assert/strict';
import { canCheckInWithQr, validateQrSessionInput } from '../src/domain/attendanceQrPolicy.js';
const now = new Date('2026-10-30T09:00:00Z');

test('allows attendance officers to record QR check-ins',()=>{
 for (const role of ['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin','department_leader']) {
  assert.equal(canCheckInWithQr({role},'member-1'),true);
 }
});
test('members can check in only their own linked profile',()=>{
 assert.equal(canCheckInWithQr({role:'member',memberProfile:'member-1'},'member-1'),true);
 assert.equal(canCheckInWithQr({role:'member',memberProfile:'member-1'},'member-2'),false);
 assert.equal(canCheckInWithQr({role:'member'},'member-1'),false);
});
test('finance and unrelated roles cannot use QR check-in to record attendance',()=>{
 for (const role of ['treasurer','visitor','auditor','unknown']) assert.equal(canCheckInWithQr({role,memberProfile:'member-1'},'member-1'),false);
 assert.equal(canCheckInWithQr(null,'member-1'),false);
});
test('accepts a valid branch service session and normalises the activity name',()=>{
 const result=validateQrSessionInput({activityName:' Sunday Service ',category:'sunday_service',heldAt:'2026-10-30T08:00:00Z'},now);
 assert.equal(result.valid,true);assert.equal(result.value.activityName,'Sunday Service');
});
test('rejects missing, oversized, invalid-category and invalid-date sessions',()=>{
 const base={activityName:'Sunday Service',heldAt:'2026-10-30T08:00:00Z'};
 for(const input of [{},{...base,activityName:''},{...base,activityName:'x'.repeat(81)},{...base,category:'unknown'},{...base,heldAt:'not-a-date'}]) assert.equal(validateQrSessionInput(input,now).valid,false);
});
test('limits QR sessions to a 24-hour window',()=>{
 assert.equal(validateQrSessionInput({activityName:'Service',heldAt:'2026-10-28T08:00:00Z'},now).valid,false);
 assert.equal(validateQrSessionInput({activityName:'Service',heldAt:'2026-11-02T08:00:00Z'},now).valid,false);
});
