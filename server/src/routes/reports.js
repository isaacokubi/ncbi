import { Router } from 'express';
import { Attendance, FinanceTransaction, Member, Organisation } from '../models/index.js';
import { OperationsRecord } from '../models/domain.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { accessibleOrganisationIds, assertOrganisationAccess } from '../middleware/organisationScope.js';
import { reportPayloadForRole } from '../domain/dashboardPolicy.js';

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
router.get('/overview', allowRoles('super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin','treasurer'), async (req, res, next) => {
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
        { $lookup: { from: 'members', localField: '_id', foreignField: 'homeOrganisation', pipeline: [{ $match: { createdAt: { $gte: start } } }], as: 'members' } },
        { $lookup: { from: 'attendances', localField: '_id', foreignField: 'organisation', pipeline: [{ $match: { heldAt: { $gte: start } } }], as: 'attendance' } },
        { $project: {
          name: 1, code: 1, status: 1,
          members: { $size: { $filter: { input: '$members', as: 'member', cond: { $in: ['$$member.status', ['member','worker','minister']] } } } },
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
    res.json(reportPayloadForRole(req.user.role, {
      generatedAt: new Date().toISOString(),
      period: { months, from: start.toISOString(), to: now.toISOString() },
      scope: { organisationUnits: ids.length, branches: branches },
      totals,
      trend,
      ministryActivity: ministry.map(row => ({ entity: row._id, count: row.count })),
      branchPerformance
    }));
  } catch (error) { next(error); }
});

import { csvDocument } from '../domain/reportCsv.js';

router.get('/overview.csv', allowRoles('super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin','treasurer'), async (req, res, next) => {
  try {
    const months = Math.min(24, Math.max(3, Number.parseInt(req.query.months, 10) || 12));
    const scopeIds = await accessibleOrganisationIds(req.user);
    let ids = scopeIds;
    if (req.query.organisation) {
      if (!(await assertOrganisationAccess(req.user, req.query.organisation))) return res.status(403).json({ message: 'Organisation outside your authorised scope' });
      ids = [req.query.organisation];
    }
    const now = new Date();
    const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - months + 1, 1));
    const [members, attendance, finance, ministry, branches] = await Promise.all([
      Member.aggregate([{ $match: { homeOrganisation: { $in: ids }, createdAt: { $gte: start } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$createdAt', timezone: 'UTC' } }, count: { $sum: 1 } } }]),
      Attendance.aggregate([{ $match: { organisation: { $in: ids }, heldAt: { $gte: start } } }, { $group: { _id: { $dateToString: { format: '%Y-%m', date: '$heldAt', timezone: 'UTC' } }, count: { $sum: 1 } } }]),
      FinanceTransaction.aggregate([{ $match: { organisation: { $in: ids }, status: 'confirmed', occurredAt: { $gte: start } } }, { $group: { _id: { month: { $dateToString: { format: '%Y-%m', date: '$occurredAt', timezone: 'UTC' } }, currency: '$currency', direction: '$direction' }, total: { $sum: '$amount' }, transactions: { $sum: 1 } } }]),
      OperationsRecord.aggregate([{ $match: { organisation: { $in: ids }, status: { $ne: 'archived' }, createdAt: { $gte: start } } }, { $group: { _id: '$entity', count: { $sum: 1 } } }, { $sort: { count: -1, _id: 1 } }]),
      Organisation.aggregate([
        { $match: { _id: { $in: ids }, level: 'branch' } },
        { $lookup: { from: 'members', localField: '_id', foreignField: 'homeOrganisation', pipeline: [{ $match: { createdAt: { $gte: start } } }], as: 'members' } },
        { $lookup: { from: 'attendances', localField: '_id', foreignField: 'organisation', pipeline: [{ $match: { heldAt: { $gte: start } } }], as: 'attendance' } },
        { $project: { name: 1, code: 1, members: { $size: { $filter: { input: '$members', as: 'member', cond: { $in: ['$member.status', ['member','worker','minister']] } } } }, attendanceRecords: { $size: '$attendance' } } },
        { $sort: { members: -1, name: 1 } }, { $limit: 30 }
      ])
    ]);
    const rows = [], memberMap = new Map(members.map(x => [x._id, x.count])), attendanceMap = new Map(attendance.map(x => [x._id, x.count]));
    if (req.user.role !== 'treasurer') for (const { key } of monthLabels(start, months)) {
      rows.push(['trend', key, 'new_members', '', memberMap.get(key) || 0, '']);
      rows.push(['trend', key, 'attendance_records', '', attendanceMap.get(key) || 0, '']);
    }
    for (const x of finance) rows.push(['finance', x._id.month, x._id.direction, x.transactions + ' confirmed transactions', Number(x.total.toString()), x._id.currency || 'KES']);
    if (req.user.role !== 'treasurer') {
      for (const x of ministry) rows.push(['ministry', '', 'active_records', x._id, x.count, '']);
      for (const x of branches) { rows.push(['branch', '', 'registered_members', x.code || x.name, x.members, '']); rows.push(['branch', '', 'attendance_records', x.code || x.name, x.attendanceRecords, '']); }
    }
    res.set({ 'Content-Type': 'text/csv; charset=utf-8', 'Content-Disposition': 'attachment; filename="ncbi-management-report.csv"', 'Cache-Control': 'no-store' });
    res.send(csvDocument(rows));
  } catch (error) { next(error); }
});

export default router;
