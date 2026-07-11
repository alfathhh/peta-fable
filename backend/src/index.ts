import { env } from './config/env';
import { createApp } from './app';
import { prisma } from './lib/prisma';

const app = createApp();
const server = app.listen(env.port, () => {
  console.log(`API berjalan di http://localhost:${env.port}`);
});

// Graceful shutdown: berhenti menerima koneksi baru, tunggu request berjalan
// selesai, lalu tutup koneksi DB — penting saat redeploy di VPS/container.
let shuttingDown = false;
function shutdown(signal: string): void {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} diterima — menutup server...`);
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
