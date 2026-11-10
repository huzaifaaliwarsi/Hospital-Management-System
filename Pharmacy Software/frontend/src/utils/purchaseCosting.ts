/**
 * purchase-costing-plan — pure calculation helpers mirroring the backend's
 * createPurchase pipeline EXACTLY (vendors.service.ts), so the Purchase
 * form's live "AUTO" fields never drift from what actually gets posted.
 */

export interface PurchaseLineCalcInput {
  purchaseUnitQuantity: number;
  unitCost: number;
  discountType: 'FLAT' | 'PERCENTAGE';
  discountValue: number;
  taxAmount: number;
  freightAmount: number;
  conversionToBase: number;
  markupPercent: number;
}

export interface PurchaseLineCalc {
  grossAmount: number;
  discountAmount: number;
  netPurchaseCost: number;
  baseQty: number;
  effectiveCostPerBaseUnit: number;
  effectiveCostPerPurchaseUnit: number;
  suggestedSaleRate: number;
}

export function calcPurchaseLine(input: PurchaseLineCalcInput): PurchaseLineCalc {
  const grossAmount = input.purchaseUnitQuantity * input.unitCost;
  const discountAmount = input.discountType === 'PERCENTAGE' ? (grossAmount * input.discountValue) / 100 : input.discountValue;
  const netPurchaseCost = grossAmount - discountAmount + input.taxAmount + input.freightAmount;
  const baseQty = input.purchaseUnitQuantity * input.conversionToBase;
  const effectiveCostPerBaseUnit = baseQty > 0 ? netPurchaseCost / baseQty : 0;
  const effectiveCostPerPurchaseUnit = input.purchaseUnitQuantity > 0 ? netPurchaseCost / input.purchaseUnitQuantity : 0;
  const suggestedSaleRate = effectiveCostPerBaseUnit * (1 + input.markupPercent / 100);
  return { grossAmount, discountAmount, netPurchaseCost, baseQty, effectiveCostPerBaseUnit, effectiveCostPerPurchaseUnit, suggestedSaleRate };
}

/** MARKUP % = (Selling - Cost) / Cost x 100 — "how much more than cost". Never the same number as margin. */
export function markupPercentOf(cost: number, sell: number): number {
  return cost > 0 ? ((sell - cost) / cost) * 100 : 0;
}

/** MARGIN % = (Selling - Cost) / Selling x 100 — "how much of the sale price is profit". Never the same number as markup. */
export function marginPercentOf(cost: number, sell: number): number {
  return sell > 0 ? ((sell - cost) / sell) * 100 : 0;
}
