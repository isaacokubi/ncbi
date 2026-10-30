import { Router } from 'express';
import { requireAuth, allowRoles } from '../middleware/auth.js';
import { SiteContent } from '../models/siteContent.js';

const router = Router();
const editors = ['super_admin', 'national_admin'];

router.get('/', requireAuth, allowRoles(...editors), async (_req, res, next) => {
  try {
    const saved = await SiteContent.findOne({ key: 'global' }).lean();
    res.set('Cache-Control', 'no-store');
    res.json({ content: saved ? { pages: saved.pages || {}, navigation: saved.navigation || {}, footer: saved.footer || {} } : null, updatedAt: saved?.updatedAt || null });
  } catch (error) { next(error); }
});

router.put('/', requireAuth, allowRoles(...editors), async (req, res, next) => {
  try {
    const content = req.body?.content;
    if (!content || typeof content !== 'object' || Array.isArray(content) || !content.pages || typeof content.pages !== 'object' || Array.isArray(content.pages)) {
      return res.status(400).json({ message: 'Provide valid website page content.' });
    }
    const encoded = JSON.stringify(content);
    if (Buffer.byteLength(encoded, 'utf8') > 100 * 1024) return res.status(413).json({ message: 'Website content must be 100 KB or smaller.' });
    const allowedPages = ['home', 'about', 'mission', 'ministries', 'branches', 'programmes', 'news', 'contact'];
    if (Object.keys(content.pages).some(key => !allowedPages.includes(key))) return res.status(400).json({ message: 'Website content contains an unsupported page.' });
    if (Object.values(content.pages).some(page => !page || typeof page !== 'object' || Array.isArray(page))) return res.status(400).json({ message: 'Each website page must be an object of editable fields.' });
    if (content.navigation != null && (typeof content.navigation !== 'object' || Array.isArray(content.navigation))) return res.status(400).json({ message: 'Navigation content must be an object.' });
    if (content.footer != null && (typeof content.footer !== 'object' || Array.isArray(content.footer))) return res.status(400).json({ message: 'Footer content must be an object.' });
    const saved = await SiteContent.findOneAndUpdate(
      { key: 'global' },
      { $set: { pages: content.pages, navigation: content.navigation || {}, footer: content.footer || {}, updatedBy: req.user._id } },
      { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    ).lean();
    res.set('Cache-Control', 'no-store');
    res.json({ message: 'Public website content saved successfully.', content: { pages: saved.pages, navigation: saved.navigation, footer: saved.footer }, updatedAt: saved.updatedAt });
  } catch (error) { next(error); }
});

export default router;
