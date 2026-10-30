export function tokenVersionMatches(tokenVersion, currentVersion) {
  return Number(tokenVersion || 0) === Number(currentVersion || 0);
}

export function passwordChangeError(currentPassword, newPassword) {
  if (!currentPassword || String(newPassword || '').length < 14) return 'Enter your current password and a new password of at least 14 characters';
  if (currentPassword === newPassword) return 'Your new password must be different from your current password';
  return null;
}
