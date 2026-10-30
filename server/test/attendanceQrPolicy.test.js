import test from 'node:test';
import assert from 'node:assert/strict';
import { validateQrSessionInput } from '../src/domain/attendanceQrPolicy.js';
const now = new Date('2026-10-30T09:00:00Z');
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
