/** Shared reporting arithmetic. Inputs are recognized amounts, never receipt/payout totals. */
export function operatingPerformance(revenue: number, directCosts: number, operatingExpenses: number) {
  const grossProfit = revenue - directCosts;
  const operatingProfit = grossProfit - operatingExpenses;
  return { grossProfit, operatingProfit, operatingMargin: revenue ? operatingProfit / revenue * 100 : 0 };
}
