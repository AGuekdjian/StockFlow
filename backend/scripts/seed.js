import mongoose from 'mongoose';
import { seedDatabase } from '../src/modules/users/seed.js';
const { MONGODB_URI, SEED_ADMIN_PASSWORD, SEED_ADMIN_EMAIL } = process.env;
if (!MONGODB_URI || !SEED_ADMIN_PASSWORD)
  throw new Error('MONGODB_URI y SEED_ADMIN_PASSWORD son obligatorias para ejecutar seed.');
await mongoose.connect(MONGODB_URI);
await seedDatabase({
  adminPassword: SEED_ADMIN_PASSWORD,
  adminEmail: SEED_ADMIN_EMAIL,
});
await mongoose.disconnect();
console.log('Seed completado.');
