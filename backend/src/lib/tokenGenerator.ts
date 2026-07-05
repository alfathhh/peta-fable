import crypto from 'node:crypto';

// Alfabet tanpa karakter membingungkan (0/O, 1/I/L) — aturan domain #7.
export const TOKEN_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const TOKEN_LENGTH = 7;

export function generateToken(): string {
  let out = '';
  const bytes = crypto.randomBytes(TOKEN_LENGTH);
  for (let i = 0; i < TOKEN_LENGTH; i++) {
    out += TOKEN_ALPHABET[bytes[i]! % TOKEN_ALPHABET.length];
  }
  return out;
}
