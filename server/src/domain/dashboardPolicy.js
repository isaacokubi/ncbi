// Pure dashboard scope helpers; database filters remain enforced server-side.
export function attendanceDashboardFilter(user, organisationIds, start) {
  return { organisation: { $in: organisationIds }, heldAt: { $gte: start }, ...(user.role === 'department_leader' ? { recordedBy: user._id } : {}) };
}
export function attendanceWorkspaceFilter(user, organisationIds) {
  return { organisation: { $in: organisationIds }, ...(user.role === 'department_leader' ? { recordedBy: user._id } : {}) };
}
export function canSeeUpcomingEvents(user) { return user.role !== 'department_leader'; }

export function dashboardPendingApprovalsForRole(role, breakdown) {
  const categories = role === 'department_leader' || role === 'treasurer' ? []
    : role === 'branch_admin' ? ['registrations','operations']
    : role === 'branch_pastor' ? ['registrations','finance','budgets','operations']
    : ['registrations','organisations','finance','budgets','operations'];
  return categories.reduce((total, key) => total + Math.max(0, Number(breakdown?.[key]) || 0), 0);
}

export function dashboardMetricsForRole(role, metrics) {
  if (role === 'super_admin') return {
    organisationUnits: metrics.organisationUnits,
    activeOrganisations: metrics.activeOrganisations,
    activeUsers: metrics.activeUsers,
    pendingAccounts: metrics.pendingAccounts,
    branches: metrics.branches
  };
  if (role === 'international_executive') return {
    nationalOffices: metrics.nationalOffices,
    regionalUnits: metrics.regionalUnits,
    districtUnits: metrics.districtUnits,
    branches: metrics.branches,
    members: metrics.members,
    visitors: metrics.visitors,
    attendanceRecordsThisMonth: metrics.attendanceRecordsThisMonth,
    confirmedIncomeThisMonth: metrics.confirmedIncomeThisMonth,
    confirmedExpensesThisMonth: metrics.confirmedExpensesThisMonth,
    pendingApprovals: metrics.pendingApprovals
  };
  if (role === 'national_admin') return {
    regionalUnits: metrics.regionalUnits,
    districtUnits: metrics.districtUnits,
    branches: metrics.branches,
    members: metrics.members,
    visitors: metrics.visitors,
    attendanceRecordsThisMonth: metrics.attendanceRecordsThisMonth,
    confirmedIncomeThisMonth: metrics.confirmedIncomeThisMonth,
    confirmedExpensesThisMonth: metrics.confirmedExpensesThisMonth,
    pendingApprovals: metrics.pendingApprovals
  };
  if (role === 'department_leader') return { attendanceRecordsThisMonth: metrics.attendanceRecordsThisMonth };
  if (role === 'treasurer') return { confirmedIncomeThisMonth: metrics.confirmedIncomeThisMonth, confirmedExpensesThisMonth: metrics.confirmedExpensesThisMonth };
  if (role === 'branch_admin') return { branches: metrics.branches, members: metrics.members, visitors: metrics.visitors, attendanceRecordsThisMonth: metrics.attendanceRecordsThisMonth, pendingApprovals: metrics.pendingApprovals };
  return metrics;
}
export function reportPayloadForRole(role, payload) {
  if (role !== 'treasurer') return payload;
  return { generatedAt: payload.generatedAt, period: payload.period, scope: { organisationUnits: payload.scope.organisationUnits }, totals: payload.totals, trend: payload.trend.map(({ month, label, finance }) => ({ month, label, finance })) };
}
