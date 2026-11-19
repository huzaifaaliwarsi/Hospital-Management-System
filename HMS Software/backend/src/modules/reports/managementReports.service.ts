import { invoiceAsOf } from '@/shared/invoiceAsOf';
import { allocateCollection, allocateInvoiceAmount, collectionSelect, collectionInvoiceSelect, invoiceBalance, panelCollectionLedger, signedReceiptWhere } from '@/shared/departmentCollections';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '@/db/client';
import { resolveDateRange } from './dashboard.service';
import { PAYABLE_EQUIVALENT } from '@/modules/attendance/attendance.service';
import { expensesService } from '@/modules/expenses/expenses.service';
import { commissionBalance, commissionPeriodBalance, commissionDepartmentFilter } from '@/modules/commission/commission.calc';
import { salaryBalance } from '@/modules/payroll/payroll.balance';
import { staffFinanceSummary } from './staffFinanceSummary';
import { getPositiveBatchBalances } from '@/shared/inventoryBatchBalances';
import type {
  ManagementSummaryQuery,
  BillingCollectionQuery,
  OutstandingPanelQuery,
  BalanceSettlementsQuery,
  StaffPayrollQuery,
  InventoryPharmacyQuery,
} from './managementReports.schemas';

/**
 * Admin / Super Admin management reports (Super Admin_Admin Reporting.pdf,
 * reporting.md §8.3). Read-only views over the same posted tables Front
 * Desk, Admission, Payroll and Inventory already write — no mock rows.
 * Admission & Bed Summary (#4) uses `/reports/admission/summary` directly.
 */

const ZERO = () => new Decimal(0);
const sumOf = <T>(rows: T[], pick: (r: T) => Decimal) =>
  rows.reduce((s, r) => s.plus(pick(r)), ZERO());

const patientSelect = {
  panelPatient: { select: { fullName: true } },
  selfPayEncounter: { select: { fullName: true } },
} as const;
const userSelect = { select: { id: true, displayName: true, username: true, role: true } } as const;

type Named = { fullName: string } | null | undefined;
const patientName = (r: { panelPatient?: Named; selfPayEncounter?: Named }) =>
  r.panelPatient?.fullName || r.selfPayEncounter?.fullName || 'Unknown Patient';
const userName = (u?: { displayName: string | null; username: string } | null) =>
  u ? u.displayName || u.username : null;
const unique = (values: (string | null | undefined)[]) =>
  Array.from(new Set(values.filter(Boolean))) as string[];
const periodOf = (start: Date, end: Date, label: string) => ({
  label,
  start: start.toISOString(),
  end: end.toISOString(),
});
/** Amount still owed on an invoice; an overpaid invoice is a credit, not negative debt. */

/** Settlements that actually moved cash off a user's custody. */
const ACCEPTED_SETTLEMENT = ['ACCEPTED', 'PARTIALLY_ACCEPTED'] as const;
const CASH_ROLES = [
  'FRONT_DESK_BILLING',
  'INVENTORY_MANAGEMENT',
  'PHARMACY_MANAGER',
  'PHARMACY_SALES_DISPENSING',
];
const PORTAL_LABEL: Record<string, string> = {
  BILLING: 'Front Desk / Billing',
  INVENTORY: 'Inventory',
  PHARMACY: 'Pharmacy',
};

export const managementReportsService = {
  /** #1 Management Summary — hospital-wide totals (shown as table rows) + one row per department. */
  async getSummary(query: ManagementSummaryQuery) {
    const { start, end, label } = resolveDateRange(query);
    const dept = query.departmentId;
    const user = query.portalUserId;
    const method = query.method;

    const bedDept = dept
      ? { OR: [{ ward: { departmentId: dept } }, { room: { ward: { departmentId: dept } } }] }
      : {};
    const [
      invoices,
      receipts,
      expenses,
      activeAdmissions,
      occupiedBeds,
      availableBeds,
      pendingSettlements,
      hospitalExpenses,
      staffFinance,
      panelCollections,
      departmentIssues,
    ] = await Promise.all([
      prisma.hospitalInvoice.findMany({
        where: {
          createdAt: { lte: end },
          status: { not: 'VOID' },
          ...(dept
            ? {
              OR: [
                { departmentId: dept },
                { lines: { some: { serviceRate: { departmentId: dept } } } },
              ],
            }
            : {}),
          ...(user ? { createdById: user } : {}),
        },
        select: {
          id: true,
          createdAt: true,
          paymentReceipts: { where: { ...signedReceiptWhere, collectedAt: { lte: end } }, select: { amount: true } },
          subtotal: true,
          discountTotal: true,
          total: true,
          paidTotal: true,
          panelReceivable: true,
          panelRemittanceAllocations: { where: { panelRemittance: { receivedAt: { lte: end } } }, select: { allocatedAmount: true } },
          departmentId: true,
          department: { select: { id: true, name: true } },
          lines: {
            select: {
              lineGross: true,
              discountAmount: true,
              lineNet: true,
              patientShare: true,
              panelReceivable: true,
              serviceRate: {
                select: {
                  departmentId: true,
                  department: { select: { id: true, name: true } },
                },
              },
            },
          },
        },
      }),
      prisma.paymentReceipt.findMany({
        where: {
          collectedAt: { gte: start, lte: end },
          AND: [{ OR: [{ isReversed: false }, { amount: { lt: 0 } }] }],
          ...(method ? { method } : {}),
          ...(user ? { collectedById: user } : {}),
          ...(dept
            ? {
              OR: [
                { hospitalInvoice: { departmentId: dept } },
                { hospitalInvoice: { lines: { some: { serviceRate: { departmentId: dept } } } } },
                { hospitalInvoiceId: null, admissionRecord: { departmentId: dept } },
                { hospitalInvoiceId: null, appointment: { departmentId: dept } },
              ],
            }
            : {}),
        },
        select: collectionSelect,
      }),
      // Operating vouchers only: never also count their cash-ledger mirrors.
      prisma.inventoryExpense.aggregate({
        where: {
          expenseDate: { gte: new Date(start.toLocaleDateString('en-CA')), lte: new Date(end.toLocaleDateString('en-CA')) },
          // Inventory vouchers have no department assignment.
          ...(dept ? { id: { in: [] } } : {}),
          ...(user ? { createdById: user } : {}),
          ...(method ? { paymentMethod: method } : {}),
        },
        _sum: { amount: true },
      }),
      prisma.admissionRecord.groupBy({
        by: ['departmentId'],
        where: { status: 'ACTIVE', ...(dept ? { departmentId: dept } : {}) },
        _count: { _all: true },
      }),
      prisma.bed.count({ where: { status: 'OCCUPIED', ...bedDept } }),
      prisma.bed.count({ where: { status: 'AVAILABLE', ...bedDept } }),
      prisma.accountSettlement.count({
        where: { status: 'SUBMITTED', ...(user ? { portalUserId: user } : {}) },
      }),
      expensesService.totalBetween(start, end, dept, method),
      staffFinanceSummary(start, end, dept, user, method),
      panelCollectionLedger(prisma, end, { start, departmentId: dept, method, userId: user }),
      prisma.departmentRequisition.findMany({
        where: {
          issuedAt: { gte: start, lte: end },
          status: { in: ['ISSUED', 'PARTIALLY_RETURNED', 'CLOSED'] },
          ...(dept ? { departmentId: dept } : {}),
        },
        include: {
          lines: {
            select: {
              quantity: true,
              returnedQuantity: true,
              costRate: true,
            },
          },
        },
      }),
    ]);

    type Row = {
      department: string;
      invoices: number;
      gross: Decimal;
      discount: Decimal;
      net: Decimal;
      collected: Decimal;
      outstanding: Decimal;
      activeAdmissions: number;
    };
    const rows = new Map<string, Row>();
    const rowFor = (name: string) => {
      let r = rows.get(name);
      if (!r) {
        r = {
          department: name,
          invoices: 0,
          gross: ZERO(),
          discount: ZERO(),
          net: ZERO(),
          collected: ZERO(),
          outstanding: ZERO(),
          activeAdmissions: 0,
        };
        rows.set(name, r);
      }
      return r;
    };

    const countedInvoicesPerDept = new Map<string, Set<string>>();

    for (const i of invoices) {
      if (i.createdAt >= start) {
        if (i.lines && i.lines.length > 0) {
          for (const l of i.lines) {
            const lineDept = l.serviceRate?.department;
            const targetDeptId = lineDept?.id ?? i.departmentId ?? null;
            const targetDeptName = lineDept?.name ?? i.department?.name ?? 'General Hospital Services';

            if (dept && targetDeptId !== dept) {
              continue;
            }

            const r = rowFor(targetDeptName);
            let invSet = countedInvoicesPerDept.get(targetDeptName);
            if (!invSet) {
              invSet = new Set<string>();
              countedInvoicesPerDept.set(targetDeptName, invSet);
            }
            if (!invSet.has(i.id)) {
              invSet.add(i.id);
              r.invoices += 1;
            }

            r.gross = r.gross.plus(l.lineGross);
            r.discount = r.discount.plus(l.discountAmount);
            r.net = r.net.plus(l.lineNet);


          }
        } else {
          const targetDeptId = i.departmentId;
          const targetDeptName = i.department?.name ?? 'General Hospital Services';
          if (dept && targetDeptId !== dept) {
            continue;
          }
          const r = rowFor(targetDeptName);
          r.invoices += 1;
          r.gross = r.gross.plus(i.subtotal);
          r.discount = r.discount.plus(i.discountTotal);
          r.net = r.net.plus(i.total);

        }
      }
      // Current paidTotal includes later receipts: reconstruct the cutoff balance.
      const balance = invoiceBalance({ ...i, paidTotal: sumOf(i.paymentReceipts, r => r.amount) });
      for (const allocation of [
        ...allocateInvoiceAmount(balance.patientDue, i, 'patientShare'),
        ...allocateInvoiceAmount(balance.panelDue, i, 'panelReceivable'),
      ]) {
        if (!dept || allocation.departmentId === dept) {
          const row = rowFor(allocation.departmentId === null ? 'General Hospital Services' : allocation.name);
          row.outstanding = row.outstanding.plus(allocation.amount);
        }
      }
    }

    // Collections follow receipt date, method and collector, including old invoices.
    for (const receipt of receipts) {
      for (const allocation of allocateCollection(receipt)) {
        if (!dept || allocation.departmentId === dept) {
          const row = rowFor(allocation.departmentId === null ? 'General Hospital Services' : allocation.name);
          row.collected = row.collected.plus(allocation.amount);
        }
      }
    }
    for (const allocation of panelCollections) {
      if (!dept || allocation.departmentId === dept) {
        const row = rowFor(allocation.departmentId === null ? 'General Hospital Services' : allocation.name);
        row.collected = row.collected.plus(allocation.amount);
      }
    }
    if (activeAdmissions.length) {
      const departments = await prisma.department.findMany({
        where: { id: { in: activeAdmissions.map((a) => a.departmentId) } },
        select: { id: true, name: true },
      });
      const nameById = new Map(departments.map((d) => [d.id, d.name]));
      for (const a of activeAdmissions)
        rowFor(nameById.get(a.departmentId) ?? 'Unassigned').activeAdmissions += a._count._all;
    }

    const table = Array.from(rows.values()).sort((a, b) =>
      a.department.localeCompare(b.department),
    );
    let directServiceCosts = ZERO();
    for (const req of (departmentIssues as any[] || [])) {
      for (const line of req.lines || []) {
        const netQty = line.quantity.minus(line.returnedQuantity);
        if (netQty.greaterThan(0)) {
          directServiceCosts = directServiceCosts.plus(netQty.times(line.costRate ?? ZERO()));
        }
      }
    }

    const grossBilling = sumOf(table, (r) => r.gross);
    const discounts = sumOf(table, (r) => r.discount);
    const netEarnedRevenue = sumOf(table, (r) => r.net);
    const grossProfit = netEarnedRevenue.minus(directServiceCosts);
    const otherOperatingExpenses = hospitalExpenses.plus(expenses._sum.amount ?? ZERO());
    const totalOperatingCosts = directServiceCosts
      .plus(staffFinance.salaryGenerated)
      .plus(staffFinance.commissionGenerated)
      .plus(otherOperatingExpenses);
    const operatingProfit = grossProfit
      .minus(staffFinance.salaryGenerated)
      .minus(staffFinance.commissionGenerated)
      .minus(otherOperatingExpenses);
    const collectedIncome = sumOf(table, (r) => r.collected);
    const operatingMargin = netEarnedRevenue.isZero() ? ZERO() : operatingProfit.dividedBy(netEarnedRevenue).times(100);

    return {
      period: periodOf(start, end, label),
      summary: {
        ...staffFinance,
        grossBilling,
        discounts,
        totalBilling: netEarnedRevenue,
        netEarnedRevenue,
        directServiceCosts,
        grossProfit,
        payrollCost: staffFinance.salaryGenerated,
        doctorCommissionCost: staffFinance.commissionGenerated,
        otherOperatingExpenses,
        totalOperatingCosts,
        operatingProfit,
        operatingResult: operatingProfit, // Accrual-based Operating Profit (replaces collectedIncome - costs)
        operatingMargin,
        collections: collectedIncome,
        collectedIncome,
        outstanding: sumOf(table, (r) => r.outstanding),
        hospitalExpenses,
        expenses: expenses._sum.amount ?? ZERO(),
        activeAdmissions: table.reduce((s, r) => s + r.activeAdmissions, 0),
        occupiedBeds,
        availableBeds,
        pendingSettlements,
      },
      rows: table,
    };
  },

  /** #2 Billing & Collection — one row per invoice with how it was paid and who collected it. */
  async getBillingCollection(query: BillingCollectionQuery) {
    const { start, end, label } = resolveDateRange(query);
    const invoices = await prisma.hospitalInvoice.findMany({
      where: {
        createdAt: { lte: end }, status: query.status === 'VOID' ? 'VOID' : { not: 'VOID' },
        ...(query.departmentId ? { OR: [{ departmentId: query.departmentId }, { lines: { some: { serviceRate: { departmentId: query.departmentId } } } }] } : {}),
        ...(query.corporatePanelId ? { corporatePanelId: query.corporatePanelId } : {})
      },
      include: {
        ...patientSelect, department: { select: { id: true, name: true } }, lines: collectionInvoiceSelect.lines,
        corporatePanel: { select: { organizationName: true } },
        paymentReceipts: { where: { ...signedReceiptWhere, collectedAt: { lte: end } }, include: { collectedBy: userSelect } },
        panelRemittanceAllocations: { where: { panelRemittance: { receivedAt: { lte: end } } }, include: { panelRemittance: { include: { receivedByUser: userSelect } } } }
      },
      orderBy: { createdAt: 'desc' },
    });
    const rows = invoices.map(invoiceAsOf).flatMap(i => {
      if (query.status && i.status !== query.status) return [];
      const receipts = i.paymentReceipts.filter(p => p.collectedAt >= start && (!query.method || p.method === query.method) && (!query.collectedById || p.collectedById === query.collectedById));
      const panels = i.panelRemittanceAllocations.filter(a => a.panelRemittance.receivedAt >= start && (!query.method || (query.method === 'BANK' ? ['BANK', 'BANK_TRANSFER', 'BANK TRANSFER'] : [query.method]).includes(a.panelRemittance.method.toUpperCase())) && (!query.collectedById || a.panelRemittance.receivedById === query.collectedById));
      if (!receipts.length && !panels.length && (i.createdAt < start || query.method || query.collectedById)) return [];
      const scoped = (amount: Decimal, basis: 'lineNet' | 'patientShare' | 'panelReceivable') => !query.departmentId ? amount : allocateInvoiceAmount(amount, i, basis).filter(a => a.departmentId === query.departmentId).reduce((sum, a) => sum.plus(a.amount), ZERO());
      return [{
        id: i.id, invoiceNumber: i.invoiceNumber, createdAt: i.createdAt, patient: patientName(i), payer: i.corporatePanel?.organizationName ?? 'Self-Pay',
        department: unique([i.department?.name, ...i.lines.map(l => l.serviceRate?.department?.name)]).join(', '),
        gross: scoped(i.subtotal, 'lineNet'), discount: scoped(i.discountTotal, 'lineNet'), net: scoped(i.total, 'lineNet'),
        periodBilled: i.createdAt >= start ? scoped(i.total, 'lineNet') : ZERO(),
        collected: scoped(sumOf(receipts, p => p.amount), 'patientShare').plus(scoped(sumOf(panels, a => a.allocatedAmount), 'panelReceivable')),
        outstanding: scoped(i.balance.patientDue, 'patientShare').plus(scoped(i.balance.panelDue, 'panelReceivable')),
        methods: unique([...receipts.map(p => p.method), ...panels.map(a => a.panelRemittance.method)]).join(', '),
        collectedBy: unique([...receipts.map(p => userName(p.collectedBy)), ...panels.map(a => userName(a.panelRemittance.receivedByUser))]).join(', '), status: i.status
      }];
    });
    return { period: periodOf(start, end, label), rows };
  },

  /**
   * #3 Outstanding / Panel — every invoice with money still owed. A Panel invoice
   * can be PAID by the patient (their share) while the company still owes its
   * receivable, so rows are chosen by amount due, not by invoice status.
   */
  async getOutstandingPanel(query: OutstandingPanelQuery) {
    const { start, end, label } = resolveDateRange(query);
    const invoices = await prisma.hospitalInvoice.findMany({
      where: {
        createdAt: { lte: end },
        status: { not: 'VOID' },
        ...(query.departmentId ? {
          OR: [
            { departmentId: query.departmentId },
            { lines: { some: { serviceRate: { departmentId: query.departmentId } } } },
          ]
        } : {}),
        ...(query.corporatePanelId ? { corporatePanelId: query.corporatePanelId } : {}),
        ...(query.payerType === 'PANEL' ? { corporatePanelId: { not: null } } : {}),
        ...(query.payerType === 'SELF_PAY' ? { corporatePanelId: null } : {}),
      },
      include: {
        ...patientSelect,
        paymentReceipts: { where: { ...signedReceiptWhere, collectedAt: { lte: end } }, select: { amount: true } },
        panelRemittanceAllocations: { where: { panelRemittance: { receivedAt: { lte: end } } }, select: { allocatedAmount: true } },
        department: { select: { id: true, name: true } },
        lines: collectionInvoiceSelect.lines,
        corporatePanel: { select: { organizationName: true } },
      },
      orderBy: { createdAt: 'asc' },
      // Reports and exports include the entire selected period; never silently truncate.
    });

    return {
      period: periodOf(start, end, label),
      rows: invoices.map(invoiceAsOf).map((i) => {
        const paidAtCutoff = sumOf(i.paymentReceipts, r => r.amount);
        const balance = invoiceBalance({ ...i, paidTotal: paidAtCutoff });
        const scoped = (amount: Decimal, basis: 'lineNet' | 'patientShare' | 'panelReceivable') => !query.departmentId ? amount :
          allocateInvoiceAmount(amount, i, basis).filter(r => r.departmentId === query.departmentId)
            .reduce((sum, r) => sum.plus(r.amount), ZERO());
        const patientDue = scoped(balance.patientDue, 'patientShare');
        const panelDue = scoped(balance.panelDue, 'panelReceivable');
        const due = patientDue.plus(panelDue);
        const collected = scoped(paidAtCutoff, 'patientShare').plus(scoped(balance.panelPaid, 'panelReceivable'));
        const departmentName = query.departmentId
          ? i.lines.find(l => l.serviceRate?.department?.id === query.departmentId)?.serviceRate?.department?.name ?? i.department?.name
          : i.department?.name;
        return {
          id: i.id,
          invoiceNumber: i.invoiceNumber,
          createdAt: i.createdAt,
          patient: patientName(i),
          payerType: i.corporatePanelId ? 'Panel' : 'Self-Pay',
          panel: i.corporatePanel?.organizationName ?? null,
          department: departmentName ?? null,
          net: scoped(i.total, 'lineNet'),
          paid: collected,
          patientDue,
          panelDue,
          due,
          status: i.status,
        };
      }).filter(row => row.due.gt(0) && (!query.status || row.status === query.status)),
    };
  },

  /**
   * #6 Balance Sheet & Account Settlements — one row per user per cash portal.
   * Expected cash = carry-forward before the period + physical cash in − physical
   * cash out. Card/Bank/Online is shown separately and never counted as cash.
   */
  async getBalanceSettlements(query: BalanceSettlementsQuery) {
    const { start, end, label } = resolveDateRange(query);
    const scope = query.portal ? { moduleScope: query.portal } : {};
    const owner = query.portalUserId ? { portalUserId: query.portalUserId } : {};

    const [ledger, settlements] = await Promise.all([
      prisma.userCashBalance.findMany({
        where: { occurredAt: { lte: end }, ...scope, ...owner },
        select: {
          portalUserId: true,
          moduleScope: true,
          occurredAt: true,
          direction: true,
          category: true,
          amount: true,
          isPhysicalCash: true,
          portalUser: userSelect,
        },
      }),
      prisma.accountSettlement.findMany({
        where: { submittedAt: { lte: end }, ...scope, ...owner },
        select: {
          portalUserId: true,
          moduleScope: true,
          physicalCash: true,
          handoverAmount: true,
          variance: true,
          status: true,
          submittedAt: true,
          reviewedAt: true,
          reversedAt: true,
          submittedByUser: userSelect,
        },
        orderBy: { submittedAt: 'asc' },
      }),
    ]);

    type Row = {
      key: string;
      user: string;
      portal: string;
      opening: Decimal;
      pettyCash: Decimal;
      cashCollections: Decimal;
      expenses: Decimal;
      refunds: Decimal;
      nonCash: Decimal;
      physicalOut: Decimal;
      submitted: Decimal;
      accepted: Decimal;
      variance: Decimal;
      settlementStatus: string;
    };
    const rows = new Map<string, Row>();
    const rowFor = (
      userId: string,
      portal: string,
      u: { displayName: string | null; username: string },
    ) => {
      const key = `${userId}:${portal}`;
      let r = rows.get(key);
      if (!r) {
        r = {
          key,
          user: userName(u) ?? '—',
          portal: PORTAL_LABEL[portal] ?? portal,
          opening: ZERO(),
          pettyCash: ZERO(),
          cashCollections: ZERO(),
          expenses: ZERO(),
          refunds: ZERO(),
          nonCash: ZERO(),
          physicalOut: ZERO(),
          submitted: ZERO(),
          accepted: ZERO(),
          variance: ZERO(),
          settlementStatus: 'NONE',
        };
        rows.set(key, r);
      }
      return r;
    };

    for (const e of ledger) {
      const r = rowFor(e.portalUserId, e.moduleScope, e.portalUser);
      if (e.occurredAt < start) {
        if (e.isPhysicalCash) r.opening = r.opening.plus(e.direction === 'IN' ? e.amount : e.amount.negated());
        continue;
      }
      if (!e.isPhysicalCash) {
        r.nonCash = r.nonCash.plus(e.direction === 'IN' ? e.amount : e.amount.negated());
        continue;
      }
      if (e.direction === 'IN') {
        if (e.category === 'SALARY_PAYMENT' || e.category === 'COMMISSION_PAYMENT') {
          r.physicalOut = r.physicalOut.minus(e.amount);
          r.expenses = r.expenses.minus(e.amount);
          continue;
        }
        if (e.category === 'PETTY_CASH_ISSUE') r.pettyCash = r.pettyCash.plus(e.amount);
        else r.cashCollections = r.cashCollections.plus(e.amount);
      } else {
        r.physicalOut = r.physicalOut.plus(e.amount);
        if (e.category === 'REFUND') r.refunds = r.refunds.plus(e.amount);
        else r.expenses = r.expenses.plus(e.amount);
      }
    }

    for (const s of settlements) {
      const r = rowFor(s.portalUserId, s.moduleScope, s.submittedByUser);
      const acceptedAt = s.reviewedAt ?? s.submittedAt;
      const wasAccepted = (ACCEPTED_SETTLEMENT as readonly string[]).includes(s.status) || (s.status === 'REVERSED' && !!s.reversedAt && !!s.reviewedAt);
      if (wasAccepted && acceptedAt && acceptedAt <= end) {
        const amount = s.handoverAmount ?? s.physicalCash;
        if (acceptedAt < start) r.opening = r.opening.minus(amount);
        else r.accepted = r.accepted.plus(amount);
        if (s.reversedAt && s.reversedAt <= end) {
          if (s.reversedAt < start) r.opening = r.opening.plus(amount);
          else r.accepted = r.accepted.minus(amount);
        }
      }
      if (!s.submittedAt || s.submittedAt < start) continue;
      r.settlementStatus = s.status;
      if (s.status === 'REJECTED' || s.status === 'REVERSED' || s.status === 'RETURNED') continue;
      r.submitted = r.submitted.plus(s.physicalCash);
      r.variance = r.variance.plus(s.variance);
    }

    const result = Array.from(rows.values())
      .filter((r) => !query.settlementStatus || r.settlementStatus === query.settlementStatus)
      .map(({ physicalOut, ...r }) => {
        const expectedCash = r.opening.plus(r.pettyCash).plus(r.cashCollections).minus(physicalOut);
        return { ...r, cashCollections: r.cashCollections.minus(r.refunds), expectedCash, remaining: expectedCash.minus(r.accepted) };
      })
      .sort((a, b) => a.user.localeCompare(b.user) || a.portal.localeCompare(b.portal));

    return { period: periodOf(start, end, label), rows: result };
  },

  /** #7 Staff / Payroll / Doctor Commission — one row per staff member for a payroll month. */
  async getStaffPayrollCommission(query: StaffPayrollQuery) {
    const now = new Date();
    const period =
      query.period ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const [year, month] = period.split('-').map(Number) as [number, number];
    const start = new Date(Date.UTC(year, month - 1, 1));
    const end = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
    const inMonth = { gte: start, lte: end };

    const staff = await prisma.staff.findMany({
      where: {
        ...(query.departmentId ? {
          OR: [
            { staffDepartments: { some: { departmentId: query.departmentId } } },
            { commissionAccruals: { some: { periodStart: { lte: end }, invoiceLineItem: commissionDepartmentFilter(query.departmentId) } } },
          ]
        } : {}),
        ...(query.staffId ? { id: query.staffId } : {}),
      },
      select: {
        id: true,
        employeeId: true,
        fullName: true,
        category: true,
        department: { select: { name: true } },
        salaryProfiles: {
          where: { effectiveFrom: { lte: end }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: start } }] },
          orderBy: { effectiveFrom: 'desc' },
          take: 1,
          select: { salaryBasis: true, baseAmount: true },
        },
        attendanceRecords: { where: { attendanceDate: inMonth, isApproved: true }, select: { status: true } },
        salarySlips: {
          where: { periodStart: { lte: end }, periodEnd: { gte: start } },
          select: { id: true, payrollRunId: true, generatedAmount: true, status: true, payments: true, correctionEntries: true },
        },
        commissionAccruals: {
          where: { periodStart: { lte: end }, ...(query.departmentId ? { invoiceLineItem: commissionDepartmentFilter(query.departmentId) } : {}) }, select: {
            id: true, periodStart: true, collectionEvent: true, commissionRunId: true, commissionAmount: true, ruleSnapshot: true, status: true,
            payouts: { where: { paidAt: { lte: end } } }, reversals: { where: { reversedAt: { lte: end } } }, adjustments: { where: { createdAt: { lte: end } } },
          }
        },
      },
      orderBy: { fullName: 'asc' },
    });

    const rows = staff
      .map((s) => {
        const profile = s.salaryProfiles[0];
        const statuses = s.salarySlips.map(x => x.status);
        const payrollStatus = !statuses.length ? 'NOT_GENERATED'
          : statuses.every(x => x === 'PAID') ? 'PAID'
            : statuses.some(x => x === 'PAID' || x === 'PARTIALLY_PAID') ? 'PARTIALLY_PAID'
              : statuses.some(x => x === 'GENERATED' || x === 'DRAFT') ? 'GENERATED' : 'APPROVED';
        const salaries = s.salarySlips.map(salaryBalance);
        const commissions = s.commissionAccruals.map(row => commissionPeriodBalance(row, start, end));
        return {
          staffId: s.id,
          employeeId: s.employeeId,
          name: s.fullName,
          category: s.category,
          department: s.department?.name ?? null,
          attendanceDays: s.attendanceRecords.reduce(
            (d, a) => d + (PAYABLE_EQUIVALENT[a.status] ?? 0),
            0,
          ),
          salaryBasis: profile ? `${profile.salaryBasis} — ${profile.baseAmount.toFixed(0)}` : null,
          payrollAmount: sumOf(s.salarySlips, (x) => x.generatedAmount),
          commissionAmount: sumOf(commissions, x => x.periodGross),
          salaryAdjustments: sumOf(salaries, x => x.adjustments),
          salaryPayable: sumOf(salaries, x => x.payable),
          salaryPaid: sumOf(salaries, x => x.paid),
          salaryRemaining: sumOf(salaries, x => x.remaining),
          salaryOverpaid: sumOf(salaries, x => x.overpaid),
          commissionTax: sumOf(commissions, x => x.periodTax),
          commissionReversed: sumOf(commissions, x => x.periodReversed),
          commissionAdjustments: sumOf(commissions, x => x.periodAdjustments),
          commissionPayable: sumOf(commissions, x => x.generated),
          commissionPaid: sumOf(commissions, x => x.periodPaid),
          commissionRemaining: sumOf(commissions, x => x.remaining),
          commissionOverpaid: sumOf(commissions, x => x.overpaid),
          salarySlipIds: s.salarySlips.map(x => x.id),
          commissionAccrualIds: s.commissionAccruals.map(x => x.id),
          payrollRunIds: [...new Set(s.salarySlips.map(x => x.payrollRunId).filter(Boolean))],
          commissionRunIds: [...new Set(s.commissionAccruals.map(x => x.commissionRunId).filter(Boolean))],
          salaryStatements: s.salarySlips.map(x => ({ ...x, balance: salaryBalance(x) })),
          commissionStatements: s.commissionAccruals.map(x => ({ ...x, balance: commissionBalance(x) })),
          status: payrollStatus,
        };
      })
      .filter((r) => !query.status || r.status === query.status);

    return { period: { label: period, start: start.toISOString(), end: end.toISOString() }, rows };
  },

  /** #8 Inventory / Pharmacy Summary — purchases, stock movement, low stock / expiry and Pharmacy request totals. */
  async getInventoryPharmacy(query: InventoryPharmacyQuery) {
    const { start, end, label } = resolveDateRange(query);
    const soon = new Date();
    soon.setDate(soon.getDate() + 60);

    const [items, purchases, expiring, expired, requests, inventoryExpiringBatches, inventoryExpiredBatches, supplierLedgerAll] = await Promise.all([
      prisma.stockItem.findMany({
        where: { isActive: true, ...(query.category ? { category: query.category } : {}) },
        select: { id: true, reorderLevel: true },
      }),
      prisma.purchaseOrder.aggregate({
        where: { createdAt: { gte: start, lte: end }, status: { not: 'CANCELLED' } },
        _sum: { totalAmount: true },
        _count: { _all: true },
      }),
      prisma.medicineBatch.count({ where: { expiryDate: { gte: new Date(), lte: soon } } }),
      prisma.medicineBatch.count({ where: { expiryDate: { lt: new Date() } } }),
      prisma.pharmacyClearance.groupBy({
        by: ['status'],
        where: { requestedAt: { gte: start, lte: end } },
        _count: { _all: true },
      }),
      // General HMS Inventory's own batch/expiry — deliberately separate from
      // Pharmacy's `medicineBatch` above (Domain F/G never intersect,
      // inventory.md §7.2/§9 step 1).
      getPositiveBatchBalances(soon),
      getPositiveBatchBalances(new Date()),
      prisma.supplierLedger.findMany({ select: { entryType: true, amount: true } }),
    ]);
    const inventoryExpiredCount = inventoryExpiredBatches.length;
    const inventoryNearExpiryOnlyCount = Math.max(0, inventoryExpiringBatches.length - inventoryExpiredCount);
    const inventorySupplierPayable = supplierLedgerAll.reduce(
      (acc, e) => (e.entryType === 'PURCHASE_CREDIT' ? acc.plus(e.amount) : acc.minus(e.amount)),
      ZERO(),
    );

    const ids = items.map((i) => i.id);
    const [balances, movements] = ids.length
      ? await Promise.all([
        prisma.stockLedger.groupBy({
          by: ['stockItemId'],
          where: { stockItemId: { in: ids } },
          _sum: { quantityDelta: true },
        }),
        prisma.stockLedger.findMany({
          where: { stockItemId: { in: ids }, createdAt: { gte: start, lte: end } },
          select: { stockItemId: true, quantityDelta: true },
        }),
      ])
      : [[], []];
    const balanceOf = new Map(balances.map((b) => [b.stockItemId, b._sum.quantityDelta ?? ZERO()]));
    const inOf = new Map<string, Decimal>();
    const outOf = new Map<string, Decimal>();
    for (const m of movements) {
      const target = m.quantityDelta.greaterThan(0) ? inOf : outOf;
      target.set(m.stockItemId, (target.get(m.stockItemId) ?? ZERO()).plus(m.quantityDelta.abs()));
    }

    const lowStockItems = items.filter((i) =>
      (balanceOf.get(i.id) ?? ZERO()).lessThanOrEqualTo(i.reorderLevel),
    ).length;
    const count = (statuses: string[]) =>
      requests.filter((r) => statuses.includes(r.status)).reduce((s, r) => s + r._count._all, 0);

    // Summary only (PDF): one record per figure. `isAlert` rows are what the
    // "Alerts only" status filter keeps — they need management attention.
    const rows: {
      section: string;
      metric: string;
      value: number;
      isAmount: boolean;
      isAlert: boolean;
    }[] = [
        {
          section: 'Purchases',
          metric: 'Purchase Orders',
          value: purchases._count._all,
          isAmount: false,
          isAlert: false,
        },
        {
          section: 'Purchases',
          metric: 'Purchase Amount',
          value: Number(purchases._sum.totalAmount ?? 0),
          isAmount: true,
          isAlert: false,
        },
        {
          section: 'Inventory Stock',
          metric: 'Active Stock Items',
          value: items.length,
          isAmount: false,
          isAlert: false,
        },
        {
          section: 'Inventory Stock',
          metric: 'Stock In (Qty)',
          value: Number(sumOf([...inOf.values()], (v) => v)),
          isAmount: false,
          isAlert: false,
        },
        {
          section: 'Inventory Stock',
          metric: 'Stock Out (Qty)',
          value: Number(sumOf([...outOf.values()], (v) => v)),
          isAmount: false,
          isAlert: false,
        },
        {
          section: 'Inventory Stock',
          metric: 'Low Stock Items (at or below reorder level)',
          value: lowStockItems,
          isAmount: false,
          isAlert: true,
        },
        {
          section: 'Inventory Stock',
          metric: 'Batches Near Expiry (60 Days)',
          value: inventoryNearExpiryOnlyCount,
          isAmount: false,
          isAlert: true,
        },
        {
          section: 'Inventory Stock',
          metric: 'Expired Batches',
          value: inventoryExpiredCount,
          isAmount: false,
          isAlert: true,
        },
        {
          section: 'Inventory Stock',
          metric: 'Supplier Payable',
          value: Number(inventorySupplierPayable),
          isAmount: true,
          isAlert: inventorySupplierPayable.greaterThan(0),
        },
        {
          section: 'Medicine Expiry',
          metric: 'Batches Expiring in 60 Days',
          value: expiring,
          isAmount: false,
          isAlert: true,
        },
        {
          section: 'Medicine Expiry',
          metric: 'Expired Batches',
          value: expired,
          isAmount: false,
          isAlert: true,
        },
        {
          section: 'Pharmacy Requests',
          metric: 'Total Requests',
          value: count(requests.map((r) => r.status)),
          isAmount: false,
          isAlert: false,
        },
        {
          section: 'Pharmacy Requests',
          metric: 'Pending (Requested / Authorization / Dispensing)',
          value: count([
            'REQUESTED',
            'ACCEPTED',
            'PARTIALLY_FULFILLED',
            'DISPENSING',
            'AUTHORIZATION_REQUIRED',
          ]),
          isAmount: false,
          isAlert: true,
        },
        {
          section: 'Pharmacy Requests',
          metric: 'Cleared (Dispensed / Invoiced)',
          value: count(['DISPENSED', 'INVOICED', 'CLEARANCE_SENT']),
          isAmount: false,
          isAlert: false,
        },
        {
          section: 'Pharmacy Requests',
          metric: 'Rejected',
          value: count(['REJECTED']),
          isAmount: false,
          isAlert: false,
        },
      ];

    return {
      period: periodOf(start, end, label),
      rows: query.status === 'ALERTS' ? rows.filter((r) => r.isAlert && r.value > 0) : rows,
    };
  },

  /** One source for every dropdown on the 8 management reports. */
  async getFilterOptions() {
    const [departments, doctors, wards, users, panels, staff, categories] = await Promise.all([
      prisma.department.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.staff.findMany({
        where: { isActive: true, category: { equals: 'Doctor', mode: 'insensitive' } },
        select: { id: true, fullName: true },
        orderBy: { fullName: 'asc' },
      }),
      prisma.ward.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: 'asc' },
      }),
      prisma.portalUser.findMany({
        select: { id: true, displayName: true, username: true, role: true },
        orderBy: { username: 'asc' },
      }),
      prisma.corporatePanel.findMany({
        where: { isActive: true },
        select: { id: true, organizationName: true },
        orderBy: { organizationName: 'asc' },
      }),
      prisma.staff.findMany({
        where: { isActive: true },
        select: { id: true, fullName: true, employeeId: true },
        orderBy: { fullName: 'asc' },
      }),
      prisma.stockItem.findMany({
        where: { isActive: true, category: { not: null } },
        distinct: ['category'],
        select: { category: true },
        orderBy: { category: 'asc' },
      }),
    ]);
    const roleLabel = (role: string) =>
      role
        .replace(/_/g, ' ')
        .toLowerCase()
        .replace(/\b\w/g, (c) => c.toUpperCase());
    return {
      departments: departments.map((d) => ({ value: d.id, label: d.name })),
      doctors: doctors.map((d) => ({ value: d.id, label: d.fullName })),
      wards: wards.map((w) => ({ value: w.id, label: w.name })),
      users: users.map((u) => ({
        value: u.id,
        label: `${u.displayName || u.username} (${roleLabel(u.role)})`,
      })),
      cashiers: users
        .filter((u) => ['FRONT_DESK_BILLING', 'ADMIN', 'SUPER_ADMIN'].includes(u.role))
        .map((u) => ({ value: u.id, label: u.displayName || u.username })),
      // Users who hold cash custody (own a Balance Sheet / Account Settlement).
      cashUsers: users
        .filter((u) => CASH_ROLES.includes(u.role))
        .map((u) => ({
          value: u.id,
          label: `${u.displayName || u.username} (${roleLabel(u.role)})`,
        })),
      panels: panels.map((p) => ({ value: p.id, label: p.organizationName })),
      staff: staff.map((s) => ({ value: s.id, label: `${s.fullName} (${s.employeeId})` })),
      stockCategories: categories.map((c) => ({ value: c.category!, label: c.category! })),
    };
  },
  /** M04 Operating Profit (P&L) — Revenue - Direct Cost - Gross Profit - Payroll - Commission - Opex. */
  async getOperatingProfit(query: ManagementSummaryQuery) {
    const summaryData = await this.getSummary(query);
    const { summary, period, rows } = summaryData;

    return {
      period,
      summary: {
        revenue: summary.netEarnedRevenue,
        grossBilling: summary.grossBilling,
        discounts: summary.discounts,
        directCost: summary.directServiceCosts,
        grossProfit: summary.grossProfit,
        payroll: summary.payrollCost,
        doctorCommission: summary.doctorCommissionCost,
        otherOperatingExpenses: summary.otherOperatingExpenses,
        totalCosts: summary.totalOperatingCosts,
        operatingProfit: summary.operatingProfit,
        marginPercentage: summary.operatingMargin,
        collections: summary.collections,
        outstanding: summary.outstanding,
      },
      rows: rows.map((r) => ({
        department: r.department,
        invoices: r.invoices,
        gross: r.gross,
        discount: r.discount,
        revenue: r.net,
        collected: r.collected,
        outstanding: r.outstanding,
      })),
    };
  },

  /** M03 Detailed Expense — Itemized hospital expenses, consumables, payroll, and commissions. */
  async getDetailedExpenses(query: ManagementSummaryQuery) {
    const { start, end, label } = resolveDateRange(query);
    const dept = query.departmentId;

    const [
      hospitalExpenseRows,
      deptRequisitions,
      salarySlips,
      commissionAccruals,
      inventoryExpenseRows,
    ] = await Promise.all([
      prisma.expense.findMany({
        where: {
          status: 'ACTIVE',
          expenseDate: {
            gte: new Date(start.toLocaleDateString('en-CA')),
            lte: new Date(end.toLocaleDateString('en-CA')),
          },
          ...(dept ? { departmentId: dept } : {}),
        },
        include: {
          department: { select: { id: true, name: true } },
          createdByUser: { select: { id: true, displayName: true, username: true, role: true } },
        },
        orderBy: { expenseDate: 'desc' },
      }),
      prisma.departmentRequisition.findMany({
        where: {
          issuedAt: { gte: start, lte: end },
          status: { in: ['ISSUED', 'PARTIALLY_RETURNED', 'CLOSED'] },
          ...(dept ? { departmentId: dept } : {}),
        },
        include: {
          department: { select: { id: true, name: true } },
          issuedBy: { select: { id: true, displayName: true, username: true, role: true } },
          lines: {
            include: {
              stockItem: { select: { id: true, name: true, code: true, unit: true } },
            },
          },
        },
        orderBy: { issuedAt: 'desc' },
      }),
      prisma.salarySlip.findMany({
        where: {
          approvedAt: { gte: start, lte: end },
          status: { in: ['APPROVED', 'PARTIALLY_PAID', 'PAID'] },
          ...(dept
            ? {
                OR: [
                  { payrollRun: { departmentId: dept } },
                  { staff: { staffDepartments: { some: { departmentId: dept } } } },
                ],
              }
            : {}),
        },
        include: {
          staff: { select: { id: true, fullName: true, employeeId: true } },
          payrollRun: { include: { department: { select: { id: true, name: true } } } },
          payments: { where: { paidAt: { lte: end } } },
          correctionEntries: { where: { createdAt: { lte: end } } },
        },
        orderBy: { approvedAt: 'desc' },
      }),
      prisma.doctorCommissionAccrual.findMany({
        where: {
          OR: [
            { collectionEventId: { not: null }, collectionEvent: { occurredAt: { gte: start, lte: end } } },
            { collectionEventId: null, approvedAt: { gte: start, lte: end }, status: { in: ['APPROVED', 'PARTIALLY_PAID', 'PAID'] } },
          ],
          ...(dept ? { invoiceLineItem: commissionDepartmentFilter(dept) } : {}),
        },
        include: {
          doctor: { select: { id: true, fullName: true, employeeId: true } },
          collectionEvent: true,
          payouts: { where: { paidAt: { lte: end } } },
          reversals: { where: { reversedAt: { lte: end } } },
          adjustments: { where: { createdAt: { lte: end } } },
        },
      }),
      prisma.inventoryExpense.findMany({
        where: {
          expenseDate: {
            gte: new Date(start.toLocaleDateString('en-CA')),
            lte: new Date(end.toLocaleDateString('en-CA')),
          },
          ...(dept ? { id: { in: [] } } : {}),
        },
        include: {
          createdByUser: { select: { id: true, displayName: true, username: true, role: true } },
        },
        orderBy: { expenseDate: 'desc' },
      }),
    ]);

    const items: Array<{
      id: string;
      date: string;
      source: string;
      category: string;
      voucherRef: string;
      department: string;
      description: string;
      amount: Decimal;
      enteredBy: string;
    }> = [];

    let totalHospitalExpenses = ZERO();
    for (const h of hospitalExpenseRows) {
      totalHospitalExpenses = totalHospitalExpenses.plus(h.amount);
      items.push({
        id: `hosp-${h.id}`,
        date: h.expenseDate.toISOString().slice(0, 10),
        source: 'Hospital Voucher',
        category: h.category,
        voucherRef: h.expenseNumber,
        department: h.department?.name ?? 'Hospital-Wide',
        description: [h.paidTo, h.description].filter(Boolean).join(' — ') || 'Operating Expense',
        amount: h.amount,
        enteredBy: userName(h.createdByUser) || 'System',
      });
    }

    let totalDirectConsumables = ZERO();
    for (const r of deptRequisitions) {
      for (const l of r.lines) {
        const netQty = l.quantity.minus(l.returnedQuantity);
        if (netQty.greaterThan(0)) {
          const cost = netQty.times(l.costRate ?? ZERO());
          totalDirectConsumables = totalDirectConsumables.plus(cost);
          items.push({
            id: `req-${l.id}`,
            date: r.issuedAt.toISOString().slice(0, 10),
            source: 'Inventory Consumption',
            category: 'Clinical Consumables',
            voucherRef: `REQ-${r.id.slice(0, 8).toUpperCase()}`,
            department: r.department?.name ?? 'Clinical Department',
            description: `${l.stockItem.name} (${netQty.toString()} ${l.stockItem.unit})`,
            amount: cost,
            enteredBy: userName(r.issuedBy) || 'System',
          });
        }
      }
    }

    let totalPayroll = ZERO();
    for (const s of salarySlips) {
      const balance = salaryBalance(s);
      const before = (s.approvedAt ?? s.createdAt) < start
        ? salaryBalance({ ...s, correctionEntries: s.correctionEntries.filter((a) => a.createdAt < start) }).payable
        : ZERO();
      const recognized = balance.payable.minus(before);
      if (recognized.greaterThan(0)) {
        totalPayroll = totalPayroll.plus(recognized);
        items.push({
          id: `sal-${s.id}`,
          date: (s.approvedAt ?? s.createdAt).toISOString().slice(0, 10),
          source: 'Staff Payroll',
          category: 'Salaries & Wages',
          voucherRef: `SLIP-${s.id.slice(0, 8).toUpperCase()}`,
          department: s.payrollRun?.department?.name ?? 'Hospital Staff',
          description: `Salary: ${s.staff.fullName} (${s.staff.employeeId})`,
          amount: recognized,
          enteredBy: 'Payroll System',
        });
      }
    }

    let totalCommission = ZERO();
    for (const c of commissionAccruals) {
      const balance = commissionBalance(c);
      const before = (c.collectionEvent?.occurredAt ?? c.approvedAt ?? c.createdAt) < start
        ? commissionBalance({ ...c, reversals: c.reversals.filter((r) => r.reversedAt < start), adjustments: c.adjustments.filter((a) => a.createdAt < start) }).payable
        : ZERO();
      const recognized = balance.payable.minus(before);
      if (recognized.greaterThan(0)) {
        totalCommission = totalCommission.plus(recognized);
        items.push({
          id: `comm-${c.id}`,
          date: (c.collectionEvent?.occurredAt ?? c.approvedAt ?? c.createdAt).toISOString().slice(0, 10),
          source: 'Doctor Commission',
          category: 'Doctor Commissions',
          voucherRef: `COMM-${c.id.slice(0, 8).toUpperCase()}`,
          department: 'Medical Services',
          description: `Commission: Dr. ${c.doctor.fullName} (${c.doctor.employeeId})`,
          amount: recognized,
          enteredBy: 'Billing Collection Event',
        });
      }
    }

    let totalInventoryOpex = ZERO();
    for (const ie of inventoryExpenseRows) {
      totalInventoryOpex = totalInventoryOpex.plus(ie.amount);
      items.push({
        id: `inve-${ie.id}`,
        date: ie.expenseDate.toISOString().slice(0, 10),
        source: 'Inventory Opex',
        category: ie.category,
        voucherRef: ie.reference || `INV-EXP-${ie.id.slice(0, 8).toUpperCase()}`,
        department: 'Inventory / Stores',
        description: ie.description ?? 'Store Operating Expense',
        amount: ie.amount,
        enteredBy: userName(ie.createdByUser) || 'System',
      });
    }

    const totalOperatingCosts = totalHospitalExpenses
      .plus(totalDirectConsumables)
      .plus(totalPayroll)
      .plus(totalCommission)
      .plus(totalInventoryOpex);

    return {
      period: periodOf(start, end, label),
      summary: {
        totalOperatingCosts,
        totalHospitalExpenses,
        totalDirectConsumables,
        totalPayroll,
        totalCommission,
        totalInventoryOpex,
        rowCount: items.length,
      },
      rows: items,
    };
  },
};