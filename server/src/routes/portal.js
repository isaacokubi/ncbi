import { Router } from 'express';
import { Member, Attendance } from '../models/index.js';
import { OperationsRecord } from '../models/domain.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

// A member account sees only the profile explicitly linked by an authorised
// administrator, its own attendance, its own event registrations and public
// organisation announcements. No directory or pastoral-case access is exposed.
router.get('/summary', async (req, res, next) => {
  try {
    if (req.user.role !== 'member') return res.status(403).json({ message: 'Member portal access is limited to member accounts' });
    if (!req.user.memberProfile) return res.status(409).json({ message: 'Your account is not linked to a member profile. Contact your branch administrator.' });
    const member = await Member.findOne({
      _id: req.user.memberProfile,
      homeOrganisation: req.user.organisation._id ?? req.user.organisation
    }).select('membershipNumber firstName lastName phone email status joinedAt ministries homeOrganisation').populate('homeOrganisation', 'name code').lean();
    if (!member) return res.status(404).json({ message: 'Linked member profile is unavailable' });
    const now = new Date();
    const [attendance, events, registrations, announcements] = await Promise.all([
      Attendance.find({ member: member._id, organisation: member.homeOrganisation._id ?? member.homeOrganisation }).sort({ heldAt: -1 }).limit(20).select('activityName category heldAt checkInMethod').lean(),
      OperationsRecord.find({ organisation: member.homeOrganisation._id ?? member.homeOrganisation, entity: 'event', status: { $in: ['scheduled','active'] }, startAt: { $gte: now } }).sort({ startAt: 1 }).limit(10).select('title startAt endAt reference data').lean(),
      OperationsRecord.find({ organisation: member.homeOrganisation._id ?? member.homeOrganisation, entity: 'event_registration', createdBy: req.user._id, status: { $nin: ['archived','cancelled'] } }).sort({ createdAt: -1 }).limit(20).select('title status data createdAt').lean(),
      OperationsRecord.find({ organisation: member.homeOrganisation._id ?? member.homeOrganisation, entity: 'announcement', status: 'active', visibility: 'organisation' }).sort({ createdAt: -1 }).limit(10).select('title startAt data createdAt').lean()
    ]);
    res.json({ profile: member, attendance, upcomingEvents: events, registrations, announcements });
  } catch (error) { next(error); }
});
export default router;
