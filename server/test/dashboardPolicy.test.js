import test from 'node:test';
import assert from 'node:assert/strict';
import { dashboardMetricsForRole, reportPayloadForRole } from '../src/domain/dashboardPolicy.js';
const metrics={branches:3,members:120,visitors:9,attendanceRecordsThisMonth:44,confirmedIncomeThisMonth:[{_id:'KES',total:10}],confirmedExpensesThisMonth:[{_id:'KES',total:4}],pendingApprovals:2};
test('treasurer dashboard exposes finance KPIs only',()=>assert.deepEqual(dashboardMetricsForRole('treasurer',metrics),{confirmedIncomeThisMonth:metrics.confirmedIncomeThisMonth,confirmedExpensesThisMonth:metrics.confirmedExpensesThisMonth,pendingApprovals:2}));
test('branch admin dashboard excludes financial KPIs',()=>assert.deepEqual(dashboardMetricsForRole('branch_admin',metrics),{branches:3,members:120,visitors:9,attendanceRecordsThisMonth:44,pendingApprovals:2}));
test('treasurer report payload contains finance aggregates only',()=>{
 const source={generatedAt:'now',period:{months:12},scope:{organisationUnits:2,branches:5},totals:{KES:{income:10}},trend:[{month:'2026-10',label:'Oct',newMembers:8,attendanceRecords:44,finance:{KES:{income:10}}}],ministryActivity:[{entity:'event',count:2}],branchPerformance:[{name:'Branch'}]};
 assert.deepEqual(reportPayloadForRole('treasurer',source),{generatedAt:'now',period:{months:12},scope:{organisationUnits:2},totals:source.totals,trend:[{month:'2026-10',label:'Oct',finance:{KES:{income:10}}}]});
});

test('department leader dashboard exposes attendance activity only',()=>assert.deepEqual(dashboardMetricsForRole('department_leader',metrics),{attendanceRecordsThisMonth:44}));
test('branch pastor dashboard includes scoped stewardship indicators',()=>{
 const result=dashboardMetricsForRole('branch_pastor',metrics);
 assert.equal(result.members,120);
 assert.equal(result.attendanceRecordsThisMonth,44);
 assert.deepEqual(result.confirmedIncomeThisMonth,metrics.confirmedIncomeThisMonth);
 assert.deepEqual(result.confirmedExpensesThisMonth,metrics.confirmedExpensesThisMonth);
});
test('senior leadership dashboard retains organisation-wide operational indicators',()=>{
 const result=dashboardMetricsForRole('national_admin',metrics);
 assert.equal(result.branches,3);
 assert.equal(result.members,120);
 assert.equal(result.pendingApprovals,2);
});

import { dashboardPendingApprovalsForRole } from '../src/domain/dashboardPolicy.js';

test('pending approvals include registrations, organisation requests, finance, budgets and operational records',()=>{
 assert.equal(dashboardPendingApprovalsForRole('super_admin',{registrations:2,organisations:1,finance:3,budgets:4,operations:5}),15);
});
test('treasurers do not receive approval counts because finance decisions require an independent approver',()=>{
 assert.equal(dashboardPendingApprovalsForRole('treasurer',{registrations:8,organisations:7,finance:2,budgets:3,operations:9}),0);
});
test('department leaders do not receive approval counts they cannot administer',()=>{
 assert.equal(dashboardPendingApprovalsForRole('department_leader',{registrations:8,finance:2,operations:9}),0);
});
test('missing or invalid approval counts safely contribute zero',()=>{
 assert.equal(dashboardPendingApprovalsForRole('national_admin',{registrations:null,organisations:-2,finance:'bad',budgets:1}),1);
});

test('branch administrators only count approval queues they can act on',()=>{
 assert.equal(dashboardPendingApprovalsForRole('branch_admin',{registrations:2,organisations:8,finance:9,budgets:7,operations:1}),3);
});
