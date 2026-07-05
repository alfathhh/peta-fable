import multer from 'multer';
import { fileTypeFromBuffer } from 'file-type';
import { badRequest } from './errorHandler';

const MB = 1024 * 1024;

// Foto infrastruktur: 1 file, maks 5 MB, harus benar-benar gambar (cek magic bytes).
export const photoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * MB, files: 1 },
});

// File geojson layer/wilayah & xlsx import: maks 20 MB.
export const fileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * MB, files: 1 },
});

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png', 'image/webp']);

/** Validasi MIME asli foto dari magic bytes — jangan percaya ekstensi/header client. */
export async function assertIsImage(buffer: Buffer): Promise<void> {
  const type = await fileTypeFromBuffer(buffer);
  if (!type || !IMAGE_MIMES.has(type.mime)) {
    throw badRequest('File foto harus berupa gambar JPEG/PNG/WebP');
  }
}
