import { Organisation } from '../models/index.js';

const DESCENDANT_ROLES = new Set(['super_admin','international_executive','national_admin','regional_overseer','district_pastor']);

export async function accessibleOrganisationIds(user) {
  const ownId = user.organisation?._id ?? user.organisation;
  if (!ownId) return [];
  if (user.role === 'super_admin') {
    return (await Organisation.find({ status: { $ne: 'archived' } }).distinct('_id'));
  }
  if (!DESCENDANT_ROLES.has(user.role)) return [ownId];
  const ids = [ownId];
  let frontier = [ownId];
  // Bound traversal to the five configured organisation levels.
  for (let depth = 0; depth < 5 && frontier.length; depth += 1) {
    const children = await Organisation.find({ parent: { $in: frontier }, status: { $ne: 'archived' } }).distinct('_id');
    frontier = children.filter(id => !ids.some(existing => String(existing) === String(id)));
    ids.push(...frontier);
  }
  return ids;
}

export async function assertOrganisationAccess(user, organisationId) {
  const ids = await accessibleOrganisationIds(user);
  return ids.some(id => String(id) === String(organisationId));
}
