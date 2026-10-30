import mongoose from 'mongoose';
const { Schema, model } = mongoose;
const recordSchema = new Schema({
  organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  entity: { type: String, required: true, enum: ['department','event','pastoral_case','prayer_request','mission','discipleship_course','service_plan','leadership_appointment','asset','project','document','visitor_follow_up','announcement','volunteer','training','property','children_ministry','youth_ministry','family_ministry','small_group','baptism','wedding','funeral','benevolence','facility_booking','inventory','procurement','communications','media','transport','compliance','member_class','volunteer_schedule','event_registration','sermon','church_plant','sponsorship','donation_pledge','member_enrolment','member_notification','ministry_report','welfare_visit','discipline_case','counselling_case'], index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  reference: { type: String, trim: true, maxlength: 80 },
  status: { type: String, enum: ['draft','pending','active','scheduled','in_progress','completed','cancelled','archived','closed'], default: 'active', index: true },
  startAt: Date, endAt: Date,
  owner: { type: Schema.Types.ObjectId, ref: 'User' },
  assignedTo: [{ type: Schema.Types.ObjectId, ref: 'User' }],
  visibility: { type: String, enum: ['private','team','organisation','public'], default: 'organisation' },
  data: { type: Schema.Types.Mixed, default: {} },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  updatedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  archivedAt: Date
}, { timestamps: true, minimize: false });
recordSchema.index({ organisation: 1, entity: 1, status: 1, startAt: 1 });
recordSchema.index({ organisation: 1, entity: 1, reference: 1 }, { unique: true, partialFilterExpression: { reference: { $type: 'string', $gt: '' } } });
const auditSchema = new Schema({
  organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', index: true },
  actor: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  action: { type: String, required: true }, entity: { type: String, required: true },
  recordId: Schema.Types.ObjectId, summary: { type: String, maxlength: 300 },
  metadata: { type: Schema.Types.Mixed, default: {} }, ipAddress: String, userAgent: String
}, { timestamps: true });
auditSchema.index({ organisation: 1, createdAt: -1 });
export const OperationsRecord = mongoose.models.OperationsRecord || model('OperationsRecord', recordSchema);
export const AuditLog = mongoose.models.AuditLog || model('AuditLog', auditSchema);

const ledgerAccountSchema = new Schema({
  organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  code: { type: String, required: true, trim: true },
  name: { type: String, required: true, trim: true, maxlength: 120 },
  type: { type: String, enum: ['asset','liability','equity','income','expense'], required: true },
  normalBalance: { type: String, enum: ['debit','credit'], required: true },
  parent: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', default: null },
  active: { type: Boolean, default: true },
  system: { type: Boolean, default: false }
}, { timestamps: true });
ledgerAccountSchema.index({ organisation: 1, code: 1 }, { unique: true });

const journalEntrySchema = new Schema({
  organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  entryNumber: { type: String, required: true, trim: true },
  entryDate: { type: Date, required: true, index: true },
  description: { type: String, required: true, maxlength: 300 },
  status: { type: String, enum: ['draft','submitted','posted','rejected','void'], default: 'draft', index: true },
  lines: [{
    account: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
    debit: { type: Schema.Types.Decimal128, default: '0.00' },
    credit: { type: Schema.Types.Decimal128, default: '0.00' },
    memo: { type: String, maxlength: 180 }
  }],
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  approvedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  postedAt: Date,
  sourceType: String,
  sourceId: Schema.Types.ObjectId
}, { timestamps: true });
journalEntrySchema.index({ organisation: 1, entryNumber: 1 }, { unique: true });
journalEntrySchema.index({ sourceType: 1, sourceId: 1 }, { unique: true, partialFilterExpression: { sourceType: { $type: 'string' }, sourceId: { $type: 'objectId' } } });

const budgetSchema = new Schema({
  organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  account: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
  fiscalYear: { type: Number, required: true },
  period: { type: String, enum: ['annual','q1','q2','q3','q4','jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'], default: 'annual' },
  amount: { type: Schema.Types.Decimal128, required: true },
  notes: { type: String, maxlength: 300 },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true }
}, { timestamps: true });
budgetSchema.index({ organisation: 1, account: 1, fiscalYear: 1, period: 1 }, { unique: true });

const bankReconciliationSchema = new Schema({
  organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  bankAccount: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
  statementDate: { type: Date, required: true },
  statementBalance: { type: Schema.Types.Decimal128, required: true },
  bookBalance: { type: Schema.Types.Decimal128, default: '0.00' },
  difference: { type: Schema.Types.Decimal128, default: '0.00' },
  status: { type: String, enum: ['open','reconciled'], default: 'open' },
  reconciledBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reconciledAt: Date,
  notes: { type: String, maxlength: 500 }
}, { timestamps: true });
bankReconciliationSchema.index({ organisation: 1, bankAccount: 1, statementDate: 1 }, { unique: true });

export const LedgerAccount = mongoose.models.LedgerAccount || model('LedgerAccount', ledgerAccountSchema);
export const JournalEntry = mongoose.models.JournalEntry || model('JournalEntry', journalEntrySchema);
export const Budget = mongoose.models.Budget || model('Budget', budgetSchema);
export const BankReconciliation = mongoose.models.BankReconciliation || model('BankReconciliation', bankReconciliationSchema);

const paymentIntentSchema = new Schema({
  organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  amount: { type: Schema.Types.Decimal128, required: true },
  phoneNumber: { type: String, required: true },
  accountReference: { type: String, required: true, maxlength: 12 },
  description: { type: String, maxlength: 100 },
  debitAccount: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
  creditAccount: { type: Schema.Types.ObjectId, ref: 'LedgerAccount', required: true },
  status: { type: String, enum: ['initiated','accepted','processing','paid','failed'], default: 'initiated', index: true },
  merchantRequestId: String,
  checkoutRequestId: { type: String, unique: true, sparse: true },
  responseDescription: String,
  mpesaReceipt: { type: String, unique: true, sparse: true },
  transactionDate: Date,
  financeTransaction: { type: Schema.Types.ObjectId, ref: 'FinanceTransaction' },
  journalEntry: { type: Schema.Types.ObjectId, ref: 'JournalEntry' },
  createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  callbackReceivedAt: Date
}, { timestamps: true });
paymentIntentSchema.index({ organisation: 1, createdAt: -1 });
export const PaymentIntent = mongoose.models.PaymentIntent || model('PaymentIntent', paymentIntentSchema);

const sequenceSchema = new Schema({
  key: { type: String, required: true, unique: true },
  value: { type: Number, default: 0 }
}, { timestamps: true });
export const SequenceCounter = mongoose.models.SequenceCounter || model('SequenceCounter', sequenceSchema);


const documentFileSchema = new Schema({
  organisation: { type: Schema.Types.ObjectId, ref: 'Organisation', required: true, index: true },
  document: { type: Schema.Types.ObjectId, ref: 'OperationsRecord', required: true, index: true },
  storageKey: { type: String, required: true, unique: true, select: false },
  originalName: { type: String, required: true, maxlength: 140 },
  mimeType: { type: String, required: true, enum: ['application/pdf','image/jpeg','image/png','image/webp','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'] },
  size: { type: Number, required: true, min: 1, max: 10485760 },
  checksum: { type: String, required: true, match: /^[a-f0-9]{64}$/ },
  version: { type: Number, required: true, min: 1 },
  uploadedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['active','archived'], default: 'active', index: true }
}, { timestamps: true });
documentFileSchema.index({ organisation: 1, document: 1, version: 1 }, { unique: true });
export const DocumentFile = mongoose.models.DocumentFile || model('DocumentFile', documentFileSchema);

const safeguardingConsentSchema = new Schema({
 organisation:{type:Schema.Types.ObjectId,ref:'Organisation',required:true,index:true},
 child:{type:Schema.Types.ObjectId,ref:'Member',required:true,index:true},
 guardianName:{type:String,required:true,trim:true,maxlength:120}, guardianRelationship:{type:String,required:true,trim:true,maxlength:60}, guardianPhone:{type:String,required:true,trim:true,maxlength:30},
 guardianConfirmedAuthority:{type:Boolean,required:true,default:false},
 consentTypes:[{type:String,enum:['participation','photography','media_publication','emergency_medical','authorised_collection','offsite_travel']}],
 authorisedPickupPersons:[{name:{type:String,trim:true,maxlength:120},phone:{type:String,trim:true,maxlength:30}}],
 validFrom:{type:Date,required:true},validUntil:{type:Date,default:null},status:{type:String,enum:['active','revoked'],default:'active',index:true},
 capturedBy:{type:Schema.Types.ObjectId,ref:'User',required:true},revokedBy:{type:Schema.Types.ObjectId,ref:'User',default:null},revokedAt:Date,revocationReason:{type:String,maxlength:300}
},{timestamps:true});
safeguardingConsentSchema.index({organisation:1,child:1,status:1,validUntil:1});
export const SafeguardingConsent = mongoose.models.SafeguardingConsent || model('SafeguardingConsent', safeguardingConsentSchema);
