import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { AuditLog } from '../models/domain.js';
import { requireAuth } from '../middleware/auth.js';
import { passwordChangeError } from '../domain/authPolicy.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');
    if (!email || !password) return res.status(400).json({ message: 'Email and password are required' });
    const user = await User.findOne({ email }).select('+passwordHash').populate('organisation', 'name code level');
    if (!user || !user.active || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ message: 'Email or password is incorrect' });
    }
    const token = jwt.sign({ sub: user.id, role: user.role, tokenVersion: user.tokenVersion || 0 }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    res.json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, permissions: user.permissions || [], organisation: user.organisation } });
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
