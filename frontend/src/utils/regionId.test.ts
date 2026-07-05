import { describe, expect, it } from 'vitest';
import { isChildOf, levelOf, parentOf } from './regionId';

describe('regionId (FE — logika identik BE)', () => {
  it('levelOf dari panjang id', () => {
    expect(levelOf('1306')).toBe('kab');
    expect(levelOf('1306010001000100')).toBe('subsls');
    expect(levelOf('99')).toBeNull();
  });

  it('parentOf & isChildOf pakai prefix string', () => {
    expect(parentOf('1306010001')).toBe('1306010');
    expect(isChildOf('13060100010001', '1306010001')).toBe(true);
    expect(isChildOf('13060200010001', '1306010001')).toBe(false);
  });
});
