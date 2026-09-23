import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Building2,
  Wallet,
  ClipboardList,
  FileSpreadsheet,
  History,
  Receipt,
  Search,
  RefreshCw,
  Plus,
  Eye,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
  CreditCard,
  Printer,
  Calendar,
  Filter,
} from 'lucide-react';
import { Select, TextInput } from '../../../components/forms/FormControls';
import { EmptyState, LoadingState, ErrorState } from '../../../components/common/StateViews';
import { formatPKR } from '../../../utils/formatters';
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
import { InvoiceDetailModal } from '../../frontDesk/billing/InvoiceDetailModal';
import { PanelVerificationPanel } from '../../frontDesk/panelBilling/PanelVerificationPanel';
import { PanelInterimStatementSection } from '../../frontDesk/panelBilling/PanelInterimStatementSection';
import { PanelRemittanceHistorySection } from '../../frontDesk/panelBilling/PanelRemittanceHistorySection';
import { PanelLedgerSection } from '../../frontDesk/panelBilling/PanelLedgerSection';
import { RecordPanelRemittanceModal } from '../../frontDesk/panelBilling/RecordPanelRemittanceModal';
import { PanelBadge } from '../../../components/common/PanelBadge';

type SuperAdminTab = 'ledger' | 'statement' | 'invoices' | 'remittances' | 'verification';

const TABS: { id: SuperAdminTab; label: string; icon: React.ElementType; desc: string }[] = [
  { id: 'ledger', label: 'Company Ledger', icon: TrendingUp, desc: 'Running-balance statement: charges vs. remittances, patient co-pay kept separate' },
  { id: 'statement', label: 'Interim Statement & Claims', icon: FileSpreadsheet, desc: 'Per-panel receivable & patient co-pay statement' },
  { id: 'invoices', label: 'All Panel Invoices Ledger', icon: Receipt, desc: 'Real DB invoices with corporate credit & co-pay' },
  { id: 'remittances', label: 'Panel Remittances & Receipts', icon: History, desc: 'Incoming company payments & department allocations' },
  { id: 'verification', label: 'Contract & Coverage Testing', icon: ClipboardList, desc: 'Verify patient cards & contract tariff coverage' },
];

export const SuperAdminPanelBillingView: React.FC = () => {
  const [panels, setPanels] = useState<CorporatePanel[]>(() => getActiveCorporatePanels());
  const [isLoadingPanels, setIsLoadingPanels] = useState(true);
  const [selectedPanelId, setSelectedPanelId] = useState<string>('');
  const [activeTab, setActiveTab] = useState<SuperAdminTab>('ledger');

  // Company Ledger State
  const [ledger, setLedger] = useState<PanelLedger | null>(null);
  const [isLedgerLoading, setIsLedgerLoading] = useState(false);
  const [ledgerError, setLedgerError] = useState<string | null>(null);

  // Statement State
  const [statement, setStatement] = useState<PanelStatement | null>(null);
  const [isStatementLoading, setIsStatementLoading] = useState(false);
  const [statementError, setStatementError] = useState<string | null>(null);

  // Remittances State
  const [remittances, setRemittances] = useState<PanelRemittanceRecord[]>([]);
  const [isRemittancesLoading, setIsRemittancesLoading] = useState(false);
  const [remittancesError, setRemittancesError] = useState<string | null>(null);

  // Panel Invoices State (Real DB Invoices)
  const [invoices, setInvoices] = useState<InvoiceSummary[]>([]);
  const [isInvoicesLoading, setIsInvoicesLoading] = useState(false);
  const [invoicesError, setInvoicesError] = useState<string | null>(null);
  const [invoiceSearchQuery, setInvoiceSearchQuery] = useState('');
  const [invoiceStatusFilter, setInvoiceStatusFilter] = useState<'ALL' | 'UNPAID' | 'PARTIALLY_PAID' | 'PAID'>('ALL');

  // Active Invoice Detail Modal
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string | null>(null);

  // Record Remittance Modal
  const [isRecordRemittanceOpen, setIsRecordRemittanceOpen] = useState(false);

  // Refresh flag for manual button
  const [isRefreshing, setIsRefreshing] = useState(false);

  // 1. Load active corporate panels from DB on mount
  const loadPanels = useCallback(async () => {
    setIsLoadingPanels(true);
    try {
      const data = await fetchCorporatePanels();
      const active = data.filter((p) => p.status === 'Active');
      setPanels(active);
      if (active.length > 0 && !selectedPanelId) {
        setSelectedPanelId(active[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load corporate panels:', err);
    } finally {
      setIsLoadingPanels(false);
    }
  }, [selectedPanelId]);

  useEffect(() => {
    loadPanels();
  }, [loadPanels]);

  // Selected Corporate Panel Object
  const currentPanel = useMemo(
    () => panels.find((p) => p.id === selectedPanelId) || (panels.length > 0 ? panels[0] : null),
    [panels, selectedPanelId]
  );

  // 2. Load Company Ledger for Selected Panel
  const loadLedger = useCallback(async (panelId: string) => {
    if (!panelId) {
      setLedger(null);
      return;
    }
    setIsLedgerLoading(true);
    setLedgerError(null);
    try {
      const led = await fetchPanelLedger(panelId);
      setLedger(led);
    } catch (err: any) {
      setLedgerError(err?.message || 'Failed to load company ledger.');
    } finally {
      setIsLedgerLoading(false);
    }
  }, []);

  // 2. Load Statement for Selected Panel
  const loadStatement = useCallback(async (panelId: string) => {
    if (!panelId) {
      setStatement(null);
      return;
    }
    setIsStatementLoading(true);
    setStatementError(null);
    try {
      const stmt = await fetchPanelStatement(panelId);
      setStatement(stmt);
    } catch (err: any) {
      setStatementError(err?.message || 'Failed to load panel statement.');
    } finally {
      setIsStatementLoading(false);
    }
  }, []);

  // 3. Load Remittances for Selected Panel
  const loadRemittances = useCallback(async (panelId: string) => {
    if (!panelId) {
      setRemittances([]);
      return;
    }
    setIsRemittancesLoading(true);
    setRemittancesError(null);
    try {
      const rems = await fetchPanelRemittances(panelId);
      setRemittances(rems);
    } catch (err: any) {
      setRemittancesError(err?.message || 'Failed to load remittance history.');
    } finally {
      setIsRemittancesLoading(false);
    }
  }, []);

  // 4. Load Real Panel Invoices across Hospital
  const loadInvoices = useCallback(async (panelId?: string) => {
    setIsInvoicesLoading(true);
    setInvoicesError(null);
    try {
      const invs = await fetchInvoices({
        isPanel: 'true',
        corporatePanelId: panelId || undefined,
      });
      setInvoices(invs);
    } catch (err: any) {
      setInvoicesError(err?.message || 'Failed to load panel invoices.');
    } finally {
      setIsInvoicesLoading(false);
    }
  }, []);

  // Sync when selected panel changes
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

  // Comprehensive Refresh
  const handleRefreshAll = async () => {
    setIsRefreshing(true);
    try {
      await loadPanels();
      if (selectedPanelId) {
        await Promise.all([
          loadLedger(selectedPanelId),
          loadStatement(selectedPanelId),
          loadRemittances(selectedPanelId),
          loadInvoices(selectedPanelId),
        ]);
      }
    } finally {
      setIsRefreshing(false);
    }
  };

  // Filtered Invoices for Invoices Tab
  const filteredInvoices = useMemo(() => {
    return invoices.filter((inv) => {
      if (invoiceStatusFilter !== 'ALL' && inv.status !== invoiceStatusFilter) {
        return false;
      }
      if (invoiceSearchQuery.trim()) {
        const q = invoiceSearchQuery.toLowerCase().trim();
        const matchesInv = inv.invoiceNumber.toLowerCase().includes(q);
        const matchesName = inv.patientName.toLowerCase().includes(q);
        const matchesMr = (inv.patientMr || '').toLowerCase().includes(q);
        const matchesMember = (inv.panelMemberId || '').toLowerCase().includes(q);
        const matchesPanel = (inv.panelName || '').toLowerCase().includes(q);
        if (!matchesInv && !matchesName && !matchesMr && !matchesMember && !matchesPanel) {
          return false;
        }
      }
      return true;
    });
  }, [invoices, invoiceStatusFilter, invoiceSearchQuery]);

  // Overall Financial Aggregates
  const metrics = useMemo(() => {
    const totalPanelReceivable = invoices.reduce((sum, inv) => sum + (inv.panelReceivable || 0), 0);
    const totalPatientShare = invoices.reduce((sum, inv) => sum + (inv.patientShare || 0), 0);
    const totalCollected = invoices.reduce((sum, inv) => sum + (inv.paidTotal || 0), 0);
    const totalOutstandingPatientShare = invoices.reduce((sum, inv) => sum + (inv.balanceDue || 0), 0);
    const totalRemittances = remittances.reduce((sum, r) => sum + (r.amount || 0), 0);
    const totalOutstandingPanelClaim = Math.max(0, totalPanelReceivable - totalRemittances);

    return {
      totalPanelReceivable,
      totalPatientShare,
      totalCollected,
      totalOutstandingPatientShare,
      totalRemittances,
      totalOutstandingPanelClaim,
      totalInvoicesCount: invoices.length,
      activePanelsCount: panels.length,
    };
  }, [invoices, remittances, panels]);

  const outstandingInvoicesForRemittance = useMemo(
    () => (statement?.invoices || []).filter((inv) => inv.panelReceivableOutstanding > 0),
    [statement]
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-150 pb-12">
      {/* Top Header Card */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-[#effaf5] text-[#08775A] border border-[#c2e7db] flex items-center justify-center shrink-0">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-xl font-bold text-slate-900">Corporate Panel Billing</h1>
              <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                Live Database
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Consolidated company credit claims, tariff contract resolution, interim statements, and incoming remittances.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#08775A]' : 'text-slate-500'}`} />
            <span>Refresh</span>
          </button>

          {currentPanel && (
            <button
              type="button"
              onClick={() => setIsRecordRemittanceOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold shadow-xs cursor-pointer transition-all"
            >
              <Wallet className="h-3.5 w-3.5" />
              <span>Record Panel Remittance</span>
            </button>
          )}
        </div>
      </div>

      {/* Financial KPIs Banner */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        {/* 1. Panel Claims Receivable (Total) */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Panel Receivable (Claims)</span>
            <Building2 className="h-4 w-4 text-purple-600" />
          </div>
          <div className="text-lg font-bold text-purple-900">
            {formatPKR(statement ? statement.consolidated.panelReceivable : metrics.totalPanelReceivable)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Credit billed to {currentPanel?.name || 'corporate panels'}
          </p>
        </div>

        {/* 2. Remittances Realized */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Remittances Realized</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="text-lg font-bold text-emerald-900">
            {formatPKR(statement ? statement.consolidated.panelReceivableRealized : metrics.totalRemittances)}
          </div>
          <p className="text-[11px] text-emerald-700 font-medium mt-0.5">
            {remittances.length} payment remittance(s) recorded
          </p>
        </div>

        {/* 3. Outstanding Panel Balance */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Outstanding Panel Balance</span>
            <AlertCircle className="h-4 w-4 text-rose-600" />
          </div>
          <div className="text-lg font-bold text-rose-900">
            {formatPKR(statement ? statement.consolidated.panelReceivableOutstanding : metrics.totalOutstandingPanelClaim)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Pending claims settlement from company
          </p>
        </div>

        {/* 4. Patient Co-Pay Outstanding */}
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 text-xs font-medium mb-1">
            <span>Patient Co-Pay Outstanding</span>
            <Wallet className="h-4 w-4 text-amber-600" />
          </div>
          <div className="text-lg font-bold text-amber-900">
            {formatPKR(statement ? statement.consolidated.patientShareOutstanding : metrics.totalOutstandingPatientShare)}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            Patient self-share remaining due
          </p>
        </div>
      </div>

      {/* Corporate Panel Selector & Details Strip */}
      {panels.length === 0 && !isLoadingPanels ? (
        <EmptyState
          title="No Active Corporate Panels Found in Database"
          description="Create a Corporate Panel from Panel Management > Corporate Panels before panel billing can be processed."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="w-full sm:max-w-md">
              <label className="block text-xs font-bold text-slate-700 uppercase tracking-wide mb-1">
                Select Corporate Panel / Organization
              </label>
              <Select
                options={panels.map((p) => ({
                  label: `${p.name} (${p.code}) — ${p.category || 'Insurance'}`,
                  value: p.id,
                }))}
                value={selectedPanelId}
                onChange={(e) => setSelectedPanelId(e.target.value)}
              />
            </div>

            {currentPanel && (
              <div className="flex items-center gap-3 text-xs bg-slate-50 px-3.5 py-2.5 rounded-lg border border-slate-200 flex-wrap">
                <div>
                  <span className="text-[10.5px] text-slate-400 uppercase block font-semibold">Category</span>
                  <span className="font-bold text-slate-800">{currentPanel.category || 'Corporate'}</span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div>
                  <span className="text-[10.5px] text-slate-400 uppercase block font-semibold">Credit Limit</span>
                  <span className="font-bold text-[#08775A]">
                    {currentPanel.creditLimit ? formatPKR(currentPanel.creditLimit) : 'No Limit'}
                  </span>
                </div>
                <div className="h-6 w-px bg-slate-200" />
                <div>
                  <span className="text-[10.5px] text-slate-400 uppercase block font-semibold">Billing Terms</span>
                  <span className="font-medium text-slate-700">{currentPanel.billingTerms || '30 Days Net'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Main Navigation Tabs */}
      <div className="border-b border-slate-200 flex items-center gap-2 overflow-x-auto pb-px">
        {TABS.map((t) => {
          const Icon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-4 py-2.5 text-xs font-bold rounded-t-lg border-b-2 flex items-center gap-2 transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'border-[#08775A] text-[#08775A] bg-emerald-50/50'
                  : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className={`h-4 w-4 ${isActive ? 'text-[#08775A]' : 'text-slate-400'}`} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab 0: Company Ledger */}
      {activeTab === 'ledger' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Company Ledger — {currentPanel?.name || 'Selected Panel'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Running balance: every panel-covered charge is a debit, every remittance a credit. Patient co-pay stays a separate total.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {ledger && ledger.entries.length > 0 && (
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5 text-slate-500" />
                  <span>Print Ledger</span>
                </button>
              )}
              {currentPanel && (
                <button
                  type="button"
                  onClick={() => setIsRecordRemittanceOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  <span>Record Company Payment</span>
                </button>
              )}
            </div>
          </div>

          <PanelLedgerSection
            ledger={ledger}
            isLoading={isLedgerLoading}
            loadError={ledgerError}
            onRetry={() => selectedPanelId && loadLedger(selectedPanelId)}
          />
        </div>
      )}

      {/* Tab 1: Interim Statement */}
      {activeTab === 'statement' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Interim Statement — {currentPanel?.name || 'Selected Panel'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Separate accounting for Patient Co-Pay vs. Company Claimable Receivables.
              </p>
            </div>
            {statement && statement.invoices.length > 0 && (
              <button
                type="button"
                onClick={() => window.print()}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
              >
                <Printer className="h-3.5 w-3.5 text-slate-500" />
                <span>Print Statement</span>
              </button>
            )}
          </div>

          <PanelInterimStatementSection
            statement={statement}
            isLoading={isStatementLoading}
            loadError={statementError}
            onRetry={() => selectedPanelId && loadStatement(selectedPanelId)}
          />
        </div>
      )}

      {/* Tab 2: Panel Invoices & Claims */}
      {activeTab === 'invoices' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">Corporate Panel Invoices</h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Every encounter and admission invoice backed by company tariff ({invoices.length} total).
              </p>
            </div>

            {/* Filter and Search Bar */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search invoice, patient, MR#, member ID…"
                  value={invoiceSearchQuery}
                  onChange={(e) => setInvoiceSearchQuery(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A] w-56 sm:w-64"
                />
              </div>

              <select
                value={invoiceStatusFilter}
                onChange={(e) => setInvoiceStatusFilter(e.target.value as any)}
                className="px-2.5 py-1.5 text-xs border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
              >
                <option value="ALL">All Statuses</option>
                <option value="UNPAID">Unpaid</option>
                <option value="PARTIALLY_PAID">Partially Paid</option>
                <option value="PAID">Fully Paid</option>
              </select>
            </div>
          </div>

          {isInvoicesLoading ? (
            <LoadingState message="Loading corporate panel invoices from database…" />
          ) : invoicesError ? (
            <ErrorState message={invoicesError} onRetry={() => loadInvoices(selectedPanelId)} />
          ) : filteredInvoices.length === 0 ? (
            <EmptyState
              title="No matching panel invoices found"
              description="Invoices billed to this corporate panel will appear here automatically."
            />
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">Invoice #</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">Date</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">Patient</th>
                    <th className="text-left px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">Panel / Member ID</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">Gross Total</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-purple-700 whitespace-nowrap">Panel Receivable</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-amber-700 whitespace-nowrap">Patient Co-Pay</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-emerald-700 whitespace-nowrap">Collected</th>
                    <th className="text-right px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">Balance Due</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">Status</th>
                    <th className="text-center px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredInvoices.map((inv) => (
                    <tr key={inv.id} className="hover:bg-slate-50/70 transition-colors">
                      <td className="px-3 py-2.5 whitespace-nowrap font-mono font-bold text-slate-800">
                        {inv.invoiceNumber}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">
                        {inv.createdAt}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="font-semibold text-slate-900">{inv.patientName}</div>
                        <div className="text-[10px] text-slate-400 font-mono">{inv.patientMr}</div>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <span className="font-semibold text-slate-800">{inv.panelName || currentPanel?.name || 'Panel'}</span>
                        {inv.panelMemberId && (
                          <span className="block text-[10.5px] font-mono text-slate-500">
                            ID: {inv.panelMemberId}
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right font-medium text-slate-700">
                        {formatPKR(inv.total)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right font-bold text-purple-700">
                        {formatPKR(inv.panelReceivable)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right font-semibold text-amber-700">
                        {formatPKR(inv.patientShare)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right font-medium text-emerald-700">
                        {formatPKR(inv.paidTotal)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-right font-bold text-slate-900">
                        {formatPKR(inv.balanceDue)}
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            inv.status === 'PAID'
                              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                              : inv.status === 'PARTIALLY_PAID'
                              ? 'bg-amber-50 text-amber-700 border border-amber-200'
                              : 'bg-rose-50 text-rose-700 border border-rose-200'
                          }`}
                        >
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-3 py-2.5 whitespace-nowrap text-center">
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceId(inv.id)}
                          className="px-2.5 py-1 text-xs font-semibold text-[#08775A] bg-emerald-50 hover:bg-emerald-100 rounded-md border border-emerald-200 inline-flex items-center gap-1 cursor-pointer transition-colors"
                        >
                          <Eye className="h-3 w-3" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Remittances & Payments History */}
      {activeTab === 'remittances' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-2 pb-3 border-b border-slate-100">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Remittances History — {currentPanel?.name || 'Selected Panel'}
              </h2>
              <p className="text-xs text-slate-500 mt-0.5">
                Bulk payments received from the company and allocated across department invoices.
              </p>
            </div>
            {currentPanel && (
              <button
                type="button"
                onClick={() => setIsRecordRemittanceOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Remittance</span>
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

      {/* Tab 4: Patient Verification & Contract Coverage Testing */}
      {activeTab === 'verification' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
          <div className="pb-3 border-b border-slate-100">
            <h2 className="text-sm font-bold text-slate-900">
              Contract Resolution &amp; Verification Testing
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Verify any panel patient's active status and test service rate coverage % and co-pay caps.
            </p>
          </div>

          {currentPanel && (
            <PanelVerificationPanel
              corporatePanelId={currentPanel.id}
              corporatePanelName={currentPanel.name}
            />
          )}
        </div>
      )}

      {/* Record Remittance Modal */}
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

      {/* Invoice Detail Modal */}
      {selectedInvoiceId && (
        <InvoiceDetailModal
          invoiceId={selectedInvoiceId}
          onClose={() => setSelectedInvoiceId(null)}
          onInvoiceUpdated={() => {
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
