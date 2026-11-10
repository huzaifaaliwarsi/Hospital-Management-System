import React, { useEffect, useState, useMemo } from 'react';
import { Loader2, Check, X as XIcon, DollarSign, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import apiClient from '../services/apiClient';
import { formatPKR } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { PharmacyKpiHeader, KpiItem } from '../components/PharmacyKpiHeader';
import { PharmacyDataTable, Column } from '../components/PharmacyDataTable';

const STATUS_STYLE: Record<string, string> = {
  SUBMITTED: 'bg-amber-50 text-amber-700 border-amber-200',
  ACCEPTED: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
};

export const SettlementsPage: React.FC<{ canReview: boolean }> = ({ canReview }) => {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expected, setExpected] = useState<number | null>(null);
  const [physicalCash, setPhysicalCash] = useState('');
  const [periodFrom, setPeriodFrom] = useState(new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 10));
  const [periodTo, setPeriodTo] = useState(new Date().toISOString().slice(0, 10));
  const [varianceReason, setVarianceReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    apiClient
      .get('/cash/settlements')
      .then((r) => setRows(r.data.data))
      .catch(() => toast.error('Failed to load settlements.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    apiClient.get('/cash/balance-sheet').then((r) => setExpected(Number(r.data.data.expectedCash)));
  }, []);

  const handleSubmit = async () => {
    if (physicalCash === '') return toast.error('Enter your counted physical cash.');
    setSubmitting(true);
    try {
      await apiClient.post('/cash/settlements', {
        periodFrom,
        periodTo,
        physicalCash: Number(physicalCash),
        varianceReason: varianceReason || undefined,
      });
      toast.success('Settlement submitted for review.');
      setPhysicalCash('');
      setVarianceReason('');
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to submit settlement.');
    } finally {
      setSubmitting(false);
    }
  };

  const review = async (id: string, decision: 'ACCEPTED' | 'REJECTED') => {
    try {
      await apiClient.post(`/cash/settlements/${id}/review`, { decision });
      toast.success(`Settlement ${decision.toLowerCase()}.`);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to review settlement.');
    }
  };

  const variance = expected !== null && physicalCash !== '' ? Number(physicalCash) - expected : null;

  // KPI Calculations
  const totalSettledCash = rows.filter((s) => s.status === 'ACCEPTED').reduce((sum, s) => sum + Number(s.physicalCash || 0), 0);
  const pendingReviewCount = rows.filter((s) => s.status === 'SUBMITTED').length;

  const kpis: KpiItem[] = [
    {
      label: 'System Expected Balance',
      value: expected !== null ? formatPKR(expected) : '—',
      icon: DollarSign,
      subtitle: 'Theoretical cash in drawer',
      tone: 'default',
    },
    {
      label: 'Total Accepted Cash',
      value: formatPKR(totalSettledCash),
      icon: CheckCircle2,
      subtitle: 'Verified by branch admin',
      tone: 'success',
    },
    {
      label: 'Pending Reviews',
      value: pendingReviewCount,
      icon: Clock,
      subtitle: 'Cash reconciliations to verify',
      tone: pendingReviewCount > 0 ? 'warning' : 'success',
    },
    {
      label: 'Total Submissions',
      value: rows.length,
      icon: AlertCircle,
      subtitle: 'Historical reconciliation logs',
      tone: 'info',
    },
  ];

  const columns: Column<any>[] = [
    {
      key: 'submittedBy',
      header: 'Submitted By',
      render: (s) => (
        <span className="font-semibold text-slate-900 text-xs whitespace-nowrap">
          {s.submittedByUser?.fullName || s.submittedByUser?.username || 'Staff'}
        </span>
      ),
    },
    {
      key: 'period',
      header: 'Audit Period',
      render: (s) => (
        <span className="text-[11.5px] text-slate-700 whitespace-nowrap">
          {new Date(s.periodFrom).toLocaleDateString('en-GB')} – {new Date(s.periodTo).toLocaleDateString('en-GB')}
        </span>
      ),
    },
    {
      key: 'expectedCash',
      header: 'Expected (PKR)',
      align: 'right',
      width: '150px',
      render: (s) => (
        <span className="font-bold text-xs text-slate-900 whitespace-nowrap">
          {formatPKR(s.expectedCash)}
        </span>
      ),
    },
    {
      key: 'physicalCash',
      header: 'Physical Cash (PKR)',
      align: 'right',
      width: '150px',
      render: (s) => (
        <span className="font-bold text-xs text-slate-900 whitespace-nowrap">
          {formatPKR(s.physicalCash)}
        </span>
      ),
    },
    {
      key: 'variance',
      header: 'Variance',
      align: 'right',
      width: '140px',
      render: (s) => {
        const v = Number(s.variance || 0);
        return (
          <span
            className={`font-bold text-xs whitespace-nowrap ${
              v === 0 ? 'text-slate-500' : v > 0 ? 'text-[#0e7d5a]' : 'text-rose-600'
            }`}
          >
            {v > 0 ? '+' : ''}
            {formatPKR(v)}
          </span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '130px',
      render: (s) => (
        <span className="inline-flex items-center gap-1.5 text-xs font-semibold whitespace-nowrap">
          <span
            className={`h-2 w-2 rounded-full shrink-0 ${
              s.status === 'ACCEPTED'
                ? 'bg-[#0e7d5a]'
                : s.status === 'REJECTED'
                ? 'bg-rose-500'
                : 'bg-amber-500'
            }`}
          />
          <span
            className={
              s.status === 'ACCEPTED'
                ? 'text-[#0e7d5a]'
                : s.status === 'REJECTED'
                ? 'text-rose-700'
                : 'text-amber-700'
            }
          >
            {s.status}
          </span>
        </span>
      ),
    },
    {
      key: 'review',
      header: 'Review Action',
      align: 'center',
      width: '130px',
      render: (s) =>
        canReview && s.status === 'SUBMITTED' ? (
          <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
            <button
              type="button"
              onClick={() => review(s.id, 'ACCEPTED')}
              className="px-2 py-0.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
              title="Accept Settlement"
            >
              <Check className="h-3 w-3" /> Accept
            </button>
            <button
              type="button"
              onClick={() => review(s.id, 'REJECTED')}
              className="px-2 py-0.5 text-[11px] font-semibold text-rose-800 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
              title="Reject Settlement"
            >
              <XIcon className="h-3 w-3" /> Reject
            </button>
          </div>
        ) : (
          <span className="text-slate-400 text-xs">—</span>
        ),
    },
  ];

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-[1700px] mx-auto">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Account &amp; Cash Settlements
          </h1>
          <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
            Shift End Audits
          </span>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          Cashier end-of-shift reconciliation, physical counter audits, discrepancy tracking, and supervisor verification.
        </p>
      </div>

      {/* KPI Cards */}
      <PharmacyKpiHeader items={kpis} />

      {/* Submission Form for Cashiers */}
      {!canReview && (
        <div className="bg-white rounded-2xl border border-slate-300/80 p-5 shadow-[0_1px_4px_rgba(0,0,0,0.04)] space-y-4 max-w-xl">
          <div className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-2">
            Submit Physical Cash Reconciliation
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Period From">
              <input
                type="date"
                value={periodFrom}
                onChange={(e) => setPeriodFrom(e.target.value)}
                className="w-full h-8.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
              />
            </Field>
            <Field label="Period To">
              <input
                type="date"
                value={periodTo}
                onChange={(e) => setPeriodTo(e.target.value)}
                className="w-full h-8.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
              />
            </Field>
          </div>
          <Field label="Expected Drawer Cash (System Balance)">
            <div className="w-full h-8.5 px-3 text-xs bg-slate-100 border border-slate-200 rounded-lg flex items-center font-mono font-bold text-slate-800">
              {expected !== null ? formatPKR(expected) : '—'}
            </div>
          </Field>
          <Field label="Physical Counted Cash *">
            <input
              type="number"
              value={physicalCash}
              onChange={(e) => setPhysicalCash(e.target.value)}
              placeholder="0"
              className="w-full h-8.5 px-3 text-xs bg-slate-50 border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
            />
          </Field>
          {variance !== null && variance !== 0 && (
            <div className="p-3 bg-amber-50/70 border border-amber-200 rounded-xl space-y-2">
              <div className={`text-xs font-bold ${variance > 0 ? 'text-[#0e7d5a]' : 'text-rose-600'}`}>
                Reconciliation Variance: {formatPKR(variance)}
              </div>
              <Field label="Variance Explanation Reason *">
                <input
                  value={varianceReason}
                  onChange={(e) => setVarianceReason(e.target.value)}
                  placeholder="Explain discrepancy reasons for audit log"
                  className="w-full h-8.5 px-3 text-xs bg-white border border-amber-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                />
              </Field>
            </div>
          )}
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full h-9 text-xs font-semibold text-white bg-[#0e7d5a] hover:bg-[#0c6b50] rounded-xl disabled:opacity-60 transition-colors cursor-pointer flex items-center justify-center gap-1.5"
          >
            {submitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Submit Settlement
          </button>
        </div>
      )}

      {/* Main Table */}
      <PharmacyDataTable
        columns={columns}
        data={rows}
        loading={loading}
        title="Settlement History & Audit Ledger"
        badge="Reconciliation Records"
        exportFileName="cash_settlements"
        searchPlaceholder="Search by cashier name or notes…"
        searchFilter={(s, q) =>
          (s.submittedByUser?.fullName && s.submittedByUser.fullName.toLowerCase().includes(q)) ||
          (s.varianceReason && s.varianceReason.toLowerCase().includes(q))
        }
        onRefresh={load}
        emptyTitle="No Settlements Logged"
        emptyDescription="No cashier drawer settlements recorded yet."
      />
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-semibold text-slate-600 mb-1">{label}</label>
    {children}
  </div>
);
