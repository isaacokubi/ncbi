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

  if (!['super_admin', 'international_executive', 'national_admin', 'branch_admin'].includes(role)) {
    return 'Registration approval permission required.';
  }

  if (target?.registrationCategory !== 'non_member') {
    return 'Administrators may approve non-member applications only. Member applications belong to the selected branch pastor.';
  }

  if (role === 'branch_admin' && (!actorOrganisation || targetOrganisation !== actorOrganisation)) {
    return 'Branch administrators may approve non-member applications only within their assigned branch.';
  }

  return null;
}
