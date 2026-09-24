import React, { useEffect, useState, useCallback } from 'react';
import { FileSpreadsheet, Loader2, AlertCircle, Eye, Banknote, CreditCard, RotateCcw, ShieldCheck } from 'lucide-react';
import { Toggle } from '../../../components/forms/FormControls';
import { Modal } from '../../../components/common/Modal';
import { formatPKR, formatDateTimeDDMMYYYY } from '../../../utils/formatters';
import { useAuth } from '../../../context/AuthContext';
import { downloadTablePDF, downloadTableExcel, downloadTableCSV, printTable, ExportColumn } from '../../../services/tableExportService';
import {
  fetchBalanceSheets,
  fetchUserBalanceSheetDetail,
  fetchFinanceKpis,
  DatePreset,
  UserBalanceSheetRow,
  FinanceKpis,
} from '../../../services/financeControlService';
import { FinanceDateFilterBar, todayISO } from './FinanceDateFilterBar';
import { FinanceKpiStrip } from './FinanceKpiStrip';
import { ExportButtonGroup } from './ExportButtonGroup';

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: 'Super Admin',
  ADMIN: 'Admin',
  FRONT_DESK_BILLING: 'Front Desk',
  INVENTORY_MANAGEMENT: 'Inventory',
};

const EXPORT_COLUMNS: ExportColumn<UserBalanceSheetRow>[] = [
  { header: 'User', cell: (r) => r.user?.fullName || 'Staff User' },
  { header: 'Username', cell: (r) => r.user?.username ? `@${r.user.username}` : '—' },
  { header: 'Role', cell: (r) => ROLE_LABEL[r.user?.role] || r.user?.role || 'Staff' },
  { header: 'Expected Cash', align: 'right', cell: (r) => formatPKR(r.expectedPhysicalCash), excelValue: (r) => r.expectedPhysicalCash },
  { header: 'Carried Forward', align: 'right', cell: (r) => formatPKR(r.carriedForwardAmount), excelValue: (r) => r.carriedForwardAmount },
  { header: 'Non-Cash Total', align: 'right', cell: (r) => formatPKR(r.nonPhysicalTotal), excelValue: (r) => r.nonPhysicalTotal },
  { header: 'Collections', align: 'right', cell: (r) => formatPKR(r.totalCollections), excelValue: (r) => r.totalCollections },
  { header: 'Refunds', align: 'right', cell: (r) => formatPKR(r.totalRefunds), excelValue: (r) => r.totalRefunds },
  { header: 'Unsettled Txns', align: 'right', cell: (r) => String(r.unsettledCount), excelValue: (r) => r.unsettledCount },
];

/**
 * Finance Control — Balance Sheets (Guide §6.1). Admin / Super Admin
 * oversight of every cash-handling user's live position for the selected
 * period — replaces the old mock-data placeholder that used to render here
 * for `moduleId === 'balance_sheets'`.
 */
export const FinanceControlBalanceSheetsView: React.FC = () => {
  const { currentUser } = useAuth();
  const [preset, setPreset] = useState<DatePreset>('today');
  const [fromDate, setFromDate] = useState(todayISO());
  const [toDate, setToDate] = useState(todayISO());
  const [onlyUnsettled, setOnlyUnsettled] = useState(false);

  const [sheets, setSheets] = useState<UserBalanceSheetRow[]>([]);
  const [periodLabel, setPeriodLabel] = useState('');
  const [kpis, setKpis] = useState<FinanceKpis | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [detailUser, setDetailUser] = useState<UserBalanceSheetRow | null>(null);
  const [detailData, setDetailData] = useState<any | null>(null);
  const [isDetailLoading, setIsDetailLoading] = useState(false);

  const range = { preset, fromDate: preset === 'custom' ? fromDate : undefined, toDate: preset === 'custom' ? toDate : undefined };

  const load = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [sheetsResult, kpiResult] = await Promise.all([fetchBalanceSheets(range, onlyUnsettled), fetchFinanceKpis(range)]);
      setSheets(sheetsResult.sheets);
      setPeriodLabel(sheetsResult.period.label);
      setKpis(kpiResult);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load balance sheets.');
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset, preset === 'custom' ? fromDate : null, preset === 'custom' ? toDate : null, onlyUnsettled]);

  useEffect(() => {
    load();
  }, [load]);

  const openDetail = async (row: UserBalanceSheetRow) => {
    setDetailUser(row);
    setIsDetailLoading(true);
    try {
      const data = await fetchUserBalanceSheetDetail(row.portalUserId);
      setDetailData(data);
    } catch {
      setDetailData(null);
    } finally {
      setIsDetailLoading(false);
    }
  };

  const exportContext = {
    documentTitle: 'Balance Sheets',
    documentSubtitle: 'Finance Control — Hospital-Wide Cash Custody Oversight',
    filenamePrefix: 'Balance_Sheets',
    columns: EXPORT_COLUMNS,
    rows: sheets,
    currentUser,
    periodLabel,
    filters: onlyUnsettled ? ['Unsettled only'] : undefined,
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
            <FileSpreadsheet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Balance Sheets</h1>
            <p className="text-xs text-slate-500 mt-0.5">Every cash-handling user's live custody position — hospital-wide oversight, not a patient-revenue report.</p>
          </div>
        </div>
        <ExportButtonGroup
          disabled={sheets.length === 0}
          onPrint={() => printTable(exportContext)}
          onPdf={() => downloadTablePDF(exportContext)}
          onExcel={() => downloadTableExcel(exportContext)}
          onCsv={() => downloadTableCSV(exportContext)}
        />
      </div>

      <FinanceDateFilterBar preset={preset} onPresetChange={setPreset} fromDate={fromDate} toDate={toDate} onFromDateChange={setFromDate} onToDateChange={setToDate} onRefresh={load}>
        <Toggle label="Unsettled only" checked={onlyUnsettled} onChange={setOnlyUnsettled} />
      </FinanceDateFilterBar>

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
          <span className="text-xs">Loading balance sheets…</span>
        </div>
      ) : (
        <>
          {kpis && <FinanceKpiStrip kpis={kpis} />}
          <p className="text-[11px] text-slate-400 -mb-2">{periodLabel}</p>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-280px)] min-h-[300px]">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="sticky top-0 z-10 bg-slate-50/95 shadow-2xs">
                  <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-4 whitespace-nowrap">User</th>
                    <th className="py-2.5 px-4 whitespace-nowrap">Role</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">Expected Cash</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">Carried Fwd</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">Non-Cash Total</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">Collections</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">Refunds</th>
                    <th className="py-2.5 px-4 text-center whitespace-nowrap">Unsettled</th>
                    <th className="py-2.5 px-4 text-right whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {sheets.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400">
                        No cash activity for this period.
                      </td>
                    </tr>
                  ) : (
                    sheets.map((s) => (
                      <tr key={s.portalUserId} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <div className="font-bold text-slate-900 whitespace-nowrap">{s.user?.fullName || 'Staff User'}</div>
                          <div className="text-[11px] text-slate-400 font-mono whitespace-nowrap">@{s.user?.username || 'staff'}</div>
                        </td>
                        <td className="py-2.5 px-4 whitespace-nowrap">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200 whitespace-nowrap">
                            {ROLE_LABEL[s.user?.role] || s.user?.role || 'Staff'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900 whitespace-nowrap">{formatPKR(s.expectedPhysicalCash)}</td>
                        <td className={`py-2.5 px-4 text-right font-mono whitespace-nowrap ${s.carriedForwardAmount > 0 ? 'text-amber-700 font-semibold' : 'text-slate-400'}`}>
                          {s.carriedForwardAmount > 0 ? formatPKR(s.carriedForwardAmount) : '—'}
                        </td>
                        <td className="py-2.5 px-4 text-right font-mono text-slate-700 whitespace-nowrap">{formatPKR(s.nonPhysicalTotal)}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-emerald-700 whitespace-nowrap">{formatPKR(s.totalCollections)}</td>
                        <td className="py-2.5 px-4 text-right font-mono text-rose-700 whitespace-nowrap">{formatPKR(s.totalRefunds)}</td>
                        <td className="py-2.5 px-4 text-center whitespace-nowrap">
                          {s.unsettledCount > 0 || s.carriedForwardAmount > 0 ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200 whitespace-nowrap">
                              {s.unsettledCount > 0 ? `${s.unsettledCount} pending` : 'Carry-fwd due'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 whitespace-nowrap">All settled</span>
                          )}
                        </td>
                        <td className="py-2.5 px-4 text-right whitespace-nowrap">
                          <button type="button" onClick={() => openDetail(s)} className="inline-flex items-center gap-1 p-1.5 hover:bg-slate-100 rounded-lg text-slate-500 hover:text-[#08775A]" title="View transactions">
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <Modal
        isOpen={!!detailUser}
        onClose={() => {
          setDetailUser(null);
          setDetailData(null);
        }}
        title={detailUser ? `${detailUser.user?.fullName || 'Staff'}'s Balance Sheet` : ''}
        subtitle="Live unsettled transactions for this user — the same rows their next Account Settlement will cover."
        maxWidth="2xl"
      >
        {isDetailLoading ? (
          <div className="flex items-center justify-center py-10 gap-2 text-slate-400 text-xs">
            <Loader2 className="h-4 w-4 animate-spin" /> Loading…
          </div>
        ) : detailData ? (
          <div className="space-y-3">
            <div className="grid grid-cols-3 gap-2.5">
              <div className="p-2.5 bg-[#effaf5] rounded-lg border border-[#c2e7db]">
                <span className="text-[10px] text-[#0e7d5a] font-medium block">Expected Cash</span>
                <span className="text-sm font-bold text-[#0e7d5a] font-mono">{formatPKR(Number(detailData.summary?.expectedPhysicalCash ?? 0))}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 font-medium block">Non-Cash</span>
                <span className="text-sm font-bold text-slate-900 font-mono">{formatPKR(Number(detailData.summary?.nonPhysicalTotal ?? 0))}</span>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-[10px] text-amber-700 font-medium block">Unsettled</span>
                <span className="text-sm font-bold text-amber-900 font-mono">{detailData.summary?.unsettledCount ?? 0}</span>
              </div>
            </div>
            <div className="border border-slate-200 rounded-lg overflow-hidden">
              <table className="w-full text-left text-[11px] border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="py-2 px-3 font-semibold">Receipt</th>
                    <th className="py-2 px-3 font-semibold">Category</th>
                    <th className="py-2 px-3 font-semibold text-right">Amount</th>
                    <th className="py-2 px-3 font-semibold text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {(detailData.transactions || []).length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-6 text-center text-slate-400">
                        Nothing unsettled.
                      </td>
                    </tr>
                  ) : (
                    (detailData.transactions || []).map((t: any) => (
                      <tr key={t.id}>
                        <td className="py-2 px-3 font-mono font-bold text-emerald-800">{t.receiptNumber || '—'}</td>
                        <td className="py-2 px-3">
                          <span className="inline-flex items-center gap-1">
                            {t.isPhysicalCash ? <Banknote className="h-3 w-3 text-slate-400" /> : <CreditCard className="h-3 w-3 text-slate-400" />}
                            {t.category}
                          </span>
                        </td>
                        <td className={`py-2 px-3 text-right font-mono font-bold ${t.direction === 'IN' ? 'text-emerald-700' : 'text-rose-700'}`}>
                          {t.direction === 'IN' ? '+' : '-'}
                          {formatPKR(Number(t.amount ?? 0))}
                        </td>
                        <td className="py-2 px-3 text-right text-slate-500 font-mono">{formatDateTimeDDMMYYYY(t.occurredAt)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <p className="text-[10.5px] text-slate-400 flex items-center gap-1">
              <ShieldCheck className="h-3 w-3" /> Ownership stays with {detailUser?.user.fullName} — viewing this never reassigns the collection.
            </p>
          </div>
        ) : (
          <div className="flex items-center gap-2 text-rose-600 text-xs py-6 justify-center">
            <RotateCcw className="h-4 w-4" /> Failed to load transactions.
          </div>
        )}
      </Modal>
    </div>
  );
};
