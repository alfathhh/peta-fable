import { z } from 'zod';
import { CATEGORY_ICONS } from '../config/categoryIcons';

// ---------- auth ----------
export const loginSchema = z.object({
  username: z.string().min(1, 'Username wajib diisi'),
  password: z.string().min(1, 'Password wajib diisi'),
});

export const changePasswordSchema = z.object({
  current_password: z.string().min(1, 'Password saat ini wajib diisi'),
  new_password: z.string().min(6, 'Password baru minimal 6 karakter'),
});

// ---------- users ----------
export const createUserSchema = z.object({
  name: z.string().min(1).max(100),
  username: z.string().min(3).max(50).regex(/^[a-z0-9._-]+$/i, 'Username hanya huruf/angka/titik/strip'),
  email: z.string().email().max(150).optional().nullable(),
  password: z.string().min(6, 'Password minimal 6 karakter'),
  role: z.enum(['admin', 'petugas']),
});

export const updateUserSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  email: z.string().email().max(150).optional().nullable(),
  password: z.string().min(6).optional(),
  role: z.enum(['admin', 'petugas']).optional(),
  is_active: z.boolean().optional(),
});

// ---------- categories ----------
const iconSchema = z.string().refine((v) => (CATEGORY_ICONS as readonly string[]).includes(v), {
  message: 'Ikon tidak ada dalam daftar ikon yang diizinkan',
});

export const categorySchema = z.object({
  name: z.string().min(1).max(100),
  icon: iconSchema,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Warna harus format hex #rrggbb'),
  is_active: z.boolean().optional(),
});

// ---------- activities & tokens ----------
export const activitySchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().max(2000).optional().nullable(),
});

export const createTokenSchema = z.object({
  activity_id: z.string().min(1),
  expires_at: z.coerce.date(),
  max_claims: z.coerce.number().int().positive().optional().nullable(),
});

export const updateTokenSchema = z.object({
  expires_at: z.coerce.date().optional(),
  is_active: z.boolean().optional(),
  max_claims: z.coerce.number().int().positive().optional().nullable(),
});

export const claimTokenSchema = z.object({
  token: z
    .string()
    .transform((v) => v.trim().toUpperCase())
    .pipe(z.string().length(7, 'Token harus 7 karakter')),
});

// ---------- projects ----------
export const createProjectSchema = z.object({
  name: z.string().min(1).max(150),
  activity_id: z.string().min(1),
  region_id: z.string().min(4).max(16),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  status: z.enum(['aktif', 'selesai', 'arsip']).optional(),
});

// ---------- infrastructures ----------
// Wilayah manual: idsls (14 digit) wajib bila mode manual — kec & desa turunan
// prefix idsls; idsubsls (16 digit) opsional. Kosong = auto-detect dari koordinat.
const idslsField = z
  .string()
  .regex(/^\d{14}$/, 'idsls harus 14 digit angka')
  .optional()
  .nullable()
  .or(z.literal('').transform(() => null));
const idsubslsField = z
  .string()
  .regex(/^\d{16}$/, 'idsubsls harus 16 digit angka')
  .optional()
  .nullable()
  .or(z.literal('').transform(() => null));

export const createInfraSchema = z.object({
  name: z.string().min(1).max(150),
  category_id: z.string().min(1),
  description: z.string().max(5000).optional().nullable(),
  lat: z.coerce.number().min(-90).max(90),
  lng: z.coerce.number().min(-180).max(180),
  gps_accuracy_m: z.coerce.number().nonnegative().optional().nullable(),
  project_id: z.string().min(1),
  idsls: idslsField,
  idsubsls: idsubslsField,
});

export const updateInfraSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  category_id: z.string().min(1).optional(),
  description: z.string().max(5000).optional().nullable(),
  // lat/lng hanya boleh dikirim admin (dicek di service, bukan di sini)
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  idsls: idslsField,
  idsubsls: idsubslsField,
});

export const approvalSchema = z.object({
  status: z.enum(['pending', 'approved', 'rejected']),
});

// ---------- layers ----------
export const layerStyleSchema = z.object({
  mode: z.enum(['outline', 'fill']),
  strokeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  strokeWidth: z.number().min(0).max(10),
  fillColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  fillOpacity: z.number().min(0).max(1),
  label: z
    .object({
      field: z.string().max(100).nullable(),
      fontSize: z.number().min(6).max(48),
      fontColor: z.string().regex(/^#[0-9a-fA-F]{6}$/),
    })
    .nullable(),
});

export const updateLayerSchema = z.object({
  name: z.string().min(1).max(150).optional(),
  style: layerStyleSchema.optional(),
  is_visible: z.boolean().optional(),
  sort_order: z.number().int().optional(),
});

export const DEFAULT_LAYER_STYLE = {
  mode: 'outline',
  strokeColor: '#e11d48',
  strokeWidth: 2,
  fillColor: '#e11d48',
  fillOpacity: 0.25,
  label: null,
} as const;
