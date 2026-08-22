import { z } from 'zod';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Identificador inválido');
const barcode = z
  .string()
  .trim()
  .min(3)
  .max(64)
  .regex(/^[\x21-\x7e]+$/, 'Código de barras inválido');

export const createProductSchema = z
  .object({
    internalCode: z
      .string()
      .trim()
      .toUpperCase()
      .min(3)
      .max(40)
      .regex(/^[A-Z0-9_-]+$/)
      .optional(),
    barcodes: z
      .array(barcode)
      .max(20)
      .default([])
      .transform((values) => [...new Set(values)]),
    name: z.string().trim().min(2).max(160),
    brand: z.string().trim().max(100).optional().default(''),
    model: z.string().trim().max(100).optional().default(''),
    categoryId: objectId,
    locationId: objectId,
    minimumStock: z.number().int().min(0).default(0),
    serializable: z.boolean().default(false),
  })
  .strict();

export const updateProductSchema = createProductSchema
  .omit({ internalCode: true })
  .partial()
  .refine((value) => Object.keys(value).length > 0, 'Debe indicar al menos un campo');
export const productStatusSchema = z.object({ active: z.boolean() }).strict();

export const createNamedEntitySchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .min(1)
      .max(40)
      .regex(/^[A-Z0-9_-]+$/),
  })
  .strict();
export const entityStatusSchema = productStatusSchema;
