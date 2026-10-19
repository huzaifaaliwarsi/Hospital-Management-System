import { describe, expect, it, vi } from 'vitest';
vi.mock('@/config/env', () => ({ env: { INTERNAL_BRIDGE_SECRET: 'test-secret' } }));
import { bridgeAuth } from '../src/middleware/bridgeAuth';
import { authorize } from '../src/middleware/authorize';
import { pharmacyDischargeBlocked } from '../src/shared/pharmacyDischargeGate';

describe('integration and discharge safety gates', () => {
  it('rejects a logged-in user attempting a bridge callback without the secret', () => {
    expect(() => bridgeAuth({ headers: {}, user: { role: 'SUPER_ADMIN' } } as any, {} as any, vi.fn())).toThrow('Unauthorized bridge');
  });
  it('accepts a valid integration secret', () => {
    const next = vi.fn();
    bridgeAuth({ headers: { 'x-bridge-token': 'test-secret' } } as any, {} as any, next);
    expect(next).toHaveBeenCalledOnce();
  });
  it('prevents bridge credentials from collecting patient cash', () => {
    expect(() => authorize('frontdesk', 'create')({ isInternalBridge: true, user: { role: 'SUPER_ADMIN' } } as any, {} as any, vi.fn())).toThrow('restricted');
  });
  it('prevents admission staff from collecting cash', () => {
    expect(() => authorize('frontdesk', 'create')({ user: { role: 'ADMISSION' } } as any, {} as any, vi.fn())).toThrow('not permitted');
  });
  it.each([[1, 0, true], [0, 1, true], [1, 1, true], [0, 0, false]])('pending=%s unpaid=%s blocks discharge=%s', async (pending, unpaid, expected) => {
    const tx = { pharmacyClearance: { count: vi.fn(async () => pending) }, hmsPharmacyCharge: { count: vi.fn(async () => unpaid) } };
    expect(await pharmacyDischargeBlocked(tx as any, 'adm')).toBe(expected);
    expect(tx.pharmacyClearance.count).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ admissionRecordId: 'adm' }) }));
  });
});
