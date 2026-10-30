import { Router } from 'express';
import { createHash, randomBytes } from 'node:crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User, Organisation, Member } from '../models/index.js';
import { AuditLog } from '../models/domain.js';
import { requireAuth } from '../middleware/auth.js';
import { passwordChangeError, passwordLengthError, phoneNumberError } from '../domain/authPolicy.js';
import { accountActionUrl, sendAccountEmail } from '../services/email.js';
import { registrationDecisionError, registrationScopeError } from '../domain/registrationPolicy.js';
import { accessibleOrganisationIds } from '../middleware/organisationScope.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
    const user = await User.findOne({ email }).select('+passwordHash').populate('organisation', 'name code level');
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Email or password is incorrect' });
    }
    if (user.accountApproval === 'pending') return res.status(403).json({ message: 'Your registration is awaiting approval by the appropriate NCBI authority.' });
    if (user.accountApproval === 'rejected') return res.status(403).json({ message: 'Your registration was not approved. Please contact the church office.' });
    if (!user.active) return res.status(403).json({ message: 'This account is inactive. Please contact your church administrator.' });
    const token = jwt.sign({ sub: user.id, role: user.role, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    res.json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, permissions: user.permissions || [], organisation: user.organisation } });
  } catch (error) { next(error); }
});


// Public registration accepts member, visitor and church-official applications. Official roles are assigned only after an authorised approval.
router.get('/registration/branches', async (_req, res, next) => {
  try {
    const [branches, organisations] = await Promise.all([
      Organisation.find({ level: 'branch', status: 'active' }).select('name code country address level').sort({ name: 1 }).lean(),
      Organisation.find({ level: { $in: ['international','national','regional','district','branch'] }, status: 'active' }).select('name code country level').sort({ level: 1, name: 1 }).lean()
    ]);
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ branches, organisations });
  } catch (error) { next(error); }
});

router.post('/register', async (req, res, next) => {
  try {
    const fullName = String(req.body.fullName || '').trim().replace(/\s+/g, ' ');
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    const phone = String(req.body.phone || '').trim();
    const organisationId = String(req.body.organisation || '').trim();
    const category = String(req.body.category || '');
    const membershipNumber = String(req.body.membershipNumber || '').trim();
    const requestedRole = String(req.body.requestedRole || '').trim();
    const allowedRequestedRoles = ['international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin','treasurer','department_leader'];
    const phoneError = phoneNumberError(phone);
    if (fullName.length < 3 || fullName.length > 120 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || password.length < 6 || password.length > 128 || phoneError || !organisationId || !['member','non_member','official'].includes(category) || (category === 'official' && !allowedRequestedRoles.includes(requestedRole))) {
      return res.status(400).json({ message: 'Enter a valid name, email, phone, password (at least 6 characters), account category and church branch.' });
    }
    const requestedLevels = { international_executive:['international'], national_admin:['national'], regional_overseer:['regional'], district_pastor:['district'], branch_pastor:['branch'], branch_admin:['branch'], treasurer:['branch','district','regional','national'], department_leader:['branch','district','regional','national'] };
    const allowedLevels = category === 'official' ? requestedLevels[requestedRole] : ['branch'];
    const branch = await Organisation.findOne({ _id: organisationId, level: { $in: allowedLevels }, status: 'active' }).select('_id level').lean();
    if (!branch) return res.status(400).json({ message: 'Select an active NCBI organisation at the level required for this application.' });
    if (category === 'member' && !membershipNumber) return res.status(400).json({ message: 'Enter your membership number so the branch pastor can verify your membership.' });
    if (await User.exists({ email })) return res.status(409).json({ message: 'An account with this email already exists.' });
    const passwordHash = await bcrypt.hash(password, 12);
    await User.create({
      fullName, email, passwordHash, role: 'member', organisation: branch._id,
      active: false, accountApproval: 'pending', registrationCategory: category,
      requestedRole: category === 'official' ? requestedRole : undefined,
      registrationPhone: phone, claimedMembershipNumber: category === 'member' ? membershipNumber : undefined
    });
    res.status(201).json({
      message: category === 'member'
        ? 'Registration submitted. Your selected branch pastor must approve your membership before you can sign in.'
        : category === 'official'
          ? 'Official application submitted. NCBI leadership must verify your appointment and approve the requested dashboard before access is granted.'
          : 'Registration submitted. An NCBI administrator must approve your account before you can sign in.'
    });
  } catch (error) { next(error); }
});

router.get('/registrations/pending', requireAuth, async (req, res, next) => {
  try {
    const memberPastor = req.user.role === 'branch_pastor';
    const adminRoles = ['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_admin'];
    if (!memberPastor && !adminRoles.includes(req.user.role)) return res.status(403).json({ message: 'Registration approval permission required.' });
    const filter = { accountApproval: 'pending' };
    if (memberPastor) {
      const branchId = req.user.organisation?._id || req.user.organisation;
      filter.organisation = branchId;
      filter.registrationCategory = 'member';
    } else {
      filter.registrationCategory = { $in: ['non_member','official'] };
      const accessibleIds = await accessibleOrganisationIds(req.user);
      filter.organisation = { $in: accessibleIds };
    }
    const registrations = await User.find(filter)
      .select('fullName email organisation registrationCategory requestedRole registrationPhone claimedMembershipNumber createdAt')
      .populate('organisation','name code level').sort({ createdAt: 1 }).limit(200).lean();
    res.json({ registrations });
  } catch (error) { next(error); }
});

router.patch('/registrations/:id/decision', requireAuth, async (req, res, next) => {
  try {
    const decision = String(req.body.decision || '');
    const note = String(req.body.note || '').trim().slice(0, 500);
    if (!['approve','reject'].includes(decision)) return res.status(400).json({ message: 'Decision must be approve or reject.' });
    if (decision === 'reject' && !note) return res.status(400).json({ message: 'Provide a reason when rejecting an application.' });
    const memberPastor = req.user.role === 'branch_pastor';
    const target = await User.findOne({ _id: req.params.id, accountApproval: 'pending' });
    if (!target) return res.status(404).json({ message: 'Pending registration not found.' });
    const accessibleIds = await accessibleOrganisationIds(req.user);
    const scopeError = registrationScopeError(req.user, target, accessibleIds);
    if (scopeError) return res.status(403).json({ message: scopeError });
    const decisionError = registrationDecisionError(req.user, target);
    if (decisionError) return res.status(403).json({ message: decisionError });
    if (decision === 'approve' && target.registrationCategory === 'member') {
      const verifiedMember = await Member.findOne({
        homeOrganisation: target.organisation,
        membershipNumber: target.claimedMembershipNumber,
        status: { $in: ['new_believer','member','worker','minister'] }
      }).select('_id').lean();
      if (!verifiedMember) return res.status(409).json({ message: 'Membership could not be verified in this branch. Check the membership number and member record before approving.' });
      if (await User.exists({ memberProfile: verifiedMember._id, _id: { $ne: target._id } })) {
        return res.status(409).json({ message: 'This member already has a portal account.' });
      }
      target.memberProfile = verifiedMember._id;
    }
    if (decision === 'approve' && target.registrationCategory === 'official') {
      const roleRank = { super_admin:100, international_executive:90, national_admin:80, regional_overseer:70, district_pastor:60, branch_pastor:50, branch_admin:45, treasurer:35, department_leader:25, member:10 };
      const levels = { international_executive:['international'], national_admin:['national'], regional_overseer:['regional'], district_pastor:['district'], branch_pastor:['branch'], branch_admin:['branch'], treasurer:['branch','district','regional','national'], department_leader:['branch','district','regional','national'] };
      const requestedOrg = await Organisation.findById(target.organisation).select('level').lean();
      if (!target.requestedRole || roleRank[target.requestedRole] === undefined || roleRank[target.requestedRole] >= roleRank[req.user.role]) return res.status(403).json({ message: 'You are not authorised to approve or assign the requested church dashboard.' });
      if (!requestedOrg || !levels[target.requestedRole]?.includes(requestedOrg.level)) return res.status(409).json({ message: 'The requested dashboard does not match the selected church organisation level.' });
      target.role = target.requestedRole;
    }
    if (decision === 'approve' && target.registrationCategory === 'non_member') {
      const names = target.fullName.split(/\s+/);
      const visitor = await Member.create({
        firstName: names.shift() || target.fullName,
        lastName: names.join(' ') || 'Visitor',
        phone: target.registrationPhone, email: target.email,
        status: 'visitor', homeOrganisation: target.organisation
      });
      target.memberProfile = visitor._id;
    }
    target.accountApproval = decision === 'approve' ? 'approved' : 'rejected';
    target.active = decision === 'approve';
    target.approvalNote = note;
    if (decision === 'approve') { target.approvedBy = req.user._id; target.approvedAt = new Date(); }
    else { target.rejectedBy = req.user._id; target.rejectedAt = new Date(); }
    await target.save();
    await AuditLog.create({
      organisation: target.organisation, actor: req.user._id,
      action: decision === 'approve' ? 'account.registration_approved' : 'account.registration_rejected',
      entity: 'user', recordId: target._id,
      summary: 'Registration ' + (decision === 'approve' ? 'approved' : 'rejected') + ' for ' + target.fullName,
      metadata: { registrationCategory: target.registrationCategory, requestedRole: target.requestedRole || null, assignedRole: target.role, note },
      ipAddress: req.ip, userAgent: req.get('user-agent')
    });
    res.json({ message: decision === 'approve' ? (target.registrationCategory === 'official' ? 'Official application approved. The requested church dashboard has been assigned.' : 'Account approved. The applicant can now sign in.') : 'Registration rejected.', registration: { id: target.id, accountApproval: target.accountApproval, active: target.active } });
  } catch (error) { next(error); }
});

const hashAccountToken = value => createHash('sha256').update(String(value)).digest('hex');
const validEmail = value => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value || '').trim());

router.post('/password-reset/request', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    if (!validEmail(email)) return res.status(400).json({ message: 'Enter a valid email address.' });
    if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM || !/^https:\/\//i.test(String(process.env.APP_BASE_URL || ''))) return res.status(503).json({ message: 'Email recovery is not configured yet. Please contact the NCBI administrator.' });
    const user = await User.findOne({ email, active: true, accountApproval: 'approved' });
    if (user) {
      const token = randomBytes(32).toString('hex');
      user.passwordResetTokenHash = hashAccountToken(token);
      user.passwordResetExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
      await user.save();
      try {
        const url = accountActionUrl('resetPassword', token);
        await sendAccountEmail({
          to: user.email,
          subject: 'Reset your NCBI account password',
          text: 'A password reset was requested for your NCBI account. Open this link within 30 minutes to choose a new password: ' + url + '\n\nIf you did not request this, ignore this email.',
          html: '<p>A password reset was requested for your NCBI account.</p><p><a href="' + url + '">Reset your password</a></p><p>This link expires in 30 minutes and can only be used once. If you did not request this, ignore this email.</p>'
        });
      } catch (error) {
        user.passwordResetTokenHash = undefined;
        user.passwordResetExpiresAt = undefined;
        await user.save();
        console.error('NCBI password reset email delivery failed:', error.message);
      }
    }
    res.json({ message: 'If an active NCBI account exists for that email, a password-reset link will be sent shortly.' });
  } catch (error) { next(error); }
});

router.post('/password-reset/confirm', async (req, res, next) => {
  try {
    const token = String(req.body.token || '');
    const newPassword = String(req.body.newPassword || '');
    const validationError = passwordLengthError(newPassword, 'New password');
    if (!token || token.length > 200 || validationError || newPassword.length > 128) return res.status(400).json({ message: validationError || 'This password reset link is invalid.' });
    const user = await User.findOne({ passwordResetTokenHash: hashAccountToken(token), passwordResetExpiresAt: { $gt: new Date() } }).select('+passwordHash +passwordResetTokenHash +passwordResetExpiresAt');
    if (!user) return res.status(400).json({ message: 'This password reset link is invalid or has expired. Request a new one.' });
    user.passwordHash = await bcrypt.hash(newPassword, 12);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiresAt = undefined;
    user.tokenVersion = (user.tokenVersion || 0) + 1;
    await user.save();
    await AuditLog.create({ organisation: user.organisation, actor: user._id, action: 'account.password_reset', entity: 'user', recordId: user._id, summary: 'Password reset by verified email; existing sessions revoked', ipAddress: req.ip, userAgent: req.get('user-agent') });
    res.json({ message: 'Your password has been reset. You can now sign in with your new password.' });
  } catch (error) { next(error); }
});

router.post('/email-change/request', requireAuth, async (req, res, next) => {
  try {
    const newEmail = String(req.body.newEmail || '').trim().toLowerCase();
    const currentPassword = String(req.body.currentPassword || '');
    if (!validEmail(newEmail)) return res.status(400).json({ message: 'Enter a valid new email address.' });
    if (newEmail === req.user.email) return res.status(400).json({ message: 'That is already your registered email address.' });
    if (await User.exists({ email: newEmail, _id: { $ne: req.user._id } })) return res.status(409).json({ message: 'That email address is already associated with another account.' });
    const account = await User.findById(req.user._id).select('+passwordHash');
    if (!account || !(await bcrypt.compare(currentPassword, account.passwordHash))) return res.status(401).json({ message: 'Your current password is incorrect.' });
    const token = randomBytes(32).toString('hex');
    account.pendingEmail = newEmail;
    account.emailChangeTokenHash = hashAccountToken(token);
    account.emailChangeExpiresAt = new Date(Date.now() + 30 * 60 * 1000);
    await account.save();
    try {
      const url = accountActionUrl('verifyEmail', token);
      await sendAccountEmail({
        to: newEmail,
        subject: 'Confirm your new NCBI account email',
        text: 'Confirm your new NCBI account email by opening this link within 30 minutes: ' + url + '\n\nIf you did not request this change, ignore this email.',
        html: '<p>Confirm that you want to use this email address for your NCBI account.</p><p><a href="' + url + '">Confirm new email address</a></p><p>This link expires in 30 minutes and can only be used once.</p>'
      });
    } catch (error) {
      account.pendingEmail = undefined;
      account.emailChangeTokenHash = undefined;
      account.emailChangeExpiresAt = undefined;
      await account.save();
      throw error;
    }
    res.json({ message: 'A confirmation link has been sent to your new email address. Your current email remains active until you confirm the change.' });
  } catch (error) { next(error); }
});

router.post('/email-change/confirm', async (req, res, next) => {
  try {
    const token = String(req.body.token || '');
    if (!token || token.length > 200) return res.status(400).json({ message: 'This email confirmation link is invalid.' });
    const account = await User.findOne({ emailChangeTokenHash: hashAccountToken(token), emailChangeExpiresAt: { $gt: new Date() } }).select('+pendingEmail +emailChangeTokenHash +emailChangeExpiresAt');
    if (!account || !account.pendingEmail) return res.status(400).json({ message: 'This email confirmation link is invalid or has expired. Request a new one.' });
    if (await User.exists({ email: account.pendingEmail, _id: { $ne: account._id } })) return res.status(409).json({ message: 'That email address is now in use. Request a different address.' });
    const previousEmail = account.email;
    account.email = account.pendingEmail;
    account.pendingEmail = undefined;
    account.emailChangeTokenHash = undefined;
    account.emailChangeExpiresAt = undefined;
    account.tokenVersion = (account.tokenVersion || 0) + 1;
    await account.save();
    await AuditLog.create({ organisation: account.organisation, actor: account._id, action: 'account.email_changed', entity: 'user', recordId: account._id, summary: 'Account email changed after confirmation; previous sessions revoked', metadata: { previousEmail, newEmail: account.email }, ipAddress: req.ip, userAgent: req.get('user-agent') });
    res.json({ message: 'Your email address has been updated. Please sign in again using the new email address.' });
  } catch (error) { next(error); }
});

router.post('/change-password', requireAuth, async (req, res, next) => {
  try {
    const currentPassword = String(req.body.currentPassword || '');
    const newPassword = String(req.body.newPassword || '');
    const validationError = passwordChangeError(currentPassword, newPassword);
    if (validationError) return res.status(400).json({ message: validationError });
    const account = await User.findById(req.user._id).select('+passwordHash');
    if (!account || !(await bcrypt.compare(currentPassword, account.passwordHash))) return res.status(401).json({ message: 'Current password is incorrect' });
    account.passwordHash = await bcrypt.hash(newPassword, 12);
    account.tokenVersion = (account.tokenVersion || 0) + 1;
    await account.save();
    await AuditLog.create({ organisation: account.organisation, actor: account._id, action: 'account.password_changed', entity: 'user', recordId: account._id, summary: 'Password changed; existing sessions revoked', ipAddress: req.ip, userAgent: req.get('user-agent') });
    res.json({ message: 'Password changed successfully. Sign in again with your new password.' });
  } catch (error) { next(error); }
});

router.post('/logout-all', requireAuth, async (req, res, next) => {
  try {
    await User.updateOne({ _id: req.user._id }, { $inc: { tokenVersion: 1 } });
    await AuditLog.create({ organisation: req.user.organisation?._id || req.user.organisation, actor: req.user._id, action: 'account.sessions_revoked', entity: 'user', recordId: req.user._id, summary: 'All account sessions revoked', ipAddress: req.ip, userAgent: req.get('user-agent') });
    res.json({ message: 'All sessions have been revoked. Sign in again.' });
  } catch (error) { next(error); }
});

router.get('/me', requireAuth, async (req, res) => {
  await req.user.populate('organisation', 'name code level');
  res.json({ user: { id: req.user.id, fullName: req.user.fullName, email: req.user.email, role: req.user.role, permissions: req.user.permissions || [], organisation: req.user.organisation } });
});

export default router;
