import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { connectDatabase } from '../config/db.js';
import { Organisation, User } from '../models/index.js';
const required = ['BOOTSTRAP_NAME','BOOTSTRAP_EMAIL','BOOTSTRAP_PASSWORD','BOOTSTRAP_ORG_NAME','BOOTSTRAP_ORG_CODE'];
for (const key of required) if (!process.env[key]) throw new Error(`${key} is required`);
if (process.env.BOOTSTRAP_PASSWORD.length < 14) throw new Error('Use a one-time password of at least 14 characters');
await connectDatabase();
try {
 const email = process.env.BOOTSTRAP_EMAIL.trim().toLowerCase();
 if (await User.exists({ email })) throw new Error('That account already exists; refusing to overwrite it');
 if (await Organisation.exists({ code: process.env.BOOTSTRAP_ORG_CODE.trim().toUpperCase() })) throw new Error('That organisation code already exists');
 const org = await Organisation.create({ name: process.env.BOOTSTRAP_ORG_NAME.trim(), code: process.env.BOOTSTRAP_ORG_CODE.trim().toUpperCase(), level: 'international', status: 'active', country: process.env.BOOTSTRAP_COUNTRY || 'Kenya', currency: process.env.BOOTSTRAP_CURRENCY || 'KES' });
 const passwordHash = await bcrypt.hash(process.env.BOOTSTRAP_PASSWORD, 12);
 await User.create({ fullName: process.env.BOOTSTRAP_NAME.trim(), email, passwordHash, role: 'super_admin', organisation: org._id, active: true });
 process.stdout.write(`Provisioned the initial administrator for ${org.code}. No credential was printed.\n`);
} finally { await mongoose.disconnect(); }
