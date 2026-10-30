const allowedConsentTypes = new Set(['participation','photography','media_publication','emergency_medical','authorised_collection','offsite_travel']);
function ageAt(dateOfBirth, at) {
  if (!dateOfBirth) return null;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime()) || dob > at) return null;
  let age = at.getFullYear() - dob.getFullYear();
  if (at.getMonth() < dob.getMonth() || (at.getMonth() === dob.getMonth() && at.getDate() < dob.getDate())) age--;
  return age;
}
export function validateSafeguardingConsentInput(input, child, now = new Date()) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { valid: false, message: 'Consent details are required' };
  const age = ageAt(child?.dateOfBirth, now);
  if (age === null || age >= 18) return { valid: false, message: 'Consent workflow is only available for verified minors' };
  const guardianName = String(input.guardianName || '').trim();
  const guardianRelationship = String(input.guardianRelationship || '').trim();
  const guardianPhone = String(input.guardianPhone || '').trim();
  if (!guardianName || guardianName.length > 120 || !guardianRelationship || guardianRelationship.length > 60 || !/^\+?[0-9 ()-]{7,30}$/.test(guardianPhone)) return { valid: false, message: 'Valid guardian name, relationship and phone number are required' };
  if (input.guardianConfirmedAuthority !== true) return { valid: false, message: 'Guardian authority must be explicitly confirmed' };
  if (!Array.isArray(input.consentTypes) || !input.consentTypes.length || input.consentTypes.some(type => !allowedConsentTypes.has(type)) || new Set(input.consentTypes).size !== input.consentTypes.length) return { valid: false, message: 'Select one or more valid, non-duplicated consent purposes' };
  const validFrom = input.validFrom ? new Date(input.validFrom) : now;
  const validUntil = input.validUntil ? new Date(input.validUntil) : null;
  if (Number.isNaN(validFrom.getTime()) || validFrom > new Date(now.getTime() + 86400000)) return { valid: false, message: 'Consent start date is invalid' };
  if (validUntil && (Number.isNaN(validUntil.getTime()) || validUntil <= validFrom || validUntil > new Date(now.getTime() + 366 * 86400000))) return { valid: false, message: 'Consent expiry must be after its start and within one year' };
  const authorisedPickupPersons = input.authorisedPickupPersons ?? [];
  if (!Array.isArray(authorisedPickupPersons) || authorisedPickupPersons.length > 10 || authorisedPickupPersons.some(person => !person || !String(person.name || '').trim() || String(person.name).length > 120 || !/^\+?[0-9 ()-]{7,30}$/.test(String(person.phone || '').trim()))) return { valid: false, message: 'Authorised collection contacts must have a name and valid phone number (maximum 10)' };
  if (input.consentTypes.includes('authorised_collection') && !authorisedPickupPersons.length) return { valid: false, message: 'At least one authorised collection contact is required for collection consent' };
  return { valid: true, value: { guardianName, guardianRelationship, guardianPhone, guardianConfirmedAuthority: true, consentTypes: [...input.consentTypes], authorisedPickupPersons: authorisedPickupPersons.map(person => ({ name: String(person.name).trim(), phone: String(person.phone).trim() })), validFrom, validUntil } };
}
export function validateSafeguardingRevocation(input) {
  const reason = String(input?.reason || '').trim();
  if (!reason || reason.length > 300) return { valid: false, message: 'A revocation reason (1–300 characters) is required' };
  return { valid: true, value: { reason } };
}
