import React, { useState } from 'react';
import { ClipboardList, FileSpreadsheet, Wallet, AlertCircle, Tag, RotateCcw, Building2, CreditCard, Eye, Loader2, Landmark, Printer, Users } from 'lucide-react';
import { GenericReportView } from '../../../components/reports/GenericReportView';
import { Modal } from '../../../components/common/Modal';
import { formatPKR } from '../../../utils/formatters';
import {
  fetchEncounterRegister,
  fetchInvoiceRegister,
  fetchCollectionReport,
  fetchOutstandingInvoices,
  fetchDiscountReport,
  fetchRefundVoidReport,
  fetchDepartmentRevenue,
  fetchAdmissionPaymentCollections,
  fetchInvoiceLedger,
  fetchPanelPayerReport,
  fetchReceiptExceptionLog,
  fetchCashierPerformance,
  EncounterRow,
  InvoiceRow,
  CollectionRow,
  OutstandingRow,
  DiscountRow,
  RefundVoidRow,
  DepartmentRevenueRow,
  AdmissionPaymentCollectionRow,
  LedgerEntry,
  PanelPayerRow,
  ReceiptExceptionRow,
  CashierPerformanceRow,
} from '../../../services/frontdeskReportsService';

/** Reporting Guide v7.5 §3.2 — planned/arrived visits and OPD/Observation/Emergency encounters. */
export const EncounterRegisterView: React.FC = () => (
  <GenericReportView<EncounterRow>
    title="Appointment / Visit / Encounter Register"
    subtitle="Chronological register of OPD, Observation and Emergency encounters."
    icon={ClipboardList}
    filenamePrefix="Encounter_Register"
    fetchReport={fetchEncounterRegister}
    rowKey={(r, i) => `${r.invoiceNumber}-${i}`}
    columns={[
      { header: 'Invoice #', cell: (r) => r.invoiceNumber },
      { header: 'Date/Time', cell: (r) => r.occurredAt },
      { header: 'Patient', cell: (r) => r.patient },
      { header: 'Payer', cell: (r) => r.payer },
      { header: 'Department', cell: (r) => r.department || '—' },
      { header: 'Doctor', cell: (r) => r.doctor || '—' },
      { header: 'Visit Type', cell: (r) => r.encounterType || r.visitType },
      { header: 'Status', cell: (r) => r.status },
      { header: 'Created By', cell: (r) => r.createdBy || '—' },
    ]}
  />
);

/** Reporting Guide v7.5 §3.3 — primary billing register across all Hospital-side invoices. Each row drills into its §3.5 Patient/Invoice Ledger. */
export const InvoiceRegisterView: React.FC = () => {
  const [ledgerTarget, setLedgerTarget] = useState<{ id: string; number: string } | null>(null);
  const [ledger, setLedger] = useState<{ invoiceNumber: string; patient: string; entries: LedgerEntry[] } | null>(null);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);

  const openLedger = async (id: string, number: string) => {
    setLedgerTarget({ id, number });
    setIsLedgerLoading(true);
    try {
      setLedger(await fetchInvoiceLedger(id));
    } catch {
      setLedger(null);
    } finally {
      setIsLedgerLoading(false);
    }
  };

  return (
    <>
      <GenericReportView<InvoiceRow>
        title="Billing / Invoice Register"
        subtitle="Every Hospital-side invoice — visit billing and Admission Hospital bills."
        icon={FileSpreadsheet}
        filenamePrefix="Invoice_Register"
        fetchReport={fetchInvoiceRegister}
        rowKey={(r) => r.invoiceNumber}
        columns={[
          { header: 'Invoice #', cell: (r) => r.invoiceNumber },
          { header: 'Date', cell: (r) => r.createdAt },
          { header: 'Patient', cell: (r) => r.patient },
          { header: 'Source', cell: (r) => r.sourceType },
          { header: 'Department', cell: (r) => r.department || '—' },
          { header: 'Gross', align: 'right', cell: (r) => formatPKR(r.gross), excelValue: (r) => r.gross },
          { header: 'Discount', align: 'right', cell: (r) => formatPKR(r.discount), excelValue: (r) => r.discount },
          { header: 'Net', align: 'right', cell: (r) => formatPKR(r.net), excelValue: (r) => r.net },
          { header: 'Paid', align: 'right', cell: (r) => formatPKR(r.paid), excelValue: (r) => r.paid },
          { header: 'Balance', align: 'right', cell: (r) => formatPKR(r.balance), excelValue: (r) => r.balance },
          { header: 'Status', cell: (r) => r.status },
          { header: 'Created By', cell: (r) => r.createdBy || '—' },
          { header: 'Ledger', cell: () => 'View' },
        ]}
        renderCell={(col, row) =>
          col.header === 'Ledger' ? (
            <button
              type="button"
              onClick={() => openLedger(row.id, row.invoiceNumber)}
              className="inline-flex items-center gap-1 px-3 py-1 bg-[#08775A] hover:bg-[#065f46] text-white rounded text-xs font-medium shadow-2xs transition-colors"
              title="View invoice ledger"
            >
              <Eye className="h-3.5 w-3.5" />
              <span>View</span>
            </button>
          ) : (
            col.cell(row)
          )
        }
      />

      <Modal
        isOpen={!!ledgerTarget}
        onClose={() => {
          setLedgerTarget(null);
          setLedger(null);
        }}
        title={ledgerTarget ? `Invoice Ledger — ${ledgerTarget.number}` : ''}
        subtitle="Append/reversal-based transaction log — charges, payments and running balance."
        maxWidth="2xl"
      >
        {isLedgerLoading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-slate-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : ledger ? (
          <div className="border border-slate-200 rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-left text-[11px] border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-2 px-3 font-semibold">Date</th>
                  <th className="py-2 px-3 font-semibold">Reference</th>
                  <th className="py-2 px-3 font-semibold">Type</th>
                  <th className="py-2 px-3 font-semibold">Description</th>
                  <th className="py-2 px-3 font-semibold text-right">Debit</th>
                  <th className="py-2 px-3 font-semibold text-right">Credit</th>
                  <th className="py-2 px-3 font-semibold text-right">Balance</th>
                  <th className="py-2 px-3 font-semibold">Performed By</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ledger.entries.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-6 text-center text-slate-400">
                      No entries yet.
                    </td>
                  </tr>
                ) : (
                  ledger.entries.map((e, i) => (
                    <tr key={i}>
                      <td className="py-2 px-3 text-slate-500">{e.occurredAt}</td>
                      <td className="py-2 px-3 font-mono text-emerald-800">{e.reference}</td>
                      <td className="py-2 px-3">{e.type}</td>
                      <td className="py-2 px-3">{e.description}</td>
                      <td className="py-2 px-3 text-right font-mono">{e.debit > 0 ? formatPKR(e.debit) : '—'}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-700">{e.credit > 0 ? formatPKR(e.credit) : '—'}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{formatPKR(e.runningBalance)}</td>
                      <td className="py-2 px-3">{e.performedBy}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-xs text-rose-600">Failed to load ledger.</div>
        )}
      </Modal>
    </>
  );
};

/** Reporting Guide v7.5 §3.4 — cashier/user-wise collection across Hospital receipts. */
export const CollectionReportViewPage: React.FC = () => (
  <GenericReportView<CollectionRow>
    title="Collection & Receipt Report"
    subtitle="Every payment receipt, including active Admission partial payments."
    icon={Wallet}
    filenamePrefix="Collection_Report"
    fetchReport={fetchCollectionReport}
    rowKey={(r) => r.receiptNumber}
    columns={[
      { header: 'Receipt #', cell: (r) => r.receiptNumber },
      { header: 'Reference', cell: (r) => r.reference },
      { header: 'Patient', cell: (r) => r.patient },
      { header: 'Amount', align: 'right', cell: (r) => formatPKR(r.amount), excelValue: (r) => r.amount },
      { header: 'Method', cell: (r) => r.method },
      { header: 'Date/Time', cell: (r) => r.occurredAt },
      { header: 'Collected By', cell: (r) => r.collectedBy },
    ]}
  />
);

/** Reporting Guide v7.5 §4.1 — open receivable list. */
export const OutstandingInvoicesView: React.FC = () => (
  <GenericReportView<OutstandingRow>
    title="Outstanding / Partial Invoice Report"
    subtitle="Open receivables for follow-up and management control."
    icon={AlertCircle}
    filenamePrefix="Outstanding_Invoices"
    fetchReport={fetchOutstandingInvoices}
    rowKey={(r) => r.invoiceNumber}
    columns={[
      { header: 'Invoice #', cell: (r) => r.invoiceNumber },
      { header: 'Patient', cell: (r) => r.patient },
      { header: 'Department', cell: (r) => r.department || '—' },
      { header: 'Net', align: 'right', cell: (r) => formatPKR(r.net), excelValue: (r) => r.net },
      { header: 'Paid', align: 'right', cell: (r) => formatPKR(r.paid), excelValue: (r) => r.paid },
      { header: 'Outstanding', align: 'right', cell: (r) => formatPKR(r.outstanding), excelValue: (r) => r.outstanding },
      { header: 'Created By', cell: (r) => r.createdBy || '—' },
      { header: 'Status', cell: (r) => r.status },
    ]}
  />
);

/** Reporting Guide v7.5 §4.2 — manual + panel discounts with approval trail. */
export const DiscountReportViewPage: React.FC = () => (
  <GenericReportView<DiscountRow>
    title="Discount / Panel Discount Report"
    subtitle="Manual discounts, configured Panel discounts and their reasons."
    icon={Tag}
    filenamePrefix="Discount_Report"
    fetchReport={fetchDiscountReport}
    rowKey={(r, i) => `${r.invoiceNumber}-${i}`}
    columns={[
      { header: 'Invoice #', cell: (r) => r.invoiceNumber },
      { header: 'Patient / Panel', cell: (r) => r.patientOrPanel },
      { header: 'Service', cell: (r) => r.service },
      { header: 'Standard Amount', align: 'right', cell: (r) => formatPKR(r.standardAmount), excelValue: (r) => r.standardAmount },
      { header: 'Discount Amount', align: 'right', cell: (r) => formatPKR(r.discountAmount), excelValue: (r) => r.discountAmount },
      { header: 'Net', align: 'right', cell: (r) => formatPKR(r.net), excelValue: (r) => r.net },
      { header: 'Reason', cell: (r) => r.reason || '—' },
    ]}
  />
);

/** Reporting Guide v7.5 §4.3 — controlled financial reversals; original transaction always preserved. */
export const RefundVoidReportViewPage: React.FC = () => (
  <GenericReportView<RefundVoidRow>
    title="Refund / Void / Reversal Report"
    subtitle="Exception report for controlled financial reversals."
    icon={RotateCcw}
    filenamePrefix="Refund_Void_Report"
    fetchReport={fetchRefundVoidReport}
    rowKey={(r, i) => `${r.reference}-${i}`}
    columns={[
      { header: 'Reference', cell: (r) => r.reference },
      { header: 'Original Invoice', cell: (r) => r.originalInvoice || '—' },
      { header: 'Type', cell: (r) => r.type },
      { header: 'Amount', align: 'right', cell: (r) => formatPKR(r.amount), excelValue: (r) => r.amount },
      { header: 'Performed By', cell: (r) => r.performedBy },
      { header: 'Date/Time', cell: (r) => r.occurredAt },
    ]}
  />
);

/** Reporting Guide v7.5 §4.4 — billing/collections by department and service. */
export const DepartmentRevenueReportView: React.FC = () => (
  <GenericReportView<DepartmentRevenueRow>
    title="Department / Service Revenue Report"
    subtitle="Billing and collections by department and service."
    icon={Building2}
    filenamePrefix="Department_Revenue"
    fetchReport={fetchDepartmentRevenue}
    rowKey={(r, i) => `${r.department}-${r.service}-${i}`}
    columns={[
      { header: 'Department', cell: (r) => r.department },
      { header: 'Service', cell: (r) => r.service },
      { header: 'Qty', align: 'right', cell: (r) => String(r.qty), excelValue: (r) => r.qty },
      { header: 'Gross', align: 'right', cell: (r) => formatPKR(r.gross), excelValue: (r) => r.gross },
      { header: 'Discount', align: 'right', cell: (r) => formatPKR(r.discount), excelValue: (r) => r.discount },
      { header: 'Net', align: 'right', cell: (r) => formatPKR(r.net), excelValue: (r) => r.net },
    ]}
  />
);

/** Reporting Guide v7.5 §3.6 — Hospital payments Front Desk collected for active/discharge-stage admissions. */
export const AdmissionPaymentCollectionsView: React.FC = () => (
  <GenericReportView<AdmissionPaymentCollectionRow>
    title="Admission Hospital Payment Collection Report"
    subtitle="Hospital payments Front Desk collected against Admission payment requests."
    icon={CreditCard}
    filenamePrefix="Admission_Payment_Collections"
    fetchReport={fetchAdmissionPaymentCollections}
    rowKey={(r, i) => `${r.admissionNumber}-${r.receiptNo || i}`}
    columns={[
      { header: 'Admission #', cell: (r) => r.admissionNumber },
      { header: 'Patient', cell: (r) => r.patient },
      { header: 'Requested Amount', align: 'right', cell: (r) => formatPKR(r.requestedAmount), excelValue: (r) => r.requestedAmount },
      { header: 'Receipt #', cell: (r) => r.receiptNo || '—' },
      { header: 'Collected Amount', align: 'right', cell: (r) => formatPKR(r.collectedAmount), excelValue: (r) => r.collectedAmount },
      { header: 'Method', cell: (r) => r.method || '—' },
      { header: 'Collected By', cell: (r) => r.collectedBy || '—' },
      { header: 'Status', cell: (r) => r.status },
    ]}
  />
);

/** Reporting Guide v7.5 §9 menu — "Panel / Payer Reporting": billing/collections grouped by payer (Corporate Panel or Self-Pay). */
export const PanelPayerReportView: React.FC = () => (
  <GenericReportView<PanelPayerRow>
    title="Panel / Payer Reporting"
    subtitle="Billing and collections grouped by payer — each Corporate Panel plus Self-Pay."
    icon={Landmark}
    filenamePrefix="Panel_Payer_Report"
    fetchReport={fetchPanelPayerReport}
    rowKey={(r) => r.payer}
    columns={[
      { header: 'Payer', cell: (r) => r.payer },
      { header: 'Invoices', align: 'right', cell: (r) => String(r.invoiceCount), excelValue: (r) => r.invoiceCount },
      { header: 'Gross', align: 'right', cell: (r) => formatPKR(r.gross), excelValue: (r) => r.gross },
      { header: 'Discount', align: 'right', cell: (r) => formatPKR(r.discount), excelValue: (r) => r.discount },
      { header: 'Net', align: 'right', cell: (r) => formatPKR(r.net), excelValue: (r) => r.net },
      { header: 'Paid', align: 'right', cell: (r) => formatPKR(r.paid), excelValue: (r) => r.paid },
      { header: 'Outstanding', align: 'right', cell: (r) => formatPKR(r.outstanding), excelValue: (r) => r.outstanding },
    ]}
  />
);

/** Reporting Guide v7.5 §9 menu — "Receipt Reprint / Exception Log". Tracks whether a receipt was printed and any voided receipts — the schema has no per-reprint counter, so this stays honestly scoped to what's actually recorded. */
export const ReceiptExceptionLogView: React.FC = () => (
  <GenericReportView<ReceiptExceptionRow>
    title="Receipt Reprint / Exception Log"
    subtitle="Receipts that were printed, plus any voided receipts."
    icon={Printer}
    filenamePrefix="Receipt_Exception_Log"
    fetchReport={fetchReceiptExceptionLog}
    rowKey={(r) => r.receiptNumber}
    columns={[
      { header: 'Receipt #', cell: (r) => r.receiptNumber },
      { header: 'Invoice #', cell: (r) => r.invoiceNumber || '—' },
      { header: 'Amount', align: 'right', cell: (r) => formatPKR(r.amount), excelValue: (r) => r.amount },
      { header: 'Printed', cell: (r) => (r.printed ? 'Yes' : 'No') },
      { header: 'Voided', cell: (r) => (r.voided ? 'Yes' : 'No') },
      { header: 'Collected By', cell: (r) => r.collectedBy },
      { header: 'Date/Time', cell: (r) => r.occurredAt },
    ]}
  />
);

/** Reporting Guide v7.5 §9 menu — "User/Cashier Performance": per-cashier collection totals and activity. */
export const CashierPerformanceReportView: React.FC = () => (
  <GenericReportView<CashierPerformanceRow>
    title="User / Cashier Performance"
    subtitle="Per-cashier collection totals and transaction activity for the period."
    icon={Users}
    filenamePrefix="Cashier_Performance"
    fetchReport={fetchCashierPerformance}
    rowKey={(r) => r.cashier}
    columns={[
      { header: 'Cashier', cell: (r) => r.cashier },
      { header: 'Receipts', align: 'right', cell: (r) => String(r.receiptCount), excelValue: (r) => r.receiptCount },
      { header: 'Total Collected', align: 'right', cell: (r) => formatPKR(r.totalCollected), excelValue: (r) => r.totalCollected },
      { header: 'Average Transaction', align: 'right', cell: (r) => formatPKR(r.averageTransaction), excelValue: (r) => r.averageTransaction },
    ]}
  />
);
