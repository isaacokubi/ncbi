import { Router } from 'express';
import { Organisation } from '../models/index.js';
import { OperationsRecord } from '../models/domain.js';
import { SiteContent } from '../models/siteContent.js';

const router = Router();
import mongoose from 'mongoose';
const Branding = mongoose.models.NcbiBranding || mongoose.model('NcbiBranding', new mongoose.Schema({key:{type:String,unique:true,default:'global'},logoData:{type:String,required:true},heroImageData:{type:String,default:''}},{timestamps:true}));
router.get('/branding',async(_req,res,next)=>{try{const item=await Branding.findOne({key:'global'}).select('logoData heroImageData').lean();res.set('Cache-Control','public, max-age=60, stale-while-revalidate=300');res.json({logoUrl:item?.logoData||'/ncbi-logo.jpg?v=20261030-2',heroImageUrl:item?.heroImageData||'/ncbi-logo.jpg'});}catch(error){next(error);}});

// Public data is opt-in: only records explicitly marked public are exposed.
// No member directory, financial data, pastoral records or internal notices
// are returned by this endpoint.
router.get('/content', async (_req, res, next) => {
  try {
    const now = new Date();
    const [branches, events, announcements, site] = await Promise.all([
      Organisation.find({ level: 'branch', status: 'active' }).select('name code country phone contactEmail address').sort({ country: 1, name: 1 }).limit(500).lean(),
      OperationsRecord.find({ entity: 'event', visibility: 'public', status: { $in: ['scheduled','active'] }, startAt: { $gte: now } }).sort({ startAt: 1 }).limit(20).select('title startAt endAt organisation data').populate('organisation','name code country').lean(),
      OperationsRecord.find({ entity: 'announcement', visibility: 'public', status: 'active' }).sort({ createdAt: -1 }).limit(10).select('title createdAt data organisation').populate('organisation','name code').lean(),
      SiteContent.findOne({ key: 'global' }).select('pages navigation footer updatedAt').lean()
    ]);
    res.set('Cache-Control', 'public, max-age=0, must-revalidate');
    res.json({ branches, events, announcements, siteContent: site ? { pages: site.pages || {}, navigation: site.navigation || {}, footer: site.footer || {} } : null, generatedAt: now.toISOString() });
  } catch (error) { next(error); }
});
export default router;
