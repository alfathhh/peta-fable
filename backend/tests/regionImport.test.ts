import { describe, expect, it } from 'vitest';
import { importRegions, regionNameForImport } from '../src/services/regionImportService';

describe('import wilayah', () => {
  it('menambahkan kode dua digit ke nama sub-SLS tanpa menggandakannya', () => {
    expect(regionNameForImport('subsls', '1306010001000102', 'Korong A')).toBe('Korong A - 02');
    expect(regionNameForImport('subsls', '1306010001000102', 'Korong A - 02')).toBe('Korong A - 02');
    expect(regionNameForImport('sls', '13060100010001', 'Korong A')).toBe('Korong A');
  });

  it('menolak geometry selain Polygon atau MultiPolygon sebelum mengakses database', async () => {
    await expect(
      importRegions({
        level: 'kec',
        filename: 'garis.geojson',
        fc: {
          type: 'FeatureCollection',
          features: [
            {
              type: 'Feature',
              properties: { idkec: '1306010', nmkec: 'Kecamatan Garis' },
              geometry: { type: 'LineString', coordinates: [[100, -0.5], [100.1, -0.4]] },
            },
          ],
        },
      }),
    ).rejects.toMatchObject({ status: 422, message: expect.stringContaining('geometry harus Polygon atau MultiPolygon') });
  });
});
