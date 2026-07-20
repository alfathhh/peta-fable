import { describe, expect, it } from 'vitest';
import { sanitizeInfrastructure, sanitizeLayer } from '../src/lib/sanitize';
import { assertWorkbookShape } from '../src/lib/importLimits';

describe('API security contracts', () => {
  it('never exposes infrastructure storage paths', () => {
    expect(sanitizeInfrastructure({ id: 'i1', photoPath: 'photos/private.webp', name: 'A' })).toEqual({
      id: 'i1', name: 'A', photo_url: '/api/infrastructures/i1/photo?size=full', photo_thumb_url: '/api/infrastructures/i1/photo?size=thumb',
    });
  });

  it('never exposes layer storage paths', () => {
    expect(sanitizeLayer({ id: 'l1', geojsonPath: 'layers/private.geojson', name: 'L' })).toEqual({ id: 'l1', name: 'L' });
  });

  it('rejects oversized workbook shapes', () => {
    expect(() => assertWorkbookShape(2, 5001)).toThrow('maksimal');
    expect(() => assertWorkbookShape(6, 1)).toThrow('maksimal');
    expect(() => assertWorkbookShape(1, 5000)).not.toThrow();
  });
});
