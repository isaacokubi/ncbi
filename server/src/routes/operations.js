import { Router } from 'express';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { randomUUID } from 'node:crypto';
import { OperationsRecord, AuditLog, SafeguardingConsent } from '../models/domain.js';
import { validateSafeguardingConsentInput, validateSafeguardingRevocation } from '../domain/safeguardingPolicy.js';
import { Member } from '../models/index.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { accessibleOrganisationIds, assertOrganisationAccess } from '../middleware/organisationScope.js';
import { validateEventRegistrationInput, validateEventRegistrationStatus } from '../domain/eventRegistrationPolicy.js';
import { validateQrSessionInput } from '../domain/attendanceQrPolicy.js';

const router = Router();
router.use(requireAuth);
const entities = new Set(['department','event','pastoral_case','prayer_request','mission','discipleship_course','service_plan','leadership_appointment','asset','project','document','visitor_follow_up','announcement','volunteer','training','property','children_ministry','youth_ministry','family_ministry','small_group','baptism','wedding','funeral','benevolence','facility_booking','inventory','procurement','communications','media','transport','compliance','member_class','volunteer_schedule','event_registration','sermon','church_plant','sponsorship','donation_pledge','ministry_report','welfare_visit','discipline_case','counselling_case']);
const sensitiveEntities = new Set(['pastoral_case','prayer_request','benevolence','discipline_case','counselling_case']);
const managers = new Set(['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin']);
const canManageSensitive = new Set(['super_admin','international_executive','national_admin','branch_pastor']);

async function audit(req, action, entity, record, summary) {
  await AuditLog.create({ organisation: record?.organisation ?? req.user.organisation?._id ?? req.user.organisation, actor: req.user._id, action, entity, recordId: record?._id, summary, ipAddress: req.ip, userAgent: req.get('user-agent') });
}
function safeData(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) return null;
  try { if (JSON.stringify(data).length > 30000) return null; } catch { return null; }
  return data;
}
function privateRecordScope(user) {
  return { $or: [{ createdBy: user._id }, { owner: user._id }, { assignedTo: user._id }] };
}
function scopedRecordFilter(entity, ids, user) {
  const filter = { entity, organisation: { $in: ids }, status: { $ne: 'archived' } };
  if (sensitiveEntities.has(entity)) filter.$and = [privateRecordScope(user)];
  // Attendee contact details are not a public member directory. Members can
  // read their own registration only; leadership uses the dedicated register.
  if (entity === 'event_registration' && user.role === 'member') filter.createdBy = user._id;
  return filter;
}


const safeguardingManagers = new Set(['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor']);
function canManageSafeguarding(user) {
  return safeguardingManagers.has(user.role) || (user.permissions || []).includes('safeguarding:manage');
}
function isMinor(dateOfBirth, at = new Date()) {
  if (!dateOfBirth) return false;
  const dob = new Date(dateOfBirth);
  if (Number.isNaN(dob.getTime()) || dob > at) return false;
  let age = at.getFullYear() - dob.getFullYear();
  if (at.getMonth() < dob.getMonth() || (at.getMonth() === dob.getMonth() && at.getDate() < dob.getDate())) age--;
  return age < 18;
}

// Dedicated, immutable-after-capture consent records; audit summaries omit contact details.

const attendanceManagers = new Set(['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin','department_leader']);
const attendanceCategories = new Set(['sunday_service','midweek_service','prayer','bible_study','department','conference','outreach','other']);
// QR session tokens are signed, short-lived and bound to one organisation and service.
router.post('/attendance/qr-session', async (req, res, next) => {
  try {
    if (!attendanceManagers.has(req.user.role)) return res.status(403).json({ message: 'Attendance session management permission required' });
    const validation = validateQrSessionInput(req.body, new Date());
    if (!validation.valid) return res.status(400).json({ message: validation.message });
    const organisation = req.body.organisation || (req.user.organisation?._id ?? req.user.organisation);
    if (!mongoose.isValidObjectId(organisation) || !(await assertOrganisationAccess(req.user, organisation))) return res.status(403).json({ message: 'Organisation is outside your authorised scope' });
    const token = jwt.sign({
      purpose: 'ncbi-attendance-checkin', organisation: String(organisation),
      ...validation.value, heldAt: validation.value.heldAt.toISOString()
    }, process.env.JWT_SECRET, {
      algorithm: 'HS256', expiresIn: '10m', jwtid: randomUUID(),
      issuer: 'ncbi-cms', audience: 'attendance-checkin'
    });
    res.status(201).json({ token, expiresInSeconds: 600, activityName: validation.value.activityName, category: validation.value.category, heldAt: validation.value.heldAt, organisation });
  } catch (error) { next(error); }
});

router.post('/attendance/qr-checkin', async (req, res, next) => {
  try {
    const { token, member: memberId } = req.body;
    if (!token || typeof token !== 'string' || token.length > 4096 || !mongoose.isValidObjectId(memberId)) return res.status(400).json({ message: 'A valid session token and member identifier are required' });
    let session;
    try {
      session = jwt.verify(token, process.env.JWT_SECRET, { algorithms: ['HS256'], issuer: 'ncbi-cms', audience: 'attendance-checkin' });
    } catch {
      return res.status(401).json({ message: 'QR session is invalid or expired; ask an usher for a new code' });
    }
    if (session.purpose !== 'ncbi-attendance-checkin' || !mongoose.isValidObjectId(session.organisation) || !attendanceCategories.has(session.category) || !session.jti) return res.status(401).json({ message: 'QR session is not a valid attendance session' });
    if (!(await assertOrganisationAccess(req.user, session.organisation))) return res.status(403).json({ message: 'QR session belongs to another organisation' });
    if (req.user.role === 'member' && String(req.user.memberProfile || '') !== String(memberId)) return res.status(403).json({ message: 'Members can only check in their own profile' });
    const member = await Member.findOne({ _id: memberId, homeOrganisation: session.organisation, status: { $in: ['member','worker','minister','new_believer'] } }).select('_id').lean();
    if (!member) return res.status(404).json({ message: 'Active member profile not found in this branch' });
    const heldAt = new Date(session.heldAt);
    const existing = await Attendance.findOne({ organisation: session.organisation, member: member._id, heldAt, activityName: session.activityName }).lean();
    if (existing) return res.json({ attendance: existing, alreadyCheckedIn: true });
    try {
      const attendance = await Attendance.create({
        organisation: session.organisation, member: member._id,
        activityName: session.activityName, category: session.category,
        heldAt, recordedBy: req.user._id, checkInMethod: 'qr'
      });
      await AuditLog.create({ organisation: session.organisation, actor: req.user._id, action: 'qr-attendance-checkin', entity: 'attendance', recordId: attendance._id, summary: 'Member checked in using a signed QR session' });
      return res.status(201).json({ attendance, alreadyCheckedIn: false });
    } catch (error) {
      if (error.code === 11000) {
        const winner = await Attendance.findOne({ organisation: session.organisation, member: member._id, heldAt, activityName: session.activityName }).lean();
        if (winner) return res.json({ attendance: winner, alreadyCheckedIn: true });
      }
      return next(error);
    }
  } catch (error) { next(error); }
});

router.get('/safeguarding/consents', async (req, res, next) => {
  try {
    if (!canManageSafeguarding(req.user)) return res.status(403).json({ message: 'Specific child safeguarding permission required' });
    const ids = await accessibleOrganisationIds(req.user);
    const filter = { organisation: { $in: ids } };
    if (req.query.child) {
      if (!mongoose.isValidObjectId(req.query.child)) return res.status(400).json({ message: 'Invalid child identifier' });
      filter.child = req.query.child;
    }
    if (['active','revoked'].includes(req.query.status)) filter.status = req.query.status;
    const consents = await SafeguardingConsent.find(filter).sort({ createdAt: -1 }).limit(100)
      .populate('child', 'firstName lastName membershipNumber dateOfBirth')
      .populate('capturedBy', 'fullName').populate('revokedBy', 'fullName').lean();
    res.json({ consents });
  } catch (error) { next(error); }
});

router.post('/safeguarding/consents', async (req, res, next) => {
  try {
    if (!canManageSafeguarding(req.user)) return res.status(403).json({ message: 'Specific child safeguarding permission required' });
    const childId = req.body.child;
    if (!mongoose.isValidObjectId(childId)) return res.status(400).json({ message: 'A valid child member identifier is required' });
    const ids = await accessibleOrganisationIds(req.user);
    const child = await Member.findOne({ _id: childId, homeOrganisation: { $in: ids } }).select('_id homeOrganisation dateOfBirth').lean();
    if (!child || !isMinor(child.dateOfBirth)) return res.status(404).json({ message: 'An eligible minor in your organisation scope was not found' });
    const validation = validateSafeguardingConsentInput(req.body, child, new Date());
    if (!validation.valid) return res.status(400).json({ message: validation.message });
    const consent = await SafeguardingConsent.create({ organisation: child.homeOrganisation, child: child._id, ...validation.value, capturedBy: req.user._id, status: 'active' });
    await AuditLog.create({ organisation: child.homeOrganisation, actor: req.user._id, action: 'safeguarding-consent-captured', entity: 'safeguarding_consent', recordId: consent._id, summary: 'Child safeguarding consent recorded' });
    res.status(201).json({ consent });
  } catch (error) { next(error); }
});

router.patch('/safeguarding/consents/:id/revoke', async (req, res, next) => {
  try {
    if (!canManageSafeguarding(req.user)) return res.status(403).json({ message: 'Specific child safeguarding permission required' });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Consent record not found' });
    const validation = validateSafeguardingRevocation(req.body);
    if (!validation.valid) return res.status(400).json({ message: validation.message });
    const ids = await accessibleOrganisationIds(req.user);
    const consent = await SafeguardingConsent.findOne({ _id: req.params.id, organisation: { $in: ids } });
    if (!consent) return res.status(404).json({ message: 'Consent record not found' });
    if (consent.status === 'revoked') return res.json({ consent, alreadyRevoked: true });
    consent.status = 'revoked'; consent.revokedBy = req.user._id; consent.revokedAt = new Date(); consent.revocationReason = validation.value.reason;
    await consent.save();
    await AuditLog.create({ organisation: consent.organisation, actor: req.user._id, action: 'safeguarding-consent-revoked', entity: 'safeguarding_consent', recordId: consent._id, summary: 'Child safeguarding consent revoked' });
    res.json({ consent, alreadyRevoked: false });
  } catch (error) { next(error); }
});

// Keep this fixed path before /:entity so "audit" is not parsed as an entity name.
router.get('/audit/logs', allowRoles('super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor'), async (req, res, next) => {
  try {
    const ids = await accessibleOrganisationIds(req.user);
    const logs = await AuditLog.find({ organisation: { $in: ids } }).sort({ createdAt: -1 }).limit(100).populate('actor','fullName email').lean();
    res.json({ logs });
  } catch (error) { next(error); }
});

// Authenticated members can register themselves for an event without receiving
// access to the event's administrative register or other attendees' details.
router.post('/events/:id/register', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Event not found' });
    const validation = validateEventRegistrationInput(req.body, req.user);
    if (!validation.valid) return res.status(400).json({ message: validation.message });
    const ids = await accessibleOrganisationIds(req.user);
    const event = await OperationsRecord.findOne({
      _id: req.params.id, entity: 'event', organisation: { $in: ids },
      status: { $nin: ['archived', 'cancelled', 'completed'] }
    }).select('_id organisation title startAt').lean();
    if (!event) return res.status(404).json({ message: 'Event is unavailable or outside your organisation scope' });

    const reference = `${event._id}:${req.user._id}`;
    const existing = await OperationsRecord.findOne({ organisation: event.organisation, entity: 'event_registration', reference });
    if (existing) {
      if (existing.status === 'cancelled') {
        existing.status = 'pending';
        existing.data = { ...existing.data, ...validation.value, registeredAt: new Date(), cancelledAt: null };
        existing.updatedBy = req.user._id;
        await existing.save();
        await audit(req, 're-register', 'event_registration', existing, `Re-registered for ${event.title}`);
        return res.json({ registration: existing, alreadyRegistered: false });
      }
      return res.json({ registration: existing, alreadyRegistered: true });
    }

    const registration = await OperationsRecord.create({
      organisation: event.organisation, entity: 'event_registration',
      title: `${event.title} — ${validation.value.attendeeName}`,
      reference, status: 'pending', startAt: event.startAt,
      owner: req.user._id, visibility: 'organisation',
      data: { eventId: event._id, attendeeUserId: req.user._id, ...validation.value, registeredAt: new Date() },
      createdBy: req.user._id, updatedBy: req.user._id
    });
    await audit(req, 'register', 'event_registration', registration, `Registered for ${event.title}`);
    return res.status(201).json({ registration, alreadyRegistered: false });
  } catch (error) {
    // The unique organisation/entity/reference index closes the concurrent
    // double-submit race; return the winning registration as an idempotent result.
    if (error.code === 11000 && mongoose.isValidObjectId(req.params.id)) {
      const ids = await accessibleOrganisationIds(req.user);
      const event = await OperationsRecord.findOne({ _id: req.params.id, entity: 'event', organisation: { $in: ids } }).select('organisation').lean();
      const registration = event && await OperationsRecord.findOne({
        organisation: event.organisation, entity: 'event_registration',
        reference: `${req.params.id}:${req.user._id}`
      }).lean();
      if (registration) return res.json({ registration, alreadyRegistered: true });
    }
    return next(error);
  }
});

router.patch('/events/:id/register/cancel', async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Registration not found' });
    const ids = await accessibleOrganisationIds(req.user);
    const registration = await OperationsRecord.findOne({
      entity: 'event_registration', organisation: { $in: ids },
      reference: `${req.params.id}:${req.user._id}`, status: { $ne: 'archived' }
    });
    if (!registration) return res.status(404).json({ message: 'Registration not found' });
    if (registration.status === 'cancelled') return res.json({ registration });
    registration.status = 'cancelled';
    registration.data = { ...registration.data, cancelledAt: new Date() };
    registration.updatedBy = req.user._id;
    await registration.save();
    await audit(req, 'cancel-registration', 'event_registration', registration, 'Cancelled own event registration');
    res.json({ registration });
  } catch (error) { next(error); }
});

router.get('/events/:id/registrations', allowRoles('super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Event not found' });
    const ids = await accessibleOrganisationIds(req.user);
    const event = await OperationsRecord.findOne({ _id: req.params.id, entity: 'event', organisation: { $in: ids } }).select('_id organisation').lean();
    if (!event) return res.status(404).json({ message: 'Event not found' });
    const registrations = await OperationsRecord.find({
      organisation: event.organisation, entity: 'event_registration',
      'data.eventId': event._id, status: { $ne: 'archived' }
    }).sort({ createdAt: -1 }).lean();
    res.json({ registrations, total: registrations.length });
  } catch (error) { next(error); }
});

router.patch('/event-registrations/:id/status', allowRoles('super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin'), async (req, res, next) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Registration not found' });
    if (!validateEventRegistrationStatus(req.body.status)) return res.status(400).json({ message: 'Status must be pending, confirmed, waitlisted or cancelled' });
    const ids = await accessibleOrganisationIds(req.user);
    const registration = await OperationsRecord.findOne({
      _id: req.params.id, entity: 'event_registration', organisation: { $in: ids }
    });
    if (!registration) return res.status(404).json({ message: 'Registration not found' });
    registration.status = req.body.status;
    registration.updatedBy = req.user._id;
    registration.data = { ...registration.data, statusChangedAt: new Date(), statusChangedBy: req.user._id };
    await registration.save();
    await audit(req, 'registration-status', 'event_registration', registration, `Set registration status to ${registration.status}`);
    res.json({ registration });
  } catch (error) { next(error); }
});

router.get('/:entity', async (req, res, next) => {
  try {
    const { entity } = req.params;
    if (!entities.has(entity)) return res.status(404).json({ message: 'Unknown workspace module' });
    if (sensitiveEntities.has(entity) && !canManageSensitive.has(req.user.role)) return res.status(403).json({ message: 'Restricted pastoral information' });
    const ids = await accessibleOrganisationIds(req.user);
    const page = Math.max(1, Math.min(1000, Number(req.query.page) || 1));
    const limit = Math.max(1, Math.min(100, Number(req.query.limit) || 25));
    const filter = scopedRecordFilter(entity, ids, req.user);
    if (req.query.status && ['draft','pending','active','scheduled','in_progress','completed','cancelled','closed','archived'].includes(req.query.status)) filter.status = req.query.status;
    if (req.query.search) filter.title = { $regex: String(req.query.search).slice(0, 80).replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), $options: 'i' };
    const [records, total] = await Promise.all([
      OperationsRecord.find(filter).sort({ startAt: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('organisation','name code level').lean(),
      OperationsRecord.countDocuments(filter)
    ]);
    res.json({ records, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
});

router.post('/:entity', async (req, res, next) => {
  try {
    const { entity } = req.params;
    if (!entities.has(entity)) return res.status(404).json({ message: 'Unknown workspace module' });
    if (!managers.has(req.user.role)) return res.status(403).json({ message: 'You cannot create workspace records' });
    if (sensitiveEntities.has(entity) && !canManageSensitive.has(req.user.role)) return res.status(403).json({ message: 'Restricted pastoral information' });
    const { title, organisation, reference, status, startAt, endAt, assignedTo, visibility, data } = req.body;
    if (!String(title || '').trim()) return res.status(400).json({ message: 'A title is required' });
    const targetOrg = organisation || (req.user.organisation?._id ?? req.user.organisation);
    if (!mongoose.isValidObjectId(targetOrg) || !(await assertOrganisationAccess(req.user, targetOrg))) return res.status(403).json({ message: 'Organisation is outside your authorised scope' });
    if (sensitiveEntities.has(entity) && visibility === 'organisation') return res.status(400).json({ message: 'Sensitive pastoral records cannot be organisation-wide' });
    const payload = safeData(data ?? {});
    if (!payload) return res.status(400).json({ message: 'Record data must be an object under 30KB' });
    const record = await OperationsRecord.create({
      organisation: targetOrg, entity, title, reference, status, startAt, endAt, assignedTo,
      owner: req.user._id,
      visibility: sensitiveEntities.has(entity) ? (visibility || 'private') : (visibility || 'organisation'),
      data: payload, createdBy: req.user._id, updatedBy: req.user._id
    });
    await audit(req, 'create', entity, record, `Created ${entity}: ${record.title}`);
    res.status(201).json({ record });
  } catch (error) { next(error); }
});

router.patch('/:entity/:id', async (req, res, next) => {
  try {
    const { entity, id } = req.params;
    if (!entities.has(entity) || !mongoose.isValidObjectId(id)) return res.status(404).json({ message: 'Record not found' });
    if (!managers.has(req.user.role)) return res.status(403).json({ message: 'You cannot update workspace records' });
    if (sensitiveEntities.has(entity) && !canManageSensitive.has(req.user.role)) return res.status(403).json({ message: 'Restricted pastoral information' });
    const ids = await accessibleOrganisationIds(req.user);
    const filter = scopedRecordFilter(entity, ids, req.user); filter._id = id;
    const record = await OperationsRecord.findOne(filter);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    for (const key of ['title','reference','status','startAt','endAt','assignedTo','visibility']) if (req.body[key] !== undefined) record[key] = req.body[key];
    if (req.body.data !== undefined) {
      const payload = safeData(req.body.data);
      if (!payload) return res.status(400).json({ message: 'Record data must be an object under 30KB' });
      record.data = payload;
    }
    if (sensitiveEntities.has(entity) && record.visibility === 'organisation') return res.status(400).json({ message: 'Sensitive pastoral records cannot be organisation-wide' });
    record.updatedBy = req.user._id; await record.save();
    await audit(req, 'update', entity, record, `Updated ${entity}: ${record.title}`);
    res.json({ record });
  } catch (error) { next(error); }
});

router.delete('/:entity/:id', async (req, res, next) => {
  try {
    const { entity, id } = req.params;
    if (!entities.has(entity) || !mongoose.isValidObjectId(id)) return res.status(404).json({ message: 'Record not found' });
    if (!managers.has(req.user.role)) return res.status(403).json({ message: 'You cannot archive workspace records' });
    if (sensitiveEntities.has(entity) && !canManageSensitive.has(req.user.role)) return res.status(403).json({ message: 'Restricted pastoral information' });
    const ids = await accessibleOrganisationIds(req.user);
    const filter = scopedRecordFilter(entity, ids, req.user); filter._id = id;
    const record = await OperationsRecord.findOne(filter);
    if (!record) return res.status(404).json({ message: 'Record not found' });
    record.status = 'archived'; record.archivedAt = new Date(); record.updatedBy = req.user._id; await record.save();
    await audit(req, 'archive', entity, record, `Archived ${entity}: ${record.title}`);
    res.json({ message: 'Record archived' });
  } catch (error) { next(error); }
});

export default router;
