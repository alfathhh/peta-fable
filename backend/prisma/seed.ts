// Seeder development (DATABASE.md §4): admin + petugas, kategori berikon,
// wilayah dummy (kab/kec/desa/sls/subsls berbentuk persegi agar peta & resolver hidup),
// 1 kegiatan + 1 token aktif (dicetak di console), 10 infrastruktur dummy.
import bcrypt from 'bcryptjs';
import { prisma } from '../src/lib/prisma';
import { generateToken } from '../src/lib/tokenGenerator';
import { parentOf } from '../src/lib/regionId';

interface Rect {
  id: string;
  level: string;
  name: string;
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

async function upsertRegion(r: Rect) {
  const wkt = `MULTIPOLYGON(((${r.minLng} ${r.minLat}, ${r.maxLng} ${r.minLat}, ${r.maxLng} ${r.maxLat}, ${r.minLng} ${r.maxLat}, ${r.minLng} ${r.minLat})))`;
  await prisma.$executeRaw`
    INSERT INTO regions (region_id, level, name, parent_id, geom, source_version, updated_at)
    VALUES (${r.id}, ${r.level}, ${r.name}, ${parentOf(r.id)}, ST_GeomFromText(${wkt}, 4326), 'seed', NOW())
    ON CONFLICT (region_id) DO UPDATE SET
      level = EXCLUDED.level, name = EXCLUDED.name, parent_id = EXCLUDED.parent_id,
      geom = EXCLUDED.geom, source_version = 'seed', updated_at = NOW();
  `;
}

async function main() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? 'admin123';
  const hash = await bcrypt.hash(adminPassword, 10);

  // --- users ---
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: { name: 'Administrator', username: 'admin', email: 'admin@example.com', password: hash, role: 'admin' },
  });
  const petugas1 = await prisma.user.upsert({
    where: { username: 'petugas1' },
    update: {},
    create: { name: 'Petugas Satu', username: 'petugas1', password: hash, role: 'petugas' },
  });
  await prisma.user.upsert({
    where: { username: 'petugas2' },
    update: {},
    create: { name: 'Petugas Dua', username: 'petugas2', password: hash, role: 'petugas' },
  });

  // --- kategori (ikon lucide + warna) ---
  const categorySpecs = [
    { name: 'Pendidikan', icon: 'school', color: '#2563eb' },
    { name: 'Kesehatan', icon: 'hospital', color: '#dc2626' },
    { name: 'Ibadah', icon: 'landmark', color: '#16a34a' },
    { name: 'Pemerintahan', icon: 'building-2', color: '#7c3aed' },
    { name: 'Ekonomi', icon: 'store', color: '#ea580c' },
    { name: 'Jalan/Jembatan', icon: 'route', color: '#6b7280' },
  ];
  const categories = [];
  for (const spec of categorySpecs) {
    categories.push(await prisma.category.upsert({ where: { name: spec.name }, update: spec, create: spec }));
  }

  // --- wilayah dummy (persegi bersarang di sekitar Padang Pariaman) ---
  // Hanya untuk development; data asli diimport via `npm run import:regions`.
  const regions: Rect[] = [
    { id: '1306', level: 'kab', name: 'Padang Pariaman', minLng: 99.95, minLat: -0.85, maxLng: 100.5, maxLat: -0.35 },
    { id: '1306010', level: 'kec', name: 'Batang Anai (dummy)', minLng: 99.95, minLat: -0.85, maxLng: 100.22, maxLat: -0.35 },
    { id: '1306020', level: 'kec', name: 'Lubuk Alung (dummy)', minLng: 100.22, minLat: -0.85, maxLng: 100.5, maxLat: -0.35 },
    { id: '1306010001', level: 'desa', name: 'Katapiang (dummy)', minLng: 99.95, minLat: -0.85, maxLng: 100.08, maxLat: -0.6 },
    { id: '1306010002', level: 'desa', name: 'Kasang (dummy)', minLng: 100.08, minLat: -0.85, maxLng: 100.22, maxLat: -0.6 },
    { id: '1306020001', level: 'desa', name: 'Aie Tajun (dummy)', minLng: 100.22, minLat: -0.85, maxLng: 100.36, maxLat: -0.6 },
    { id: '1306020002', level: 'desa', name: 'Pasie Laweh (dummy)', minLng: 100.36, minLat: -0.85, maxLng: 100.5, maxLat: -0.6 },
    { id: '13060100010001', level: 'sls', name: 'Korong Kasai (dummy)', minLng: 99.95, minLat: -0.85, maxLng: 100.02, maxLat: -0.72 },
    { id: '13060100010002', level: 'sls', name: 'Korong Talao (dummy)', minLng: 100.02, minLat: -0.85, maxLng: 100.08, maxLat: -0.72 },
    { id: '1306010001000100', level: 'subsls', name: 'Sub-SLS 00 Kasai (dummy)', minLng: 99.95, minLat: -0.85, maxLng: 100.02, maxLat: -0.78 },
  ];
  for (const r of regions) await upsertRegion(r);
  await prisma.$executeRaw`
    UPDATE regions
    SET geom_simplified = ST_Multi(ST_SimplifyPreserveTopology(geom, 0.0005)),
        bbox = json_build_array(ST_XMin(geom), ST_YMin(geom), ST_XMax(geom), ST_YMax(geom))
    WHERE source_version = 'seed';
  `;

  // --- kegiatan + token ---
  const activity = await prisma.activity.findFirst({ where: { name: 'Susenas 2026' } })
    ?? (await prisma.activity.create({
      data: { name: 'Susenas 2026', description: 'Kegiatan contoh untuk development', createdBy: admin.id },
    }));
  let token = await prisma.activityToken.findFirst({ where: { activityId: activity.id, isActive: true } });
  if (!token) {
    token = await prisma.activityToken.create({
      data: {
        activityId: activity.id,
        token: generateToken(),
        expiresAt: new Date(Date.now() + 90 * 24 * 3600 * 1000),
        createdBy: admin.id,
      },
    });
  }

  // --- proyek contoh milik petugas1 (klaim token dulu) ---
  await prisma.activityClaim.upsert({
    where: { userId_activityTokenId: { userId: petugas1.id, activityTokenId: token.id } },
    update: {},
    create: { userId: petugas1.id, activityTokenId: token.id, activityId: activity.id },
  });
  const project = await prisma.project.findFirst({ where: { userId: petugas1.id } })
    ?? (await prisma.project.create({
      data: {
        userId: petugas1.id,
        activityId: activity.id,
        name: 'Listing Katapiang',
        regionId: '1306010001',
        regionLevel: 'desa',
      },
    }));

  // --- 10 infrastruktur dummy tersebar di 2 kecamatan; 2 di luar wilayah proyek ---
  const existing = await prisma.infrastructure.count();
  if (existing === 0) {
    // dua baris pertama sengaja 'pending' untuk menguji alur ACC admin
    const points = [
      { name: 'SDN 01 Katapiang', lat: -0.8, lng: 99.98, cat: 0, pending: true },
      { name: 'Puskesmas Katapiang', lat: -0.79, lng: 100.0, cat: 1, pending: true },
      { name: 'Masjid Raya Kasai', lat: -0.82, lng: 99.97, cat: 2 },
      { name: 'Kantor Wali Nagari Katapiang', lat: -0.75, lng: 100.03, cat: 3 },
      { name: 'Pasar Kasang', lat: -0.78, lng: 100.12, cat: 4 },
      { name: 'Jembatan Batang Anai', lat: -0.7, lng: 100.15, cat: 5 },
      { name: 'SMPN 2 Lubuk Alung', lat: -0.75, lng: 100.3, cat: 0 },
      { name: 'Klinik Aie Tajun', lat: -0.72, lng: 100.28, cat: 1 },
      { name: 'Surau Pasie Laweh', lat: -0.8, lng: 100.4, cat: 2 },   // di luar wilayah proyek
      { name: 'Toko Tani Pasie Laweh', lat: -0.78, lng: 100.45, cat: 4 }, // di luar wilayah proyek
    ];
    for (const p of points) {
      const inside = p.lng < 100.08 && p.lat <= -0.6; // dalam desa proyek 1306010001
      const idkec = p.lng < 100.22 ? '1306010' : '1306020';
      const iddesa =
        p.lng < 100.08 ? '1306010001' : p.lng < 100.22 ? '1306010002' : p.lng < 100.36 ? '1306020001' : '1306020002';
      const infra = await prisma.infrastructure.create({
        data: {
          name: p.name,
          categoryId: categories[p.cat]!.id,
          description: 'Data dummy seed',
          lat: p.lat,
          lng: p.lng,
          idkab: '1306',
          idkec,
          iddesa,
          isOutsideRegion: !inside,
          approvalStatus: (p as { pending?: boolean }).pending ? 'pending' : 'approved',
          userId: petugas1.id,
          projectId: project.id,
          activityId: activity.id,
          source: 'manual',
        },
      });
      await prisma.$executeRaw`
        UPDATE infrastructures SET geom = ST_SetSRID(ST_MakePoint(${p.lng}, ${p.lat}), 4326) WHERE id = ${infra.id};
      `;
    }
  }

  console.log('=== SEED SELESAI ===');
  console.log(`Login admin   : admin / ${adminPassword}`);
  console.log(`Login petugas : petugas1 / ${adminPassword} (dan petugas2)`);
  console.log(`Token kegiatan "${activity.name}": ${token.token} (kedaluwarsa ${token.expiresAt.toISOString()})`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
