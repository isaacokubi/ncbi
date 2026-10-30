import { Router } from 'express';
import mongoose from 'mongoose';
import { FinanceTransaction, Member } from '../models/index.js';
import { AuditLog, LedgerAccount, JournalEntry } from '../models/domain.js';
import { financeTransition, isValidPositiveAmount, financeDecisionError, financeDecisionNoteError } from '../domain/financePolicy.js';
import { requireAuth } from '../middleware/auth.js';
import { accessibleOrganisationIds, assertOrganisationAccess } from '../middleware/organisationScope.js';

const router = Router();
router.use(requireAuth);
const financeRoles = new Set(['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin','treasurer']);
const approverRoles = new Set(['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor']);

router.get('/transactions', async (req, res, next) => {
  try {
    if (!financeRoles.has(req.user.role)) return res.status(403).json({ message: 'Finance access denied' });
    const ids = await accessibleOrganisationIds(req.user);
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const filter = { organisation: { $in: ids } };
    if (req.query.status) filter.status = req.query.status;
    if (req.query.direction) filter.direction = req.query.direction;
    const [transactions, total] = await Promise.all([
      FinanceTransaction.find(filter).sort({ occurredAt: -1 }).skip((page - 1) * limit).limit(limit)
        .populate('organisation', 'name code').populate('createdBy', 'fullName')
        .populate('approvedBy', 'fullName').populate('confirmedBy', 'fullName').lean(),
      FinanceTransaction.countDocuments(filter)
    ]);
    res.json({ transactions, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
  } catch (error) { next(error); }
});

router.post('/transactions', async (req, res, next) => {
  try {
    if (!financeRoles.has(req.user.role)) return res.status(403).json({ message: 'Finance access denied' });
    const { organisation, direction, category, amount, currency = 'KES', occurredAt, paymentMethod = 'other', reference, description, debitAccount, creditAccount, member } = req.body;
    const org = organisation || (req.user.organisation?._id ?? req.user.organisation);
    if (!mongoose.isValidObjectId(org) || !(await assertOrganisationAccess(req.user, org))) return res.status(403).json({ message: 'Organisation outside your authorised scope' });
    if (!['income','expense'].includes(direction) || !String(category || '').trim() || !isValidPositiveAmount(amount) || !mongoose.isValidObjectId(debitAccount) || !mongoose.isValidObjectId(creditAccount)) return res.status(400).json({ message: 'Valid direction, category, positive amount and both ledger accounts are required' });
    const ledgerAccounts = await LedgerAccount.find({ _id: { $in: [debitAccount, creditAccount] }, organisation: org, active: true });
    const debit = ledgerAccounts.find(account => String(account._id) === String(debitAccount));
    const credit = ledgerAccounts.find(account => String(account._id) === String(creditAccount));
    if (!debit || !credit) return res.status(400).json({ message: 'Both ledger accounts must be active and belong to this organisation' });
    if (direction === 'income' && (debit.type !== 'asset' || credit.type !== 'income')) return res.status(400).json({ message: 'Income must debit an asset account and credit an income account' });
    if (direction === 'expense' && (debit.type !== 'expense' || credit.type !== 'asset')) return res.status(400).json({ message: 'Expense must debit an expense account and credit an asset account' });
    let linkedMember = null;
    if (member) {
      if (direction !== 'income' || !mongoose.isValidObjectId(member)) return res.status(400).json({ message: 'Only an income transaction can be linked to a valid member' });
      linkedMember = await Member.findOne({ _id: member, homeOrganisation: org }).select('_id').lean();
      if (!linkedMember) return res.status(400).json({ message: 'Member must belong to the selected organisation' });
    }
    const transaction = await FinanceTransaction.create({ organisation: org, direction, category, amount: String(amount), currency, occurredAt: occurredAt || new Date(), paymentMethod, reference, description, member: linkedMember?._id || null, debitAccount, creditAccount, createdBy: req.user._id, status: 'submitted' });
    await AuditLog.create({ organisation: org, actor: req.user._id, action: 'submit', entity: 'finance_transaction', recordId: transaction._id, summary: `Submitted ${direction} ${currency} ${amount}` });
    res.status(201).json({ transaction });
  } catch (error) { next(error); }
});

router.post('/transactions/:id/decision', async (req, res, next) => {
  try {
    const decision = String(req.body.decision || '');
    if (!['approve','reject','confirm','void'].includes(decision)) return res.status(400).json({ message: 'Unsupported finance decision' });
    const decisionNote = String(req.body.note || '').trim().slice(0, 500);
    const noteError = financeDecisionNoteError(decision, decisionNote);
    if (noteError) return res.status(400).json({ message: noteError });
    const isApproval = decision === 'approve' || decision === 'reject';
    if (isApproval ? !approverRoles.has(req.user.role) : !financeRoles.has(req.user.role)) return res.status(403).json({ message: isApproval ? 'Finance approval permission required' : 'Finance permission required' });
    const ids = await accessibleOrganisationIds(req.user);
    const transaction = await FinanceTransaction.findOne({ _id: req.params.id, organisation: { $in: ids } });
    if (!transaction) return res.status(404).json({ message: 'Transaction not found' });
    const policyError = financeDecisionError(transaction, decision, req.user._id);
    if (policyError) return res.status(403).json({ message: policyError });
    const transition = financeTransition(transaction.status, decision);
    if (!transition.allowed) return res.status(409).json({ message: `Cannot ${decision} a transaction in ${transaction.status} state` });

    if (decision === 'confirm') {
      let journal = await JournalEntry.findOne({ sourceType: 'finance_transaction', sourceId: transaction._id });
      if (!journal) {
        journal = await JournalEntry.create({ organisation: transaction.organisation, entryNumber: 'FT-' + String(transaction._id), entryDate: transaction.occurredAt, description: (transaction.direction === 'income' ? 'Income: ' : 'Expense: ') + transaction.category + ' · ' + (transaction.description || ''), status: 'posted', lines: [{ account: transaction.debitAccount, debit: String(transaction.amount), credit: '0.00' }, { account: transaction.creditAccount, debit: '0.00', credit: String(transaction.amount) }], createdBy: transaction.createdBy, approvedBy: transaction.approvedBy, postedAt: new Date(), sourceType: 'finance_transaction', sourceId: transaction._id });
      }
      transaction.journalEntry = journal._id;
      transaction.confirmedBy = req.user._id;
      transaction.confirmedAt = new Date();
    }

    if (decision === 'void' && transaction.status === 'confirmed') {
      const original = await JournalEntry.findOne({ _id: transaction.journalEntry, organisation: transaction.organisation, status: 'posted' }).lean();
      if (!original) return res.status(409).json({ message: 'The posted journal entry is missing; transaction cannot be reversed safely' });
      let reversal = transaction.reversalJournalEntry
        ? await JournalEntry.findById(transaction.reversalJournalEntry)
        : await JournalEntry.findOne({ sourceType: 'finance_reversal', sourceId: transaction._id });
      if (!reversal) {
        reversal = await JournalEntry.create({ organisation: transaction.organisation, entryNumber: 'RV-' + String(transaction._id), entryDate: new Date(), description: 'Reversal of confirmed transaction ' + String(transaction._id), status: 'posted', lines: original.lines.map(line => ({ account: line.account, debit: line.credit, credit: line.debit, memo: 'Reversal' })), createdBy: req.user._id, approvedBy: req.user._id, postedAt: new Date(), sourceType: 'finance_reversal', sourceId: transaction._id });
      }
      transaction.reversalJournalEntry = reversal._id;
      transaction.voidedBy = req.user._id;
      transaction.voidedAt = new Date();
    }

    if (decision === 'approve') { transaction.approvedBy = req.user._id; transaction.approvedAt = new Date(); }
    if (decision === 'reject') transaction.decisionNote = decisionNote;
    if (decision === 'void') { transaction.voidedBy = req.user._id; transaction.voidedAt = new Date(); }
    transaction.status = transition.status;
    await transaction.save();
    await AuditLog.create({ organisation: transaction.organisation, actor: req.user._id, action: decision, entity: 'finance_transaction', recordId: transaction._id, summary: `Finance transaction ${transaction.status}`, metadata: { journalEntry: transaction.journalEntry || null, reversalJournalEntry: transaction.reversalJournalEntry || null, decisionNote: decisionNote || null } });
    res.json({ transaction });
  } catch (error) { next(error); }
});

export default router;
