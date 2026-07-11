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

  it('wilayah granular wajib memiliki parent langsung', async () => {
    const villages = await request.get('/api/regions?level=desa').set('Authorization', `Bearer ${adminToken}`);
    expect(villages.status).toBe(422);
    const regions = await request.get('/api/regions?level=subsls').set('Authorization', `Bearer ${adminToken}`);
    expect(regions.status).toBe(422);
    const options = await request.get('/api/regions/options?level=sls').set('Authorization', `Bearer ${adminToken}`);
    expect(options.status).toBe(422);
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

  it('project_id tidak dapat melewati filter wajib endpoint marker', async () => {
    const res = await request.get('/api/infrastructures?project_id=project').set('Authorization', `Bearer ${adminToken}`);
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

    const partialCoordinate = await request
      .put(`/api/infrastructures/${infraId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('lat', '-0.7');
    expect(partialCoordinate.status).toBe(422);
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
      .get(`/api/my/projects/${projectId}/infrastructures`)
      .set('Authorization', `Bearer ${petugasToken}`);
    expect(ownList.status).toBe(200);
    expect(ownList.body.data.length).toBe(2);
    expect(ownList.body.data.every((i: { approvalStatus: string }) => i.approvalStatus === 'pending')).toBe(true);

    // petugas lain tidak melihat isi proyek orang (bukan pemiliknya)
    const otherList = await request
      .get(`/api/my/projects/${projectId}/infrastructures`)
      .set('Authorization', `Bearer ${petugas2Token}`);
    expect(otherList.status).toBe(404);
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

  it('tolak dengan alasan → note terlihat pemilik; ACC menghapus note', async () => {
    const reject = await request
      .put(`/api/admin/infrastructures/${infraId}/approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected', note: 'Foto kurang jelas, ulangi' });
    expect(reject.status).toBe(200);
    expect(reject.body.data.approvalNote).toBe('Foto kurang jelas, ulangi');

    const ownList = await request
      .get(`/api/my/projects/${projectId}/infrastructures`)
      .set('Authorization', `Bearer ${petugasToken}`);
    const mine = ownList.body.data.find((i: { id: string }) => i.id === infraId);
    expect(mine.approvalNote).toBe('Foto kurang jelas, ulangi');

    const approve = await request
      .put(`/api/admin/infrastructures/${infraId}/approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' });
    expect(approve.body.data.approvalNote).toBeNull();
  });

  it('edit konten publik petugas mereset approved/rejected; edit admin mempertahankan approval', async () => {
    const rejected = await request
      .put(`/api/admin/infrastructures/${infraId}/approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'rejected', note: 'Perlu diperbaiki' });
    expect(rejected.status).toBe(200);

    const adminEdit = await request
      .put(`/api/infrastructures/${infraId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('description', 'Koreksi admin');
    expect(adminEdit.status).toBe(200);
    expect(adminEdit.body.data.approvalStatus).toBe('rejected');
    expect(adminEdit.body.data.approvalNote).toBe('Perlu diperbaiki');

    const petugasEditRejected = await request
      .put(`/api/infrastructures/${infraId}`)
      .set('Authorization', `Bearer ${petugasToken}`)
      .field('description', 'Diperbaiki petugas');
    expect(petugasEditRejected.status).toBe(200);
    expect(petugasEditRejected.body.data.approvalStatus).toBe('pending');
    expect(petugasEditRejected.body.data.approvalNote).toBeNull();

    await request
      .put(`/api/admin/infrastructures/${infraId}/approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
      .expect(200);
    const petugasEditApproved = await request
      .put(`/api/infrastructures/${infraId}`)
      .set('Authorization', `Bearer ${petugasToken}`)
      .field('name', 'SD Dalam Diperbarui');
    expect(petugasEditApproved.status).toBe(200);
    expect(petugasEditApproved.body.data.approvalStatus).toBe('pending');
    expect(petugasEditApproved.body.data.approvalNote).toBeNull();

    await request
      .put(`/api/admin/infrastructures/${infraId}/approval`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ status: 'approved' })
      .expect(200);
    const adminEditApproved = await request
      .put(`/api/infrastructures/${infraId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('description', 'Final oleh admin');
    expect(adminEditApproved.status).toBe(200);
    expect(adminEditApproved.body.data.approvalStatus).toBe('approved');
    expect(adminEditApproved.body.data.approvalNote).toBeNull();
  });

  it('admin mengoreksi infrastruktur import tanpa proyek dan menghitung ulang outside', async () => {
    const { prisma } = await import('../src/lib/prisma');
    const imported = await prisma.infrastructure.create({
      data: {
        id: 'infra_import_projectless',
        name: 'Import Tanpa Proyek',
        categoryId,
        lat: -0.7,
        lng: 100,
        idkab: '1306',
        isOutsideRegion: false,
        userId: 'u_admin',
        source: 'import',
        approvalStatus: 'approved',
      },
    });

    const outside = await request
      .put(`/api/infrastructures/${imported.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('lat', '1')
      .field('lng', '110');
    expect(outside.status).toBe(200);
    expect(outside.body.data.idkab).toBeNull();
    expect(outside.body.data.isOutsideRegion).toBe(true);

    const inside = await request
      .put(`/api/infrastructures/${imported.id}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .field('lat', '-0.7')
      .field('lng', '100');
    expect(inside.status).toBe(200);
    expect(inside.body.data.idkab).toBe('1306');
    expect(inside.body.data.isOutsideRegion).toBe(false);
  });

  it('layer proyek: auth/ownership, no-store, update, traversal guard, dan delete', async () => {
    const geojson = Buffer.from(JSON.stringify({
      type: 'FeatureCollection',
      features: [{ type: 'Feature', properties: { name: 'Batas' }, geometry: { type: 'Point', coordinates: [100, -0.7] } }],
    }));
    expect((await request.post(`/api/my/projects/${projectId}/layers`).attach('file', geojson, 'batas.geojson')).status).toBe(401);
    expect(
      (await request.post(`/api/my/projects/${projectId}/layers`).set('Authorization', `Bearer ${petugas2Token}`).attach('file', geojson, 'batas.geojson')).status,
    ).toBe(404);

    const uploaded = await request
      .post(`/api/my/projects/${projectId}/layers`)
      .set('Authorization', `Bearer ${petugasToken}`)
      .field('name', 'Layer Uji')
      .attach('file', geojson, 'batas.geojson');
    expect(uploaded.status).toBe(201);
    const layerId = uploaded.body.data.id as string;

    const listed = await request.get(`/api/my/projects/${projectId}/layers`).set('Authorization', `Bearer ${petugasToken}`);
    expect(listed.status).toBe(200);
    expect(listed.headers['cache-control']).toBe('private, no-store');
    expect((await request.get(`/api/layers/${layerId}/geojson`)).status).toBe(401);
    expect((await request.get(`/api/layers/${layerId}/geojson`).set('Authorization', `Bearer ${petugas2Token}`)).status).toBe(404);
    const file = await request.get(`/api/layers/${layerId}/geojson`).set('Authorization', `Bearer ${petugasToken}`);
    expect(file.status).toBe(200);
    expect(file.headers['cache-control']).toBe('private, no-store');
    expect(JSON.parse(file.text).type).toBe('FeatureCollection');

    const updated = await request
      .put(`/api/layers/${layerId}`)
      .set('Authorization', `Bearer ${petugasToken}`)
      .send({ name: 'Layer Baru', is_visible: false, sort_order: 3 });
    expect(updated.status).toBe(200);
    expect(updated.body.data).toMatchObject({ name: 'Layer Baru', isVisible: false, sortOrder: 3 });

    const { prisma } = await import('../src/lib/prisma');
    const originalPath = uploaded.body.data.geojsonPath as string;
    await prisma.projectLayer.update({ where: { id: layerId }, data: { geojsonPath: '../package.json' } });
    expect((await request.get(`/api/layers/${layerId}/geojson`).set('Authorization', `Bearer ${petugasToken}`)).status).toBe(404);
    await prisma.projectLayer.update({ where: { id: layerId }, data: { geojsonPath: originalPath } });

    expect((await request.delete(`/api/layers/${layerId}`).set('Authorization', `Bearer ${petugas2Token}`)).status).toBe(404);
    expect((await request.delete(`/api/layers/${layerId}`).set('Authorization', `Bearer ${petugasToken}`)).status).toBe(200);
    expect((await request.get(`/api/layers/${layerId}/geojson`).set('Authorization', `Bearer ${petugasToken}`)).status).toBe(404);
  });

  it('foto: pemilik & thumbnail ok, petugas lain 404 saat pending', async () => {
    const sharp = (await import('sharp')).default;
    const jpeg = await sharp({ create: { width: 640, height: 480, channels: 3, background: { r: 10, g: 120, b: 200 } } })
      .jpeg()
      .toBuffer();

    const created = await request
      .post('/api/infrastructures')
      .set('Authorization', `Bearer ${petugasToken}`)
      .field('name', 'Foto Test')
      .field('category_id', categoryId)
      .field('lat', '-0.7')
      .field('lng', '100.0')
      .field('project_id', projectId)
      .attach('photo', jpeg, 'foto.jpg');
    expect(created.status).toBe(201);
    expect(created.body.data.photo_thumb_url).toContain('size=thumb');
    const id = created.body.data.id;

    const full = await request.get(`/api/infrastructures/${id}/photo`).set('Authorization', `Bearer ${petugasToken}`);
    expect(full.status).toBe(200);
    expect(full.headers['content-type']).toContain('image/jpeg');

    // thumbnail benar-benar disajikan dan lebih kecil dari foto utama
    const thumb = await request
      .get(`/api/infrastructures/${id}/photo?size=thumb`)
      .set('Authorization', `Bearer ${petugasToken}`);
    expect(thumb.status).toBe(200);
    expect(thumb.headers['content-type']).toContain('image/jpeg');
    expect(Number(thumb.headers['content-length'])).toBeLessThan(Number(full.headers['content-length']));

    // data pending: foto tidak boleh bocor ke petugas lain
    const other = await request.get(`/api/infrastructures/${id}/photo`).set('Authorization', `Bearer ${petugas2Token}`);
    expect(other.status).toBe(404);
  });

  it('petugas tidak dapat mengubah wilayah manual saat edit', async () => {
    const res = await request
      .put(`/api/infrastructures/${infraId}`)
      .set('Authorization', `Bearer ${petugasToken}`)
      .field('idsls', '13060100010001');
    expect(res.status).toBe(422);
  });

  it('filter multi-kategori (comma) dalam satu request', async () => {
    const cat2 = await request
      .post('/api/admin/categories')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ name: 'Kesehatan', icon: 'hospital', color: '#dc2626' });
    const res = await request
      .get(`/api/infrastructures?category_id=${categoryId},${cat2.body.data.id}&region_id=1306010001`)
      .set('Authorization', `Bearer ${petugasToken}`);
    expect(res.status).toBe(200);
    expect(res.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('search wilayah full-text: prefix kata & angka id', async () => {
    const byName = await request.get('/api/regions/search?q=desa dum').set('Authorization', `Bearer ${adminToken}`);
    expect(byName.status).toBe(200);
    expect(byName.body.data.some((r: { region_id: string }) => r.region_id === '1306010001')).toBe(true);

    const byId = await request.get('/api/regions/search?q=130601').set('Authorization', `Bearer ${adminToken}`);
    expect(byId.body.data.length).toBeGreaterThanOrEqual(1);
  });

  it('stats choropleth per level + dashboard & audit log admin-only', async () => {
    const stats = await request
      .get('/api/regions/stats?level=desa&parent=1306')
      .set('Authorization', `Bearer ${petugasToken}`);
    expect(stats.status).toBe(200);
    const desa = stats.body.data.find((s: { region_id: string }) => s.region_id === '1306010001');
    expect(desa.count).toBeGreaterThanOrEqual(1); // yang approved saja

    const dashForbidden = await request.get('/api/admin/dashboard').set('Authorization', `Bearer ${petugasToken}`);
    expect(dashForbidden.status).toBe(403);
    const dash = await request.get('/api/admin/dashboard').set('Authorization', `Bearer ${adminToken}`);
    expect(dash.status).toBe(200);
    expect(dash.body.data.totals.infrastructures).toBeGreaterThanOrEqual(1);

    // audit log terekam untuk aksi approve/reject sebelumnya (ditulis async — beri jeda)
    await new Promise((r) => setTimeout(r, 300));
    const logs = await request.get('/api/admin/audit-logs?entity=infrastructure').set('Authorization', `Bearer ${adminToken}`);
    expect(logs.status).toBe(200);
    expect(logs.body.data.some((l: { action: string }) => l.action === 'reject')).toBe(true);
  });

  it('petugas export data miliknya (csv)', async () => {
    const res = await request
      .get('/api/my/export/infrastructures?format=csv')
      .set('Authorization', `Bearer ${petugasToken}`);
    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.text).toContain('SD Dalam');

    const adminBlocked = await request
      .get('/api/my/export/infrastructures?format=csv')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(adminBlocked.status).toBe(403);
  });

  it('export admin menyertakan kolom approval dan menerapkan filter status', async () => {
    const res = await request
      .get('/api/admin/export/infrastructures?format=csv&approval_status=approved')
      .set('Authorization', `Bearer ${adminToken}`);
    expect(res.status).toBe(200);
    expect(res.text).toContain('status_approval,catatan_approval');
    expect(res.text).toContain('SD Dalam Diperbarui');
    expect(res.text).not.toContain('SD Luar');
  });

  it('import: validate → commit idempoten (ulang = hasil sama, tanpa duplikasi)', async () => {
    const ExcelJS = (await import('exceljs')).default;
    const wb = new ExcelJS.Workbook();
    const ws = wb.addWorksheet('Data');
    ws.addRow(['nama*', 'kategori*', 'lat*', 'lng*', 'deskripsi', 'idsls']);
    ws.addRow(['Import Uji Valid', 'Pendidikan', -0.7, 100.0, 'baris valid', '']);
    ws.addRow(['Import Uji Gagal', 'Kategori Ngasal', -0.7, 100.0, 'kategori salah', '']);
    const xlsx = Buffer.from(await wb.xlsx.writeBuffer());

    const validated = await request
      .post('/api/admin/import/infrastructures/validate')
      .set('Authorization', `Bearer ${adminToken}`)
      .attach('file', xlsx, 'uji-import.xlsx');
    expect(validated.status).toBe(200);
    expect(validated.body.data.summary).toEqual({ total: 2, valid: 1, invalid: 1 });
    const uploadId = validated.body.data.upload_id;

    const commit1 = await request
      .post('/api/admin/import/infrastructures/commit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ upload_id: uploadId });
    expect(commit1.status).toBe(200);
    expect(commit1.body.data.saved).toBe(1);
    expect(commit1.body.data.failed).toBe(1);

    // commit ulang: hasil pertama dikembalikan, TIDAK menduplikasi baris
    const commit2 = await request
      .post('/api/admin/import/infrastructures/commit')
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ upload_id: uploadId });
    expect(commit2.status).toBe(200);
    expect(commit2.body.data).toEqual(commit1.body.data);

    const { prisma } = await import('../src/lib/prisma');
    const count = await prisma.infrastructure.count({ where: { name: 'Import Uji Valid' } });
    expect(count).toBe(1);

    // unduhan baris gagal tetap tersedia setelah commit (state di DB, bukan file)
    const failed = await request
      .get(`/api/admin/import/infrastructures/${uploadId}/failed`)
      .set('Authorization', `Bearer ${adminToken}`);
    expect(failed.status).toBe(200);
    expect(failed.headers['content-type']).toContain('spreadsheetml');
  });

  it('token lama ditolak segera setelah akun dinonaktifkan', async () => {
    const { prisma } = await import('../src/lib/prisma');
    await prisma.user.update({ where: { id: 'u_p2' }, data: { isActive: false } });
    const res = await request.get('/api/categories').set('Authorization', `Bearer ${petugas2Token}`);
    expect(res.status).toBe(401);
  });

  it('upload wilayah hanya admin, selesai async, dan recovery menandai proses terputus', async () => {
    const geojson = Buffer.from(JSON.stringify({
      type: 'FeatureCollection',
      features: [{
        type: 'Feature',
        properties: { IDKAB: '1306', NMKAB: 'Padang Pariaman Pengganti' },
        geometry: { type: 'Polygon', coordinates: [[[99.9, -0.9], [100.5, -0.9], [100.5, -0.3], [99.9, -0.3], [99.9, -0.9]]] },
      }],
    }));
    expect((await request.post('/api/admin/regions/upload').field('level', 'kab').attach('file', geojson, 'kab.geojson')).status).toBe(401);
    expect(
      (await request.post('/api/admin/regions/upload').set('Authorization', `Bearer ${petugasToken}`).field('level', 'kab').attach('file', geojson, 'kab.geojson')).status,
    ).toBe(403);

    const started = await request
      .post('/api/admin/regions/upload')
      .set('Authorization', `Bearer ${adminToken}`)
      .field('level', 'kab')
      .attach('file', geojson, 'kab.geojson');
    expect(started.status).toBe(200);
    expect(started.body.data.status).toBe('processing');

    const { prisma } = await import('../src/lib/prisma');
    let status = 'processing';
    for (let attempt = 0; attempt < 50 && status === 'processing'; attempt += 1) {
      await new Promise((resolve) => setTimeout(resolve, 20));
      status = (await prisma.regionUpload.findUniqueOrThrow({ where: { id: started.body.data.upload_id } })).status;
    }
    expect(status).toBe('done');
    expect((await prisma.region.findUnique({ where: { regionId: '1306' } }))?.name).toBe('Padang Pariaman Pengganti');

    const interrupted = await prisma.regionUpload.create({
      data: { level: 'desa', filename: 'interrupted.geojson', uploadedBy: 'u_admin', status: 'processing' },
    });
    const { recoverInterruptedRegionUploads } = await import('../src/services/regionImportService');
    expect(await recoverInterruptedRegionUploads()).toBe(1);
    expect(await prisma.regionUpload.findUnique({ where: { id: interrupted.id } })).toMatchObject({
      status: 'failed',
      note: 'Terputus karena server dimulai ulang',
    });
  });
});
