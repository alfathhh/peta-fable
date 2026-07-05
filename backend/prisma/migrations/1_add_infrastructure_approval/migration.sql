-- Approval infrastruktur oleh admin: hanya 'approved' yang tampil di peta umum;
-- 'pending'/'rejected' hanya terlihat oleh petugas pembuatnya di proyeknya.
ALTER TABLE "infrastructures"
  ADD COLUMN "approval_status" VARCHAR(20) NOT NULL DEFAULT 'pending';

CREATE INDEX "infrastructures_approval_status_idx" ON "infrastructures"("approval_status");

-- Data lama (sebelum fitur approval) dianggap sudah disetujui agar peta tidak kosong mendadak.
UPDATE "infrastructures" SET "approval_status" = 'approved';
