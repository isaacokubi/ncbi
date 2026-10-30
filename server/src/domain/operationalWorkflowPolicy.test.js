import test from 'node:test';
import assert from 'node:assert/strict';
import { communicationApprovalError, validateAttendanceSessions } from './operationalWorkflowPolicy.js';

test('communications approval requires headquarters authority',()=>{
 assert.equal(communicationApprovalError('branch_admin','pending','approved').status,403);
 assert.equal(communicationApprovalError('national_admin','pending','approved'),null);
 assert.equal(communicationApprovalError('branch_pastor','draft','pending'),null);
});
test('publishing requires a previously approved communication',()=>{
 assert.equal(communicationApprovalError('national_admin','pending','published').status,409);
 assert.equal(communicationApprovalError('national_admin','approved','published'),null);
});
test('class attendance entries are bounded and validated',()=>{
 const valid=[{sessionDate:'2026-10-30',sessionTitle:'Foundations 1',attendanceStatus:'present'}];
 assert.equal(validateAttendanceSessions(valid),null);
 assert.match(validateAttendanceSessions([{...valid[0],attendanceStatus:'unknown'}]),/valid date/);
 assert.match(validateAttendanceSessions(Array.from({length:101},(_,i)=>({...valid[0],sessionTitle:'Lesson '+i}))),/100 sessions/);
});
