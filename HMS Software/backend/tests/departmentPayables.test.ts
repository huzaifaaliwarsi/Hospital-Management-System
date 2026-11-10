import { beforeEach, expect, it, vi } from 'vitest';
import { Decimal } from '@prisma/client/runtime/library';

const db = vi.hoisted(() => ({
  department: { findMany: vi.fn(), findUnique: vi.fn() },
  invoiceLineItem: { findMany: vi.fn() },
  paymentReceipt: { findMany: vi.fn() },
  panelRemittanceAllocation: { findMany: vi.fn() },
  mainCashFundEntry: { findMany: vi.fn(), create: vi.fn() },
  $executeRaw: vi.fn(),
  providerSettlement: { findUnique: vi.fn(), findMany: vi.fn(), count: vi.fn(), aggregate: vi.fn(), create: vi.fn() },
  $transaction: vi.fn(),
}));
vi.mock('@/db/client', () => ({ prisma: db }));
import { allocateCollection, allocateInvoiceAmount, invoiceBalance, panelCollectionLedger } from '@/shared/departmentCollections';
import { setupService } from '@/modules/setup/setup.service';
import { departmentPayablesQuerySchema } from '@/modules/setup/setup.schemas';

const lab = { id: 'lab', name: 'LAB' };
const opd = { id: 'opd', name: 'OPD' };
const provider = { id: 'provider', isActive: true, allowedPaymentMethods: ['BANK_TRANSFER'] };
const department = { ...lab, code: 'LAB', fulfillmentOwnership: 'OUTSOURCED', outsourcedProviderId: provider.id, outsourcedProvider: provider };
const receipt = (amount: number, date = '2026-10-15T12:00:00Z') => ({
  amount: new Decimal(amount), collectedAt: new Date(date),
  hospitalInvoice: {
    departmentId: opd.id, department: opd,
    lines: [
      { lineNet: new Decimal(600), serviceRate: { department: lab } },
      { lineNet: new Decimal(400), serviceRate: { department: opd } },
    ],
  },
  admissionRecord: null, appointment: null,
});
const body = {
  requestKey: '11111111-1111-4111-8111-111111111111',
  outsourcedProviderId: provider.id, departmentId: lab.id, eligibleRealizedAmount: 999999,
  settlementAmount: 600, status: 'PARTIAL' as const, paymentMethod: 'BANK_TRANSFER' as const,
};
beforeEach(() => {
  vi.clearAllMocks();
  db.panelRemittanceAllocation.findMany.mockResolvedValue([]);
  db.providerSettlement.findUnique.mockResolvedValue(null);
  db.$executeRaw.mockResolvedValue(1);
  db.mainCashFundEntry.findMany.mockResolvedValue([{ direction: 'IN', amount: new Decimal(1000) }]);
  db.mainCashFundEntry.create.mockResolvedValue({});
  db.department.findMany.mockResolvedValue([department, { ...opd, fulfillmentOwnership: 'INTERNAL' }]);
  db.department.findUnique.mockResolvedValue(department);
  db.invoiceLineItem.findMany.mockResolvedValue([]);
  db.paymentReceipt.findMany.mockResolvedValue([receipt(1000)]);
  db.providerSettlement.findMany.mockResolvedValue([]);
  db.providerSettlement.count.mockResolvedValue(0);
  db.providerSettlement.aggregate.mockResolvedValue({ _sum: { settlementAmount: null } });
  db.providerSettlement.create.mockImplementation(async ({ data }) => ({ ...data, settledByUser: null }));
  db.$transaction.mockImplementation(async fn => fn(db));
});

it('allocates mixed invoices and signed refunds in cents without losing money', () => {
  for (const amount of [1000, 0.01, 17.33, -1000, -17.33]) {
    const rows = allocateCollection(receipt(amount));
    expect(rows.reduce((s, r) => s.plus(r.amount), new Decimal(0)).toNumber()).toBe(amount);
  }
  expect(allocateCollection(receipt(1000)).map(r => r.amount.toNumber())).toEqual([600, 400]);
  expect(allocateCollection(receipt(-1000)).map(r => r.amount.toNumber())).toEqual([-600, -400]);
});

it('never creates a negative departmental collection when splitting a small positive receipt', () => {
  const item = receipt(0.03);
  item.hospitalInvoice.lines = Array.from({ length: 8 }, (_, index) => ({
    lineNet: new Decimal(1), serviceRate: { department: { id: String(index), name: String(index) } },
  }));
  const rows = allocateCollection(item);
  expect(rows.every(r => r.amount.gte(0))).toBe(true);
  expect(rows.reduce((sum, r) => sum.plus(r.amount), new Decimal(0)).toNumber()).toBe(0.03);
});

it('rejects incomplete and reversed custom report date ranges', () => {
  expect(departmentPayablesQuerySchema.safeParse({ preset: 'custom' }).success).toBe(false);
  expect(departmentPayablesQuerySchema.safeParse({ preset: 'custom', fromDate: '2026-11-01', toDate: '2026-10-01' }).success).toBe(false);
  expect(departmentPayablesQuerySchema.safeParse({ preset: 'custom', fromDate: '2026-10-01', toDate: '2026-10-31' }).success).toBe(true);
});

it('preserves standalone admission and appointment advances', () => {
  expect(allocateCollection({ ...receipt(50), hospitalInvoice: null, admissionRecord: { department: lab } })[0].amount.toNumber()).toBe(50);
  expect(allocateCollection({ ...receipt(50), hospitalInvoice: null, appointment: { department: lab } })[0].departmentId).toBe('lab');
});

it('carries opening balances and separates period receipts from historical settlements', async () => {
  db.paymentReceipt.findMany.mockResolvedValue([receipt(1000, '2026-09-15'), receipt(500), receipt(-100)]);
  db.providerSettlement.findMany.mockResolvedValue([
    { departmentId: lab.id, outsourcedProviderId: provider.id, settledAt: new Date('2026-09-20'), settlementAmount: new Decimal(200) },
    { departmentId: lab.id, outsourcedProviderId: provider.id, settledAt: new Date('2026-10-20'), settlementAmount: new Decimal(100) },
  ]);
  const result = await setupService.getDepartmentPayablesSummary({ preset: 'custom', fromDate: '2026-10-01', toDate: '2026-10-31' });
  const row = result.departments[0];
  expect(row.periodBilled).toBe(0); // Old invoices paid in this period still contribute collections.
  expect(row.periodRealized).toBe(240);
  expect(row.openingBalance).toBe(400);
  expect(row.periodSettled).toBe(100);
  expect(row.closingBalance).toBe(540);
  expect(result.departments[1].remainingPayable).toBe(0);
  expect(result.kpis.totalRealized).toBe(400);
  expect(db.paymentReceipt.findMany.mock.calls[0][0].where.OR).toEqual([{ isReversed: false }, { amount: { lt: 0 } }]);
});

it('ignores forged eligibility and computes voucher status and limits on the server', async () => {
  await expect(setupService.createProviderSettlement({ ...body, settlementAmount: 601 }, 'actor')).rejects.toThrow('available payable');
  expect(db.providerSettlement.create).not.toHaveBeenCalled();
  const voucher = await setupService.createProviderSettlement(body, 'actor');
  expect(voucher.eligibleRealizedAmount.toNumber()).toBe(600);
  expect(voucher.status).toBe('FULL');
  expect(db.$transaction.mock.calls[0][1].isolationLevel).toBe('Serializable');
});

it('blocks fully settled departments, wrong providers, unsupported methods and ambiguous legacy vouchers', async () => {
  db.providerSettlement.aggregate.mockResolvedValue({ _sum: { settlementAmount: new Decimal(600) } });
  await expect(setupService.createProviderSettlement(body, 'actor')).rejects.toThrow('available payable');
  await expect(setupService.createProviderSettlement({ ...body, outsourcedProviderId: 'other' }, 'actor')).rejects.toThrow('linked');
  await expect(setupService.createProviderSettlement({ ...body, paymentMethod: 'CASH' }, 'actor')).rejects.toThrow('not allowed');
  db.providerSettlement.count.mockResolvedValue(1);
  await expect(setupService.createProviderSettlement(body, 'actor')).rejects.toThrow('Reconcile');
});

it('recomputes the balance after a concurrent transaction conflict', async () => {
  db.$transaction.mockImplementationOnce(async () => {
    db.providerSettlement.aggregate.mockResolvedValue({ _sum: { settlementAmount: new Decimal(600) } });
    throw { code: 'P2034' };
  });
  await expect(setupService.createProviderSettlement(body, 'actor')).rejects.toThrow('available payable');
  expect(db.$transaction).toHaveBeenCalledTimes(2);
  expect(db.providerSettlement.create).not.toHaveBeenCalled();
});

it('shows credit after a refund of collections already paid to a provider', async () => {
  db.paymentReceipt.findMany.mockResolvedValue([receipt(1000), receipt(-500)]);
  db.providerSettlement.findMany.mockResolvedValue([
    { departmentId: lab.id, outsourcedProviderId: provider.id, settledAt: new Date('2026-10-15'), settlementAmount: new Decimal(600) },
  ]);
  const result = await setupService.getDepartmentPayablesSummary({ preset: 'custom', fromDate: '2026-10-01', toDate: '2026-10-31' });
  expect(result.departments[0].closingBalance).toBe(-300);
  expect(result.departments[0].remainingPayable).toBe(0);
});

it('allocates patient and company payments using their own coverage shares', () => {
  const payment = receipt(200);
  const invoice: any = payment.hospitalInvoice;
  invoice.lines[0].patientShare = new Decimal(0);
  invoice.lines[0].panelReceivable = new Decimal(600);
  invoice.lines[1].patientShare = new Decimal(200);
  invoice.lines[1].panelReceivable = new Decimal(200);
  expect(allocateCollection(payment as any).map(r => [r.departmentId, r.amount.toNumber()])).toEqual([['opd', 200]]);
  expect(allocateInvoiceAmount(new Decimal(800), invoice, 'panelReceivable').map(r => r.amount.toNumber())).toEqual([600, 200]);
  expect(invoiceBalance({
    total: new Decimal(1000), paidTotal: new Decimal(200), panelReceivable: new Decimal(800),
    panelRemittanceAllocations: [{ allocatedAmount: new Decimal(500) }],
  }).due.toNumber()).toBe(300);
});

it('includes old-invoice company remittances in current collections and provider eligibility', async () => {
  db.paymentReceipt.findMany.mockResolvedValue([]);
  const invoice: any = receipt(0).hospitalInvoice;
  invoice.lines[0].panelReceivable = new Decimal(600);
  invoice.lines[1].panelReceivable = new Decimal(200);
  db.panelRemittanceAllocation.findMany.mockResolvedValue([{
    allocatedAmount: new Decimal(800), hospitalInvoice: invoice,
    panelRemittance: { receivedAt: new Date('2026-10-15') },
  }]);
  const report = await setupService.getDepartmentPayablesSummary({ preset: 'custom', fromDate: '2026-10-01', toDate: '2026-10-31' });
  expect(report.departments[0].periodBilled).toBe(0);
  expect(report.departments[0].periodRealized).toBe(600);
  expect(report.departments[0].remainingPayable).toBe(600);
  const voucher = await setupService.createProviderSettlement(body, 'actor');
  expect(voucher.eligibleRealizedAmount.toNumber()).toBe(600);
});

it('filters company allocations by remittance date, receiver and normalized payment method', async () => {
  const start = new Date('2026-10-01'), end = new Date('2026-10-31');
  await panelCollectionLedger(db as any, end, { start, departmentId: 'lab', method: 'BANK', userId: 'collector' });
  const where = db.panelRemittanceAllocation.findMany.mock.calls[0][0].where;
  expect(where.panelRemittance.receivedAt).toEqual({ gte: start, lte: end });
  expect(where.panelRemittance.receivedById).toBe('collector');
  expect(where.panelRemittance.OR).toContainEqual({ method: { equals: 'BANK_TRANSFER', mode: 'insensitive' } });
  expect(where.hospitalInvoice.OR[1]).toEqual({ lines: { some: { serviceRate: { departmentId: 'lab' } } } });
});

it('posts one linked Main Fund debit for a cash voucher and replays the same request safely', async () => {
  db.department.findUnique.mockResolvedValue({ ...department, outsourcedProvider: { ...provider, allowedPaymentMethods: ['CASH'] } });
  const cash = { ...body, paymentMethod: 'CASH' as const };
  const voucher = await setupService.createProviderSettlement(cash, 'actor');
  expect(db.mainCashFundEntry.create).toHaveBeenCalledWith({ data: expect.objectContaining({
    id: voucher.id, direction: 'OUT', amount: new Decimal(600), type: 'WITHDRAWAL', performedById: 'actor',
  }) });
  db.providerSettlement.findUnique.mockResolvedValue(voucher);
  const replay = await setupService.createProviderSettlement(cash, 'actor');
  expect(replay.id).toBe(voucher.id);
  expect(db.mainCashFundEntry.create).toHaveBeenCalledTimes(1);
  expect(db.providerSettlement.create).toHaveBeenCalledTimes(1);
  await expect(setupService.createProviderSettlement({ ...cash, settlementAmount: 500 }, 'actor')).rejects.toThrow('different settlement');
});

it('rejects insufficient Main Fund cash before creating a voucher', async () => {
  db.department.findUnique.mockResolvedValue({ ...department, outsourcedProvider: { ...provider, allowedPaymentMethods: ['CASH'] } });
  db.mainCashFundEntry.findMany.mockResolvedValue([{ direction: 'IN', amount: new Decimal(100) }]);
  await expect(setupService.createProviderSettlement({ ...body, paymentMethod: 'CASH' }, 'actor')).rejects.toThrow('Insufficient Main Fund');
  expect(db.providerSettlement.create).not.toHaveBeenCalled();
  expect(db.mainCashFundEntry.create).not.toHaveBeenCalled();
});

it('does not deduct physical cash for a bank transfer', async () => {
  await setupService.createProviderSettlement(body, 'actor');
  expect(db.mainCashFundEntry.create).not.toHaveBeenCalled();
  expect(db.mainCashFundEntry.findMany).not.toHaveBeenCalled();
});

it('supports the All Time period exposed by the department screen', async () => {
  expect(departmentPayablesQuerySchema.safeParse({ preset: 'all' }).success).toBe(true);
  const report = await setupService.getDepartmentPayablesSummary({ preset: 'all' });
  expect(report.period.label).toBe('All Time');
  expect(report.period.start).toBe(new Date(0).toISOString());
});
