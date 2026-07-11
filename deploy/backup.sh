#!/usr/bin/env bash
# Backup harian PostgreSQL (deploy Opsi A: Docker Compose) + rotasi.
# Jadwalkan via cron di VPS (jam 02:00):
#   0 2 * * * /opt/peta-fable/deploy/backup.sh >> /var/log/peta-backup.log 2>&1
#
# Env opsional: BACKUP_DIR (default: <repo>/backups), KEEP_DAYS (default 30),
# COMPOSE_PROJECT (default: nama folder repo, lowercase — sesuai default Compose).
# Uji restore berkala! Backup yang tidak pernah diuji = tidak ada backup.
set -euo pipefail

REPO_DIR="$(cd "$(dirname "$0")/.." && pwd)"
BACKUP_DIR="${BACKUP_DIR:-$REPO_DIR/backups}"
KEEP_DAYS="${KEEP_DAYS:-30}"
COMPOSE_PROJECT="${COMPOSE_PROJECT:-$(basename "$REPO_DIR" | tr '[:upper:]' '[:lower:]' | tr -cd 'a-z0-9_-')}"
STAMP="$(date +%F-%H%M)"

mkdir -p "$BACKUP_DIR"

# 1. Database
docker compose -f "$REPO_DIR/docker-compose.prod.yml" exec -T db \
  pg_dump -U peta peta | gzip > "$BACKUP_DIR/peta-db-$STAMP.sql.gz"

# 2. Storage (foto & layer geojson) — arsip isi volume backend_storage
STORAGE_VOLUME="${COMPOSE_PROJECT}_backend_storage"
if docker volume inspect "$STORAGE_VOLUME" >/dev/null 2>&1; then
  docker run --rm -v "$STORAGE_VOLUME:/data:ro" -v "$BACKUP_DIR:/backup" \
    alpine tar czf "/backup/peta-storage-$STAMP.tar.gz" -C /data .
else
  echo "PERINGATAN: volume $STORAGE_VOLUME tidak ditemukan (cek: docker volume ls)"
fi

# 3. Rotasi
find "$BACKUP_DIR" \( -name 'peta-db-*.sql.gz' -o -name 'peta-storage-*.tar.gz' \) -mtime +"$KEEP_DAYS" -delete

echo "OK $STAMP -> $BACKUP_DIR (retensi $KEEP_DAYS hari)"
