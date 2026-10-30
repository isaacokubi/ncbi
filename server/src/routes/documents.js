import { Router, raw } from 'express';

import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import path from 'node:path';
import { randomUUID, createHash } from 'node:crypto';
import mongoose from 'mongoose';
import { OperationsRecord, DocumentFile, AuditLog } from '../models/domain.js';
import { Member } from '../models/index.js';
import { requireAuth } from '../middleware/auth.js';
import { accessibleOrganisationIds } from '../middleware/organisationScope.js';

const router = Router();
router.use(requireAuth);
const managers = new Set(['super_admin','international_executive','national_admin','regional_overseer','district_pastor','branch_pastor','branch_admin']);
const upload = raw({ type: 'application/octet-stream', limit: 10 * 1024 * 1024 });
const types = {
  'application/pdf': { ext: '.pdf', ok: b => b.subarray(0,5).toString() === '%PDF-' },
  'image/jpeg': { ext: '.jpg', ok: b => b[0] === 255 && b[1] === 216 && b[2] === 255 },
  'image/png': { ext: '.png', ok: b => b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])) },
  'image/webp': { ext: '.webp', ok: b => b.subarray(0,4).toString() === 'RIFF' && b.subarray(8,12).toString() === 'WEBP' },
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': { ext: '.docx', ok: b => b[0] === 80 && b[1] === 75 && b[2] === 3 && b[3] === 4 },
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': { ext: '.xlsx', ok: b => b[0] === 80 && b[1] === 75 && b[2] === 3 && b[3] === 4 }
};
function storageRoot() {
  const value = process.env.DOCUMENT_STORAGE_DIR;
  if (!value || !path.isAbsolute(value)) throw Object.assign(new Error('Private document storage is not configured'), { status: 503 });
  return path.resolve(value);
}
function filename(value, ext) {
  const base = path.basename(String(value || 'document')).replace(/[\r\n"]/g, '').replace(/[^a-zA-Z0-9._ -]/g, '_').slice(0,120);
  return base.toLowerCase().endsWith(ext) ? base : (base.replace(/\.[^.]*$/, '') || 'document') + ext;
}
async function findDocument(req, id) {
  if (!mongoose.isValidObjectId(id)) return null;
  const ids = await accessibleOrganisationIds(req.user);
  return OperationsRecord.findOne({ _id:id, entity:'document', organisation:{$in:ids}, status:{$ne:'archived'} });
}

async function linkedMemberForDocuments(req) {
  if (req.user.role !== 'member' || !req.user.memberProfile) return null;
  const organisation = req.user.organisation?._id ?? req.user.organisation;
  return Member.findOne({ _id: req.user.memberProfile, homeOrganisation: organisation }).select('_id homeOrganisation').lean();
}
async function sendVerifiedFile(res, file) {
  const root = storageRoot();
  const target = path.resolve(root, file.storageKey);
  if (path.dirname(target) !== root) return res.status(404).json({ message: 'File not found' });
  const data = await readFile(target);
  if (data.length !== file.size || createHash('sha256').update(data).digest('hex') !== file.checksum) return res.status(404).json({ message: 'Stored file failed integrity verification' });
  const ext = types[file.mimeType]?.ext;
  if (!ext) return res.status(404).json({ message: 'File not found' });
  res.set({ 'Content-Type': 'application/octet-stream', 'Content-Length': String(file.size), 'Content-Disposition': 'attachment; filename="' + filename(file.originalName, ext) + '"', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store, private' });
  return res.send(data);
}
router.get('/member/files', async (req, res, next) => {
  try {
    const member = await linkedMemberForDocuments(req);
    if (!member) return res.status(403).json({ message: 'Member document access denied' });
    const documents = await OperationsRecord.find({ organisation: member.homeOrganisation, entity: 'document', status: { $in: ['active','completed'] }, 'data.memberId': String(member._id) }).sort({ createdAt: -1 }).limit(50).select('title reference createdAt data').lean();
    const ids = documents.map(document => document._id);
    const stored = ids.length ? await DocumentFile.find({ organisation: member.homeOrganisation, document: { $in: ids }, status: 'active' }).sort({ version: -1 }).select('document originalName mimeType size version createdAt').lean() : [];
    const byDocument = new Map();
    for (const file of stored) { const key = String(file.document); if (!byDocument.has(key)) byDocument.set(key, []); byDocument.get(key).push({ id: file._id, originalName: file.originalName, mimeType: file.mimeType, size: file.size, version: file.version, createdAt: file.createdAt }); }
    res.set('Cache-Control', 'private, no-store');
    res.json({ documents: documents.map(document => ({ ...document, files: byDocument.get(String(document._id)) || [] })) });
  } catch (error) { next(error); }
});
router.get('/member/files/:fileId/download', async (req, res, next) => {
  try {
    const member = await linkedMemberForDocuments(req);
    if (!member || !mongoose.isValidObjectId(req.params.fileId)) return res.status(404).json({ message: 'File not found' });
    const file = await DocumentFile.findOne({ _id: req.params.fileId, organisation: member.homeOrganisation, status: 'active' }).select('+storageKey').lean();
    if (!file) return res.status(404).json({ message: 'File not found' });
    const document = await OperationsRecord.findOne({ _id: file.document, organisation: member.homeOrganisation, entity: 'document', status: { $in: ['active','completed'] }, 'data.memberId': String(member._id) }).select('_id').lean();
    if (!document) return res.status(404).json({ message: 'File not found' });
    await AuditLog.create({ organisation: member.homeOrganisation, actor: req.user._id, action: 'member-document-download', entity: 'document_file', recordId: file._id, summary: 'Member downloaded an assigned document' });
    return sendVerifiedFile(res, file);
  } catch (error) { next(error); }
});

router.get('/:id/files', async (req,res,next) => {
  try {
    if (!managers.has(req.user.role)) return res.status(403).json({message:'Document access denied'});
    const doc = await findDocument(req,req.params.id);
    if (!doc) return res.status(404).json({message:'Document not found'});
    const files = await DocumentFile.find({organisation:doc.organisation,document:doc._id,status:'active'}).sort({version:-1}).select('-storageKey -__v').populate('uploadedBy','fullName').lean();
    res.set('Cache-Control','no-store, private');
    res.json({files});
  } catch(e) { next(e); }
});
router.post('/:id/files', upload, async (req,res,next) => {
  let target;
  try {
    if (!managers.has(req.user.role)) return res.status(403).json({message:'Document upload denied'});
    const doc = await findDocument(req,req.params.id);
    if (!doc) return res.status(404).json({message:'Document not found'});
    if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({message:'A non-empty binary file is required'});
    const mime = String(req.get('x-file-type') || '').toLowerCase();
    const type = types[mime];
    if (!type || !type.ok(req.body)) return res.status(415).json({message:'Unsupported file type or invalid signature'});
    const root = storageRoot();
    await mkdir(root,{recursive:true,mode:0o700});
    const key = randomUUID();
    target = path.join(root,key);
    await writeFile(target,req.body,{flag:'wx',mode:0o600});
    const latest = await DocumentFile.findOne({organisation:doc.organisation,document:doc._id}).sort({version:-1}).select('version').lean();
    const version = (latest?.version || 0)+1;
    const sum = createHash('sha256').update(req.body).digest('hex');
    const originalName = filename(req.get('x-file-name'),type.ext);
    const file = await DocumentFile.create({organisation:doc.organisation,document:doc._id,storageKey:key,originalName,mimeType:mime,size:req.body.length,checksum:sum,version,uploadedBy:req.user._id});
    await AuditLog.create({organisation:doc.organisation,actor:req.user._id,action:'document-upload',entity:'document_file',recordId:file._id,summary:'Uploaded a new document version',metadata:{documentId:String(doc._id),version,size:file.size,checksum:sum}});
    res.status(201).json({file:{id:file._id,originalName,mimeType:mime,size:file.size,checksum:sum,version,createdAt:file.createdAt}});
  } catch(e) {
    if (target) await unlink(target).catch(()=>{});
    if (e.code===11000) return res.status(409).json({message:'A concurrent upload created this version; retry'});
    next(e);
  }
});
router.get('/files/:fileId/download', async (req,res,next) => {
  try {
    if (!managers.has(req.user.role)) return res.status(403).json({message:'Document download denied'});
    if (!mongoose.isValidObjectId(req.params.fileId)) return res.status(404).json({message:'File not found'});
    const ids = await accessibleOrganisationIds(req.user);
    const file = await DocumentFile.findOne({_id:req.params.fileId,organisation:{$in:ids},status:'active'}).select('+storageKey').lean();
    if (!file) return res.status(404).json({message:'File not found'});
    const doc = await OperationsRecord.findOne({_id:file.document,entity:'document',organisation:file.organisation,status:{$ne:'archived'}}).select('_id').lean();
    if (!doc) return res.status(404).json({message:'File not found'});
    const root = storageRoot();
    const target = path.resolve(root,file.storageKey);
    if (path.dirname(target)!==root) return res.status(404).json({message:'File not found'});
    const data = await readFile(target);
    if (data.length !== file.size || createHash('sha256').update(data).digest('hex') !== file.checksum) return res.status(404).json({message:'Stored file failed integrity verification'});
    const ext = types[file.mimeType].ext;
    res.set({'Content-Type':'application/octet-stream','Content-Length':String(file.size),'Content-Disposition':'attachment; filename="'+filename(file.originalName,ext)+'"','X-Content-Type-Options':'nosniff','Cache-Control':'no-store, private'});
    res.send(data);
  } catch(e) { next(e); }
});
export default router;
