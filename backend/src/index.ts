import { env } from './config/env';
import { createApp } from './app';
import { prisma } from './lib/prisma';
import { recoverInterruptedRegionUploads } from './services/regionImportService';

const app = createApp();
let server: ReturnType<typeof app.listen>;

async function start(): Promise<void> {
  const recovered = await recoverInterruptedRegionUploads();
  if (recovered > 0) console.log(`${recovered} import wilayah terputus ditandai gagal`);
  server = app.listen(env.port, () => console.log(`API berjalan di http://localhost:${env.port}`));
}

void start().catch(async (err: unknown) => {
  console.error('Gagal memulai API', err);
  await prisma.$disconnect().catch(() => {});
  process.exit(1);
});

// Graceful shutdown: berhenti menerima koneksi baru, tunggu request berjalan
// selesai, lalu tutup koneksi DB — penting saat redeploy di VPS/container.
let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} diterima — menutup server...`);
  if (!server) {
    void prisma.$disconnect().finally(() => process.exit(0));
    return;
  }
  server.close(() => {
    prisma
      .$disconnect()
      .catch(() => {})
      .finally(() => process.exit(0));
  });
  // jangan menggantung selamanya bila ada koneksi keep-alive bandel
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));
