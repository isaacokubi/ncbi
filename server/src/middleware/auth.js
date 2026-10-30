import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';
import { tokenVersionMatches } from '../domain/authPolicy.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).populate('organisation', 'name code level parent');
    if (!user || !user.active || !tokenVersionMatches(payload.tokenVersion, user.tokenVersion)) return res.status(401).json({ message: 'Session is no longer valid. Please sign in again.' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ message: 'Invalid or expired session' });
  }
}

export const allowRoles = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) return res.status(403).json({ message: 'Insufficient permission' });
  next();
};
