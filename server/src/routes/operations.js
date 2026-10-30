import { Router } from 'express';
import mongoose from 'mongoose';
import { OperationsRecord, AuditLog } from '../models/domain.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { accessibleOrganisationIds, assertOrganisationAccess } from '../middleware/organisationScope.js';

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
