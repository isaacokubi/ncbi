import { Router } from 'express';
import { Organisation } from '../models/index.js';
import { OperationsRecord } from '../models/domain.js';

const router = Router();

// Public data is opt-in: only records explicitly marked public are exposed.
// No member directory, financial data, pastoral records or internal notices
// are returned by this endpoint.
router.get('/content', async (_req, res, next) => {
  try {
    const now = new Date();
    const [branches, events, announcements] = await Promise.all([
      Organisation.find({ level: 'branch', status: 'active' }).select('name code country phone address').sort({ country: 1, name: 1 }).limit(500).lean(),
      OperationsRecord.find({ entity: 'event', visibility: 'public', status: { $in: ['scheduled','active'] }, startAt: { $gte: now } }).sort({ startAt: 1 }).limit(20).select('title startAt endAt organisation data').populate('organisation','name code country').lean(),
      OperationsRecord.find({ entity: 'announcement', visibility: 'public', status: 'active' }).sort({ createdAt: -1 }).limit(10).select('title createdAt data organisation').populate('organisation','name code').lean()
    ]);
    res.set('Cache-Control', 'public, max-age=60, stale-while-revalidate=120');
    res.json({ branches, events, announcements, generatedAt: now.toISOString() });
  } catch (error) { next(error); }
});
export default router;
