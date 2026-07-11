import { describe, expect, it } from 'vitest';
import { importRegions } from '../src/services/regionImportService';

describe('import wilayah', () => {
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
