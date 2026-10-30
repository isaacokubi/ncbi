import mongoose from 'mongoose';

// One global public-site document. Mixed content keeps page copy and repeated
// cards editable without schema migrations whenever the church updates wording.
const schema = new mongoose.Schema({
  key: { type: String, unique: true, default: 'global', immutable: true },
  pages: { type: mongoose.Schema.Types.Mixed, required: true, default: {} },
  navigation: { type: mongoose.Schema.Types.Mixed, default: {} },
  footer: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null }
}, { timestamps: true });

export const SiteContent = mongoose.models.NcbiSiteContent || mongoose.model('NcbiSiteContent', schema);
