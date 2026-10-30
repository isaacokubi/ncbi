import { Router } from 'express';
import mongoose from 'mongoose';
import { OperationsRecord, AuditLog } from '../models/domain.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { accessibleOrganisationIds, assertOrganisationAccess } from '../middleware/organisationScope.js';
import { validateEventRegistrationInput, validateEventRegistrationStatus } from '../domain/eventRegistrationPolicy.js';

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
  return filter;
}

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
