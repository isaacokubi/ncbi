import { Router } from 'express';
import { Member, Attendance } from '../models/index.js';
import { OperationsRecord } from '../models/domain.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

async function linkedMember(user) {
  if (user.role !== 'member') return { error: { status: 403, message: 'Member portal access is limited to member accounts' } };
  if (!user.memberProfile) return { error: { status: 409, message: 'Your account is not linked to a member profile. Contact your branch administrator.' } };
  const organisationId = user.organisation._id ?? user.organisation;
  const member = await Member.findOne({ _id: user.memberProfile, homeOrganisation: organisationId });
  if (!member) return { error: { status: 404, message: 'Linked member profile is unavailable' } };
  return { member, organisationId };
}

// Member-only summary: every query is pinned to the exact linked profile and branch.
router.get('/summary', async (req, res, next) => {
  try {
    const linked = await linkedMember(req.user);
    if (linked.error) return res.status(linked.error.status).json({ message: linked.error.message });
    const { member, organisationId } = linked;
    const now = new Date();
    const yearStart = new Date(now.getFullYear(), 0, 1);
    const [attendance, attendanceTotal, attendanceThisYear, lastAttendance, events, registrations, announcements] = await Promise.all([
      Attendance.find({ member: member._id, organisation: organisationId }).sort({ heldAt: -1 }).limit(20).select('activityName category heldAt checkInMethod').lean(),
      Attendance.countDocuments({ member: member._id, organisation: organisationId }),
      Attendance.countDocuments({ member: member._id, organisation: organisationId, heldAt: { $gte: yearStart } }),
      Attendance.findOne({ member: member._id, organisation: organisationId }).sort({ heldAt: -1 }).select('heldAt activityName').lean(),
      OperationsRecord.find({ organisation: organisationId, entity: 'event', status: { $in: ['scheduled','active'] }, startAt: { $gte: now } }).sort({ startAt: 1 }).limit(10).select('title startAt endAt reference data').lean(),
      OperationsRecord.find({ organisation: organisationId, entity: 'event_registration', createdBy: req.user._id, status: { $nin: ['archived','cancelled'] } }).sort({ createdAt: -1 }).limit(20).select('title status data createdAt').lean(),
      OperationsRecord.find({ organisation: organisationId, entity: 'announcement', status: 'active', visibility: { $in: ['organisation','public'] } }).sort({ createdAt: -1 }).limit(10).select('title startAt data createdAt').lean()
    ]);
    const profile = {
      _id: member._id, membershipNumber: member.membershipNumber,
      firstName: member.firstName, lastName: member.lastName,
      phone: member.phone, email: member.email, residentialLocation: member.residentialLocation,
      emergencyContactName: member.emergencyContactName,
      emergencyContactRelationship: member.emergencyContactRelationship,
      emergencyContactPhone: member.emergencyContactPhone,
      status: member.status, joinedAt: member.joinedAt,
      ministries: member.ministries || [],
      homeOrganisation: await Member.populate(member, { path: 'homeOrganisation', select: 'name code' }).then(x => x.homeOrganisation)
    };
    res.json({ profile, attendance, attendanceSummary: { total: attendanceTotal, thisYear: attendanceThisYear, lastAttendedAt: lastAttendance?.heldAt || null, lastActivity: lastAttendance?.activityName || null }, upcomingEvents: events, registrations, announcements });
  } catch (error) { next(error); }
});

// Members may maintain contact details on their own linked profile. Identity,
// membership status, branch, role, ministry assignments and pastoral fields stay staff-controlled.
router.patch('/profile', async (req, res, next) => {
  try {
    const linked = await linkedMember(req.user);
    if (linked.error) return res.status(linked.error.status).json({ message: linked.error.message });
    const allowed = ['phone','residentialLocation','emergencyContactName','emergencyContactRelationship','emergencyContactPhone'];
    const updates = {};
    for (const key of allowed) {
      if (req.body[key] === undefined) continue;
      const value = String(req.body[key] ?? '').trim();
      if (value.length > 160) return res.status(400).json({ message: key + ' must be 160 characters or fewer' });
      if (key === 'email' && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return res.status(400).json({ message: 'Enter a valid email address' });
      updates[key] = value || undefined;
    }
    if (!Object.keys(updates).length) return res.status(400).json({ message: 'Provide at least one contact detail to update' });
    Object.assign(linked.member, updates);
    await linked.member.save();
    res.json({ profile: { phone: linked.member.phone, email: linked.member.email, residentialLocation: linked.member.residentialLocation, emergencyContactName: linked.member.emergencyContactName, emergencyContactRelationship: linked.member.emergencyContactRelationship, emergencyContactPhone: linked.member.emergencyContactPhone } });
  } catch (error) { next(error); }
});

export default router;
