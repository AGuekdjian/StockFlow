import mongoose from 'mongoose';
import { seedDatabase } from '../src/modules/users/seed.js';
const { MONGODB_URI, SEED_ADMIN_PASSWORD, SEED_TECHNICIAN_PASSWORD } = process.env;
if (!MONGODB_URI || !SEED_ADMIN_PASSWORD || !SEED_TECHNICIAN_PASSWORD)
  throw new Error(
    'MONGODB_URI, SEED_ADMIN_PASSWORD y SEED_TECHNICIAN_PASSWORD son obligatorias para ejecutar seed.',
  );
await mongoose.connect(MONGODB_URI);
await seedDatabase({
  adminPassword: SEED_ADMIN_PASSWORD,
  technicianPassword: SEED_TECHNICIAN_PASSWORD,
});
await mongoose.disconnect();
console.log('Seed completado.');
