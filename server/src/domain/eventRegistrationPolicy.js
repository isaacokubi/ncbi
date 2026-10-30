const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateEventRegistrationInput(input = {}, user = {}) {
  const attendeeName = String(user.fullName || '').trim();
  const email = String(user.email || '').trim().toLowerCase();
  if (!attendeeName || attendeeName.length > 120) {
    return { valid: false, message: 'The signed-in account must have a valid full name' };
  }
  if (!emailPattern.test(email) || email.length > 254) {
    return { valid: false, message: 'The signed-in account must have a valid email address' };
  }
  const notes = input.notes === undefined ? '' : String(input.notes).trim();
  if (notes.length > 500) return { valid: false, message: 'Registration notes cannot exceed 500 characters' };
  return { valid: true, value: { attendeeName, email, notes } };
}

export function validateEventRegistrationStatus(status) {
  return ['pending', 'confirmed', 'waitlisted', 'cancelled'].includes(status);
}
