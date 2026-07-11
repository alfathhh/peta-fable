-- State import pindah dari file storage ke DB supaya durable & crash-safe:
-- klaim job + insert baris + tandai selesai terjadi dalam SATU transaction,
-- sehingga crash kapan pun me-rollback ke status 'validated' yang aman di-retry.
CREATE TABLE "import_jobs" (
    "id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'validated',
    "rows" JSONB NOT NULL,
    "result" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "import_jobs_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "import_jobs_created_at_idx" ON "import_jobs"("created_at");
