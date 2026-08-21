import { z } from 'zod';

export const MOVEMENT_TYPES = ['IN', 'OUT', 'RETURN', 'ADJUSTMENT_IN', 'ADJUSTMENT_OUT'];
export const OUT_REASONS = [
  'Instalación',
  'Mantenimiento',
  'Service',
  'Préstamo',
  'Uso interno',
  'Otro',
];

export const stockMovementSchema = z
  .object({
    operationId: z.string().uuid(),
    productId: z.string().regex(/^[a-f\d]{24}$/i),
    type: z.enum(MOVEMENT_TYPES),
    quantity: z.number().int().positive(),
    reason: z.string().trim().min(2).max(240),
    client: z.string().trim().max(160).optional(),
    jobNumber: z.string().trim().max(80).optional(),
    observation: z.string().trim().max(1000).optional(),
    relatedMovementId: z
      .string()
      .regex(/^[a-f\d]{24}$/i)
      .optional(),
    serialNumbers: z.array(z.string().trim().min(1).max(120)).max(100).optional(),
    expectedStock: z.number().int().min(0).optional(),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.type === 'OUT' && !OUT_REASONS.includes(value.reason))
      context.addIssue({ code: 'custom', path: ['reason'], message: 'Motivo de salida inválido' });
    if (value.serialNumbers && value.serialNumbers.length !== value.quantity)
      context.addIssue({
        code: 'custom',
        path: ['serialNumbers'],
        message: 'Debe informar un serial por unidad',
      });
    if (value.expectedStock !== undefined && !value.type.startsWith('ADJUSTMENT_'))
      context.addIssue({
        code: 'custom',
        path: ['expectedStock'],
        message: 'Sólo los ajustes pueden condicionar el stock esperado',
      });
  });

export const physicalCountSchema = z
  .object({
    operationId: z.string().uuid(),
    productId: z.string().regex(/^[a-f\d]{24}$/i),
    physicalStock: z.number().int().min(0),
    reason: z.string().trim().min(2).max(240),
  })
  .strict();
