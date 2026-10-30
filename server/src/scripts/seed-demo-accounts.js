import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { Organisation, User, Member } from '../models/index.js';
import { passwordLengthError } from '../domain/authPolicy.js';

// Idempotent demo-account seed. The existing super_admin is required and never created or changed.
const commonPassword = process.env.SEED_COMMON_PASSWORD;
const seedPasswordError = passwordLengthError(commonPassword, 'SEED_COMMON_PASSWORD');
if (seedPasswordError) throw new Error(seedPasswordError);

await connectDatabase();
try {
  const root = await Organisation.findOne({ code: 'NCBI' });
  if (!root) throw new Error('NCBI international organisation not found. Confirm the existing admin bootstrap organisation.');
  if (root.level !== 'international') throw new Error('NCBI organisation must be the international root.');

  const existingAdmin = await User.findOne({
    role: 'super_admin',
    organisation: root._id,
    active: true
  }).select('_id email').lean();
  if (!existingAdmin) {
    throw new Error('No active super_admin account was found for the NCBI international organisation. Seed stopped without creating accounts.');
  }

  const ensureOrganisation = async ({ name, code, level, parent }) => {
    let organisation = await Organisation.findOne({ code });
    if (organisation) {
      if (organisation.level !== level || String(organisation.parent || '') !== String(parent || '')) {
        throw new Error(`Existing organisation ${code} has a different hierarchy; refusing to modify it.`);
      }
      if (organisation.status !== 'active') {
        organisation.status = 'active';
        await organisation.save();
      }
      return organisation;
    }
    return Organisation.create({
      name, code, level, parent: parent || null,
      country: 'Kenya', currency: 'KES', status: 'active'
    });
  };

  const national = await ensureOrganisation({
    name: 'NCBI Kenya National Office', code: 'NCBI-KE', level: 'national', parent: root._id
  });
  const regional = await ensureOrganisation({
    name: 'NCBI Western Region', code: 'NCBI-WEST', level: 'regional', parent: national._id
  });
  const district = await ensureOrganisation({
    name: 'NCBI Ebuyangu District', code: 'NCBI-EBUYANGU', level: 'district', parent: regional._id
  });
  const branch = await ensureOrganisation({
    name: 'NCBI New Jerusalem Ebuyangu Branch', code: 'NCBI-NEWJERUSALEM', level: 'branch', parent: district._id
  });

  const passwordHash = await bcrypt.hash(commonPassword, 12);
  const accounts = [
    { fullName: 'NCBI International Executive', email: 'international@ncbi.org', role: 'international_executive', organisation: root._id },
    { fullName: 'NCBI Kenya National Administrator', email: 'national@ncbi.org', role: 'national_admin', organisation: national._id },
    { fullName: 'NCBI Western Regional Overseer', email: 'regional@ncbi.org', role: 'regional_overseer', organisation: regional._id },
    { fullName: 'NCBI Ebuyangu District Pastor', email: 'district@ncbi.org', role: 'district_pastor', organisation: district._id },
    { fullName: 'NCBI Branch Pastor', email: 'pastor@ncbi.org', role: 'branch_pastor', organisation: branch._id },
    { fullName: 'NCBI Branch Administrator', email: 'branchadmin@ncbi.org', role: 'branch_admin', organisation: branch._id },
    { fullName: 'NCBI Branch Treasurer', email: 'treasurer@ncbi.org', role: 'treasurer', organisation: branch._id },
    { fullName: 'NCBI Department Leader', email: 'department@ncbi.org', role: 'department_leader', organisation: branch._id }
  ];

  const results = [];
  for (const account of accounts) {
    const existing = await User.findOne({ email: account.email }).select('email role').lean();
    if (existing) {
      results.push({ email: existing.email, role: existing.role, status: 'already-exists-unchanged' });
      continue;
    }
    const created = await User.create({ ...account, passwordHash, active: true });
    results.push({ email: created.email, role: created.role, status: 'created' });
  }

  const memberEmail = 'member@ncbi.org';
  const existingMemberUser = await User.findOne({ email: memberEmail }).select('email role').lean();
  if (existingMemberUser) {
    results.push({ email: existingMemberUser.email, role: existingMemberUser.role, status: 'already-exists-unchanged' });
  } else {
    let profile = await Member.findOne({ homeOrganisation: branch._id, email: memberEmail });
    if (!profile) {
      profile = await Member.create({
        firstName: 'Demo', lastName: 'Member', email: memberEmail,
        status: 'member', joinedAt: new Date(), homeOrganisation: branch._id
      });
    }
    const created = await User.create({
      fullName: 'NCBI Demo Member', email: memberEmail, passwordHash,
      role: 'member', organisation: branch._id, memberProfile: profile._id, active: true
    });
    results.push({ email: created.email, role: created.role, status: 'created' });
  }

  console.log(`Existing administrator verified: ${existingAdmin.email} (left unchanged)`);
  console.log('NCBI demo account seed completed:');
  for (const item of results) console.log(`- ${item.email} | ${item.role} | ${item.status}`);
  console.log('The common password was applied only to newly created demo accounts.');
} finally {
  await mongoose.disconnect();
}
