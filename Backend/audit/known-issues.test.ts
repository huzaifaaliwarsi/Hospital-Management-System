/**
 * Audit regression checks. AUDIT-01/02 moved to security and inventory tests.
 * The panel outstanding defect is now fixed and this assertion must pass.
 * No live records or HTTP calls.
 */
import { beforeEach, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';
const db = vi.hoisted(() => ({
  portalUser: { findUnique: vi.fn() },
  department: { findUnique: vi.fn() },
  stockItem: { findUnique: vi.fn() },
  departmentRequisition: { create: vi.fn() },
  stockLedger: { create: vi.fn() },
  hospitalInvoice: { findMany: vi.fn() },
  panelRemittanceAllocation: { groupBy: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('@/db/client', () => ({ prisma: db }));
vi.mock('@/config/env', () => ({ env: { JWT_ACCESS_SECRET: 'audit-only-not-a-real-secret', NODE_ENV: 'test', LOG_LEVEL: 'error' } }));
import { managementReportsService } from '@/modules/reports/managementReports.service';

beforeEach(() => vi.clearAllMocks());

it('AUDIT-03: a fully paid panel invoice must disappear from outstanding reporting', async () => {
  db.hospitalInvoice.findMany.mockResolvedValue([{
    id: 'invoice', invoiceNumber: 'AUDIT', createdAt: new Date(), status: 'PAID',
    total: new Decimal(1000), paidTotal: new Decimal(200),
    patientShare: new Decimal(200), panelReceivable: new Decimal(800),
    corporatePanelId: 'panel', corporatePanel: { organizationName: 'Audit panel' },
    panelRemittanceAllocations: [{ allocatedAmount: new Decimal(800) }],
  }]);
  db.panelRemittanceAllocation.groupBy.mockResolvedValue([
    { hospitalInvoiceId: 'invoice', _sum: { allocatedAmount: new Decimal(800) } },
  ]);
  const report = await managementReportsService.getOutstandingPanel({ preset: 'today' });
  // Regression: both patient and company have paid their respective portions.
  expect(report.rows).toHaveLength(0);
});

it('scopes mixed-invoice panel outstanding to the service department', async () => {
  const lab = { id: 'lab', name: 'LAB' }, opd = { id: 'opd', name: 'OPD' };
  db.hospitalInvoice.findMany.mockResolvedValue([{
    id: 'invoice', departmentId: 'opd', department: opd,
    total: new Decimal(1000), paidTotal: new Decimal(200), panelReceivable: new Decimal(800),
    panelRemittanceAllocations: [{ allocatedAmount: new Decimal(400) }],
    lines: [
      { lineNet: new Decimal(600), patientShare: new Decimal(0), panelReceivable: new Decimal(600), serviceRate: { department: lab } },
      { lineNet: new Decimal(400), patientShare: new Decimal(200), panelReceivable: new Decimal(200), serviceRate: { department: opd } },
    ],
  }]);
  const report = await managementReportsService.getOutstandingPanel({ preset: 'today', departmentId: 'lab' });
  expect(report.rows[0].department).toBe('LAB');
  expect(report.rows[0].patientDue.toNumber()).toBe(0);
  expect(report.rows[0].panelDue.toNumber()).toBe(300);
  expect(report.rows[0].paid.toNumber()).toBe(300);
  expect(report.rows[0].net.toNumber()).toBe(600);
});
