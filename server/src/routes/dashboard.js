import { Router } from 'express';
import { Member, Attendance, FinanceTransaction, Organisation } from '../models/index.js';
import { OperationsRecord } from '../models/domain.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { accessibleOrganisationIds } from '../middleware/organisationScope.js';
import { attendanceDashboardFilter, canSeeUpcomingEvents, dashboardMetricsForRole } from '../domain/dashboardPolicy.js';

const router = Router();
router.use(requireAuth);
router.get('/summary', allowRoles('super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin','treasurer','department_leader'), async (req, res, next) => {
  try {
    const ids = await accessibleOrganisationIds(req.user);
    const start = new Date(); start.setDate(1); start.setHours(0,0,0,0);
    const [branches, members, visitors, attendance, income, expenses, upcomingEvents, pendingRecords] = await Promise.all([
      Organisation.countDocuments({ _id: { $in: ids }, level: 'branch', status: 'active' }),
      Member.countDocuments({ homeOrganisation: { $in: ids }, status: { $in: ['member','worker','minister'] } }),
      Member.countDocuments({ homeOrganisation: { $in: ids }, status: 'visitor' }),
      Attendance.countDocuments(attendanceDashboardFilter(req.user, ids, start)),
      FinanceTransaction.aggregate([{ $match: { organisation: { $in: ids }, status: 'confirmed', direction: 'income', occurredAt: { $gte: start } } }, { $group: { _id: '$currency', total: { $sum: { $toDouble: '$amount' } } } }]),
      FinanceTransaction.aggregate([{ $match: { organisation: { $in: ids }, status: 'confirmed', direction: 'expense', occurredAt: { $gte: start } } }, { $group: { _id: '$currency', total: { $sum: { $toDouble: '$amount' } } } }]),
      (canSeeUpcomingEvents(req.user) ? OperationsRecord.find({ organisation: { $in: ids }, entity: 'event', status: { $in: ['scheduled','active'] }, startAt: { $gte: new Date() } }).sort({ startAt: 1 }).limit(6).select('title startAt organisation').populate('organisation','name').lean() : Promise.resolve([])),
      OperationsRecord.countDocuments({ organisation: { $in: ids }, status: 'pending' })
    ]);
    const metrics = dashboardMetricsForRole(req.user.role, { branches, members, visitors, attendanceRecordsThisMonth: attendance, confirmedIncomeThisMonth: income, confirmedExpensesThisMonth: expenses, pendingApprovals: pendingRecords });
    res.json({ scope: ids.length, asOf: new Date().toISOString(), metrics, upcomingEvents });
  } catch (error) { next(error); }
});
export default router;
