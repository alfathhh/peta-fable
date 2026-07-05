import imageCompression from 'browser-image-compression';

/** Kompres foto sebelum upload: maks lebar 1600px, JPEG kualitas ~0.8 (PRD §7). */
export async function compressPhoto(file: File): Promise<File> {
  return imageCompression(file, {
    maxWidthOrHeight: 1600,
    initialQuality: 0.8,
    maxSizeMB: 4.5,
    fileType: 'image/jpeg',
    useWebWorker: true,
  });
}
