import test from 'node:test';
import assert from 'node:assert/strict';
import { attendanceDashboardFilter, attendanceWorkspaceFilter, canSeeUpcomingEvents } from '../src/domain/dashboardPolicy.js';
const ids=['branch-a','branch-b'];
const start=new Date('2026-10-01T00:00:00.000Z');
test('department leader dashboard attendance is limited to records they entered',()=>{
 const filter=attendanceDashboardFilter({_id:'leader-1',role:'department_leader'},ids,start);
 assert.deepEqual(filter,{organisation:{$in:ids},heldAt:{$gte:start},recordedBy:'leader-1'});
 assert.equal(canSeeUpcomingEvents({role:'department_leader'}),false);
});
test('leadership dashboard attendance retains authorised organisation scope',()=>{
 const filter=attendanceDashboardFilter({_id:'pastor-1',role:'branch_pastor'},ids,start);
 assert.deepEqual(filter,{organisation:{$in:ids},heldAt:{$gte:start}});
 assert.equal(canSeeUpcomingEvents({role:'branch_pastor'}),true);
});
test('department leader attendance workspace cannot list other users records',()=>{
 assert.deepEqual(attendanceWorkspaceFilter({_id:'leader-1',role:'department_leader'},ids),{organisation:{$in:ids},recordedBy:'leader-1'});
});
