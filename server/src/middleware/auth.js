import jwt from 'jsonwebtoken';
import { User } from '../models/index.js';

export async function requireAuth(req, res, next) {
  try {
    const token = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7) : null;
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    const user = await User.findById(payload.sub).select('+passwordHash');
    if (!user || !user.active) return res.status(401).json({ message: 'Session is no longer valid' });
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

// Scope every ordinary workspace query to the user's assigned organisation.
// Elevated cross-branch access is explicit and limited to oversight roles.
export function organisationScope(user) {
  if (['super_admin', 'international_executive'].includes(user.role)) return {};
  return { homeOrganisation: user.organisation._id ?? user.organisation };
}
