// Test API dengan database nyata (PostGIS). Otomatis di-skip bila
// DATABASE_URL_TEST tidak diset — CI tanpa DB tetap hijau.
// Jalankan: docker compose up -d db_test, lalu set DATABASE_URL_TEST + migrate deploy.
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import supertest from 'supertest';

const dbUrl = process.env.DATABASE_URL_TEST;
if (dbUrl) {
  process.env.DATABASE_URL = dbUrl;
  process.env.JWT_SECRET ??= 'test-secret';
}

describe.skipIf(!dbUrl)('API (butuh DATABASE_URL_TEST)', () => {
  let request: ReturnType<typeof supertest>;
  let adminToken = '';
  let petugasToken = '';
  let petugas2Token = '';
  let categoryId = '';
  let activityId = '';
  let projectId = '';
  let infraId = '';

  beforeAll(async () => {
    const { createApp } = await import('../src/app');
    const { prisma } = await import('../src/lib/prisma');
    const bcrypt = (await import('bcryptjs')).default;

    // Bersihkan & siapkan data minimal
    await prisma.$executeRawUnsafe(`
      TRUNCATE users, regions, categories, activities, activity_tokens, activity_claims,
        projects, project_layers, infrastructures, region_uploads CASCADE;
    `);
    const hash = await bcrypt.hash('rahasia1', 10);
    await prisma.user.createMany({
      data: [
        { id: 'u_admin', name: 'Admin', username: 'admin', password: hash, role: 'admin' },
        { id: 'u_p1', name: 'P1', username: 'p1', password: hash, role: 'petugas' },
        { id: 'u_p2', name: 'P2', username: 'p2', password: hash, role: 'petugas' },
      ],
    });
    // Wilayah dummy: kab + desa persegi
    await prisma.$executeRaw`
      INSERT INTO regions (region_id, level, name, geom, updated_at) VALUES
      ('1306', 'kab', 'Padang Pariaman', ST_GeomFromText('MULTIPOLYGON(((99.9 -0.9, 100.5 -0.9, 100.5 -0.3, 99.9 -0.3, 99.9 -0.9)))', 4326), NOW()),
      ('1306010', 'kec', 'Kec Dummy', ST_GeomFromText('MULTIPOLYGON(((99.9 -0.9, 100.2 -0.9, 100.2 -0.3, 99.9 -0.3, 99.9 -0.9)))', 4326), NOW()),
      ('1306010001', 'desa', 'Desa Dummy', ST_GeomFromText('MULTIPOLYGON(((99.9 -0.9, 100.1 -0.9, 100.1 -0.6, 99.9 -0.6, 99.9 -0.9)))', 4326), NOW());
    `;

    const app = createApp();
    request = supertest(app);

    const loginAdmin = await request.post('/api/auth/login').send({ username: 'admin', password: 'rahasia1' });
    adminToken = loginAdmin.body.data.token;
    const loginP1 = await request.post('/api/auth/login').send({ username: 'p1', password: 'rahasia1' });
    petugasToken = loginP1.body.data.token;
    const loginP2 = await request.post('/api/auth/login').send({ username: 'p2', password: 'rahasia1' });
    petugas2Token = loginP2.body.data.token;
  });

  afterAll(async () => {
    const { prisma } = await import('../src/lib/prisma');
    await prisma.$disconnect();
  });

  it('login salah → 401', async () => {
    const res = await request.post('/api/auth/login').send({ username: 'admin', password: 'salah' });
    expect(res.status).toBe(401);
  });

  it('endpoint admin tanpa token → 401; token petugas → 403', async () => {
    expect((await request.get('/api/admin/users')).status).toBe(401);
    expect(
      (await request.get('/api/admin/users').set('Authorization', `Bearer ${petugasToken}`)).status,
    ).toBe(403);
  });

  it('GET /regions mengirim FeatureCollection + Cache-Control private no-store', async () => {
    const res = await request.get('/api/regions?level=kab').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['cache-control']).toBe('private, no-store');
    expect(JSON.parse(res.text).type).toBe('FeatureCollection');
  });

  it('admin buat kategori (icon divalidasi)', async () => {
    const bad = await request
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'X', icon: 'icon-ngasal', color: '#ff0000' });
    expect(bad.status).toBe(422);

    const res = await request
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Pendidikan', icon: 'school', color: '#2563eb' });
    expect(res.status).toBe(201);
    categoryId = res.body.data.id;
  });

  it('list infrastruktur tanpa filter → 422 (aturan domain #3)', async () => {
    const res = await request.get('/api/infrastructures').set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(422);
  });

  it('klaim token: expired → 422, valid → sukses, dobel → 409', async () => {
    const act = await request
      .post('/api/admin/activities')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Susenas Test' });
    activityId = act.body.data.id;

    // token expired dibuat langsung di DB (endpoint menolak tanggal lampau)
    const { prisma } = await import('../src/lib/prisma');
    await prisma.activityToken.create({
      data: {
        id: 'tok_exp',
        activityId,
        token: 'AAAAAAA',
        expiresAt: new Date(Date.now() - 1000),
        createdBy: 'u_admin',
      },
    });
    const expired = await request
      .post('/api/tokens/claim')
      .set('Authorization', `Bearer ${petugasToken}`)
      .send({ token: 'AAAAAAA' });
    expect(expired.status).toBe(422);

    const tok = await request
      .post('/api/admin/tokens')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ activity_id: activityId, expires_at: new Date(Date.now() + 86400_000).toISOString() });
    expect(tok.status).toBe(201);
    const code = tok.body.data.token;

    const claim = await request
      .post('/api/tokens/claim')
      .set('Authorization', `Bearer ${petugasToken}`)
      .send({ token: code });
    expect(claim.status).toBe(200);

    const double = await request
      .post('/api/tokens/claim')
      .set('Authorization', `Bearer ${petugasToken}`)
      .send({ token: code });
    expect(double.status).toBe(409);
  });

  it('proyek level kec → 422; level desa → 201', async () => {
    const bad = await request
      .post('/api/my/projects')
      .set('Authorization', `Bearer ${petugasToken}`)
      .send({ name: 'Salah', activity_id: activityId, region_id: '1306010' });
    expect(bad.status).toBe(422);

    const good = await request
      .post('/api/my/projects')
      .set('Authorization', `Bearer ${petugasToken}`)
      .send({ name: 'Proyek Desa', activity_id: activityId, region_id: '1306010001' });
    expect(good.status).toBe(201);
    projectId = good.body.data.id;
  });

  it('petugas tambah infrastruktur — resolve wilayah & flag outside', async () => {
    const inside = await request
      .post('/api/infrastructures')
      .set('Authorization', `Bearer ${petugasToken}`)
      .field('name', 'SD Dalam')
      .field('category_id', categoryId)
      .field('lat', '-0.7')
      .field('lng', '100.0')
      .field('project_id', projectId);
    expect(inside.status).toBe(201);
    expect(inside.body.data.isOutsideRegion).toBe(false);
    expect(inside.body.data.iddesa).toBe('1306010001');
    infraId = inside.body.data.id;

    const outside = await request
      .post('/api/infrastructures')
      .set('Authorization', `Bearer ${petugasToken}`)
      .field('name', 'SD Luar')
      .field('category_id', categoryId)
      .field('lat', '-0.4')
      .field('lng', '100.4')
      .field('project_id', projectId);
    expect(outside.status).toBe(201);
    expect(outside.body.data.isOutsideRegion).toBe(true);
    expect(outside.body.meta?.warning).toBeTruthy();
  });

  it('petugas lain edit infra bukan miliknya → 404 (tidak bocorkan keberadaan)', async () => {
    const res = await request
      .put(`/api/infrastructures/${infraId}`)
      .set('Authorization', `Bearer ${petugas2Token}`)
      .field('name', 'Diubah Orang Lain');
    expect(res.status).toBe(404);
  });

  it('edit koordinat: petugas → 422; admin geser → wilayah di-resolve ulang + flag outside', async () => {
    // petugas (termasuk pemilik) tidak boleh mengubah koordinat
    const denied = await request
      .put(`/api/infrastructures/${infraId}`)
      .set('Authorization', `Bearer ${petugasToken}`)
      .field('lat', '-0.5')
      .field('lng', '100.15');
    expect(denied.status).toBe(422);

    // admin geser keluar desa proyek (masih dalam kec dummy) → outside true
    const moved = await request
      .put(`/api/infrastructures/${infraId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('lat', '-0.5')
      .field('lng', '100.15');
    expect(moved.status).toBe(200);
    expect(moved.body.data.lat).toBe(-0.5);
    expect(moved.body.data.isOutsideRegion).toBe(true);

    // admin geser balik ke dalam desa proyek → outside false, iddesa ter-resolve lagi
    const back = await request
      .put(`/api/infrastructures/${infraId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('lat', '-0.7')
      .field('lng', '100.0');
    expect(back.status).toBe(200);
    expect(back.body.data.isOutsideRegion).toBe(false);
    expect(back.body.data.iddesa).toBe('1306010001');
  });

  it('infra baru berstatus pending: tidak tampil di peta umum, tampil di proyek pemilik', async () => {
    // peta umum (filter kategori) → hanya approved → kosong
    const publicList = await request
      .get(`/api/infrastructures?category_id=${categoryId}`)
      .set('Authorization', `Bearer ${petugasToken}`);
    expect(publicList.status).toBe(200);
    expect(publicList.body.data).toHaveLength(0);

    // tampilan proyek pemilik → semua status terlihat
    const ownList = await request
      .get(`/api/infrastructures?project_id=${projectId}`)
      .set('Authorization', `Bearer ${petugasToken}`);
    expect(ownList.status).toBe(200);
    expect(ownList.body.data.length).toBe(2);
    expect(ownList.body.data.every((i: { approvalStatus: string }) => i.approvalStatus === 'pending')).toBe(true);

    // petugas lain tidak melihat isi proyek orang (bukan pemiliknya)
    const otherList = await request
      .get(`/api/infrastructures?project_id=${projectId}`)
      .set('Authorization', `Bearer ${petugas2Token}`);
    expect(otherList.body.data).toHaveLength(0);
  });

  it('petugas tidak boleh ACC → 403; admin ACC → tampil di peta umum', async () => {
    const forbidden = await request
      .put(`/api/infrastructures/${infraId}/approval`)
      .set('Authorization', `Bearer ${petugasToken}`)
      .send({ status: 'approved' });
    expect(forbidden.status).toBe(404); // route admin — path berbeda

    const forbidden2 = await request
      .put(`/api/admin/infrastructures/${infraId}/approval`)
      .set('Authorization', `Bearer ${petugasToken}`)
      .send({ status: 'approved' });
    expect(forbidden2.status).toBe(403);

    const approve = await request
      .put(`/api/admin/infrastructures/${infraId}/approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });
    expect(approve.status).toBe(200);
    expect(approve.body.data.approvalStatus).toBe('approved');

    const publicList = await request
      .get(`/api/infrastructures?category_id=${categoryId}&region_id=1306010001`)
      .set('Authorization', `Bearer ${petugasToken}`);
    expect(publicList.body.data).toHaveLength(1);
    expect(publicList.body.data[0].name).toBe('SD Dalam');
  });

  it('wilayah manual: idsls wajib valid, kec/desa turunan prefix, idsubsls opsional', async () => {
    const bad = await request
      .post('/api/infrastructures')
      .set('Authorization', `Bearer ${petugasToken}`)
      .field('name', 'Manual Salah')
      .field('category_id', categoryId)
      .field('lat', '-0.7')
      .field('lng', '100.0')
      .field('project_id', projectId)
      .field('idsls', '99999999999999');
    expect(bad.status).toBe(422);

    const { prisma } = await import('../src/lib/prisma');
    await prisma.$executeRaw`
      INSERT INTO regions (region_id, level, name, geom, updated_at) VALUES
      ('13060100010001', 'sls', 'SLS Dummy', ST_GeomFromText('MULTIPOLYGON(((99.9 -0.9, 100.0 -0.9, 100.0 -0.8, 99.9 -0.8, 99.9 -0.9)))', 4326), NOW());
    `;
    const good = await request
      .post('/api/infrastructures')
      .set('Authorization', `Bearer ${petugasToken}`)
      .field('name', 'Manual Benar')
      .field('category_id', categoryId)
      .field('lat', '-0.7')
      .field('lng', '100.0')
      .field('project_id', projectId)
      .field('idsls', '13060100010001');
    expect(good.status).toBe(201);
    expect(good.body.data.idsls).toBe('13060100010001');
    expect(good.body.data.iddesa).toBe('1306010001'); // turunan prefix idsls
    expect(good.body.data.idkec).toBe('1306010');
    expect(good.body.data.isOutsideRegion).toBe(false);
  });
});
