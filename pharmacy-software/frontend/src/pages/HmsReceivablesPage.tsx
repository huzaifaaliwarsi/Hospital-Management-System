import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Landmark, AlertCircle, Clock, CheckCircle2, Send } from 'lucide-react';
import { formatPKR } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { pharmacyApi } from '../services/pharmacyApi';
import { PharmacyKpiHeader, KpiItem } from '../components/PharmacyKpiHeader';
import { PharmacyDataTable, Column } from '../components/PharmacyDataTable';

const STATUS_STYLE: Record<string, string> = {
  NOT_DUE: 'bg-slate-50 text-slate-600 border-slate-200',
  PENDING: 'bg-amber-50 text-amber-700 border-amber-200',
  REQUESTED: 'bg-blue-50 text-blue-700 border-blue-200',
  PARTIALLY_RELEASED: 'bg-indigo-50 text-indigo-700 border-indigo-200',
  SETTLED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

interface ReceivableRow {
  id: string;
  invoiceNumber: string;
  customerName: string;
  total: number;
  hmsCollectedAmount: number;
  hmsSettledAmount: number;
  hmsReceivable: number;
  internalSettlementStatus: string;
  latestSettlement: any | null;
}

function toRow(raw: any): ReceivableRow {
  const settlements = raw.settlements || [];
  const latestSettlement = settlements.length > 0 ? settlements[0] : null;
  return {
    id: raw.id,
    invoiceNumber: raw.invoiceNumber,
    customerName: raw.customerName || 'Admitted Patient',
    total: Number(raw.total || 0),
    hmsCollectedAmount: Number(raw.hmsCollectedAmount || 0),
    hmsSettledAmount: Number(raw.hmsSettledAmount || 0),
    hmsReceivable: Number(raw.hmsReceivable || 0),
    internalSettlementStatus: raw.internalSettlementStatus || 'NOT_DUE',
    latestSettlement,
  };
}

/**
 * HMS Receivables — money HMS Front Desk collected from admitted patients on
 * Pharmacy's behalf for admission-linked (HMS_LINKED) dispenses, that
 * Pharmacy still needs HMS to hand back. This screen only lets Pharmacy
 * *request* a settlement; the actual release happens on the HMS side
 * (Super Admin / Admin only) and lands back here automatically.
 */
export const HmsReceivablesPage: React.FC = () => {
  const toast = useToast();
  const [rows, setRows] = useState<ReceivableRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeRow, setActiveRow] = useState<ReceivableRow | null>(null);
  const [requestAmount, setRequestAmount] = useState('');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = () => {
    setLoading(true);
    pharmacyApi
      .listHmsReceivables()
      .then((raw: any[]) => setRows(raw.map(toRow)))
      .catch(() => toast.error('Failed to load HMS receivables.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const totalReceivable = useMemo(() => rows.reduce((s, r) => s + r.hmsReceivable, 0), [rows]);
  const totalCollectedByHms = useMemo(() => rows.reduce((s, r) => s + r.hmsCollectedAmount, 0), [rows]);
  const pendingCount = useMemo(
    () => rows.filter((r) => r.hmsReceivable > 0 && r.internalSettlementStatus === 'PENDING').length,
    [rows],
  );
  const awaitingReleaseCount = useMemo(
    () => rows.filter((r) => ['REQUESTED', 'PARTIALLY_RELEASED'].includes(r.internalSettlementStatus)).length,
    [rows],
  );

  const kpis: KpiItem[] = [
    { label: 'Collected By HMS', value: formatPKR(totalCollectedByHms), icon: Landmark, subtitle: 'Across all admission-linked invoices', tone: 'default' },
    { label: 'Receivable From HMS', value: formatPKR(totalReceivable), icon: AlertCircle, subtitle: 'Not yet settled back to Pharmacy', tone: totalReceivable > 0 ? 'warning' : 'success' },
    { label: 'Ready To Request', value: pendingCount, icon: Send, subtitle: 'No request sent yet', tone: pendingCount > 0 ? 'warning' : 'success' },
    { label: 'Awaiting HMS Release', value: awaitingReleaseCount, icon: Clock, subtitle: 'Request sent, waiting on HMS Admin', tone: 'info' },
  ];

  const openRequest = (row: ReceivableRow) => {
    setActiveRow(row);
    setRequestAmount(String(row.hmsReceivable));
    setRemarks('');
  };

  const submitRequest = async () => {
    if (!activeRow) return;
    const amount = Number(requestAmount);
    if (!amount || amount <= 0) return toast.error('Enter a valid amount to request.');
    if (amount > activeRow.hmsReceivable) return toast.error(`Cannot request more than the outstanding receivable (${formatPKR(activeRow.hmsReceivable)}).`);

    setSubmitting(true);
    try {
      await pharmacyApi.requestHmsSettlement({
        invoiceNumber: activeRow.invoiceNumber,
        amountRequested: amount,
        remarks: remarks.trim() || undefined,
      });
      toast.success(`Settlement request sent to HMS for ${formatPKR(amount)}.`);
      setActiveRow(null);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to send settlement request.');
    } finally {
      setSubmitting(false);
    }
  };

  const columns: Column<ReceivableRow>[] = [
    {
      key: 'invoiceNumber',
      header: 'HMS Invoice',
      render: (r) => (
        <div>
          <div className="font-mono font-bold text-[#0e7d5a] text-xs">{r.invoiceNumber}</div>
          <div className="text-[11px] text-slate-500">{r.customerName}</div>
        </div>
      ),
    },
    {
      key: 'total',
      header: 'Invoice Total',
      align: 'right',
      render: (r) => <span className="font-semibold text-xs text-slate-900 whitespace-nowrap">{formatPKR(r.total)}</span>,
    },
    {
      key: 'hmsCollectedAmount',
      header: 'Collected By HMS',
      align: 'right',
      render: (r) => <span className="font-semibold text-xs text-emerald-700 whitespace-nowrap">{formatPKR(r.hmsCollectedAmount)}</span>,
    },
    {
      key: 'hmsSettledAmount',
      header: 'Already Settled',
      align: 'right',
      render: (r) => <span className="text-xs text-slate-600 whitespace-nowrap">{formatPKR(r.hmsSettledAmount)}</span>,
    },
    {
      key: 'hmsReceivable',
      header: 'Receivable',
      align: 'right',
      render: (r) => <span className="font-bold text-xs text-amber-800 whitespace-nowrap">{formatPKR(r.hmsReceivable)}</span>,
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      render: (r) => (
        <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border whitespace-nowrap ${STATUS_STYLE[r.internalSettlementStatus] || STATUS_STYLE.NOT_DUE}`}>
          {r.internalSettlementStatus.replace('_', ' ')}
        </span>
      ),
    },
    {
      key: 'action',
      header: 'Action',
      align: 'center',
      render: (r) =>
        r.hmsReceivable > 0 && (r.internalSettlementStatus === 'PENDING' || r.internalSettlementStatus === 'PARTIALLY_RELEASED') ? (
          <button
            type="button"
            onClick={() => openRequest(r)}
            className="px-2.5 py-1 text-[11px] font-semibold text-white bg-[#0e7d5a] hover:bg-[#0c6b50] rounded-md transition-colors inline-flex items-center gap-1 cursor-pointer shadow-xs"
          >
            <Send className="h-3 w-3" /> Request Settlement
          </button>
        ) : r.internalSettlementStatus === 'REQUESTED' ? (
          <span className="text-[11px] text-blue-700 font-semibold bg-blue-50 px-2 py-0.5 rounded border border-blue-200 inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> Awaiting HMS Release
          </span>
        ) : r.hmsReceivable === 0 && r.hmsCollectedAmount > 0 ? (
          <span className="text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 inline-flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3" /> Settled
          </span>
        ) : (
          <span className="text-[10.5px] text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 inline-flex items-center gap-1">
            <Clock className="h-3 w-3" /> Unpaid at Front Desk
          </span>
        ),
    },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-[1700px] mx-auto">
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">HMS Receivables</h1>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200/80">
            Inter-Entity Settlement
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Money HMS Front Desk collected from admitted patients for admission-linked dispenses, that HMS still owes Pharmacy. Requesting here does not move money — HMS's Super Admin / Admin reviews and releases it.
        </p>
      </div>

      <PharmacyKpiHeader items={kpis} />

      <PharmacyDataTable
        columns={columns}
        data={rows}
        loading={loading}
        title="Admission-Linked Invoices"
        badge="HMS_LINKED Channel"
        exportFileName="hms_receivables"
        searchPlaceholder="Search by invoice number or patient name…"
        searchFilter={(r, q) => r.invoiceNumber.toLowerCase().includes(q) || r.customerName.toLowerCase().includes(q)}
        onRefresh={load}
        emptyTitle="No HMS-Linked Invoices"
        emptyDescription="No admission-linked dispenses recorded yet."
      />

      {activeRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-4 bg-slate-50 border-b border-slate-200">
              <h3 className="font-bold text-sm text-slate-900">Request Settlement — {activeRow.invoiceNumber}</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Outstanding receivable: <strong>{formatPKR(activeRow.hmsReceivable)}</strong></p>
            </div>
            <div className="p-5 space-y-3.5">
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Amount to Request (PKR) *</label>
                <input
                  type="number"
                  min={0}
                  max={activeRow.hmsReceivable}
                  value={requestAmount}
                  onChange={(e) => setRequestAmount(e.target.value)}
                  className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Remarks (optional)</label>
                <input
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="Note for HMS Admin"
                  className="w-full h-9 px-3 text-sm bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                />
              </div>
            </div>
            <div className="px-5 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setActiveRow(null)}
                className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={submitRequest}
                disabled={submitting}
                className="px-4 py-1.5 text-xs font-bold text-white bg-[#0e7d5a] hover:bg-[#0c6b50] rounded-lg disabled:opacity-60 inline-flex items-center gap-1.5 cursor-pointer"
              >
                {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Send Request
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
