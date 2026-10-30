// Pure dashboard scope helpers; database filters remain enforced server-side.
export function attendanceDashboardFilter(user, organisationIds, start) {
  return { organisation: { $in: organisationIds }, heldAt: { $gte: start }, ...(user.role === 'department_leader' ? { recordedBy: user._id } : {}) };
}
export function attendanceWorkspaceFilter(user, organisationIds) {
  return { organisation: { $in: organisationIds }, ...(user.role === 'department_leader' ? { recordedBy: user._id } : {}) };
}
export function canSeeUpcomingEvents(user) { return user.role !== 'department_leader'; }

export function dashboardMetricsForRole(role, metrics) {
  if (role === 'department_leader') return { attendanceRecordsThisMonth: metrics.attendanceRecordsThisMonth };
  if (role === 'treasurer') return { confirmedIncomeThisMonth: metrics.confirmedIncomeThisMonth, confirmedExpensesThisMonth: metrics.confirmedExpensesThisMonth };
  if (role === 'branch_admin') return { branches: metrics.branches, members: metrics.members, visitors: metrics.visitors, attendanceRecordsThisMonth: metrics.attendanceRecordsThisMonth, pendingApprovals: metrics.pendingApprovals };
  return metrics;
}
export function reportPayloadForRole(role, payload) {
  if (role !== 'treasurer') return payload;
  return { generatedAt: payload.generatedAt, period: payload.period, scope: { organisationUnits: payload.scope.organisationUnits }, totals: payload.totals, trend: payload.trend.map(({ month, label, finance }) => ({ month, label, finance })) };
}
