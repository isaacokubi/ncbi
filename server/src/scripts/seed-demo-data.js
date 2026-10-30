import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { Organisation, User, Member, Attendance, FinanceTransaction } from '../models/index.js';
import { OperationsRecord, LedgerAccount, InventoryItem } from '../models/domain.js';

const password = process.env.SEED_COMMON_PASSWORD;
if (!password || password.length < 6) {
  throw new Error('Set SEED_COMMON_PASSWORD (minimum 6 characters) in server/.env before seeding.');
}

const now = new Date();
const dateOffset = (days) => new Date(now.getTime() - days * 86400000);
const passwordHash = await bcrypt.hash(password, 12);
const counts = { organisations: 0, users: 0, members: 0, attendance: 0, finance: 0, operations: 0, inventory: 0 };
const accountLog = [];

await connectDatabase();
try {
  const root = await Organisation.findOne({ code: 'NCBI' });
  if (!root || root.level !== 'international') throw new Error('The active NCBI international root is required. Run the existing bootstrap-admin process first.');
  const platformAdmin = await User.findOne({ role: 'super_admin', organisation: root._id, active: true }).select('_id email');
  if (!platformAdmin) throw new Error('An active NCBI super_admin is required. No data was seeded.');

  async function organisation({ name, code, level, parent, country = 'Kenya', currency = 'KES', address = '' }) {
    let doc = await Organisation.findOne({ code });
    if (doc && (doc.level !== level || String(doc.parent || '') !== String(parent || ''))) {
      throw new Error(`Organisation ${code} already exists with a different hierarchy; refusing to alter it.`);
    }
    if (!doc) {
      doc = await Organisation.create({ name, code, level, parent: parent || null, country, currency, address, status: 'active' });
      counts.organisations += 1;
    } else if (doc.status !== 'active') {
      doc.status = 'active';
      await doc.save();
    }
    return doc;
  }

  async function user({ fullName, email, role, organisation: org, phone }) {
    const normalizedEmail = email.toLowerCase();
    let doc = await User.findOne({ email: normalizedEmail }).select('+passwordHash');
    if (doc) {
      if (doc.role !== role || String(doc.organisation) !== String(org._id)) {
        throw new Error(`Seed account ${normalizedEmail} already exists with a different role or organisation.`);
      }
      accountLog.push({ email: doc.email, role: doc.role, status: 'existing' });
      return doc;
    }
    doc = await User.create({
      fullName, email: normalizedEmail, passwordHash, role, organisation: org._id,
      active: true, accountApproval: 'approved', registrationPhone: phone
    });
    counts.users += 1;
    accountLog.push({ email: doc.email, role: doc.role, status: 'created' });
    return doc;
  }

  async function member({ firstName, lastName, email, phone, org, pastor, status, number }) {
    const membershipNumber = number;
    let doc = await Member.findOne({ homeOrganisation: org._id, membershipNumber });
    if (doc) return doc;
    doc = await Member.create({
      firstName, lastName, email, phone, membershipNumber, homeOrganisation: org._id,
      status, joinedAt: dateOffset(30 + (counts.members % 900)),
      gender: counts.members % 2 ? 'Female' : 'Male',
      residentialLocation: org.address || org.name,
      ministries: ['Worship', 'Discipleship'],
      assignedPastor: pastor?._id || null
    });
    counts.members += 1;
    return doc;
  }

  async function operation(org, actor, entity, reference, title, data = {}, status = 'active', visibility = 'organisation') {
    const existing = await OperationsRecord.exists({ organisation: org._id, entity, reference });
    const doc = await OperationsRecord.findOneAndUpdate(
      { organisation: org._id, entity, reference },
      { $setOnInsert: {
        organisation: org._id, entity, reference, title, data, status, visibility,
        owner: actor._id, assignedTo: [actor._id], createdBy: actor._id, updatedBy: actor._id,
        startAt: dateOffset(-1), endAt: dateOffset(30)
      } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (!existing) counts.operations += 1;
    return doc;
  }

  // Three international headquarters, five national offices, eight regions and ten districts.
  const internationals = [
    { org: root, key: 'KE', country: 'Kenya', currency: 'KES' },
    { org: await organisation({ name: 'NCBI East Africa International', code: 'NCBI-INT-EA', level: 'international', parent: null, country: 'Uganda', currency: 'UGX', address: 'Kampala, Uganda' }), key: 'EA', country: 'Uganda', currency: 'UGX' },
    { org: await organisation({ name: 'NCBI Southern Africa International', code: 'NCBI-INT-SA', level: 'international', parent: null, country: 'Zambia', currency: 'ZMW', address: 'Lusaka, Zambia' }), key: 'SA', country: 'Zambia', currency: 'ZMW' }
  ];
  const nationalSpecs = [
    ['Kenya National Office','NCBI-KE',0,'Kenya','KES','Nairobi'],
    ['Uganda National Office','NCBI-UG',1,'Uganda','UGX','Kampala'],
    ['Tanzania National Office','NCBI-TZ',1,'Tanzania','TZS','Dar es Salaam'],
    ['Rwanda National Office','NCBI-RW',1,'Rwanda','RWF','Kigali'],
    ['Zambia National Office','NCBI-ZM',2,'Zambia','ZMW','Lusaka']
  ];
  const nationals = [];
  for (const [name, code, parentIndex, country, currency, city] of nationalSpecs) {
    nationals.push(await organisation({ name, code, level: 'national', parent: internationals[parentIndex].org._id, country, currency, address: city }));
  }

  const regionSpecs = [
    ['Western Region','NCBI-REG-WEST',0,'Kenya'], ['Nairobi Region','NCBI-REG-NAIROBI',0,'Kenya'],
    ['Central Region','NCBI-REG-CENTRAL',0,'Kenya'], ['Central Uganda Region','NCBI-REG-UG-CENTRAL',1,'Uganda'],
    ['Northern Uganda Region','NCBI-REG-UG-NORTH',1,'Uganda'], ['Northern Tanzania Region','NCBI-REG-TZ-NORTH',2,'Tanzania'],
    ['Kigali Region','NCBI-REG-RW-KIGALI',3,'Rwanda'], ['Lusaka Region','NCBI-REG-ZM-LUSAKA',4,'Zambia']
  ];
  const regions = [];
  for (const [name, code, nationalIndex, country] of regionSpecs) {
    regions.push(await organisation({ name, code, level: 'regional', parent: nationals[nationalIndex]._id, country, address: country }));
  }

  const districtSpecs = [
    ['Ebuyangu District','NCBI-DST-EBUYANGU',0,'Kenya','Ebuyangu'],
    ['Kakamega District','NCBI-DST-KAKAMEGA',0,'Kenya','Kakamega'],
    ['Kisumu District','NCBI-DST-KISUMU',0,'Kenya','Kisumu'],
    ['Nairobi East District','NCBI-DST-NAIROBI-E',1,'Kenya','Nairobi'],
    ['Nairobi West District','NCBI-DST-NAIROBI-W',1,'Kenya','Nairobi'],
    ['Jinja District','NCBI-DST-JINJA',3,'Uganda','Jinja'],
    ['Kampala District','NCBI-DST-KAMPALA',3,'Uganda','Kampala'],
    ['Arusha District','NCBI-DST-ARUSHA',5,'Tanzania','Arusha'],
    ['Kigali District','NCBI-DST-KIGALI',6,'Rwanda','Kigali'],
    ['Lusaka District','NCBI-DST-LUSAKA',7,'Zambia','Lusaka']
  ];
  const districts = [];
  for (const [name, code, regionIndex, country, city] of districtSpecs) {
    districts.push(await organisation({ name, code, level: 'district', parent: regions[regionIndex]._id, country, address: city }));
  }

  const branchSpecs = [
    ['New Jerusalem Ebuyangu Church','NCBI-CH-EBUYANGU',0,'Kenya','Ebuyangu, Kakamega'],
    ['Kakamega Central Church','NCBI-CH-KAKAMEGA',1,'Kenya','Kakamega'],
    ['Kisumu Grace Church','NCBI-CH-KISUMU',2,'Kenya','Kisumu'],
    ['Nairobi Hope Church','NCBI-CH-NAIROBI',3,'Kenya','Nairobi'],
    ['Jinja River Church','NCBI-CH-JINJA',5,'Uganda','Jinja']
  ];
  const branches = [];
  for (const [name, code, districtIndex, country, address] of branchSpecs) {
    branches.push(await organisation({ name, code, level: 'branch', parent: districts[districtIndex]._id, country, currency: country === 'Uganda' ? 'UGX' : 'KES', address }));
  }

  // Role accounts at every governance level. Existing matching accounts are preserved.
  for (let i = 0; i < internationals.length; i += 1) {
    await user({ fullName: `${internationals[i].org.name} Executive`, email: `executive.${internationals[i].key.toLowerCase()}@demo.ncbi.org`, role: 'international_executive', organisation: internationals[i].org });
  }
  for (let i = 0; i < nationals.length; i += 1) {
    await user({ fullName: `${nationals[i].name} Administrator`, email: `national.${nationalSpecs[i][1].toLowerCase()}@demo.ncbi.org`, role: 'national_admin', organisation: nationals[i] });
  }
  for (let i = 0; i < regions.length; i += 1) {
    await user({ fullName: `${regions[i].name} Overseer`, email: `overseer.${regionSpecs[i][1].toLowerCase()}@demo.ncbi.org`, role: 'regional_overseer', organisation: regions[i] });
  }
  const districtUsers = [];
  for (let i = 0; i < districts.length; i += 1) {
    districtUsers.push(await user({ fullName: `${districts[i].name} Pastor`, email: `district.${districtSpecs[i][1].toLowerCase()}@demo.ncbi.org`, role: 'district_pastor', organisation: districts[i] }));
  }

  const branchActors = [];
  for (let i = 0; i < branches.length; i += 1) {
    const prefix = branchSpecs[i][1].toLowerCase();
    const pastor = await user({ fullName: `Pastor ${['Josephat Okama','Grace Atieno','Peter Ochieng','Mary Wanjiru','Daniel Kato'][i]}`, email: `pastor.${prefix}@demo.ncbi.org`, role: 'branch_pastor', organisation: branches[i] });
    const admin = await user({ fullName: `${branchSpecs[i][0]} Administrator`, email: `admin.${prefix}@demo.ncbi.org`, role: 'branch_admin', organisation: branches[i] });
    const treasurer = await user({ fullName: `${branchSpecs[i][0]} Treasurer`, email: `treasurer.${prefix}@demo.ncbi.org`, role: 'treasurer', organisation: branches[i] });
    const leader = await user({ fullName: `${branchSpecs[i][0]} Ministry Leader`, email: `ministry.${prefix}@demo.ncbi.org`, role: 'department_leader', organisation: branches[i] });
    branchActors.push({ pastor, admin, treasurer, leader, district: districtUsers[branchSpecs[i][2]], national: nationals[[0,0,0,0,1][i]] });
  }

  async function account(org, code, name, type, normalBalance) {
    const doc = await LedgerAccount.findOneAndUpdate(
      { organisation: org._id, code },
      { $setOnInsert: { organisation: org._id, code, name, type, normalBalance, active: true, system: true } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    return doc;
  }

  for (let b = 0; b < branches.length; b += 1) {
    const org = branches[b];
    const actors = branchActors[b];
    const cash = await account(org, '1000', 'Cash and Mobile Money', 'asset', 'debit');
    const income = await account(org, '4000', 'Tithes and Offerings', 'income', 'credit');
    const expense = await account(org, '5000', 'Ministry and Operations', 'expense', 'debit');

    const members = [];
    const firstNames = ['Alice','Brian','Carol','David','Esther','Faith','George','Hannah','Isaac','Janet','Kevin','Lydia','Moses','Naomi','Oscar','Priscilla','Samuel','Tabitha','Victor','Winnie','Yusuf','Zawadi','Peter','Ruth','Daniel'];
    const lastNames = ['Otieno','Wanjala','Naliaka','Ochieng','Achieng','Mwangi','Kiptoo','Atieno','Kamau','Barasa'];
    for (let i = 0; i < 30; i += 1) {
      const firstName = firstNames[i % firstNames.length];
      const lastName = lastNames[(i + b) % lastNames.length];
      members.push(await member({
        firstName, lastName,
        email: `member.${b + 1}.${i + 1}@demo.ncbi.org`,
        phone: `+2547${String(10000000 + b * 100000 + i * 137).slice(-8)}`,
        org, pastor: actors.pastor,
        status: i < 22 ? 'member' : i < 26 ? 'worker' : 'new_believer',
        number: `NCBI-${String(b + 1).padStart(2,'0')}-${String(i + 1).padStart(4,'0')}`
      }));
    }
    for (let i = 0; i < 8; i += 1) {
      await member({
        firstName: ['Mercy','John','Beatrice','Mark','Joy','Timothy','Diana','Paul'][i],
        lastName: lastNames[(i + 3) % lastNames.length],
        email: `visitor.${b + 1}.${i + 1}@demo.ncbi.org`,
        phone: `+25472${String(1000000 + b * 10000 + i * 101).slice(-7)}`,
        org, pastor: actors.pastor, status: 'visitor',
        number: `NCBI-V${b + 1}-${String(i + 1).padStart(3,'0')}`
      });
    }

    // Attendance across six recent Sundays; unique member/date/activity index makes reruns safe.
    for (let week = 0; week < 6; week += 1) {
      const heldAt = dateOffset(week * 7 + (now.getDay() === 0 ? 0 : now.getDay()));
      heldAt.setHours(9, 0, 0, 0);
      for (let i = 0; i < 22; i += 1) {
        const result = await Attendance.updateOne(
          { organisation: org._id, member: members[i]._id, heldAt, activityName: 'Sunday Celebration Service' },
          { $setOnInsert: { organisation: org._id, member: members[i]._id, heldAt, activityName: 'Sunday Celebration Service', category: 'sunday_service', recordedBy: actors.admin._id, checkInMethod: i % 3 === 0 ? 'qr' : 'manual' } },
          { upsert: true }
        );
        if (result.upsertedCount) counts.attendance += 1;
      }
    }

    // Confirmed sample income and expenses are clearly labelled demo records, never live M-Pesa payments.
    for (let i = 0; i < 12; i += 1) {
      const direction = i < 8 ? 'income' : 'expense';
      const amount = (direction === 'income' ? 1200 + (b * 310) + i * 175 : 650 + (b * 95) + i * 120).toFixed(2);
      const reference = `DEMO-${branchSpecs[b][1]}-${String(i + 1).padStart(3,'0')}`;
      const values = {
        organisation: org._id, direction, category: direction === 'income' ? ['Tithes','Offerings','Thanksgiving'][i % 3] : ['Utilities','Transport','Ministry supplies','Outreach'][i % 4],
        amount: mongoose.Types.Decimal128.fromString(amount), currency: org.currency || 'KES',
        occurredAt: dateOffset(i * 2), status: 'confirmed', paymentMethod: i % 2 ? 'cash' : 'bank',
        reference, description: `DEMO DATA — ${direction} entry ${i + 1}; not a real payment.`,
        debitAccount: direction === 'income' ? cash._id : expense._id,
        creditAccount: direction === 'income' ? income._id : cash._id,
        createdBy: actors.treasurer._id, approvedBy: actors.pastor._id, approvedAt: dateOffset(i * 2),
        confirmedBy: actors.district._id, confirmedAt: dateOffset(i * 2)
      };
      const result = await FinanceTransaction.updateOne({ organisation: org._id, reference }, { $setOnInsert: values }, { upsert: true });
      if (result.upsertedCount) counts.finance += 1;
    }

    await operation(org, actors.pastor, 'department', `DEMO-${b}-WORSHIP`, 'Worship and Music Ministry', { leader: actors.leader.fullName, meetingDay: 'Thursday', activeVolunteers: 12 });
    await operation(org, actors.pastor, 'department', `DEMO-${b}-CHILDREN`, 'Children and Families Ministry', { meetingDay: 'Sunday', activeVolunteers: 9 });
    await operation(org, actors.pastor, 'event', `DEMO-${b}-CONFERENCE`, 'Annual Church Growth Conference', { venue: org.address, expectedAttendance: 180 + b * 35, public: true }, 'scheduled', 'public');
    await operation(org, actors.pastor, 'announcement', `DEMO-${b}-NOTICE`, 'Community Prayer and Outreach Week', { message: 'Join the church family for prayer, visitation and community service.', public: true }, 'active', 'public');
    await operation(org, actors.pastor, 'project', `DEMO-${b}-PROJECT`, 'Sanctuary Improvement Project', { budget: 250000 + b * 50000, progressPercent: 20 + b * 12 }, 'in_progress');
    await operation(org, actors.pastor, 'visitor_follow_up', `DEMO-${b}-FOLLOWUP`, 'New Visitor Follow-up List', { assignedTeam: 'Welcome Team', followUpsDue: 5 + b });
    const inventoryExists = await InventoryItem.exists({ organisation: org._id, itemCode: 'DEMO-CHAIRS' });
    await InventoryItem.findOneAndUpdate(
      { organisation: org._id, itemCode: 'DEMO-CHAIRS' },
      { $setOnInsert: { organisation: org._id, itemCode: 'DEMO-CHAIRS', itemName: 'Stacking Church Chairs', category: 'Furniture', unit: 'pieces', location: 'Main sanctuary store', reorderLevel: 20, balance: 120 + b * 10, active: true, createdBy: actors.admin._id, updatedBy: actors.admin._id } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    if (!inventoryExists) counts.inventory += 1;
  }

  const seededBranches = await Organisation.find({ code: { $in: branchSpecs.map((item) => item[1]) }, level: 'branch' }).select('_id').lean();
  const integrity = {
    internationalOffices: await Organisation.countDocuments({ code: { $in: ['NCBI','NCBI-INT-EA','NCBI-INT-SA'] }, level: 'international', status: 'active' }),
    nationalOffices: await Organisation.countDocuments({ code: { $in: nationalSpecs.map((item) => item[1]) }, level: 'national', status: 'active' }),
    regions: await Organisation.countDocuments({ code: { $in: regionSpecs.map((item) => item[1]) }, level: 'regional', status: 'active' }),
    districts: await Organisation.countDocuments({ code: { $in: districtSpecs.map((item) => item[1]) }, level: 'district', status: 'active' }),
    churches: seededBranches.length,
    demoUsers: await User.countDocuments({ email: /@demo\.ncbi\.org$/ }),
    demoMembers: await Member.countDocuments({ membershipNumber: /^NCBI-(?:V)?[0-9]{1,2}-/ }),
    demoAttendance: await Attendance.countDocuments({ organisation: { $in: seededBranches.map((item) => item._id) }, activityName: 'Sunday Celebration Service' }),
    demoFinance: await FinanceTransaction.countDocuments({ organisation: { $in: seededBranches.map((item) => item._id) }, reference: /^DEMO-NCBI-CH-/ }),
    demoOperations: await OperationsRecord.countDocuments({ organisation: { $in: seededBranches.map((item) => item._id) }, reference: /^DEMO-/ })
  };
  const expected = { internationalOffices: 3, nationalOffices: 5, regions: 8, districts: 10, churches: 5, demoUsers: 46, demoMembers: 190, demoAttendance: 660, demoFinance: 60, demoOperations: 30 };
  for (const [key, value] of Object.entries(expected)) {
    if (integrity[key] !== value) throw new Error(`Seed integrity check failed for ${key}: expected ${value}, found ${integrity[key]}.`);
  }

  console.log('NCBI demo data seed completed (idempotent; existing unrelated records preserved).');
  console.log('Demo sign-in accounts (use SEED_COMMON_PASSWORD from server/.env):');
  for (const account of accountLog) console.log(`- ${account.email} | ${account.role} | ${account.status}`);
  console.log(JSON.stringify({
    created: counts,
    totals: {
      internationalOffices: await Organisation.countDocuments({ level: 'international', status: 'active' }),
      nationalOffices: await Organisation.countDocuments({ level: 'national', status: 'active' }),
      regions: await Organisation.countDocuments({ level: 'regional', status: 'active' }),
      districts: await Organisation.countDocuments({ level: 'district', status: 'active' }),
      churches: await Organisation.countDocuments({ level: 'branch', status: 'active' }),
      demoUsers: await User.countDocuments({ email: /@demo\.ncbi\.org$/ }),
      demoMembers: await Member.countDocuments({ membershipNumber: /^NCBI-(?:V)?[0-9]{1,2}-/ }),
      demoAttendance: await Attendance.countDocuments({ activityName: 'Sunday Celebration Service' }),
      demoFinance: await FinanceTransaction.countDocuments({ reference: /^DEMO-NCBI-CH-/ }),
      demoOperations: await OperationsRecord.countDocuments({ reference: /^DEMO-/ })
    }
  }, null, 2));
} finally {
  await mongoose.disconnect();
}
