export function registrationScopeError(actor, target, accessibleIds = []) {
  const role = actor?.role;
  const actorOrganisation = String(actor?.organisation?._id ?? actor?.organisation ?? '');
  const targetOrganisation = String(target?.organisation?._id ?? target?.organisation ?? '');
  if (role === 'branch_pastor') {
    return target?.registrationCategory === 'member' && actorOrganisation && targetOrganisation === actorOrganisation
      ? null
      : 'Pastors may approve member applications only for their assigned branch.';
  }
  if (!accessibleIds.some(id => String(id) === targetOrganisation)) {
    return 'This registration belongs to an organisation outside your authorised scope.';
  }
  return null;
}

export function registrationDecisionError(actor, target) {
  const role = actor?.role;
  const actorOrganisation = String(actor?.organisation?._id ?? actor?.organisation ?? '');
  const targetOrganisation = String(target?.organisation?._id ?? target?.organisation ?? '');

  if (role === 'branch_pastor') {
    if (target?.registrationCategory !== 'member' || !actorOrganisation || targetOrganisation !== actorOrganisation) {
      return 'Pastors may approve member applications only for their assigned branch.';
    }
    return null;
  }

  if (!['super_admin', 'international_executive', 'national_admin', 'regional_overseer', 'district_pastor', 'branch_admin'].includes(role)) {
    return 'Registration approval permission required.';
  }

  if (!['non_member','official'].includes(target?.registrationCategory)) {
    return 'Administrators may approve non-member and official applications only. Member applications belong to the selected branch pastor.';
  }
  if (target?.registrationCategory === 'official') {
    const rank = { super_admin:100, international_executive:90, national_admin:80, regional_overseer:70, district_pastor:60, branch_pastor:50, branch_admin:45, treasurer:35, department_leader:25, member:10 };
    if (!target.requestedRole || rank[target.requestedRole] === undefined || rank[target.requestedRole] >= rank[role]) return 'You are not authorised to approve the requested church dashboard.';
  }

  if (role === 'branch_admin' && (!actorOrganisation || targetOrganisation !== actorOrganisation)) {
    return 'Branch administrators may approve non-member applications only within their assigned branch.';
  }

  return null;
}
