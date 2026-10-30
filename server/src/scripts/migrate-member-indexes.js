import 'dotenv/config';
import mongoose from 'mongoose';
import { Member, User } from '../models/index.js';

const uri = process.env.MONGODB_URI;
if (!uri) throw new Error('MONGODB_URI is required');

async function ensurePartialUniqueIndex(collection, key, name, partialFilterExpression) {
  const indexes = await collection.indexes();
  const current = indexes.find(index => index.name === name);
  if (current && JSON.stringify(current.partialFilterExpression || null) !== JSON.stringify(partialFilterExpression)) {
    await collection.dropIndex(name);
  }
  await collection.createIndex(key, { unique: true, partialFilterExpression, name });
  process.stdout.write('Verified index: ' + name + '\n');
}

try {
  await mongoose.connect(uri);
  await ensurePartialUniqueIndex(
    Member.collection,
    { homeOrganisation: 1, membershipNumber: 1 },
    'homeOrganisation_1_membershipNumber_1',
    { membershipNumber: { $type: 'string' } }
  );
  await ensurePartialUniqueIndex(
    User.collection,
    { memberProfile: 1 },
    'memberProfile_1',
    { memberProfile: { $type: 'objectId' } }
  );
} finally {
  await mongoose.disconnect();
}
