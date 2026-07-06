# Image produksi backend. Dijalankan lewat tsx (bukan build ke JS) —
# konsisten dengan skrip "start" di package.json, tidak perlu step compile terpisah.
FROM node:20-alpine

WORKDIR /app

# Monorepo npm workspaces: npm ci butuh package.json SEMUA workspace untuk
# resolusi graph, walau image ini cuma menjalankan backend.
COPY package.json package-lock.json ./
COPY backend/package.json backend/package.json
COPY frontend/package.json frontend/package.json
RUN npm ci --workspace=backend --include-workspace-root

COPY backend backend
WORKDIR /app/backend
RUN npx prisma generate

# storage/ (foto & geojson layer) HARUS di-mount sebagai volume agar tidak
# hilang saat container diganti (lihat docker-compose.prod.yml)
RUN mkdir -p storage

ENV NODE_ENV=production
EXPOSE 3000

# Jalankan migration dulu (idempotent, no-op bila sudah up to date), baru start server.
CMD ["sh", "-c", "npx prisma migrate deploy && npx tsx src/index.ts"]
