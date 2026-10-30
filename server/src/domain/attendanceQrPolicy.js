const allowedCategories = new Set(['sunday_service','midweek_service','prayer','bible_study','department','conference','outreach','other']);
export function validateQrSessionInput(input, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { valid: false, message: 'Session details are required' };
  const activityName = String(input.activityName || '').trim();
  const category = input.category || 'other';
  const heldAt = new Date(input.heldAt || '');
  if (!activityName || activityName.length > 80) return { valid: false, message: 'Activity name must be 1–80 characters' };
  if (!allowedCategories.has(category)) return { valid: false, message: 'Invalid attendance category' };
  if (Number.isNaN(heldAt.getTime()) || heldAt < new Date(now.getTime() - 86400000) || heldAt > new Date(now.getTime() + 86400000)) return { valid: false, message: 'Attendance session date must be within 24 hours of now' };
  return { valid: true, value: { activityName, category, heldAt } };
}
