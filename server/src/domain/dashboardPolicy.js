// Pure dashboard scope helpers; database filters remain enforced server-side.
export function attendanceDashboardFilter(user, organisationIds, start) {
  return { organisation: { $in: organisationIds }, heldAt: { $gte: start }, ...(user.role === 'department_leader' ? { recordedBy: user._id } : {}) };
}
export function attendanceWorkspaceFilter(user, organisationIds) {
  return { organisation: { $in: organisationIds }, ...(user.role === 'department_leader' ? { recordedBy: user._id } : {}) };
}
export function canSeeUpcomingEvents(user) { return user.role !== 'department_leader'; }
