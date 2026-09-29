import React, { useEffect, useState } from 'react';
import { Loader2, FileBarChart } from 'lucide-react';
import apiClient from '../services/apiClient';
import { formatPKR, formatNumber } from '../utils/format';

type ReportType =
  | 'SALES_COLLECTION'
  | 'HMS_DISPENSE'
  | 'PURCHASE'
  | 'STOCK_MOVEMENT'
  | 'VENDOR_LEDGER'
  | 'EXPENSE'
  | 'RETURN_REFUND'
  | 'BALANCE_SETTLEMENT';

const REPORT_OPTIONS: { value: ReportType; label: string }[] = [
  { value: 'SALES_COLLECTION', label: 'Sales & Collection' },
  { value: 'HMS_DISPENSE', label: 'HMS Request / Dispense' },
  { value: 'PURCHASE', label: 'Purchase' },
  { value: 'STOCK_MOVEMENT', label: 'Stock Movement' },
  { value: 'VENDOR_LEDGER', label: 'Vendor Ledger' },
  { value: 'EXPENSE', label: 'Expense' },
  { value: 'RETURN_REFUND', label: 'Return / Refund' },
  { value: 'BALANCE_SETTLEMENT', label: 'Balance / Settlement' },
];

const COLUMNS: Record<ReportType, { key: string; label: string; align?: 'right'; money?: boolean; date?: boolean; datetime?: boolean }[]> = {
  SALES_COLLECTION: [
    { key: 'invoiceNumber', label: 'Invoice' },
    { key: 'channel', label: 'Channel' },
    { key: 'customerName', label: 'Customer' },
    { key: 'total', label: 'Net', align: 'right', money: true },
    { key: 'paidTotal', label: 'Paid', align: 'right', money: true },
    { key: 'outstanding', label: 'Outstanding', align: 'right', money: true },
    { key: 'status', label: 'Status' },
    { key: 'soldBy', label: 'Sold By' },
    { key: 'collectedBy', label: 'Collected By' },
    { key: 'createdAt', label: 'Date', datetime: true },
  ],
  HMS_DISPENSE: [
    { key: 'requestNumber', label: 'Request' },
    { key: 'admissionRef', label: 'Admission' },
    { key: 'patientName', label: 'Patient' },
    { key: 'medicines', label: 'Medicines' },
    { key: 'status', label: 'Status' },
    { key: 'requestedByExternal', label: 'Requested By' },
    { key: 'dispensedBy', label: 'Dispensed By' },
    { key: 'invoiceNumber', label: 'Invoice' },
    { key: 'outstanding', label: 'Outstanding', align: 'right', money: true },
    { key: 'clearanceStatus', label: 'Clearance' },
    { key: 'requestedAt', label: 'Date', datetime: true },
  ],
  PURCHASE: [
    { key: 'purchaseNumber', label: 'GRN' },
    { key: 'vendor', label: 'Vendor' },
    { key: 'purchaseDate', label: 'Date', date: true },
    { key: 'paymentType', label: 'Payment' },
    { key: 'total', label: 'Total', align: 'right', money: true },
    { key: 'paidNow', label: 'Paid', align: 'right', money: true },
    { key: 'vendorDue', label: 'Due', align: 'right', money: true },
    { key: 'receivedBy', label: 'Received By' },
  ],
  STOCK_MOVEMENT: [
    { key: 'medicine', label: 'Medicine' },
    { key: 'batch', label: 'Batch' },
    { key: 'movementType', label: 'Type' },
    { key: 'quantityDelta', label: 'Qty', align: 'right' },
    { key: 'performedBy', label: 'Performed By' },
    { key: 'createdAt', label: 'Date', datetime: true },
  ],
  VENDOR_LEDGER: [
    { key: 'vendor', label: 'Vendor' },
    { key: 'entryType', label: 'Type' },
    { key: 'amount', label: 'Amount', align: 'right', money: true },
    { key: 'description', label: 'Description' },
    { key: 'actor', label: 'Actor' },
    { key: 'createdAt', label: 'Date', datetime: true },
  ],
  EXPENSE: [
    { key: 'category', label: 'Category' },
    { key: 'date', label: 'Date', date: true },
    { key: 'amount', label: 'Amount', align: 'right', money: true },
    { key: 'paymentMethod', label: 'Method' },
    { key: 'payeeOrVendor', label: 'Payee' },
    { key: 'description', label: 'Description' },
    { key: 'enteredBy', label: 'Entered By' },
    { key: 'approvedBy', label: 'Approved By' },
  ],
  RETURN_REFUND: [
    { key: 'referenceTable', label: 'Reference' },
    { key: 'amount', label: 'Amount', align: 'right', money: true },
    { key: 'isPhysicalCash', label: 'Cash?' },
    { key: 'reason', label: 'Reason' },
    { key: 'processedBy', label: 'Processed By' },
    { key: 'occurredAt', label: 'Date', datetime: true },
  ],
  BALANCE_SETTLEMENT: [
    { key: 'submittedBy', label: 'Submitted By' },
    { key: 'periodFrom', label: 'From', date: true },
    { key: 'periodTo', label: 'To', date: true },
    { key: 'expectedCash', label: 'Expected', align: 'right', money: true },
    { key: 'physicalCash', label: 'Physical', align: 'right', money: true },
    { key: 'variance', label: 'Variance', align: 'right', money: true },
    { key: 'status', label: 'Status' },
    { key: 'reviewedBy', label: 'Reviewed By' },
  ],
};

function fmtCell(value: any, col: { money?: boolean; date?: boolean; datetime?: boolean }): string {
  if (value === null || value === undefined) return '—';
  if (col.money) return formatPKR(value);
  if (col.date) return new Date(value).toLocaleDateString('en-GB');
  if (col.datetime) return new Date(value).toLocaleString('en-GB');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  return String(value);
}

export const ReportsPage: React.FC = () => {
  const [type, setType] = useState<ReportType>('SALES_COLLECTION');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [rows, setRows] = useState<any[]>([]);
  const [totals, setTotals] = useState<Record<string, number> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = () => {
    setLoading(true);
    setError(null);
    apiClient
      .get('/reports', { params: { type, from: from || undefined, to: to || undefined } })
      .then((r) => {
        setRows(r.data.data.rows);
        setTotals(r.data.data.totals);
      })
      .catch(() => setError('Failed to load report.'))
      .finally(() => setLoading(false));
  };

  useEffect(load, [type]);

  const columns = COLUMNS[type];

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[#111827]">Pharmacy Reports</h2>
        <p className="text-xs text-[#52665e]">pharmacy.md §14 — one consolidated reporting center, actual actors on every row.</p>
      </div>

      <div className="bg-white rounded-xl border border-[#e2eae5] p-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-[#52665e] mb-1">Report</label>
          <select value={type} onChange={(e) => setType(e.target.value as ReportType)} className="input min-w-[220px]">
            {REPORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#52665e] mb-1">From</label>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="input" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-[#52665e] mb-1">To</label>
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="input" />
        </div>
        <button onClick={load} className="px-4 py-2 text-xs font-semibold text-white bg-[#129b70] hover:bg-[#0e7d5a] rounded-lg shadow-xs h-9">
          Apply Filters
        </button>
        <div className="ml-auto text-xs text-[#94a3b8] flex items-center gap-1.5">
          <FileBarChart className="h-3.5 w-3.5" /> {rows.length} row{rows.length === 1 ? '' : 's'}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#e2eae5] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#f6faf8]">
            <tr className="text-[11px] font-bold uppercase tracking-wide text-[#52665e]">
              {columns.map((col) => (
                <th key={col.key} className={`py-2.5 px-3 whitespace-nowrap ${col.align === 'right' ? 'text-right' : 'text-left'}`}>{col.label}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={columns.length} className="py-10 text-center text-[#52665e]"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</td></tr>
            ) : error ? (
              <tr><td colSpan={columns.length} className="py-10 text-center text-rose-600">{error}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={columns.length} className="py-10 text-center text-[#94a3b8]">No records for this filter.</td></tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i} className="border-t border-[#f0f4f2]">
                  {columns.map((col) => (
                    <td key={col.key} className={`py-2 px-3 whitespace-nowrap ${col.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                      {col.key === 'quantityDelta' ? (
                        <span className={Number(row[col.key]) >= 0 ? 'text-[#0e7d5a] font-semibold' : 'text-rose-600 font-semibold'}>
                          {Number(row[col.key]) >= 0 ? '+' : ''}{formatNumber(row[col.key])}
                        </span>
                      ) : (
                        fmtCell(row[col.key], col)
                      )}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {totals && !loading && !error && rows.length > 0 && (
            <tfoot>
              <tr className="border-t-2 border-[#e2eae5] bg-[#f6faf8] font-bold text-[#111827]">
                {columns.map((col, i) => (
                  <td key={col.key} className={`py-2.5 px-3 ${col.align === 'right' ? 'text-right tabular-nums' : ''}`}>
                    {i === 0 ? 'Total' : col.key in totals ? formatPKR(totals[col.key]) : ''}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <style>{`.input { height: 2.25rem; padding: 0 0.75rem; font-size: 0.875rem; background: white; border: 1px solid #e2eae5; border-radius: 0.5rem; } .input:focus { outline: none; box-shadow: 0 0 0 2px rgba(18,155,112,0.2); border-color: #129b70; }`}</style>
    </div>
  );
};
