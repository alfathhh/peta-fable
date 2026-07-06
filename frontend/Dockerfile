# Multi-stage: build SPA statis lalu sajikan via nginx.
FROM node:20-alpine AS build
WORKDIR /app

# npm ci butuh package.json SEMUA workspace untuk resolusi graph
COPY package.json package-lock.json ./
COPY frontend/package.json frontend/package.json
COPY backend/package.json backend/package.json
RUN npm ci --workspace=frontend --include-workspace-root

COPY frontend frontend
WORKDIR /app/frontend

# Aktifkan fallback basemap (OSM/Esri) tanpa build ulang: override lewat --build-arg
ARG VITE_BASEMAP_FALLBACK=0
ENV VITE_BASEMAP_FALLBACK=$VITE_BASEMAP_FALLBACK
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/frontend/dist /usr/share/nginx/html
COPY deploy/nginx.frontend.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
