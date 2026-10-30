import mongoose from 'mongoose';

const { Schema, model } = mongoose;
const timestamps = { timestamps: true };

const organisationSchema = new Schema({
  name: { type: String, required: true, trim: true },
  code: { type: String, required: true, unique: true, uppercase: true, trim: true },
  level: { type: String, enum: ['international', 'national', 'regional', 'district', 'branch'], required: true },
  parent: { type: Schema.Types.ObjectId, ref: 'Organisation', default: null, index: true },
  country: String, currency: { type: String, default: 'KES' },
  status: { type: String, enum: ['pending', 'active', 'suspended', 'archived'], default: 'pending', index: true },
  contactEmail: String, phone: String, address: String
}, timestamps);

const userSchema = new Schema({
  fullName: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true, trim: true },
  passwordHash: { type: String, required: true, select: false },
  role: { type: String, enum: ['super_admin', 'international_executive', 'national_admin', 'regional_overseer', 'district_pastor', 'branch_pastor', 'branch_admin', 'treasurer', 'department_leader', 'member'], required: true },
  organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  permissions: [{ type: String }],
  active: { type: Boolean, default: true }
}, timestamps);

const memberSchema = new Schema({
  membershipNumber: { type: String, trim: true, index: true },
  firstName: { type: String, required: true, trim: true },
  lastName: { type: String, required: true, trim: true },
  phone: String, email: String, dateOfBirth: Date, gender: String,
  homeOrganisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  status: { type: String, enum: ['visitor', 'new_believer', 'member', 'worker', 'minister', 'transferred', 'inactive'], default: 'visitor', index: true },
  joinedAt: Date, ministries: [String], assignedPastor: { type: Schema.Types.ObjectId, ref: 'User' },
  transferHistory: [{ from: Schema.Types.ObjectId, to: Schema.Types.ObjectId, approvedBy: Schema.Types.ObjectId, transferredAt: Date, note: String }]
}, timestamps);
memberSchema.index({ homeOrganisation: 1, membershipNumber: 1 }, { unique: true, sparse: true });

const attendanceSchema = new Schema({
  organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  activityName: { type: String, required: true, trim: true },
  category: { type: String, enum: ['sunday_service', 'midweek_service', 'prayer', 'bible_study', 'department', 'conference', 'outreach', 'other'], default: 'other' },
  heldAt: { type: Date, required: true, index: true },
  member: { type: Schema.Types.ObjectId, ref: 'Member', default: null },
  visitorName: String,
  recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  checkInMethod: { type: String, enum: ['manual', 'qr', 'self'], default: 'manual' }
}, timestamps);
attendanceSchema.index({ organisation: 1, member: 1, heldAt: 1, activityName: 1 }, { unique: true, partialFilterExpression: { member: { $type: 'objectId' } } });

const financeSchema = new Schema({
  organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  direction: { type: String, enum: ['income', 'expense'], required: true },
  category: { type: String, required: true, trim: true },
  amount: { type: Schema.Types.Decimal128, required: true },
  currency: { type: String, default: 'KES' },
  occurredAt: { type: Date, required: true },
  status: { type: String, enum: ['draft', 'submitted', 'approved', 'rejected', 'confirmed', 'voided'], default: 'draft', index: true },
  paymentMethod: { type: String, enum: ['cash', 'mpesa', 'bank', 'cheque', 'online', 'other'], default: 'other' },
  reference: String, description: String,\n  debitAccount: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },\n  creditAccount: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },\n  journalEntry: { type: Schema.Types.ObjectId, ref: 'JournalEntry', default: null },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  approvedAt: Date
}, timestamps);
financeSchema.index({ organisation: 1, reference: 1 }, { unique: true, sparse: true });

export const Organisation = mongoose.models.Organisation || model('Organisation', organisationSchema);
export const User = mongoose.models.User || model('User', userSchema);
export const Member = mongoose.models.Member || model('Member', memberSchema);
export const Attendance = mongoose.models.Attendance || model('Attendance', attendanceSchema);
export const FinanceTransaction = mongoose.models.FinanceTransaction || model('FinanceTransaction', financeSchema);
