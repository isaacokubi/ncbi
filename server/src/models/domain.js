import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const recordSchema = new Schema({
  organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  entity: { type: String, required: true, enum: ['department','event','pastoral_case','prayer_request','mission','discipleship_course','service_plan','leadership_appointment','asset','project','document','visitor_follow_up','announcement','volunteer','training','property'] , index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  reference: { type: String, trim: true, maxlength: 80 },
  status: { type: String, enum: ['draft','pending','active','scheduled','in_progress','completed','cancelled','archived','closed'], default: 'active', index: true },
  startAt: Date, endAt: Date,
  owner: { type: Schema.Types.ObjectId, ref: 'User' },
  assignedTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  visibility: { type: String, enum: ['private','team','organisation'], default: 'organisation' },
  data: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  archivedAt: Date
}, { timestamps: true, minimize: false });
recordSchema.index({ organisation: 1, entity: 1, status: 1, startAt: 1 });
recordSchema.index({ organisation: 1, entity: 1, reference: 1 }, { unique: true, partialFilterExpression: { reference: { $type: 'string' } } });

const auditSchema = new Schema({
  organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', index: true },
  actor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true },
  entity: { type: String, required: true },
  recordId: { type: Schema.Types.ObjectId },
  summary: { type: String, maxlength: 300 },
  metadata: { type: Schema.Types.Mixed, default: {} },
  ipAddress: String,
  userAgent: String
}, { timestamps: true });
auditSchema.index({ organisation: 1, createdAt: -1 });

export const OperationsRecord = mongoose.models.OperationsRecord || model('OperationsRecord', recordSchema);
export const AuditLog = mongoose.models.AuditLog || model('AuditLog', auditSchema);
