const categories = new Set(['sunday_service','midweek_service','prayer','bible_study','department','conference','outreach','other']);

/** Validate and normalise attendance input before any database writes. */
export function validateAttendanceInput(input = {}) {
  const activityName = String(input.activityName ?? '').trim();
  const heldAt = new Date(input.heldAt);
  const member = input.member ? String(input.member).trim() : null;
  const visitorName = String(input.visitorName ?? '').trim();
  const category = input.category || 'other';
  if (!activityName || activityName.length > 80) return { valid: false, message: 'Activity name is required and must be 80 characters or fewer' };
  if (!input.heldAt || Number.isNaN(heldAt.getTime())) return { valid: false, message: 'A valid attendance date is required' };
  if (!categories.has(category)) return { valid: false, message: 'Invalid attendance category' };
  if (!member && !visitorName) return { valid: false, message: 'Select a registered member or enter a visitor name' };
  if (member && visitorName) return { valid: false, message: 'An attendance record must identify either a member or a visitor, not both' };
  if (member && !/^[a-f\\d]{24}$/i.test(member)) return { valid: false, message: 'Invalid member identifier' };
  if (visitorName.length > 120) return { valid: false, message: 'Visitor name must be 120 characters or fewer' };
  return { valid: true, value: { activityName, category, heldAt, member, visitorName: visitorName || undefined } };
}
