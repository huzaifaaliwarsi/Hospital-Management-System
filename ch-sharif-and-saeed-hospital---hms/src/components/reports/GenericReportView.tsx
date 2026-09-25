import React, { useEffect, useState, useCallback } from 'react';
import { Loader2, AlertCircle } from 'lucide-react';
import { Select, TextInput } from '../forms/FormControls';
import { useAuth } from '../../context/AuthContext';
import { formatDateISO, getHospitalCurrentDate } from '../../utils/dateConstants';
import { downloadTablePDF, downloadTableExcel, downloadTableCSV, printTable, ExportColumn } from '../../services/tableExportService';
import { ExportButtonGroup } from '../../features/superAdmin/financeControl/ExportButtonGroup';

export type ReportDatePreset = 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom';

const PRESET_OPTIONS: { label: string; value: ReportDatePreset }[] = [
  { label: 'Today', value: 'today' },
  { label: 'Yesterday', value: 'yesterday' },
  { label: 'This Week', value: 'this_week' },
  { label: 'This Month', value: 'this_month' },
  { label: 'Custom Range', value: 'custom' },
];

export interface ReportKpi {
  label: string;
  value: string;
  accent?: 'default' | 'positive' | 'negative' | 'warning';
}

export interface ReportResult<T> {
  periodLabel?: string;
  kpis?: ReportKpi[];
  rows: T[];
}

export interface GenericReportViewProps<T> {
  title: string;
  subtitle: string;
  icon: React.ElementType;
  filenamePrefix: string;
  columns: ExportColumn<T>[];
  fetchReport: (range: { preset: ReportDatePreset; fromDate?: string; toDate?: string }) => Promise<ReportResult<T>>;
  rowKey: (row: T, index: number) => string;
  /** Renders a table cell for on-screen display; defaults to the export column's `cell`. Lets a report add badges/links the plain export text can't carry. */
  renderCell?: (col: ExportColumn<T>, row: T) => React.ReactNode;
  emptyMessage?: string;
  /** Point-in-time reports (census, bed occupancy) have no date range to filter. */
  noDateFilter?: boolean;
  extraFilters?: React.ReactNode;
}

const accentClass: Record<NonNullable<ReportKpi['accent']>, string> = {
  default: 'text-slate-900',
  positive: 'text-emerald-700',
  negative: 'text-rose-700',
  warning: 'text-amber-700',
};

/**
 * Reusable reporting view matching hospital ERP theme & reference reporting UI:
 * - Clean title & filter bar
 * - Dark hospital theme banner with icon and period label
 * - Colorful Export Toolbar (Excel, CSV, PDF, Print)
 * - Complete bordered table grid with # row numbering & subtle dividers
 */
export function GenericReportView<T>({
  title,
  subtitle,
  icon: Icon,
  filenamePrefix,
  columns,
  fetchReport,
  rowKey,
  renderCell,
  emptyMessage = 'No records for this period.',
  noDateFilter,
  extraFilters,
}: GenericReportViewProps<T>) {
  const { currentUser } = useAuth();
  const todayISO = formatDateISO(getHospitalCurrentDate());
  const [preset, setPreset] = useState<ReportDatePreset>('today');
  const [fromDate, setFromDate] = useState(todayISO);
  const [toDate, setToDate] = useState(todayISO);
  const [result, setResult] = useState<ReportResult<T> | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setResult(await fetchReport({ preset, fromDate: preset === 'custom' ? fromDate : undefined, toDate: preset === 'custom' ? toDate : undefined }));
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load report.');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, preset === 'custom' ? fromDate : null, preset === 'custom' ? toDate : null]);

  useEffect(() => {
    load();
  }, [load]);

  const rows = result?.rows ?? [];
  const exportContext = { documentTitle: title, documentSubtitle: subtitle, filenamePrefix, columns, rows, currentUser, periodLabel: result?.periodLabel };

  return (
    <div className="space-y-4 animate-in fade-in duration-150">
      {/* Top Header & Subtitle */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h1>
          <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>
        </div>
      </div>

      {/* Date Filter Bar */}
      {!noDateFilter && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex items-end gap-3 flex-wrap">
          <div className="w-48">
            <Select label="Period" options={PRESET_OPTIONS} value={preset} onChange={(e) => setPreset(e.target.value as ReportDatePreset)} />
          </div>
          {preset === 'custom' && (
            <>
              <TextInput label="From" lang="en-GB" type="date" value={fromDate} onChange={(e) => setFromDate(e.target.value)} />
              <TextInput label="To" lang="en-GB" type="date" value={toDate} onChange={(e) => setToDate(e.target.value)} />
            </>
          )}
          {extraFilters}
          <button type="button" onClick={load} className="text-xs font-semibold text-[#08775A] hover:text-[#065f46] hover:underline mb-2 ml-auto">
            Refresh
          </button>
        </div>
      )}

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
      ) : (
        <>
          {result?.kpis && result.kpis.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {result.kpis.map((k) => (
                <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-xs">
                  <span className="text-[10.5px] text-slate-500 font-medium block">{k.label}</span>
                  <span className={`text-base font-bold font-mono block mt-1 ${accentClass[k.accent || 'default']}`}>{k.value}</span>
                </div>
              ))}
            </div>
          )}

          {/* Distinctive Dark Theme Banner (matching reference UI) */}
          <div className="bg-gradient-to-r from-[#0a4636] to-[#08775A] text-white px-4 py-2.5 rounded-lg flex items-center justify-between shadow-xs">
            <div className="flex items-center gap-2.5 font-bold text-sm tracking-wide text-white">
              <div className="h-6 w-6 rounded bg-white/15 text-white flex items-center justify-center">
                <Icon className="h-3.5 w-3.5" />
              </div>
              <span>{title}</span>
            </div>
            {result?.periodLabel && (
              <span className="text-xs text-emerald-100 font-medium bg-white/10 px-2.5 py-0.5 rounded-md">
                {result.periodLabel}
              </span>
            )}
          </div>

          {/* Export Toolbar (Excel, CSV, PDF, Print) right above table */}
          <div className="flex items-center justify-end -mt-1">
            <ExportButtonGroup
              disabled={rows.length === 0}
              onExcel={() => downloadTableExcel(exportContext)}
              onCsv={() => downloadTableCSV(exportContext)}
              onPdf={() => downloadTablePDF(exportContext)}
              onPrint={() => printTable(exportContext)}
            />
          </div>

          {/* Table with proper bordered grid lines */}
          <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)]">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-[#f1f5f9] border-b border-slate-300 sticky top-0 z-10 text-slate-800 text-[11.5px] font-bold uppercase tracking-wider">
                    <th className="w-12 py-3 px-3 text-center border-r border-slate-300 font-bold text-slate-700">#</th>
                    {columns.map((c) => (
                      <th
                        key={c.header}
                        className={`py-3 px-3.5 border-r border-slate-300 last:border-r-0 whitespace-nowrap ${
                          c.align === 'right' ? 'text-right' : c.align === 'center' ? 'text-center' : 'text-left'
                        }`}
                      >
                        {c.header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="text-slate-700">
                  {rows.length === 0 ? (
                    <tr>
                      <td colSpan={columns.length + 1} className="py-12 text-center text-slate-400 border-b border-slate-200">
                        {emptyMessage}
                      </td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => (
                      <tr key={rowKey(row, idx)} className="hover:bg-slate-50/90 transition-colors border-b border-slate-200 last:border-b-0">
                        <td className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50/60 whitespace-nowrap">
                          {idx + 1}
                        </td>
                        {columns.map((c) => {
                          const isCodeOrId = c.header.toLowerCase().includes('#') || c.header.toLowerCase().includes('code') || c.header.toLowerCase().includes('id');
                          return (
                            <td
                              key={c.header}
                              className={`py-2.5 px-3.5 border-r border-slate-200 last:border-r-0 whitespace-nowrap ${
                                c.align === 'right'
                                  ? 'text-right font-mono'
                                  : c.align === 'center'
                                  ? 'text-center'
                                  : isCodeOrId
                                  ? 'font-semibold text-[#08775A]'
                                  : ''
                              }`}
                            >
                              {renderCell ? renderCell(c, row) : c.cell(row)}
                            </td>
                          );
                        })}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
