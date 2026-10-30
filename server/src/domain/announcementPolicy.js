const headquartersRoles = new Set(['super_admin','international_executive','national_admin']);
const audiences = new Set(['congregation','leaders','members','visitors','public']);
const categories = new Set(['general','service_update','event','leadership','community','urgent','media_release']);

export function validateAnnouncementRecord({ title, data, visibility = 'organisation' } = {}, actor = {}, { existingPublic = false } = {}) {
  const cleanTitle = String(title || '').trim();
  if (!cleanTitle || cleanTitle.length > 180) return { valid: false, status: 400, message: 'Announcement title is required and must not exceed 180 characters' };
  if (!data || typeof data !== 'object' || Array.isArray(data)) return { valid: false, status: 400, message: 'Announcement details must be a valid object' };
  const message = String(data.message || '').trim();
  if (!message || message.length > 5000) return { valid: false, status: 400, message: 'Announcement message must contain 1–5,000 characters' };
  if (data.audience !== undefined && !audiences.has(data.audience)) return { valid: false, status: 400, message: 'Select a supported announcement audience' };
  if (data.category !== undefined && !categories.has(data.category)) return { valid: false, status: 400, message: 'Select a supported announcement category' };
  const isHeadquarters = headquartersRoles.has(actor.role);
  if ((visibility === 'public' || existingPublic) && !isHeadquarters) return { valid: false, status: 403, message: 'Only headquarters administrators may publish or modify notices on the public NCBI website' };
  return { valid: true };
}
