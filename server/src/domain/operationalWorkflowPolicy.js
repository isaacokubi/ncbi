const headquartersRoles = new Set(['super_admin','international_executive','national_admin']);
const approvalStates = new Set(['draft','pending','approved','rejected','published']);
export function communicationApprovalError(role,currentStatus,nextStatus) {
  if (!approvalStates.has(nextStatus)) return {status:400,message:'Select a valid communication approval status'};
  if (['approved','rejected','published'].includes(nextStatus) && !headquartersRoles.has(role)) return {status:403,message:'Only headquarters leadership may approve, reject or publish church communications'};
  if (nextStatus==='published' && currentStatus!=='approved') return {status:409,message:'Approve the communication before publishing it'};
  return null;
}
export function validateAttendanceSessions(sessions) {
  if (!Array.isArray(sessions) || sessions.length>100) return 'Attendance history must contain no more than 100 sessions';
  for (const session of sessions) {
    if (!session || typeof session.sessionTitle!=='string' || !session.sessionTitle.trim() || session.sessionTitle.length>160 || !['present','late','absent','excused'].includes(session.attendanceStatus) || Number.isNaN(new Date(session.sessionDate).getTime())) return 'Each attendance entry needs a valid date, session title and attendance status';
  }
  return null;
}
