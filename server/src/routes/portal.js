import { Router } from 'express';
import mongoose from 'mongoose';
import { Member, User, Attendance, FinanceTransaction } from '../models/index.js';
import { OperationsRecord, AuditLog, DocumentFile } from '../models/domain.js';
import { calculateLessonProgress, setLessonCompletion } from '../domain/memberLearningPolicy.js';
import { requireAuth } from '../middleware/auth.js';
const router = Router();
router.use(requireAuth);
async function linkedMember(user) {
  if (user.role !== 'member') return { error: { status: 403, message: 'Member portal access is limited to member accounts' } };
  if (!user.memberProfile) return { error: { status: 409, message: 'Your account is not linked to a member profile. Contact your branch administrator.' } };
  const organisationId = user.organisation?._id ?? user.organisation;
  const member = await Member.findOne({ _id: user.memberProfile, homeOrganisation: organisationId });
  if (!member) return { error: { status: 404, message: 'Linked member profile is unavailable' } };
  return { member, organisationId };
}
function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, character => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[character]);
}
async function auditMemberAction(req, organisation, action, entity, recordId, summary) {
  await AuditLog.create({ organisation, actor: req.user._id, action, entity, recordId, summary });
}
router.get('/summary', async (req, res, next) => {
  try {
    const linked = await linkedMember(req.user);
    if (linked.error) return res.status(linked.error.status).json({ message: linked.error.message });
    const { member, organisationId } = linked;
    const now = new Date(), yearStart = new Date(now.getFullYear(), 0, 1);
    const [attendance, attendanceTotal, attendanceThisYear, lastAttendance, events, registrations, announcements, giving, prayerRequests, groups, courses, enrolments, notifications, documents] = await Promise.all([
      Attendance.find({ member: member._id, organisation: organisationId }).sort({ heldAt: -1 }).limit(20).select('activityName category heldAt checkInMethod').lean(),
      Attendance.countDocuments({ member: member._id, organisation: organisationId }),
      Attendance.countDocuments({ member: member._id, organisation: organisationId, heldAt: { $gte: yearStart } }),
      Attendance.findOne({ member: member._id, organisation: organisationId }).sort({ heldAt: -1 }).select('heldAt activityName').lean(),
      OperationsRecord.find({ organisation: organisationId, entity: 'event', status: { $in: ['scheduled','active'] }, startAt: { $gte: now } }).sort({ startAt: 1 }).limit(10).select('title startAt endAt reference data').lean(),
      OperationsRecord.find({ organisation: organisationId, entity: 'event_registration', createdBy: req.user._id, status: { $nin: ['archived','cancelled'] } }).sort({ createdAt: -1 }).limit(20).select('title status data createdAt').lean(),
      OperationsRecord.find({ organisation: organisationId, entity: 'announcement', status: 'active', visibility: { $in: ['organisation','public'] } }).sort({ createdAt: -1 }).limit(10).select('title startAt data createdAt').lean(),
      FinanceTransaction.find({ organisation: organisationId, member: member._id, direction: 'income', status: 'confirmed' }).sort({ occurredAt: -1 }).limit(100).select('category amount currency occurredAt reference paymentMethod').lean(),
      OperationsRecord.find({ organisation: organisationId, entity: 'prayer_request', createdBy: req.user._id, status: { $ne: 'archived' } }).sort({ createdAt: -1 }).limit(20).select('title status createdAt data').lean(),
      OperationsRecord.find({ organisation: organisationId, entity: 'small_group', status: 'active' }).sort({ title: 1 }).limit(100).select('title startAt endAt data').lean(),
      OperationsRecord.find({ organisation: organisationId, entity: 'discipleship_course', status: 'active' }).sort({ title: 1 }).limit(100).select('title startAt endAt data').lean(),
      OperationsRecord.find({ organisation: organisationId, entity: 'member_enrolment', createdBy: req.user._id, status: { $nin: ['archived','cancelled'] } }).sort({ createdAt: -1 }).limit(100).select('title status reference data createdAt').lean(),
      OperationsRecord.find({ organisation: organisationId, entity: 'member_notification', 'data.recipientUserId': String(req.user._id), status: { $ne: 'archived' } }).sort({ createdAt: -1 }).limit(50).select('title status data createdAt').lean(),
      OperationsRecord.find({ organisation: organisationId, entity: 'document', status: { $in: ['active','completed'] }, 'data.memberId': String(member._id) }).sort({ createdAt: -1 }).limit(50).select('title reference createdAt data').lean()
    ]);
    const documentIds = documents.map(document => document._id);
    const documentFiles = documentIds.length ? await DocumentFile.find({ organisation: organisationId, document: { $in: documentIds }, status: 'active' }).sort({ version: -1 }).select('document _id originalName mimeType size version createdAt').lean() : [];
    const filesByDocument = new Map();
    for (const file of documentFiles) { const key = String(file.document); if (!filesByDocument.has(key)) filesByDocument.set(key, []); filesByDocument.get(key).push({ id: file._id, originalName: file.originalName, mimeType: file.mimeType, size: file.size, version: file.version, createdAt: file.createdAt }); }
    const profile = {
      _id: member._id, membershipNumber: member.membershipNumber, firstName: member.firstName, lastName: member.lastName,
      phone: member.phone, email: member.email, residentialLocation: member.residentialLocation,
      emergencyContactName: member.emergencyContactName, emergencyContactRelationship: member.emergencyContactRelationship,
      emergencyContactPhone: member.emergencyContactPhone, status: member.status, joinedAt: member.joinedAt,
      ministries: member.ministries || [],
      homeOrganisation: await Member.populate(member, { path: 'homeOrganisation', select: 'name code' }).then(x => x.homeOrganisation)
    };
    const totalsByCurrency = giving.reduce((totals, transaction) => {
      const currency = transaction.currency || 'KES';
      totals[currency] = (totals[currency] || 0) + Number(transaction.amount?.toString?.() ?? transaction.amount ?? 0);
      return totals;
    }, {});
    res.json({
      profile, attendance,
      attendanceSummary: { total: attendanceTotal, thisYear: attendanceThisYear, lastAttendedAt: lastAttendance?.heldAt || null, lastActivity: lastAttendance?.activityName || null },
      upcomingEvents: events, registrations, announcements, giving: { transactions: giving, totalsByCurrency },
      prayerRequests: prayerRequests.map(({ _id, title, status, createdAt, data }) => ({ _id, title, status, createdAt, category: data?.category || 'General', followUpRequested: Boolean(data?.followUpRequested), memberVisibleUpdate: data?.memberVisibleUpdate || '' })),
      groups: groups.map(({ _id, title, startAt, data }) => ({ _id, title, meetingDay: data?.meetingDay || '', meetingTime: data?.meetingTime || '', location: data?.location || '', description: data?.description || '', enrolmentOpen: data?.enrolmentOpen !== false })),
      courses: courses.map(course => { const enrolment = enrolments.find(item => item.reference === `discipleship_course:${course._id}:${req.user._id}`); const progress = calculateLessonProgress(course.data?.lessons || [], enrolment?.data?.completedLessonIds || []); const canAccessLessons = ['active','in_progress','completed'].includes(enrolment?.status); return { _id: course._id, title: course.title, startAt: course.startAt, endAt: course.endAt, description: course.data?.description || '', enrolmentOpen: course.data?.enrolmentOpen !== false, enrolmentStatus: enrolment?.status || null, canAccessLessons, lessons: canAccessLessons ? progress.lessons : [], progressPercent: canAccessLessons ? progress.progressPercent : 0, completedLessons: canAccessLessons ? progress.completedLessonIds.length : 0, totalLessons: canAccessLessons ? progress.totalLessons : 0 }; }),
      enrolments, notifications,
      documents: documents.map(({ _id, title, reference, createdAt, data }) => ({ _id, title, reference, createdAt, documentType: data?.documentType || 'Member document', description: data?.description || '', files: filesByDocument.get(String(_id)) || [], downloadAvailable: (filesByDocument.get(String(_id)) || []).length > 0 }))
    });
  } catch (error) { next(error); }
});
router.patch('/profile', async (req, res, next) => {
  try {
    const linked = await linkedMember(req.user);
    if (linked.error) return res.status(linked.error.status).json({ message: linked.error.message });
    const allowed = ['phone','residentialLocation','emergencyContactName','emergencyContactRelationship','emergencyContactPhone'], updates = {};
    for (const key of allowed) {
      if (req.body[key] === undefined) continue;
      const value = String(req.body[key] ?? '').trim();
      if (value.length > 160) return res.status(400).json({ message: key + ' must be 160 characters or fewer' });
      updates[key] = value || undefined;
    }
    if (!Object.keys(updates).length) return res.status(400).json({ message: 'Provide at least one contact detail to update' });
    Object.assign(linked.member, updates); await linked.member.save();
    res.json({ profile: { phone: linked.member.phone, email: linked.member.email, residentialLocation: linked.member.residentialLocation, emergencyContactName: linked.member.emergencyContactName, emergencyContactRelationship: linked.member.emergencyContactRelationship, emergencyContactPhone: linked.member.emergencyContactPhone } });
  } catch (error) { next(error); }
});
router.post('/prayer-requests', async (req, res, next) => {
  try {
    const linked = await linkedMember(req.user);
    if (linked.error) return res.status(linked.error.status).json({ message: linked.error.message });
    const message = String(req.body.message || '').trim(), category = String(req.body.category || 'general').trim().slice(0, 40);
    if (message.length < 8 || message.length > 4000) return res.status(400).json({ message: 'Prayer request must contain 8–4,000 characters' });
    let assignedPastor = linked.member.assignedPastor;
    if (assignedPastor) { const validPastor = await User.findOne({ _id: assignedPastor, organisation: linked.organisationId, role: { $in: ['branch_pastor','district_pastor'] }, active: true }).select('_id').lean(); assignedPastor = validPastor?._id; }
    if (!assignedPastor) assignedPastor = await User.findOne({ organisation: linked.organisationId, role: 'branch_pastor', active: true }).select('_id').then(user => user?._id);
    const record = await OperationsRecord.create({
      organisation: linked.organisationId, entity: 'prayer_request', title: 'Member prayer request', status: 'pending',
      visibility: 'private', owner: req.user._id, assignedTo: assignedPastor ? [assignedPastor] : [],
      data: { memberId: String(linked.member._id), category, message, followUpRequested: req.body.followUpRequested === true, submittedAt: new Date() },
      createdBy: req.user._id, updatedBy: req.user._id
    });
    await auditMemberAction(req, linked.organisationId, 'member-prayer-request', 'prayer_request', record._id, 'Member submitted a private prayer request');
    res.status(201).json({ request: { _id: record._id, status: record.status, createdAt: record.createdAt } });
  } catch (error) { next(error); }
});
router.post('/enrolments', async (req, res, next) => {
  try {
    const linked = await linkedMember(req.user);
    if (linked.error) return res.status(linked.error.status).json({ message: linked.error.message });
    const { programmeId, programmeType } = req.body;
    if (!mongoose.isValidObjectId(programmeId) || !['small_group','discipleship_course'].includes(programmeType)) return res.status(400).json({ message: 'Select a valid small group or discipleship course' });
    const programme = await OperationsRecord.findOne({ _id: programmeId, organisation: linked.organisationId, entity: programmeType, status: 'active' }).select('_id title data').lean();
    if (!programme || programme.data?.enrolmentOpen === false) return res.status(404).json({ message: 'This programme is not currently accepting enrolments' });
    const reference = programmeType + ':' + programme._id + ':' + req.user._id;
    const existing = await OperationsRecord.findOne({ organisation: linked.organisationId, entity: 'member_enrolment', reference });
    if (existing && existing.status !== 'cancelled') return res.json({ enrolment: existing, alreadyEnrolled: true });
    if (existing) {
      existing.status = 'pending'; existing.updatedBy = req.user._id;
      existing.data = { programmeId: String(programme._id), programmeType, memberId: String(linked.member._id), submittedAt: new Date() };
      await existing.save(); return res.json({ enrolment: existing, alreadyEnrolled: false });
    }
    const enrolment = await OperationsRecord.create({
      organisation: linked.organisationId, entity: 'member_enrolment', title: programme.title, reference,
      status: 'pending', visibility: 'private', owner: req.user._id,
      data: { programmeId: String(programme._id), programmeType, memberId: String(linked.member._id), submittedAt: new Date() },
      createdBy: req.user._id, updatedBy: req.user._id
    });
    await auditMemberAction(req, linked.organisationId, 'member-enrolment', programmeType, enrolment._id, 'Member submitted a programme enrolment');
    res.status(201).json({ enrolment, alreadyEnrolled: false });
  } catch (error) {
    if (error.code === 11000) return res.status(409).json({ message: 'Your enrolment is already being processed' });
    next(error);
  }
});

router.patch('/enrolments/:id/progress', async (req, res, next) => {
  try {
    const linked = await linkedMember(req.user);
    if (linked.error) return res.status(linked.error.status).json({ message: linked.error.message });
    if (!mongoose.isValidObjectId(req.params.id) || typeof req.body.completed !== 'boolean') return res.status(400).json({ message: 'A valid enrolment and completed true/false value are required' });
    const enrolment = await OperationsRecord.findOne({ _id: req.params.id, organisation: linked.organisationId, entity: 'member_enrolment', createdBy: req.user._id, status: { $in: ['active','in_progress','completed'] }, 'data.programmeType': 'discipleship_course' });
    if (!enrolment || !mongoose.isValidObjectId(enrolment.data?.programmeId)) return res.status(404).json({ message: 'An approved course enrolment was not found' });
    const course = await OperationsRecord.findOne({ _id: enrolment.data.programmeId, organisation: linked.organisationId, entity: 'discipleship_course', status: { $in: ['active','completed'] } }).select('_id data').lean();
    if (!course) return res.status(404).json({ message: 'The course is no longer available' });
    const result = setLessonCompletion(course.data?.lessons || [], enrolment.data?.completedLessonIds || [], String(req.body.lessonId || ''), req.body.completed);
    if (!result.valid) return res.status(400).json({ message: result.message });
    enrolment.data = { ...enrolment.data, completedLessonIds: result.completedLessonIds, progressPercent: result.progressPercent, progressUpdatedAt: new Date(), courseCompletedAt: result.progressPercent === 100 ? (enrolment.data.courseCompletedAt || new Date()) : null };
    if (enrolment.status === 'completed' && result.progressPercent < 100) enrolment.status = 'in_progress';
    enrolment.updatedBy = req.user._id; await enrolment.save();
    res.json({ progressPercent: result.progressPercent, completedLessonIds: result.completedLessonIds, completedLessons: result.completedLessonIds.length, totalLessons: result.totalLessons });
  } catch (error) { next(error); }
});

router.patch('/notifications/:id/read', async (req, res, next) => {
  try {
    const linked = await linkedMember(req.user);
    if (linked.error) return res.status(linked.error.status).json({ message: linked.error.message });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Notification not found' });
    const notification = await OperationsRecord.findOne({ _id: req.params.id, organisation: linked.organisationId, entity: 'member_notification', 'data.recipientUserId': String(req.user._id), status: { $ne: 'archived' } });
    if (!notification) return res.status(404).json({ message: 'Notification not found' });
    if (!notification.data?.readAt) { notification.data = { ...notification.data, readAt: new Date() }; notification.updatedBy = req.user._id; await notification.save(); }
    res.json({ notification: { _id: notification._id, readAt: notification.data.readAt } });
  } catch (error) { next(error); }
});
router.get('/giving/:id/receipt', async (req, res, next) => {
  try {
    const linked = await linkedMember(req.user);
    if (linked.error) return res.status(linked.error.status).json({ message: linked.error.message });
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(404).json({ message: 'Verified giving record not found' });
    const transaction = await FinanceTransaction.findOne({ _id: req.params.id, organisation: linked.organisationId, member: linked.member._id, direction: 'income', status: 'confirmed' }).select('category amount currency occurredAt reference paymentMethod').lean();
    if (!transaction) return res.status(404).json({ message: 'No verified member-linked receipt is available for this transaction' });
    const amount = Number(transaction.amount?.toString?.() ?? transaction.amount ?? 0).toLocaleString('en-KE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const receiptNo = transaction.reference || String(transaction._id);
    const rows = [['Receipt reference', receiptNo], ['Member', linked.member.firstName + ' ' + linked.member.lastName], ['Contribution', transaction.category], ['Amount', (transaction.currency || 'KES') + ' ' + amount], ['Date received', new Date(transaction.occurredAt).toLocaleDateString('en-KE')], ['Payment method', transaction.paymentMethod]];
    const details = rows.map(([label, value]) => '<dt>' + escapeHtml(label) + '</dt><dd>' + escapeHtml(value) + '</dd>').join('');
    const markup = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>NCBI Giving Receipt ' + escapeHtml(receiptNo) + '</title><style>body{font:16px Arial,sans-serif;color:#241b2d;margin:40px auto;max-width:720px;padding:24px}.receipt{border:1px solid #ddd;border-radius:14px;padding:32px}.brand{color:#604078;font-weight:700;font-size:22px}.muted{color:#6b6470}dt{color:#6b6470;margin-top:18px}dd{font-weight:700;margin:5px 0 0}button{margin-top:28px;padding:12px 20px;background:#604078;color:#fff;border:0;border-radius:8px}@media print{button{display:none}body{margin:0}}</style></head><body><main class="receipt"><div class="brand">NEW CHURCH BELIEVERS INTERNATIONAL</div><h1>Giving receipt</h1><p class="muted">Verified confirmed contribution record</p><dl>' + details + '</dl><p class="muted">This receipt reflects a confirmed transaction recorded in the NCBI system.</p><button onclick="window.print()">Print / Save as PDF</button></main></body></html>';
    res.set('Cache-Control', 'private, no-store').type('html').attachment('NCBI-Giving-Receipt-' + String(transaction._id) + '.html').send(markup);
  } catch (error) { next(error); }
});
export default router;
