import { describe, expect, it } from 'vitest';
import { TOKEN_ALPHABET, generateToken } from '../src/lib/tokenGenerator';

describe('tokenGenerator', () => {
  it('menghasilkan 7 karakter dari alfabet aman (tanpa 0,O,1,I,L)', () => {
    for (let i = 0; i < 200; i++) {
      const token = generateToken();
      expect(token).toHaveLength(7);
      for (const char of token) expect(TOKEN_ALPHABET).toContain(char);
      expect(token).not.toMatch(/[0O1IL]/);
    }
  });

  it('token acak jarang tabrakan', () => {
    const seen = new Set(Array.from({ length: 1000 }, () => generateToken()));
    expect(seen.size).toBeGreaterThan(990);
  });
});
