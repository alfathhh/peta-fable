import { describe, expect, it } from 'vitest';
import { safeCategoryColor } from './markerColor';

describe('safeCategoryColor', () => {
  it('mengganti warna DB yang invalid dengan warna aman', () => {
    expect(safeCategoryColor('red;position:fixed')).toBe('#2563eb');
    expect(safeCategoryColor('#a1B2c3')).toBe('#a1B2c3');
  });
});
