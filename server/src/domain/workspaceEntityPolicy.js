const managementRoles = new Set([
  'super_admin','international_executive','national_admin','regional_overseer',
  'district_pastor','branch_pastor','branch_admin'
]);

// Ministry leaders may read only the operational records used by their
// assigned workspace. Writes remain restricted to management roles and
// dedicated attendance permissions.
const departmentLeaderReadEntities = new Set([
  'department','event','discipleship_course','service_plan'
]);

export function canReadOperationsEntity(user, entity) {
  if (!user?.role) return false;
  if (managementRoles.has(user.role)) return true;
  if (user.role === 'department_leader') return departmentLeaderReadEntities.has(entity);
  // Members use /portal and dedicated event-registration routes. Treasurers
  // use finance/accounting routes, not the generic operations record API.
  return false;
}

export function canWriteOperationsEntity(user) {
  return Boolean(user?.role && managementRoles.has(user.role));
}
