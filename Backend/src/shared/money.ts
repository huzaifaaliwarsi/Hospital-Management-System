/**
 * Decimal-safe arithmetic helpers. Money in this system is tracked in the
 * smallest currency unit (integer "paisa"/cents) to avoid floating-point
 * drift across billing/payroll/commission calculations (§7, §15).
 *
 * PHASE 1 SCOPE: minimal helpers only; the full formula library from
 * §15 (Formulas and Calculation Rules) is implemented per-module as each
 * module (billing, payroll, commission, inventory) is built out.
 */

/** Rounds to the nearest smallest currency unit using round-half-up. */
export function roundMoney(amount: number): number {
  return Math.round(amount);
}

export function toMinorUnits(amount: number, fractionDigits = 2): number {
  return roundMoney(amount * 10 ** fractionDigits);
}

export function toMajorUnits(minorUnits: number, fractionDigits = 2): number {
  return minorUnits / 10 ** fractionDigits;
}

export function sum(amounts: number[]): number {
  return amounts.reduce((total, amount) => roundMoney(total + amount), 0);
}

export function percentageOf(amount: number, percent: number): number {
  return roundMoney((amount * percent) / 100);
}
