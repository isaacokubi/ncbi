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
    const token = jwt.sign({ sub: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN || '8h' });
    res.json({ token, user: { id: user.id, fullName: user.fullName, email: user.email, role: user.role, permissions: user.permissions || [], organisation: user.organisation } });
  } catch (error) { next(error); }
});

router.get('/me', requireAuth, async (req, res) => {
  await req.user.populate('organisation', 'name code level');
  res.json({ user: { id: req.user.id, fullName: req.user.fullName, email: req.user.email, role: req.user.role, permissions: req.user.permissions || [], organisation: req.user.organisation } });
});

export default router;
