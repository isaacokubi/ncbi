import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attendanceDashboardFilter,
  attendanceWorkspaceFilter,
  canSeeUpcomingEvents,
  dashboardMetricsForRole,
  dashboardPendingApprovalsForRole,
  reportPayloadForRole
} from './dashboardPolicy.js';

const breakdown = {
  registrations: 2,
  organisations: 3,
  finance: 5,
  budgets: 7,
  operations: 11
};

test('approval totals follow each role authority', () => {
  assert.equal(dashboardPendingApprovalsForRole('treasurer', breakdown), 0);
  assert.equal(dashboardPendingApprovalsForRole('department_leader', breakdown), 0);
  assert.equal(dashboardPendingApprovalsForRole('branch_admin', breakdown), 13);
  assert.equal(dashboardPendingApprovalsForRole('branch_pastor', breakdown), 25);
  assert.equal(dashboardPendingApprovalsForRole('national_admin', breakdown), 28);
});

test('approval totals safely ignore missing, invalid and negative values', () => {
  assert.equal(dashboardPendingApprovalsForRole('national_admin', {
    registrations: -4,
    organisations: 'not-a-number',
    finance: 3
  }), 3);
});

test('department leaders only receive their own attendance in dashboard and workspace filters', () => {
  const user = { role: 'department_leader', _id: 'leader-1' };
  const ids = ['branch-1'];
  const start = new Date('2026-10-01T00:00:00.000Z');
  assert.deepEqual(attendanceDashboardFilter(user, ids, start), {
    organisation: { $in: ids },
    heldAt: { $gte: start },
    recordedBy: 'leader-1'
  });
  assert.deepEqual(attendanceWorkspaceFilter(user, ids), {
    organisation: { $in: ids },
    recordedBy: 'leader-1'
  });
});

test('other authorised roles retain organisation-scoped attendance filters', () => {
  const user = { role: 'branch_pastor', _id: 'pastor-1' };
  const ids = ['branch-1', 'branch-2'];
  const start = new Date('2026-10-01T00:00:00.000Z');
  assert.deepEqual(attendanceDashboardFilter(user, ids, start), {
    organisation: { $in: ids },
    heldAt: { $gte: start }
  });
  assert.deepEqual(attendanceWorkspaceFilter(user, ids), {
    organisation: { $in: ids }
  });
});

test('department leaders cannot see upcoming events while other roles can', () => {
  assert.equal(canSeeUpcomingEvents({ role: 'department_leader' }), false);
  assert.equal(canSeeUpcomingEvents({ role: 'branch_pastor' }), true);
});

test('dashboard metrics expose only role-relevant fields', () => {
  const metrics = {
    branches: 4,
    members: 120,
    visitors: 8,
    attendanceRecordsThisMonth: 35,
    confirmedIncomeThisMonth: [{ _id: 'KES', total: 1000 }],
    confirmedExpensesThisMonth: [{ _id: 'KES', total: 400 }],
    pendingApprovals: 6
  };
  assert.deepEqual(dashboardMetricsForRole('department_leader', metrics), {
    attendanceRecordsThisMonth: 35
  });
  assert.deepEqual(dashboardMetricsForRole('treasurer', metrics), {
    confirmedIncomeThisMonth: metrics.confirmedIncomeThisMonth,
    confirmedExpensesThisMonth: metrics.confirmedExpensesThisMonth,
  });
  assert.deepEqual(dashboardMetricsForRole('branch_admin', metrics), {
    branches: 4,
    members: 120,
    visitors: 8,
    attendanceRecordsThisMonth: 35,
    pendingApprovals: 6
  });
});

test('treasurer report payload excludes non-financial trend and scope detail', () => {
  const payload = {
    generatedAt: '2026-10-30T00:00:00.000Z',
    period: { months: 12 },
    scope: { organisationUnits: 2, memberCount: 100, branchNames: ['A', 'B'] },
    totals: { income: 1000, expenses: 300 },
    trend: [{ month: '2026-10', label: 'Oct 2026', finance: { income: 1000 }, attendance: 30 }]
  };
  assert.deepEqual(reportPayloadForRole('treasurer', payload), {
    generatedAt: payload.generatedAt,
    period: payload.period,
    scope: { organisationUnits: 2 },
    totals: payload.totals,
    trend: [{ month: '2026-10', label: 'Oct 2026', finance: { income: 1000 } }]
  });
  assert.equal(reportPayloadForRole('national_admin', payload), payload);
});


test('platform, international and national dashboards receive distinct indicators', () => {
  const metrics = {
    organisationUnits: 42, activeOrganisations: 38, activeUsers: 120, pendingAccounts: 4,
    nationalOffices: 5, regionalUnits: 12, districtUnits: 24, branches: 90,
    members: 2400, visitors: 120, attendanceRecordsThisMonth: 850,
    confirmedIncomeThisMonth: [{ _id: 'KES', total: 500000 }],
    confirmedExpensesThisMonth: [{ _id: 'KES', total: 200000 }], pendingApprovals: 9
  };
  const platform = dashboardMetricsForRole('super_admin', metrics);
  const international = dashboardMetricsForRole('international_executive', metrics);
  const national = dashboardMetricsForRole('national_admin', metrics);
  assert.deepEqual(Object.keys(platform), ['organisationUnits','activeOrganisations','activeUsers','pendingAccounts','branches']);
  assert.ok(Object.hasOwn(international, 'nationalOffices'));
  assert.ok(!Object.hasOwn(international, 'activeUsers'));
  assert.ok(Object.hasOwn(national, 'regionalUnits'));
  assert.ok(!Object.hasOwn(national, 'nationalOffices'));
  assert.ok(!Object.hasOwn(national, 'organisationUnits'));
});
