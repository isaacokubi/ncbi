import { Router } from 'express';
import { Member, Attendance, FinanceTransaction, Organisation, User } from '../models/index.js';
import { OperationsRecord, Budget } from '../models/domain.js';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { accessibleOrganisationIds } from '../middleware/organisationScope.js';
import { attendanceDashboardFilter, canSeeUpcomingEvents, dashboardMetricsForRole, dashboardPendingApprovalsForRole } from '../domain/dashboardPolicy.js';

const router = Router();
router.use(requireAuth);
router.get('/summary', allowRoles('super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin','treasurer','department_leader'), async (req, res, next) => {
  try {
    const ids = await accessibleOrganisationIds(req.user);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const [branches, members, visitors, attendance, income, expenses, upcomingEvents,
      pendingOperational, pendingRegistrations, pendingOrganisations, pendingFinance, pendingBudgets] = await Promise.all([
      Organisation.countDocuments({ _id: { $in: ids }, level: 'branch', status: 'active' }),
      Member.countDocuments({ homeOrganisation: { $in: ids }, status: { $in: ['member','worker','minister'] } }),
      Member.countDocuments({ homeOrganisation: { $in: ids }, status: 'visitor' }),
      Attendance.countDocuments(attendanceDashboardFilter(req.user, ids, start)),
      FinanceTransaction.aggregate([{ $match: { organisation: { $in: ids }, status: 'confirmed', direction: 'income', occurredAt: { $gte: start } } }, { $group: { _id: '$currency', total: { $sum: { $toDouble: '$amount' } } } }]),
      FinanceTransaction.aggregate([{ $match: { organisation: { $in: ids }, status: 'confirmed', direction: 'expense', occurredAt: { $gte: start } } }, { $group: { _id: '$currency', total: { $sum: { $toDouble: '$amount' } } } }]),
      (canSeeUpcomingEvents(req.user) ? OperationsRecord.find({ organisation: { $in: ids }, entity: 'event', status: { $in: ['scheduled','active'] }, startAt: { $gte: now } }).sort({ startAt: 1 }).limit(6).select('title startAt organisation').populate('organisation','name').lean() : Promise.resolve([])),
      OperationsRecord.countDocuments({ organisation: { $in: ids }, status: 'pending' }),
      User.countDocuments({ organisation: { $in: ids }, accountApproval: 'pending' }),
      Organisation.countDocuments({ _id: { $in: ids }, status: 'pending' }),
      FinanceTransaction.countDocuments({ organisation: { $in: ids }, status: { $in: ['submitted','approved'] } }),
      Budget.countDocuments({ organisation: { $in: ids }, status: 'submitted' })
    ]);

    const approvalBreakdown = {
      registrations: pendingRegistrations,
      organisations: pendingOrganisations,
      finance: pendingFinance,
      budgets: pendingBudgets,
      operations: pendingOperational
    };
    const pendingApprovals = dashboardPendingApprovalsForRole(req.user.role, approvalBreakdown);
    const metrics = dashboardMetricsForRole(req.user.role, {
      branches, members, visitors, attendanceRecordsThisMonth: attendance,
      confirmedIncomeThisMonth: income, confirmedExpensesThisMonth: expenses, pendingApprovals
    });
    const visibleApprovalBreakdown = req.user.role === 'treasurer'
      ? { finance: pendingFinance, budgets: pendingBudgets }
      : req.user.role === 'department_leader' ? {} : approvalBreakdown;
    res.json({ scope: ids.length, asOf: now.toISOString(), metrics, approvalBreakdown: visibleApprovalBreakdown, upcomingEvents });
  } catch (error) { next(error); }
});
export default router;
