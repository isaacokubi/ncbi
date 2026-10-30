// Only the platform administrator may bypass the assigned organisation hierarchy.
export function isPlatformWideOrganisationRole(role) {
  return role === 'super_admin';
}
