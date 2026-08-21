import { z } from 'zod';
import { ROLES } from './permissions.js';

export const loginSchema = z
  .object({
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(8).max(200),
  })
  .strict();
export const createUserSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(12).max(200),
    role: z.enum(Object.values(ROLES)),
  })
  .strict();
