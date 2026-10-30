export const MIN_PASSWORD_LENGTH = 6;

export function tokenVersionMatches(tokenVersion, currentVersion) {
  return Number(tokenVersion || 0) === Number(currentVersion || 0);
}

export function passwordLengthError(password, label = 'Password') {
  if (String(password || '').length < MIN_PASSWORD_LENGTH) return `${label} must be at least ${MIN_PASSWORD_LENGTH} characters`;
  return null;
}

export function passwordChangeError(currentPassword, newPassword) {
  if (!currentPassword) return 'Enter your current password';
  const lengthError = passwordLengthError(newPassword, 'New password');
  if (lengthError) return lengthError;
  if (currentPassword === newPassword) return 'Your new password must be different from your current password';
  return null;
}

export function phoneNumberError(value) {
  const phone = String(value || '').trim();
  if (!phone) return 'Enter a phone number.';
  if (phone.length > 40 || !/^\+?[0-9\s().-]+$/.test(phone)) return 'Enter a valid phone number using digits and common phone separators.';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 7 || digits.length > 15) return 'Enter a phone number containing 7 to 15 digits.';
  return null;
}
