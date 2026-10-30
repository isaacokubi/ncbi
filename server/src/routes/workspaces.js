import { Router } from 'express';
import { Organisation, Member, Attendance, FinanceTransaction } from '../models/index.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';

const router = Router();
router.use(requireAuth);

router.get('/organisations', async (req, res, next) => {
  try {
    const elevated = ['super_admin', 'international_executive'].includes(req.user.role);
    const query = elevated ? {} : { _id: req.user.organisation._id ?? req.user.organisation };
    const organisations = await Organisation.find(query).sort({ level: 1, name: 1 }).lean();
    res.json({ organisations });
  } catch (error) { next(error); }
});

router.post('/organisations', allowRoles('super_admin', 'international_executive'), async (req, res, next) => {
  try {
    const { name, code, level, parent, country, currency, contactEmail, phone } = req.body;
    if (!name || !code || !level) return res.status(400).json({ message: 'Name, code and level are required' });
    if (level !== 'international' && !parent) return res.status(400).json({ message: 'A parent organisation is required' });
    const organisation = await Organisation.create({ name, code, level, parent: parent || null, country, currency, contactEmail, phone, status: 'pending' });
    res.status(201).json({ organisation });
  } catch (error) { next(error); }
});

router.get('/members', async (req, res, next) => {
  try {
    const query = ['super_admin', 'international_executive'].includes(req.user.role) ? {} : { homeOrganisation: req.user.organisation._id ?? req.user.organisation };
    const members = await Member.find(query).sort({ createdAt: -1 }).limit(100).lean();
    res.json({ members });
  } catch (error) { next(error); }
});

router.post('/members', async (req, res, next) => {
  try {
    const { firstName, lastName, phone, email, status } = req.body;
    if (!firstName || !lastName) return res.status(400).json({ message: 'First and last name are required' });
    const member = await Member.create({ firstName, lastName, phone, email, status, homeOrganisation: req.user.organisation._id ?? req.user.organisation });
    res.status(201).json({ member });
  } catch (error) { next(error); }
});

router.get('/attendance/summary', async (req, res, next) => {
  try {
    const org = req.user.organisation._id ?? req.user.organisation;
    const [members, attendance, transactions] = await Promise.all([
      Member.countDocuments({ homeOrganisation: org, status: { $in: ['member', 'worker', 'minister'] } }),
      Attendance.countDocuments({ organisation: org, heldAt: { $gte: new Date(new Date().setDate(1)) } }),
      FinanceTransaction.aggregate([{ $match: { organisation: org, status: 'confirmed', direction: 'income' } }, { $group: { _id: null, total: { $sum: { $toDouble: '$amount' } } } }])
    ]);
    res.json({ members, attendanceRecordsThisMonth: attendance, confirmedIncomeThisMonth: transactions[0]?.total || 0 });
  } catch (error) { next(error); }
});

export default router;
