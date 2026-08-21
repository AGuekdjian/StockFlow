import argon2 from 'argon2';
import { User } from './user.model.js';
import { Category } from '../categories/category.model.js';
import { Location } from '../locations/location.model.js';
import { Product } from '../products/product.model.js';

export async function seedDatabase({ adminPassword, technicianPassword }) {
  const [adminHash, technicianHash] = await Promise.all([
    argon2.hash(adminPassword),
    argon2.hash(technicianPassword),
  ]);
  const [category, location] = await Promise.all([
    Category.findOneAndUpdate(
      { code: 'CAM' },
      { $setOnInsert: { name: 'Cámaras', code: 'CAM', active: true } },
      { upsert: true, new: true },
    ),
    Location.findOneAndUpdate(
      { code: 'A-01' },
      { $setOnInsert: { name: 'Depósito principal', code: 'A-01', active: true } },
      { upsert: true, new: true },
    ),
  ]);
  await Promise.all([
    User.findOneAndUpdate(
      { email: 'admin@example.com' },
      { $set: { name: 'Administrador', passwordHash: adminHash, role: 'ADMIN', active: true } },
      { upsert: true },
    ),
    User.findOneAndUpdate(
      { email: 'tecnico@example.com' },
      { $set: { name: 'Técnico', passwordHash: technicianHash, role: 'TECHNICIAN', active: true } },
      { upsert: true },
    ),
  ]);
  await Product.findOneAndUpdate(
    { internalCode: 'CAM-000001' },
    {
      $setOnInsert: {
        internalCode: 'CAM-000001',
        barcodes: ['779000000001'],
        name: 'Cámara IP de prueba',
        categoryId: category._id,
        locationId: location._id,
        stock: 5,
        minimumStock: 2,
        active: true,
      },
    },
    { upsert: true },
  );
}
