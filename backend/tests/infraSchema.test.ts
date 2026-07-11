import { describe, expect, it } from 'vitest';
import { createInfraSchema, updateInfraSchema } from '../src/schemas';

describe('infrastructure request validation', () => {
  it('requires lat and lng together on updates', () => {
    expect(updateInfraSchema.safeParse({ lat: -0.7 }).success).toBe(false);
    expect(updateInfraSchema.safeParse({ lng: 100.1 }).success).toBe(false);
    expect(updateInfraSchema.safeParse({ lat: -0.7, lng: 100.1 }).success).toBe(true);
  });

  it('rejects blank coordinates instead of coercing them to zero', () => {
    expect(updateInfraSchema.safeParse({ lat: '', lng: '' }).success).toBe(false);
    expect(
      createInfraSchema.safeParse({
        name: 'Posyandu',
        category_id: 'category',
        project_id: 'project',
        lat: '',
        lng: '',
      }).success,
    ).toBe(false);
  });

  it('requires idsls when idsubsls is provided', () => {
    expect(
      createInfraSchema.safeParse({
        name: 'Posyandu',
        category_id: 'category',
        project_id: 'project',
        lat: -0.7,
        lng: 100.1,
        idsubsls: '1306010001000001',
      }).success,
    ).toBe(false);
  });
});
