import React, { useEffect, useState } from 'react';
import { BarChart2, Loader2, AlertCircle, Wallet, Tag, RotateCcw, FileSpreadsheet } from 'lucide-react';
import { Select, TextInput } from '../../../components/forms/FormControls';
import { formatPKR } from '../../../utils/formatters';
import { fetchFrontDeskBillingReport, FrontDeskBillingReport, DatePreset } from '../../../services/frontdeskBillingReportService';
import { formatDateISO, getHospitalCurrentDate } from '../../../utils/dateConstants';

const PRESET_OPTIONS: { label: string; value: DatePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'this_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Custom Range', value: 'custom' },
];

const StatCard: React.FC<{ label: string; value: string; icon: React.ElementType; color: string }> = ({ label, value, icon: Icon, color }) => (
  <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-center gap-3">
    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
      <Icon className="h-4.5 w-4.5" />
    </div>
    <div>
      <p className="text-lg font-bold text-slate-900 leading-none">{value}</p>
      <p className="text-[11px] text-slate-500 mt-1">{label}</p>
    </div>
  </div>
);

/**
 * Front Desk / Billing Reports — real aggregation via
 * `services/frontdeskBillingReportService.ts` → `GET /reports/frontdesk-billing`
 * (HMS_V7.2_NEW_REQUIREMENTS.md §3.3). No hardcoded totals.
 */
export const FrontDeskBillingReportsView: React.FC = () => {
  const [preset, setPreset] = useState<DatePreset>('today');
  const [fromDate, setFromDate] = useState(formatDateISO(getHospitalCurrentDate()));
  const [toDate, setToDate] = useState(formatDateISO(getHospitalCurrentDate()));
  const [report, setReport] = useState<FrontDeskBillingReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setReport(await fetchFrontDeskBillingReport({ preset, fromDate: preset === 'custom' ? fromDate : undefined, toDate: preset === 'custom' ? toDate : undefined }));
    } catch (err: any) {
      setLoadError(err?.response?.data?.error?.message || err?.message || 'Failed to load report.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, preset === 'custom' ? fromDate : null, preset === 'custom' ? toDate : null]);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
          <BarChart2 className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Front Desk / Billing Reports</h1>
          <p className="text-xs text-slate-500 mt-0.5">Collections, discounts, refunds and invoice mix for the selected period.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-end gap-3 flex-wrap">
        <div className="w-48">
          <Select label="Period" options={PRESET_OPTIONS} value={preset} onChange={(e) => setPreset(e.target.value as DatePreset)} />
        </div>
        {preset === 'custom' && (
          <>
            <TextInput label="From" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
            <TextInput label="To" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
          </>
        )}
        <button type="button" onClick={load} className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800 mb-2">
          <RotateCcw className="h-3 w-3" /> Refresh
        </button>
      </div>

      {loadError ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 flex flex-col items-center gap-2 text-center shadow-xs">
          <AlertCircle className="h-6 w-6 text-rose-500" />
          <p className="text-xs text-rose-700 font-medium">{loadError}</p>
          <button type="button" onClick={load} className="mt-1 text-xs font-semibold text-[#08775A] hover:underline">
            Retry
          </button>
        </div>
      ) : isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-10 flex items-center justify-center gap-2 text-slate-400 shadow-xs">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-xs">Loading report…</span>
        </div>
      ) : report ? (
        <>
          <p className="text-[11px] text-slate-400 -mt-2">{report.period.label}</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatCard label="Total Collections" value={formatPKR(report.collections.total)} icon={Wallet} color="text-emerald-700 bg-emerald-50" />
            <StatCard label="Total Discounts" value={formatPKR(report.billing.totalDiscounts)} icon={Tag} color="text-amber-700 bg-amber-50" />
            <StatCard label="Total Refunds" value={formatPKR(report.refunds.total)} icon={RotateCcw} color="text-rose-700 bg-rose-50" />
            <StatCard label="Invoices Raised" value={String(report.billing.invoiceCount)} icon={FileSpreadsheet} color="text-slate-700 bg-slate-100" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Collections by Payment Method</h3>
              <div className="space-y-2">
                {(['CASH', 'CARD', 'BANK', 'ONLINE'] as const).map((m) => (
                  <div key={m} className="flex items-center justify-between text-xs">
                    <span className="text-slate-600">{m}</span>
                    <span className="font-semibold text-slate-800">{formatPKR(report.collections.byMethod[m])}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3">Invoice Mix by Status</h3>
              <div className="space-y-2">
                {Object.entries(report.billing.invoiceCountsByStatus).length === 0 ? (
                  <p className="text-xs text-slate-400">No invoices in this period.</p>
                ) : (
                  Object.entries(report.billing.invoiceCountsByStatus).map(([status, count]) => (
                    <div key={status} className="flex items-center justify-between text-xs">
                      <span className="text-slate-600">{status}</span>
                      <span className="font-semibold text-slate-800">{count}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Gross Billed</span>
              <span className="font-bold text-slate-800 text-sm">{formatPKR(report.billing.totalGross)}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase block">Net Billed</span>
              <span className="font-bold text-slate-800 text-sm">{formatPKR(report.billing.totalNet)}</span>
            </div>
            <div>
              <span className="text-[10px] text-amber-700 uppercase block">Outstanding</span>
              <span className="font-bold text-amber-800 text-sm">{formatPKR(report.billing.totalOutstanding)}</span>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
};
