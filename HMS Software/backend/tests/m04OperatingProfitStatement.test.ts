import { describe, it, expect, vi } from 'vitest';
import { managementReportsService } from '../src/modules/reports/managementReports.service';

describe('M04 — Operating Profit Statement & Detailed Ledger', () => {
  it('returns structured 5-section statement with ledger entries', async () => {
    const res = await managementReportsService.getOperatingProfitStatement({
      preset: 'today',
      comparison: 'previous',
      view: 'statement',
      page: 1,
      limit: 25,
    });

    expect(res).toBeDefined();
    expect(res.period).toBeDefined();
    expect(Array.isArray(res.rows)).toBe(true);
    expect(Array.isArray(res.warnings)).toBe(true);
    expect(res.ledger).toBeDefined();
    expect(Array.isArray(res.ledger.items)).toBe(true);

    // Verify key sections exist
    const sections = new Set(res.rows.map((r: any) => r.section));
    expect(sections.has('1. HOSPITAL OPERATING REVENUE')).toBe(true);
    expect(sections.has('2. DIRECT SERVICE COSTS')).toBe(true);
    expect(sections.has('3. GROSS PROFIT (GROSS MARGIN)')).toBe(true);
    expect(sections.has('4. OPERATING OVERHEADS & EXPENSES')).toBe(true);
    expect(sections.has('5. NET OPERATING PROFIT / (LOSS)')).toBe(true);

    // Verify Net Operating Profit row exists
    const netRow = res.rows.find((r: any) => r.key === 'operatingProfit');
    expect(netRow).toBeDefined();
  });
});
