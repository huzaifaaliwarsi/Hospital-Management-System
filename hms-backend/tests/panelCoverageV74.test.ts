import { describe, expect, it } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
import { resolvePanelCoverage, PanelDiscountRuleLike } from '@/shared/panelCoverage';
import { replaceDiscountRulesSchema } from '@/modules/setup/setup.schemas';

const d = (n: number) => new Decimal(n);
const at = new Date('2026-09-23T16:00:00Z');
const serviceId = '11111111-1111-4111-8111-111111111111';
const departmentId = '22222222-2222-4222-8222-222222222222';
const rule = (patch: Partial<PanelDiscountRuleLike> = {}): PanelDiscountRuleLike => ({
  id: 'rule',
  serviceRateId: serviceId,
  scope: 'SERVICE',
  coverageType: 'PERCENTAGE',
  discountPercent: d(0),
  coveragePercent: d(80),
  capAmount: null,
  effectiveFrom: new Date('2026-01-01'),
  effectiveTo: null,
  ...patch,
});
const resolve = (rules: PanelDiscountRuleLike[], gross = 1000, quantity = 1) =>
  resolvePanelCoverage(d(gross), rules, serviceId, at, departmentId, d(quantity));

describe('v7.4 panel coverage contract', () => {
  it('resolves service before department before global regardless of input order', () => {
    const global = rule({ serviceRateId: null, scope: 'GLOBAL', coveragePercent: d(10) });
    const department = rule({
      serviceRateId: null,
      departmentId,
      scope: 'DEPARTMENT',
      coveragePercent: d(50),
    });
    expect(resolve([global, department, rule()]).panelReceivable.toNumber()).toBe(800);
    expect(resolve([global, department]).panelReceivable.toNumber()).toBe(500);
    expect(resolve([global]).panelReceivable.toNumber()).toBe(100);
    expect(resolve([]).patientShare.toNumber()).toBe(1000);
  });
  it('explicit exclusions stop fallback while inactive, archived and expired rules do not match', () => {
    const global = rule({ scope: 'GLOBAL', serviceRateId: null, coverageType: 'FULL' });
    expect(
      resolve([global, rule({ coverageType: 'NOT_COVERED' })]).panelReceivable.toNumber(),
    ).toBe(0);
    for (const patch of [
      { isActive: false },
      { archivedAt: at },
      { effectiveTo: new Date('2026-09-22') },
      { effectiveFrom: new Date('2026-09-24') },
    ]) {
      expect(resolve([global, rule(patch)]).panelReceivable.toNumber()).toBe(1000);
    }
  });
  it('includes the full expiry day in Pakistan and excludes the next day', () => {
    const rules = [rule({ effectiveTo: new Date('2026-09-23') })];
    expect(
      resolvePanelCoverage(
        d(1000),
        rules,
        serviceId,
        new Date('2026-09-23T18:59:59Z'),
      ).panelReceivable.toNumber(),
    ).toBe(800);
    expect(
      resolvePanelCoverage(
        d(1000),
        rules,
        serviceId,
        new Date('2026-09-23T19:00:00Z'),
      ).panelReceivable.toNumber(),
    ).toBe(0);
  });
  it('applies unit tariff to quantity then percentage and snapshots the original rule', () => {
    const result = resolve([rule({ contractRate: d(700) })], 2000, 2);
    expect(result.discountAmount.toNumber()).toBe(600);
    expect(result.patientShare.toNumber()).toBe(280);
    expect(result.panelReceivable.toNumber()).toBe(1120);
    expect(result.coverageSnapshot.ruleId).toBe('rule');
    expect(result.coverageSnapshot.quantity).toBe('2');
  });
  it('bounds fixed per-line patient share and caps panel liability', () => {
    expect(
      resolve([
        rule({ coverageType: 'FIXED_PATIENT_SHARE', fixedPatientShare: d(1500) }),
      ]).patientShare.toNumber(),
    ).toBe(1000);
    expect(
      resolve(
        [rule({ coverageType: 'FIXED_PATIENT_SHARE', fixedPatientShare: d(100) })],
        2000,
        2,
      ).patientShare.toNumber(),
    ).toBe(100);
    expect(
      resolve([rule({ coverageType: 'FULL', capAmount: d(300) })]).patientShare.toNumber(),
    ).toBe(700);
  });
  it('does not turn an old contract tariff into a surcharge when standard pricing falls', () => {
    const result = resolve([rule({ contractRate: d(1200) })]);
    expect(result.discountAmount.toNumber()).toBe(0);
    expect(result.eligibleNet.toNumber()).toBe(1000);
  });
  it('keeps legacy discounts separate from panel liability and conserves rounded totals', () => {
    const legacy = resolve([
      rule({ coverageType: 'LEGACY_DISCOUNT', coveragePercent: null, discountPercent: d(10) }),
    ]);
    expect(legacy.patientShare.toNumber()).toBe(900);
    expect(legacy.panelReceivable.toNumber()).toBe(0);
    const rounded = resolve([rule({ coveragePercent: d(33.33) })], 100.01);
    expect(rounded.patientShare.plus(rounded.panelReceivable).equals(rounded.eligibleNet)).toBe(
      true,
    );
  });
});

describe('rule-set validation', () => {
  const base = {
    serviceRateId: serviceId,
    scope: 'SERVICE',
    coverageType: 'PERCENTAGE',
    coveragePercent: 80,
    effectiveFrom: '2026-01-01',
  };
  it('rejects overlapping current rules, malformed scope and reversed dates', () => {
    expect(replaceDiscountRulesSchema.safeParse({ rules: [base, base] }).success).toBe(false);
    expect(
      replaceDiscountRulesSchema.safeParse({ rules: [{ ...base, scope: 'GLOBAL' }] }).success,
    ).toBe(false);
    expect(
      replaceDiscountRulesSchema.safeParse({ rules: [{ ...base, effectiveTo: '2025-01-01' }] })
        .success,
    ).toBe(false);
  });
  it('accepts adjacent nonoverlapping versions and independent scopes', () => {
    expect(
      replaceDiscountRulesSchema.safeParse({
        rules: [
          { ...base, effectiveTo: '2026-09-22' },
          { ...base, effectiveFrom: '2026-09-23' },
          { ...base, scope: 'GLOBAL', serviceRateId: null },
        ],
      }).success,
    ).toBe(true);
  });
  it('rejects missing coverage values and ambiguous department tariffs', () => {
    expect(
      replaceDiscountRulesSchema.safeParse({ rules: [{ ...base, coveragePercent: undefined }] })
        .success,
    ).toBe(false);
    expect(
      replaceDiscountRulesSchema.safeParse({
        rules: [
          { ...base, scope: 'DEPARTMENT', serviceRateId: null, departmentId, contractRate: 100 },
        ],
      }).success,
    ).toBe(false);
  });
});
