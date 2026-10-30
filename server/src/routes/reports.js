import { Router } from 'express';
import { Attendance, FinanceTransaction, Member, Organisation } from '../models/index.js';
import { OperationsRecord } from '../models/domain.js';
import { requireAuth } from '../middleware/auth.js';
import { accessibleOrganisationIds, assertOrganisationAccess } from '../middleware/organisationScope.js';

const router = Router();
router.use(requireAuth);

function monthKey(date) {
  return date.toISOString().slice(0, 7);
}
function monthLabels(start, count) {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + index, 1));
    return { key: monthKey(date), label: new Intl.DateTimeFormat('en', { month: 'short', year: '2-digit', timeZone: 'UTC' }).format(date) };
  });
}

// Consolidated reports deliberately derive every organisation filter from the
// authenticated user's hierarchy. Client-supplied branch IDs are only accepted
// after assertOrganisationAccess confirms that they are inside that scope.
router.get('/overview', async (req, res, next) => {
  try {
    const months = Math.min(24, Math.max(3, Number.parseInt(req.query.months, 10) || 12));
    const scopeIds = await accessibleOrganisationIds(req.user);
    let ids = scopeIds;
    if (req.query.organisation) {
      if (!(await assertOrganisationAccess(req.user, req.query.organisation))) {
        return res.status(403).json({ message: 'Organisation outside your authorised scope' });
      }
      ids = [req.query.organisation];
    }
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));
    const labels = monthLabels(start, months);
    const [branches, members, attendance, finance, ministry, branchPerformance] = await Promise.all([
      Organisation.countDocuments({ _id: { $in: ids }, level: 'branch', status: 'active' }),
      Member.aggregate([
        { $match: { homeOrganisation: { $in: ids }, createdAt: { $gte: start } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } }
      ]),
      Attendance.aggregate([
        { $match: { organisation: { $in: ids }, heldAt: { $gte: start } } },
        { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$heldAt', timezone: 'UTC' } }, count: { $sum: 1 } } }
      ]),
      FinanceTransaction.aggregate([
        { $match: { organisation: { $in: ids }, status: 'confirmed', occurredAt: { $gte: start } } },
        { $group: {
          _id: { month: { $dateToString: { format: '%Y-%m', date: '$occurredAt', timezone: 'UTC' } }, currency: '$currency', direction: '$direction' },
          total: { $sum: '$amount' }, transactions: { $sum: 1 }
        } }
      ]),
      OperationsRecord.aggregate([
        { $match: { organisation: { $in: ids }, status: { $ne: 'archived' }, createdAt: { $gte: start } } },
        { $group: { _id: '$entity', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } }
      ]),
      Organisation.aggregate([
        { $match: { _id: { $in: ids }, level: 'branch' } },
        { $lookup: { from: 'members', localField: '_id', foreignField: 'homeOrganisation', as: 'members' } },
        { $lookup: { from: 'attendances', localField: '_id', foreignField: 'organisation', as: 'attendance' } },
        { $project: {
          name: 1, code: 1, status: 1,
          members: { $size: { $filter: { input: '$members', as: 'member', cond: { $in: ['$member.status', ['member','worker','minister']] } } } },
          attendanceRecords: { $size: '$attendance' }
        } },
        { $sort: { members: -1, name: 1 } },
        { $limit: 30 }
      ])
    ]);
    const memberByMonth = new Map(members.map(row => [row._id, row.count]));
    const attendanceByMonth = new Map(attendance.map(row => [row._id, row.count]));
    const financeByMonth = new Map();
    const totals = {};
    for (const row of finance) {
      const currency = row._id.currency || 'KES';
      const direction = row._id.direction;
      const key = row._id.month;
      const bucket = financeByMonth.get(key) || {};
      bucket[currency] ||= { income: 0, expense: 0 };
      bucket[currency][direction] = Number(row.total.toString());
      financeByMonth.set(key, bucket);
      totals[currency] ||= { income: 0, expense: 0, transactions: 0 };
      totals[currency][direction] += Number(row.total.toString());
      totals[currency].transactions += row.transactions;
    }
    const trend = labels.map(({ key, label }) => ({
      month: key, label,
      newMembers: memberByMonth.get(key) || 0,
      attendanceRecords: attendanceByMonth.get(key) || 0,
      finance: financeByMonth.get(key) || {}
    }));
    res.json({
      generatedAt: new Date().toISOString(),
      period: { months, from: start.toISOString(), to: now.toISOString() },
      scope: { organisationUnits: ids.length, branches: branches },
      totals,
      trend,
      ministryActivity: ministry.map(row => ({ entity: row._id, count: row.count })),
      branchPerformance
    });
  } catch (error) { next(error); }
});

export default router;
