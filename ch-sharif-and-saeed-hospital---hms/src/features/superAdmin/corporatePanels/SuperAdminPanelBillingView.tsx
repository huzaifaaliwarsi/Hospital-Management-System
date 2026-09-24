import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Building2,
  Wallet,
  ClipboardList,
  FileSpreadsheet,
  History,
  Search,
  RefreshCw,
  Plus,
  Eye,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  FileText,
  ShieldCheck,
  CreditCard,
  User,
  X,
} from 'lucide-react';
import { Select } from '../../../components/forms/FormControls';
import { EmptyState, LoadingState, ErrorState } from '../../../components/common/StateViews';
import { formatPKR } from '../../../utils/formatters';
import { useAuth } from '../../../context/AuthContext';
import { fetchCorporatePanels, getActiveCorporatePanels, CorporatePanel } from '../../../services/panelService';
import {
  fetchPanelStatement,
  fetchPanelRemittances,
  fetchPanelLedger,
  PanelStatement,
  PanelRemittanceRecord,
  PanelLedger,
} from '../../../services/panelBillingService';
import { fetchInvoices, InvoiceSummary } from '../../../services/invoiceService';
import {
  downloadTablePDF,
  downloadTableExcel,
  downloadTableCSV,
  printTable,
  ExportColumn,
  ExportRequest,
} from '../../../services/tableExportService';
import { ExportButtonGroup } from '../financeControl/ExportButtonGroup';
import { InvoiceDetailModal } from '../../frontDesk/billing/InvoiceDetailModal';
import { PanelVerificationPanel } from '../../frontDesk/panelBilling/PanelVerificationPanel';
import { PanelInterimStatementSection } from '../../frontDesk/panelBilling/PanelInterimStatementSection';
import { PanelRemittanceHistorySection } from '../../frontDesk/panelBilling/PanelRemittanceHistorySection';
import { PanelLedgerSection } from '../../frontDesk/panelBilling/PanelLedgerSection';
import { RecordPanelRemittanceModal } from '../../frontDesk/panelBilling/RecordPanelRemittanceModal';

type ActiveTab = 'invoices' | 'ledger' | 'statement' | 'remittances' | 'verification';
type InvoiceStatusFilter = 'all' | 'pending' | 'settled';

export const SuperAdminPanelBillingView: React.FC = () => {
  const { user } = useAuth();
  const [panels, setPanels] = useState<CorporatePanel[]>(() => getActiveCorporatePanels());
  const [isLoadingPanels, setIsLoadingPanels] = useState(true);
  const [selectedPanelId, setSelectedPanelId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<ActiveTab>('invoices');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<InvoiceStatusFilter>('pending');

  const [ledger, setLedger] = useState<PanelLedger | null>(null);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  const [statement, setStatement] = useState<PanelStatement | null>(null);
  const [isStatementLoading, setIsStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState<string | null>(null);

  const [remittances, setRemittances] = useState<PanelRemittanceRecord[]>([]);
  const [isRemittancesLoading, setIsRemittancesLoading] = useState(false);
  const [remittancesError, setRemittancesError] = useState<string | null>(null);

  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [isInvoicesLoading, setIsInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [invoiceSearch, setInvoiceSearch] = useState('');

  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);
  const [isRecordRemittanceOpen, setIsRecordRemittanceOpen] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const loadPanels = useCallback(async () => {
    setIsLoadingPanels(true);
    try {
      const data = await fetchCorporatePanels();
      const active = data.filter((p) => p.status === 'Active');
      setPanels(active);
      if (active.length > 0 && !selectedPanelId) setSelectedPanelId(active[0].id);
    } catch (err: any) {
      console.error('Failed to load corporate panels:', err);
    } finally {
      setIsLoadingPanels(false);
    }
  }, [selectedPanelId]);

  useEffect(() => { loadPanels(); }, [loadPanels]);

  const currentPanel = useMemo(
    () => panels.find((p) => p.id === selectedPanelId) || (panels.length > 0 ? panels[0] : null),
    [panels, selectedPanelId]
  );

  const loadLedger = useCallback(async (id: string) => {
    if (!id) { setLedger(null); return; }
    setIsLedgerLoading(true); setLedgerError(null);
    try { setLedger(await fetchPanelLedger(id)); }
    catch (e: any) { setLedgerError(e?.message || 'Failed to load ledger.'); }
    finally { setIsLedgerLoading(false); }
  }, []);

  const loadStatement = useCallback(async (id: string) => {
    if (!id) { setStatement(null); return; }
    setIsStatementLoading(true); setStatementError(null);
    try { setStatement(await fetchPanelStatement(id)); }
    catch (e: any) { setStatementError(e?.message || 'Failed to load statement.'); }
    finally { setIsStatementLoading(false); }
  }, []);

  const loadRemittances = useCallback(async (id: string) => {
    if (!id) { setRemittances([]); return; }
    setIsRemittancesLoading(true); setRemittancesError(null);
    try { setRemittances(await fetchPanelRemittances(id)); }
    catch (e: any) { setRemittancesError(e?.message || 'Failed to load remittances.'); }
    finally { setIsRemittancesLoading(false); }
  }, []);

  const loadInvoices = useCallback(async (panelId?: string) => {
    setIsInvoicesLoading(true); setInvoicesError(null);
    try { setInvoices(await fetchInvoices({ isPanel: 'true', corporatePanelId: panelId || undefined })); }
    catch (e: any) { setInvoicesError(e?.message || 'Failed to load invoices.'); }
    finally { setIsInvoicesLoading(false); }
  }, []);

  useEffect(() => {
    if (selectedPanelId) {
      loadLedger(selectedPanelId);
      loadStatement(selectedPanelId);
      loadRemittances(selectedPanelId);
      loadInvoices(selectedPanelId);
    } else if (panels.length > 0) {
      setSelectedPanelId(panels[0].id);
    }
  }, [selectedPanelId, panels, loadLedger, loadStatement, loadRemittances, loadInvoices]);

  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await loadPanels();
      if (selectedPanelId) {
        await Promise.all([
          loadLedger(selectedPanelId), loadStatement(selectedPanelId),
          loadRemittances(selectedPanelId), loadInvoices(selectedPanelId),
        ]);
      }
    } finally { setIsRefreshing(false); }
  };

  const totalBilled     = statement?.consolidated?.panelReceivable ?? invoices.reduce((s, i) => s + (i.panelReceivable || 0), 0);
  const totalPaid       = statement?.consolidated?.panelReceivableRealized ?? remittances.reduce((s, r) => s + (r.amount || 0), 0);
  const companyOwes     = statement?.consolidated?.panelReceivableOutstanding ?? Math.max(0, totalBilled - totalPaid);
  const patientCopayDue = statement?.consolidated?.patientShareOutstanding ?? invoices.reduce((s, i) => s + (i.balanceDue || 0), 0);

  const unpaidInvoices = useMemo(
    () => invoices.filter((inv) => inv.status !== 'PAID' && (inv.panelReceivable || 0) > 0),
    [invoices]
  );

  const settledInvoices = useMemo(
    () => invoices.filter((inv) => inv.status === 'PAID'),
    [invoices]
  );

  const displayedInvoices = useMemo(() => {
    let list = invoices;
    if (invoiceStatusFilter === 'pending') {
      list = unpaidInvoices;
    } else if (invoiceStatusFilter === 'settled') {
      list = settledInvoices;
    }

    if (!invoiceSearch.trim()) return list;
    const q = invoiceSearch.toLowerCase();
    return list.filter((inv) =>
      inv.patientName.toLowerCase().includes(q) ||
      (inv.patientMr || '').toLowerCase().includes(q) ||
      (inv.panelMemberId || '').toLowerCase().includes(q) ||
      inv.invoiceNumber.toLowerCase().includes(q) ||
      (inv.departmentName || '').toLowerCase().includes(q)
    );
  }, [invoices, unpaidInvoices, settledInvoices, invoiceStatusFilter, invoiceSearch]);

  const outstandingInvoicesForRemittance = useMemo(
    () => (statement?.invoices || []).filter((inv) => inv.panelReceivableOutstanding > 0),
    [statement]
  );

  const isLoading = isInvoicesLoading || isStatementLoading;

  // Export Columns definition
  const exportColumns: ExportColumn<InvoiceSummary>[] = [
    { header: 'Invoice #', cell: (r) => r.invoiceNumber },
    { header: 'Date', cell: (r) => r.createdAt },
    { header: 'Patient', cell: (r) => `${r.patientName} (${r.patientMr})` },
    { header: 'Member ID', cell: (r) => r.panelMemberId || '—' },
    { header: 'Department', cell: (r) => r.departmentName || '—' },
    { header: 'Total Bill', align: 'right', cell: (r) => formatPKR(r.total), excelValue: (r) => r.total },
    { header: 'Company Share', align: 'right', cell: (r) => formatPKR(r.panelReceivable || 0), excelValue: (r) => r.panelReceivable || 0 },
    { header: 'Received', align: 'right', cell: (r) => formatPKR(r.paidTotal || 0), excelValue: (r) => r.paidTotal || 0 },
    {
      header: 'Still Owes',
      align: 'right',
      cell: (r) => formatPKR(Math.max(0, (r.panelReceivable || 0) - (r.paidTotal || 0))),
      excelValue: (r) => Math.max(0, (r.panelReceivable || 0) - (r.paidTotal || 0)),
    },
    { header: 'Status', cell: (r) => r.status },
  ];

  const handleExport = (type: 'excel' | 'csv' | 'pdf' | 'print') => {
    const req: ExportRequest<InvoiceSummary> = {
      documentTitle: `Panel Credit Invoices — ${currentPanel?.name || 'Company'}`,
      documentSubtitle: `Corporate Credit Account Statement & Invoices Register (${currentPanel?.code || ''})`,
      filenamePrefix: `Panel_Billing_${currentPanel?.code || 'Company'}`,
      columns: exportColumns,
      rows: displayedInvoices,
      currentUser: user,
      periodLabel: `${displayedInvoices.length} invoices`,
      filters: [
        `Company: ${currentPanel?.name || ''}`,
        `Filter: ${invoiceStatusFilter === 'pending' ? 'Pending Invoices' : invoiceStatusFilter === 'settled' ? 'Settled Invoices' : 'All Invoices'}`,
      ],
    };
    if (type === 'excel') downloadTableExcel(req);
    else if (type === 'csv') downloadTableCSV(req);
    else if (type === 'pdf') downloadTablePDF(req);
    else if (type === 'print') printTable(req);
  };

  const TABS: { id: ActiveTab; label: string; icon: React.ElementType; badge?: string | number }[] = [
    {
      id: 'invoices',
      label: 'Credit Invoices',
      icon: FileText,
      badge: unpaidInvoices.length > 0 ? `${unpaidInvoices.length} pending` : `${invoices.length}`,
    },
    { id: 'ledger', label: 'Company Ledger', icon: TrendingUp },
    { id: 'statement', label: 'Interim Statement', icon: FileSpreadsheet },
    { id: 'remittances', label: 'Payment Remittances', icon: History, badge: remittances.length > 0 ? remittances.length : undefined },
    { id: 'verification', label: 'Contract Rules', icon: ShieldCheck },
  ];

  return (
    <div className="space-y-4 animate-in fade-in duration-150 pb-12">
      {/* Top Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Panel Billing & Receivables</h1>
          <p className="text-xs text-slate-500 mt-0.5">Corporate credit accounts, patient co-pay and remittance settlements</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#08775A]' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>
          {currentPanel && (
            <button
              type="button"
              onClick={() => setIsRecordRemittanceOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-bold shadow-2xs cursor-pointer transition-all"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>Record Payment Received</span>
            </button>
          )}
        </div>
      </div>

      {/* Company Selector Toolbar */}
      {panels.length === 0 && !isLoadingPanels ? (
        <EmptyState
          title="No Active Corporate Panels"
          description="Add a corporate panel first from Panel Management > Corporate Panels."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-3.5 shadow-2xs">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="flex-1 max-w-md">
              <label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Select Corporate Panel / Insurance Company
              </label>
              <Select
                options={panels.map((p) => ({ label: `${p.name} (${p.code})`, value: p.id }))}
                value={selectedPanelId}
                onChange={(e) => setSelectedPanelId(e.target.value)}
              />
            </div>
            {currentPanel && (
              <div className="flex flex-wrap items-center gap-2 md:pt-4">
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  <span className="text-slate-400 font-normal">Category:</span>
                  <strong className="text-slate-800">{currentPanel.category || 'Corporate'}</strong>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-emerald-50 text-emerald-800 border border-emerald-200">
                  <span className="text-emerald-600/80 font-normal">Credit Limit:</span>
                  <strong className="text-[#08775A]">
                    {currentPanel.creditLimit ? formatPKR(currentPanel.creditLimit) : 'No Limit'}
                  </strong>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-700 border border-slate-200">
                  <span className="text-slate-400 font-normal">Terms:</span>
                  <strong className="text-slate-800">{currentPanel.billingTerms || '30 Days Net'}</strong>
                </span>
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-800 border border-blue-200">
                  <span className="text-blue-600/80 font-normal">Active Invoices:</span>
                  <strong className="text-blue-900">{invoices.length}</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Content Area */}
      {isLoading ? (
        <div className="bg-white rounded-xl border border-slate-200 p-12 text-center shadow-2xs">
          <LoadingState message="Loading corporate panel financial data..." />
        </div>
      ) : (
        <>
          {/* 4 Professional Financial KPI Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* Card 1: Company Outstanding */}
            <div className={`rounded-xl border p-4 shadow-2xs flex flex-col justify-between transition-all ${
              companyOwes > 0
                ? 'bg-rose-50/70 border-rose-200'
                : 'bg-emerald-50/70 border-emerald-200'
            }`}>
              <div className="flex items-center justify-between">
                <span className={`text-[11px] font-bold uppercase tracking-wider ${
                  companyOwes > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}>
                  Company Outstanding
                </span>
                <div className={`p-1.5 rounded-lg ${
                  companyOwes > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                }`}>
                  <Building2 className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <div className={`text-2xl font-black ${
                  companyOwes > 0 ? 'text-rose-700' : 'text-emerald-700'
                }`}>
                  {formatPKR(companyOwes)}
                </div>
                <div className="mt-1 flex items-center gap-1.5">
                  <span className={`inline-block w-2 h-2 rounded-full ${companyOwes > 0 ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                  <span className={`text-[11px] font-medium ${companyOwes > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                    {companyOwes > 0 ? 'Pending collection from company' : 'All credit settled'}
                  </span>
                </div>
              </div>
            </div>

            {/* Card 2: Total Billed */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Total Billed (Credit)
                </span>
                <div className="p-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-100">
                  <FileSpreadsheet className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="text-2xl font-black text-slate-900">{formatPKR(totalBilled)}</div>
                <div className="mt-1 text-[11px] text-slate-500 font-medium">
                  {invoices.length} invoice(s) on credit
                </div>
              </div>
            </div>

            {/* Card 3: Total Received */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Received from Company
                </span>
                <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <Wallet className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <div className="text-2xl font-black text-emerald-700">{formatPKR(totalPaid)}</div>
                <div className="mt-1 text-[11px] text-slate-500 font-medium">
                  {remittances.length} remittance settlement(s)
                </div>
              </div>
            </div>

            {/* Card 4: Patient Co-Pay Outstanding */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-2xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                  Patient Co-Pay Outstanding
                </span>
                <div className={`p-1.5 rounded-lg ${
                  patientCopayDue > 0 ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-slate-50 text-slate-600 border border-slate-200'
                }`}>
                  <AlertCircle className="h-4 w-4" />
                </div>
              </div>
              <div className="mt-2.5">
                <div className={`text-2xl font-black ${patientCopayDue > 0 ? 'text-amber-700' : 'text-slate-800'}`}>
                  {formatPKR(patientCopayDue)}
                </div>
                <div className="mt-1 text-[11px] text-slate-500 font-medium">
                  Direct patient share (non-panel)
                </div>
              </div>
            </div>
          </div>

          {/* Navigation Tabs Bar */}
          <div className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto pt-2">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`px-3.5 py-2.5 text-xs font-semibold rounded-t-lg border-b-2 flex items-center gap-2 whitespace-nowrap cursor-pointer transition-all ${
                    active
                      ? 'border-[#08775A] text-[#08775A] bg-emerald-50/50 font-bold'
                      : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                  }`}
                >
                  <Icon className={`h-4 w-4 ${active ? 'text-[#08775A]' : 'text-slate-400'}`} />
                  <span>{t.label}</span>
                  {t.badge && (
                    <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                      active ? 'bg-[#08775A] text-white' : 'bg-slate-200 text-slate-700'
                    }`}>
                      {t.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* TAB 1: Invoices Register Table */}
          {activeTab === 'invoices' && (
            <div className="space-y-3">
              {/* Dark Forest Green Brand Banner */}
              <div className="bg-gradient-to-r from-[#064e3b] via-[#08775A] to-[#0f766e] rounded-t-xl px-5 py-3.5 flex items-center justify-between shadow-2xs flex-wrap gap-2">
                <div className="flex items-center gap-2.5 font-bold text-sm tracking-wide text-white">
                  <div className="h-6 w-6 rounded bg-white/15 text-white flex items-center justify-center">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <span>Company Credit Invoices — {currentPanel?.name || 'Selected Panel'}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-emerald-100 font-medium bg-white/10 px-2.5 py-0.5 rounded-md">
                    {displayedInvoices.length} invoice(s) listed
                  </span>
                </div>
              </div>

              {/* Table Toolbar & Export Actions */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-b-xl border border-slate-200 -mt-3 shadow-2xs">
                {/* Status Filter Buttons */}
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setInvoiceStatusFilter('pending')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      invoiceStatusFilter === 'pending'
                        ? 'bg-rose-100 text-rose-800 border border-rose-300'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    Pending ({unpaidInvoices.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceStatusFilter('all')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      invoiceStatusFilter === 'all'
                        ? 'bg-slate-800 text-white'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    All ({invoices.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setInvoiceStatusFilter('settled')}
                    className={`px-3 py-1.5 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      invoiceStatusFilter === 'settled'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  >
                    Settled ({settledInvoices.length})
                  </button>

                  {/* Search box */}
                  <div className="relative ml-1">
                    <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      placeholder="Search patient, MR#, invoice..."
                      value={invoiceSearch}
                      onChange={(e) => setInvoiceSearch(e.target.value)}
                      className="pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-md bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#08775A] w-52"
                    />
                    {invoiceSearch && (
                      <button
                        type="button"
                        onClick={() => setInvoiceSearch('')}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Export Buttons */}
                <ExportButtonGroup
                  disabled={displayedInvoices.length === 0}
                  onExcel={() => handleExport('excel')}
                  onCsv={() => handleExport('csv')}
                  onPdf={() => handleExport('pdf')}
                  onPrint={() => handleExport('print')}
                />
              </div>

              {/* Complete Professional Bordered Grid Table */}
              <div className="bg-white rounded-lg border border-slate-300 shadow-2xs overflow-hidden">
                <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-320px)]">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead>
                      <tr className="bg-[#f1f5f9] border-b border-slate-300 sticky top-0 z-10 text-slate-800 text-[11.5px] font-bold uppercase tracking-wider">
                        <th className="w-12 py-3 px-3 text-center border-r border-slate-300 font-bold text-slate-700">#</th>
                        <th className="py-3 px-3.5 border-r border-slate-300 whitespace-nowrap">Date</th>
                        <th className="py-3 px-3.5 border-r border-slate-300 whitespace-nowrap">Invoice #</th>
                        <th className="py-3 px-3.5 border-r border-slate-300 whitespace-nowrap">Patient</th>
                        <th className="py-3 px-3.5 border-r border-slate-300 whitespace-nowrap">Member ID</th>
                        <th className="py-3 px-3.5 border-r border-slate-300 whitespace-nowrap">Department</th>
                        <th className="py-3 px-3.5 border-r border-slate-300 text-right whitespace-nowrap">Total Bill</th>
                        <th className="py-3 px-3.5 border-r border-slate-300 text-right whitespace-nowrap">Company Share</th>
                        <th className="py-3 px-3.5 border-r border-slate-300 text-right whitespace-nowrap">Received</th>
                        <th className="py-3 px-3.5 border-r border-slate-300 text-right whitespace-nowrap">Still Owes</th>
                        <th className="py-3 px-3.5 border-r border-slate-300 text-center whitespace-nowrap">Status</th>
                        <th className="py-3 px-3.5 text-center whitespace-nowrap">Action</th>
                      </tr>
                    </thead>
                    <tbody className="text-slate-700 divide-y divide-slate-200">
                      {displayedInvoices.length === 0 ? (
                        <tr>
                          <td colSpan={12} className="py-12 text-center text-slate-400">
                            <CheckCircle2 className="h-9 w-9 text-emerald-400 mx-auto mb-2" />
                            <p className="font-bold text-slate-700 text-sm">
                              {invoiceSearch ? 'No matching invoices found' : 'No invoices in this status!'}
                            </p>
                            <p className="text-xs text-slate-400 mt-1">
                              {invoiceSearch ? 'Try a different search query.' : 'All invoices have been settled or no records match.'}
                            </p>
                          </td>
                        </tr>
                      ) : (
                        displayedInvoices.map((inv, idx) => {
                          const outstanding = Math.max(0, (inv.panelReceivable || 0) - (inv.paidTotal || 0));
                          return (
                            <tr key={inv.id} className="hover:bg-slate-50/90 transition-colors">
                              {/* Row # */}
                              <td className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50/60 whitespace-nowrap">
                                {String(idx + 1).padStart(2, '0')}
                              </td>

                              {/* Date */}
                              <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap text-slate-600 text-[11px]">
                                {inv.createdAt}
                              </td>

                              {/* Clickable Invoice # */}
                              <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap font-bold text-[#08775A]">
                                <button
                                  type="button"
                                  onClick={() => setSelectedInvoiceId(inv.id)}
                                  className="hover:underline hover:text-[#065f46] transition-colors cursor-pointer text-left"
                                  title="Click to view full invoice bill"
                                >
                                  {inv.invoiceNumber}
                                </button>
                              </td>

                              {/* Patient */}
                              <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap">
                                <div className="font-semibold text-slate-900">{inv.patientName}</div>
                                <div className="text-[11px] text-slate-400 font-mono">MR: {inv.patientMr}</div>
                              </td>

                              {/* Member ID */}
                              <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap">
                                {inv.panelMemberId ? (
                                  <span className="font-mono text-xs text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                    {inv.panelMemberId}
                                  </span>
                                ) : (
                                  <span className="text-slate-400">—</span>
                                )}
                              </td>

                              {/* Department */}
                              <td className="py-2.5 px-3.5 border-r border-slate-200 whitespace-nowrap text-slate-600">
                                {inv.departmentName || '—'}
                              </td>

                              {/* Gross Total */}
                              <td className="py-2.5 px-3.5 border-r border-slate-200 text-right font-mono text-slate-600 whitespace-nowrap">
                                {formatPKR(inv.total)}
                              </td>

                              {/* Company Share */}
                              <td className="py-2.5 px-3.5 border-r border-slate-200 text-right font-mono font-semibold text-slate-800 whitespace-nowrap">
                                {formatPKR(inv.panelReceivable || 0)}
                              </td>

                              {/* Received */}
                              <td className="py-2.5 px-3.5 border-r border-slate-200 text-right font-mono text-emerald-700 whitespace-nowrap">
                                {formatPKR(inv.paidTotal || 0)}
                              </td>

                              {/* Still Owes */}
                              <td className={`py-2.5 px-3.5 border-r border-slate-200 text-right font-mono font-bold whitespace-nowrap ${
                                outstanding > 0 ? 'text-rose-700' : 'text-slate-700'
                              }`}>
                                {formatPKR(outstanding)}
                              </td>

                              {/* Status Badge */}
                              <td className="py-2.5 px-3.5 border-r border-slate-200 text-center whitespace-nowrap">
                                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  inv.status === 'PAID'
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-300'
                                    : inv.status === 'PARTIALLY_PAID'
                                    ? 'bg-amber-100 text-amber-800 border border-amber-300'
                                    : 'bg-rose-100 text-rose-800 border border-rose-300'
                                }`}>
                                  {inv.status === 'PARTIALLY_PAID' ? 'PARTIAL' : inv.status}
                                </span>
                              </td>

                              {/* Action Button */}
                              <td className="py-2.5 px-3.5 text-center whitespace-nowrap">
                                <button
                                  type="button"
                                  onClick={() => setSelectedInvoiceId(inv.id)}
                                  className="inline-flex items-center gap-1 px-3 py-1 bg-[#08775A] hover:bg-[#065f46] text-white rounded text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
                                  title="View full invoice details, rates and print receipt"
                                >
                                  <Eye className="h-3.5 w-3.5" />
                                  <span>View</span>
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>

                    {/* Table Summary Footer */}
                    {displayedInvoices.length > 0 && (
                      <tfoot>
                        <tr className="bg-slate-100 font-bold text-slate-800 border-t-2 border-slate-300">
                          <td colSpan={6} className="py-2.5 px-3.5 text-right uppercase text-[11px] tracking-wider text-slate-600">
                            Total Summary ({displayedInvoices.length} Invoices):
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900">
                            {formatPKR(displayedInvoices.reduce((s, i) => s + (i.total || 0), 0))}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900">
                            {formatPKR(displayedInvoices.reduce((s, i) => s + (i.panelReceivable || 0), 0))}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono font-bold text-emerald-700">
                            {formatPKR(displayedInvoices.reduce((s, i) => s + (i.paidTotal || 0), 0))}
                          </td>
                          <td className="py-2.5 px-3.5 text-right font-mono font-bold text-rose-700">
                            {formatPKR(displayedInvoices.reduce((s, i) => s + Math.max(0, (i.panelReceivable || 0) - (i.paidTotal || 0)), 0))}
                          </td>
                          <td colSpan={2}></td>
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Company Ledger */}
          {activeTab === 'ledger' && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <PanelLedgerSection
                ledger={ledger}
                isLoading={isLedgerLoading}
                loadError={ledgerError}
                onRetry={() => selectedPanelId && loadLedger(selectedPanelId)}
              />
            </div>
          )}

          {/* TAB 3: Interim Statement */}
          {activeTab === 'statement' && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <PanelInterimStatementSection
                statement={statement}
                isLoading={isStatementLoading}
                loadError={statementError}
                onRetry={() => selectedPanelId && loadStatement(selectedPanelId)}
              />
            </div>
          )}

          {/* TAB 4: Remittances History */}
          {activeTab === 'remittances' && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                <div>
                  <h3 className="text-sm font-bold text-slate-800">Bulk Payments & Remittance History</h3>
                  <p className="text-xs text-slate-500">All bulk payments and settlements received from {currentPanel?.name || 'company'}.</p>
                </div>
                {currentPanel && (
                  <button
                    type="button"
                    onClick={() => setIsRecordRemittanceOpen(true)}
                    className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold cursor-pointer shadow-2xs transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>Record New Payment</span>
                  </button>
                )}
              </div>
              <PanelRemittanceHistorySection
                remittances={remittances}
                isLoading={isRemittancesLoading}
                loadError={remittancesError}
                onRetry={() => selectedPanelId && loadRemittances(selectedPanelId)}
              />
            </div>
          )}

          {/* TAB 5: Contract Verification */}
          {activeTab === 'verification' && currentPanel && (
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-2xs">
              <PanelVerificationPanel panel={currentPanel} />
            </div>
          )}
        </>
      )}

      {/* Record Remittance Payment Modal */}
      {isRecordRemittanceOpen && currentPanel && (
        <RecordPanelRemittanceModal
          corporatePanelId={currentPanel.id}
          corporatePanelName={currentPanel.name}
          outstandingInvoices={outstandingInvoicesForRemittance}
          onClose={() => setIsRecordRemittanceOpen(false)}
          onRecorded={() => {
            setIsRecordRemittanceOpen(false);
            if (selectedPanelId) {
              loadLedger(selectedPanelId);
              loadStatement(selectedPanelId);
              loadRemittances(selectedPanelId);
              loadInvoices(selectedPanelId);
            }
          }}
        />
      )}

      {/* Full Hospital Invoice Modal with services, rates, receipts & print */}
      {selectedInvoiceId && (
        <InvoiceDetailModal
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
          onChanged={() => {
            if (selectedPanelId) {
              loadLedger(selectedPanelId);
              loadStatement(selectedPanelId);
              loadInvoices(selectedPanelId);
            }
          }}
        />
      )}
    </div>
  );
};
