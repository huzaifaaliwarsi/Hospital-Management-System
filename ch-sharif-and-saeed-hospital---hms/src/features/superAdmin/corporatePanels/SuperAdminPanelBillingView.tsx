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
  ChevronDown,
  ChevronUp,
  User,
} from 'lucide-react';
import { Select } from '../../../components/forms/FormControls';
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

type DetailTab = 'ledger' | 'statement' | 'remittances' | 'verification';

export const SuperAdminPanelBillingView: React.FC = () => {
  const [panels, setPanels] = useState<CorporatePanel[]>(() => getActiveCorporatePanels());
  const [isLoadingPanels, setIsLoadingPanels] = useState(true);
  const [selectedPanelId, setSelectedPanelId] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);
  const [activeDetailTab, setActiveDetailTab] = useState<DetailTab>('ledger');

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

  const filteredUnpaid = useMemo(() => {
    if (!invoiceSearch.trim()) return unpaidInvoices;
    const q = invoiceSearch.toLowerCase();
    return unpaidInvoices.filter((inv) =>
      inv.patientName.toLowerCase().includes(q) ||
      (inv.patientMr || '').toLowerCase().includes(q) ||
      (inv.panelMemberId || '').toLowerCase().includes(q) ||
      inv.invoiceNumber.toLowerCase().includes(q)
    );
  }, [unpaidInvoices, invoiceSearch]);

  const outstandingInvoicesForRemittance = useMemo(
    () => (statement?.invoices || []).filter((inv) => inv.panelReceivableOutstanding > 0),
    [statement]
  );

  const isLoading = isInvoicesLoading || isStatementLoading;

  return (
    <div className="space-y-5 animate-in fade-in duration-150 pb-12">

      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Panel Billing</h1>
          <p className="text-xs text-slate-500 mt-0.5">Company credit accounts — who owes what</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleRefreshAll}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold cursor-pointer transition-colors shadow-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? 'animate-spin text-[#08775A]' : 'text-slate-500'}`} />
            Refresh
          </button>
          {currentPanel && (
            <button
              type="button"
              onClick={() => setIsRecordRemittanceOpen(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-bold shadow-sm cursor-pointer transition-all"
            >
              <Wallet className="h-3.5 w-3.5" />
              Record Payment Received
            </button>
          )}
        </div>
      </div>

      {/* Company Selector */}
      {panels.length === 0 && !isLoadingPanels ? (
        <EmptyState
          title="No Active Corporate Panels"
          description="Add a corporate panel first from Panel Management > Corporate Panels."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <label className="block text-xs font-bold text-slate-500 uppercase tracking-wide mb-1.5">
            Select Company
          </label>
          <Select
            options={panels.map((p) => ({ label: `${p.name}  (${p.code})`, value: p.id }))}
            value={selectedPanelId}
            onChange={(e) => setSelectedPanelId(e.target.value)}
          />
          {currentPanel && (
            <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-slate-500">
              <span>Category: <strong className="text-slate-800">{currentPanel.category || 'Corporate'}</strong></span>
              <span>Credit Limit: <strong className="text-[#08775A]">{currentPanel.creditLimit ? formatPKR(currentPanel.creditLimit) : 'No Limit'}</strong></span>
              <span>Terms: <strong className="text-slate-800">{currentPanel.billingTerms || '30 Days Net'}</strong></span>
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      {isLoading ? (
        <LoadingState message="Loading billing data..." />
      ) : (
        <>
          {/* Big Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Company Owes — PRIMARY */}
            <div className={`rounded-2xl p-5 border-2 flex flex-col gap-2 ${
              companyOwes > 0 ? 'bg-rose-50 border-rose-300' : 'bg-emerald-50 border-emerald-300'
            }`}>
              <div className="flex items-center gap-2">
                <Building2 className={`h-5 w-5 ${companyOwes > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
                <span className={`text-xs font-bold uppercase tracking-wide ${companyOwes > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  {currentPanel?.name || 'Company'} Owes Hospital
                </span>
              </div>
              <div className={`text-4xl font-black ${companyOwes > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                {formatPKR(companyOwes)}
              </div>
              {companyOwes === 0 ? (
                <span className="text-xs font-semibold text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> All settled — no outstanding balance
                </span>
              ) : (
                <span className="text-xs text-rose-600 font-medium">Payment pending from company</span>
              )}
            </div>

            {/* Total Billed */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-1 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Billed to Company</span>
              <div className="text-2xl font-black text-slate-800">{formatPKR(totalBilled)}</div>
              <span className="text-[11px] text-slate-400">{invoices.length} invoice(s) on credit</span>
            </div>

            {/* Total Received */}
            <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col gap-1 shadow-xs">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Total Received from Company</span>
              <div className="text-2xl font-black text-emerald-700">{formatPKR(totalPaid)}</div>
              <span className="text-[11px] text-slate-400">{remittances.length} payment(s) recorded</span>
            </div>
          </div>

          {/* Patient Co-Pay Alert */}
          {patientCopayDue > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-amber-600 shrink-0" />
              <div className="flex-1">
                <span className="text-sm font-bold text-amber-800">Patient Co-Pay Outstanding: {formatPKR(patientCopayDue)}</span>
                <span className="block text-xs text-amber-700 mt-0.5">
                  These are amounts patients owe directly — separate from what the company owes.
                </span>
              </div>
            </div>
          )}

          {/* Per-Patient Outstanding List */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="flex items-center justify-between p-4 border-b border-slate-100 flex-wrap gap-3">
              <div>
                <h2 className="text-sm font-bold text-slate-900">
                  Which Patients' Bills Are Pending?
                  {unpaidInvoices.length > 0 && (
                    <span className="ml-2 px-2 py-0.5 bg-rose-100 text-rose-700 rounded text-[11px] font-bold border border-rose-200">
                      {unpaidInvoices.length} pending
                    </span>
                  )}
                </h2>
                <p className="text-xs text-slate-500 mt-0.5">
                  Company credit invoices not yet fully settled
                </p>
              </div>
              <div className="relative">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search patient, MR#, invoice..."
                  value={invoiceSearch}
                  onChange={(e) => setInvoiceSearch(e.target.value)}
                  className="pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg bg-slate-50 focus:outline-none focus:ring-1 focus:ring-[#08775A] w-52"
                />
              </div>
            </div>

            {isInvoicesLoading ? (
              <div className="p-6"><LoadingState message="Loading..." /></div>
            ) : invoicesError ? (
              <div className="p-6"><ErrorState message={invoicesError} onRetry={() => loadInvoices(selectedPanelId)} /></div>
            ) : filteredUnpaid.length === 0 ? (
              <div className="p-8 text-center">
                <CheckCircle2 className="h-10 w-10 text-emerald-400 mx-auto mb-2" />
                <p className="text-sm font-bold text-slate-700">
                  {invoiceSearch ? 'No matching invoices found' : 'No pending invoices!'}
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  {invoiceSearch ? 'Try a different search.' : 'All company-billed invoices have been fully settled.'}
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100">
                {filteredUnpaid.map((inv) => {
                  const outstanding = Math.max(0, (inv.panelReceivable || 0) - (inv.paidTotal || 0));
                  return (
                    <div key={inv.id} className="flex items-center justify-between px-4 py-3 hover:bg-slate-50/60 transition-colors gap-3 flex-wrap">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="h-8 w-8 rounded-full bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0">
                          <User className="h-4 w-4 text-slate-500" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-bold text-slate-900 truncate">{inv.patientName}</div>
                          <div className="text-[11px] text-slate-400 font-mono">
                            MR: {inv.patientMr}
                            {inv.panelMemberId && <span className="ml-2">Member: {inv.panelMemberId}</span>}
                          </div>
                        </div>
                      </div>

                      <div className="text-xs text-slate-500 font-mono shrink-0">{inv.invoiceNumber}</div>

                      <div className="flex items-center gap-4 shrink-0 flex-wrap text-right">
                        <div>
                          <div className="text-[10px] text-slate-400 font-medium">Company's Bill</div>
                          <div className="text-sm font-bold text-slate-700">{formatPKR(inv.panelReceivable)}</div>
                        </div>
                        <div>
                          <div className="text-[10px] text-slate-400 font-medium">Received</div>
                          <div className="text-sm font-bold text-emerald-600">{formatPKR(inv.paidTotal)}</div>
                        </div>
                        <div className="bg-rose-50 border border-rose-200 rounded-lg px-3 py-1.5">
                          <div className="text-[10px] text-rose-600 font-bold uppercase">Still Owes</div>
                          <div className="text-sm font-black text-rose-700">{formatPKR(outstanding)}</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          inv.status === 'PARTIALLY_PAID'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-rose-50 text-rose-700 border border-rose-200'
                        }`}>
                          {inv.status === 'PARTIALLY_PAID' ? 'Partial' : 'Unpaid'}
                        </span>
                        <button
                          type="button"
                          onClick={() => setSelectedInvoiceId(inv.id)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#08775A] hover:bg-emerald-50 transition-colors cursor-pointer"
                          title="View Invoice"
                        >
                          <Eye className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Advanced Details — Collapsible */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setShowDetails((v) => !v)}
              className="w-full flex items-center justify-between px-5 py-3.5 text-left hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-slate-400" />
                <span className="text-sm font-bold text-slate-700">Advanced Details</span>
                <span className="text-xs text-slate-400">(Ledger, Statement, Remittances, Contract Testing)</span>
              </div>
              {showDetails ? <ChevronUp className="h-4 w-4 text-slate-400" /> : <ChevronDown className="h-4 w-4 text-slate-400" />}
            </button>

            {showDetails && (
              <div className="border-t border-slate-100">
                <div className="flex items-center gap-1 px-4 pt-3 border-b border-slate-100 overflow-x-auto">
                  {([
                    { id: 'ledger' as DetailTab, label: 'Company Ledger', icon: TrendingUp },
                    { id: 'statement' as DetailTab, label: 'Interim Statement', icon: FileSpreadsheet },
                    { id: 'remittances' as DetailTab, label: 'Payments Received', icon: History },
                    { id: 'verification' as DetailTab, label: 'Contract Testing', icon: ClipboardList },
                  ]).map((t) => {
                    const Icon = t.icon;
                    const active = activeDetailTab === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setActiveDetailTab(t.id)}
                        className={`px-3 py-2 text-xs font-semibold rounded-t border-b-2 flex items-center gap-1.5 whitespace-nowrap cursor-pointer transition-all ${
                          active ? 'border-[#08775A] text-[#08775A]' : 'border-transparent text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {t.label}
                      </button>
                    );
                  })}
                </div>

                <div className="p-5">
                  {activeDetailTab === 'ledger' && (
                    <PanelLedgerSection
                      ledger={ledger}
                      isLoading={isLedgerLoading}
                      loadError={ledgerError}
                      onRetry={() => selectedPanelId && loadLedger(selectedPanelId)}
                    />
                  )}
                  {activeDetailTab === 'statement' && (
                    <PanelInterimStatementSection
                      statement={statement}
                      isLoading={isStatementLoading}
                      loadError={statementError}
                      onRetry={() => selectedPanelId && loadStatement(selectedPanelId)}
                    />
                  )}
                  {activeDetailTab === 'remittances' && (
                    <>
                      <div className="flex items-center justify-between mb-4">
                        <p className="text-xs text-slate-500">All bulk payments received from the company.</p>
                        {currentPanel && (
                          <button
                            type="button"
                            onClick={() => setIsRecordRemittanceOpen(true)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold cursor-pointer shadow-xs"
                          >
                            <Plus className="h-3.5 w-3.5" />
                            New Payment Record
                          </button>
                        )}
                      </div>
                      <PanelRemittanceHistorySection
                        remittances={remittances}
                        isLoading={isRemittancesLoading}
                        loadError={remittancesError}
                        onRetry={() => selectedPanelId && loadRemittances(selectedPanelId)}
                      />
                    </>
                  )}
                  {activeDetailTab === 'verification' && currentPanel && (
                    <PanelVerificationPanel panel={currentPanel} />
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Modals */}
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
