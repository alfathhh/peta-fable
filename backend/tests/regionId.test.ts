import { describe, expect, it } from 'vitest';
import { childLevelOf, isChildOf, levelOf, parentIdsOf, parentOf } from '../src/lib/regionId';

describe('regionId', () => {
  it('levelOf dari panjang id', () => {
    expect(levelOf('1306')).toBe('kab');
    expect(levelOf('1306010')).toBe('kec');
    expect(levelOf('1306010001')).toBe('desa');
    expect(levelOf('13060100010001')).toBe('sls');
    expect(levelOf('1306010001000100')).toBe('subsls');
    expect(levelOf('12345')).toBeNull();
  });

  it('parentOf memotong prefix', () => {
    expect(parentOf('1306010001000100')).toBe('13060100010001');
    expect(parentOf('13060100010001')).toBe('1306010001');
    expect(parentOf('1306010001')).toBe('1306010');
    expect(parentOf('1306010')).toBe('1306');
    expect(parentOf('1306')).toBeNull();
  });

  it('isChildOf pakai prefix', () => {
    expect(isChildOf('1306010001', '1306010')).toBe(true);
    expect(isChildOf('1306010001', '1306020')).toBe(false);
    expect(isChildOf('1306', '1306')).toBe(false);
  });

  it('parentIdsOf mengembalikan semua level', () => {
    expect(parentIdsOf('1306010001000100')).toEqual({
      kab: '1306',
      kec: '1306010',
      desa: '1306010001',
      sls: '13060100010001',
      subsls: '1306010001000100',
    });
  });

  it('childLevelOf', () => {
    expect(childLevelOf('kab')).toBe('kec');
    expect(childLevelOf('subsls')).toBeNull();
  });
});
