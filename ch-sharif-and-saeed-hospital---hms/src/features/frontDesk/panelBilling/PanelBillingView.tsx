import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Wallet, ClipboardList, FileSpreadsheet, History } from 'lucide-react';
import { Select } from '../../../components/forms/FormControls';
import { EmptyState } from '../../../components/common/StateViews';
import { formatPKR } from '../../../utils/formatters';
import { getActiveCorporatePanels } from '../../../services/panelService';
import { fetchPanelStatement, fetchPanelRemittances, PanelStatement, PanelRemittanceRecord } from '../../../services/panelBillingService';
import { PanelVerificationPanel } from './PanelVerificationPanel';
import { PanelInterimStatementSection } from './PanelInterimStatementSection';
import { PanelRemittanceHistorySection } from './PanelRemittanceHistorySection';
import { RecordPanelRemittanceModal } from './RecordPanelRemittanceModal';

type Tab = 'verification' | 'statement' | 'remittances';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'verification', label: 'Verification & Contract Resolution', icon: ClipboardList },
  { id: 'statement', label: 'Interim Statement', icon: FileSpreadsheet },
  { id: 'remittances', label: 'Remittances', icon: History },
];

/**
 * Panel Billing (HMS_V7.2_NEW_REQUIREMENTS.md §2.5/§3.3) — the Front Desk
 * portal's last remaining nav item. Panel Verification, Contract
 * Resolution, Panel Interim Statement and Panel Remittance, consolidated
 * onto one page with tabs behind a single Corporate Panel selector — same
 * multi-nav-item-to-one-page consolidation `HospitalInvoicesView` already
 * uses for `hospital_invoices`/`payments_receipts`/`discounts`/`refunds`.
 */
export const PanelBillingView: React.FC = () => {
  const panels = useMemo(() => getActiveCorporatePanels(), []);
  const [corporatePanelId, setCorporatePanelId] = useState(panels[0]?.id ?? '');
  const [tab, setTab] = useState<Tab>('verification');

  const [statement, setStatement] = useState<PanelStatement | null>(null);
  const [isStatementLoading, setIsStatementLoading] = useState(true);
  const [statementError, setStatementError] = useState<string | null>(null);

  const [remittances, setRemittances] = useState<PanelRemittanceRecord[]>([]);
  const [isRemittancesLoading, setIsRemittancesLoading] = useState(true);
  const [remittancesError, setRemittancesError] = useState<string | null>(null);

  const [isRecordOpen, setIsRecordOpen] = useState(false);

  const selectedPanel = panels.find((p) => p.id === corporatePanelId) || null;

  const loadStatement = async (panelId: string) => {
    setIsStatementLoading(true);
    setStatementError(null);
    try {
      setStatement(await fetchPanelStatement(panelId));
    } catch (err: any) {
      setStatementError(err?.message || 'Failed to load panel statement.');
    } finally {
      setIsStatementLoading(false);
    }
  };

  const loadRemittances = async (panelId: string) => {
    setIsRemittancesLoading(true);
    setRemittancesError(null);
    try {
      setRemittances(await fetchPanelRemittances(panelId));
    } catch (err: any) {
      setRemittancesError(err?.message || 'Failed to load remittance history.');
    } finally {
      setIsRemittancesLoading(false);
    }
  };

  useEffect(() => {
    if (!corporatePanelId) return;
    loadStatement(corporatePanelId);
    loadRemittances(corporatePanelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [corporatePanelId]);

  const outstandingInvoices = useMemo(
    () => (statement?.invoices || []).filter((inv) => inv.panelReceivableOutstanding > 0),
    [statement],
  );

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Panel Billing</h1>
            <p className="text-xs text-slate-500 mt-0.5">
              Panel Verification, Contract Resolution, Interim Statement and Remittance — per corporate panel.
            </p>
          </div>
        </div>
        {selectedPanel && (
          <button
            type="button"
            onClick={() => setIsRecordOpen(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 bg-[#08775A] hover:bg-[#065f46] text-white rounded-lg text-xs font-semibold shadow-xs"
          >
            <Wallet className="h-3.5 w-3.5" /> Record Remittance
          </button>
        )}
      </div>

      {panels.length === 0 ? (
        <EmptyState
          title="No active corporate panels"
          description="Add a Corporate Panel from Hospital Management before Panel Billing can be used."
        />
      ) : (
        <>
          <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
            <Select
              label="Corporate Panel"
              options={panels.map((p) => ({ label: `${p.name} (${p.code})`, value: p.id }))}
              value={corporatePanelId}
              onChange={(e) => setCorporatePanelId(e.target.value)}
              className="max-w-sm"
            />
          </div>

          {selectedPanel && statement && !isStatementLoading && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { label: 'Active Patients', value: statement.activePatientsCount, color: 'text-slate-700 bg-slate-100' },
                { label: 'Panel Receivable', value: formatPKR(statement.consolidated.panelReceivable), color: 'text-purple-700 bg-purple-50' },
                { label: 'Realized', value: formatPKR(statement.consolidated.panelReceivableRealized), color: 'text-emerald-700 bg-emerald-50' },
                { label: 'Outstanding', value: formatPKR(statement.consolidated.panelReceivableOutstanding), color: 'text-amber-700 bg-amber-50' },
              ].map((k) => (
                <div key={k.label} className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
                  <p className={`inline-flex px-2 py-0.5 rounded text-[10px] font-bold ${k.color}`}>{k.label}</p>
                  <p className="text-lg font-bold text-slate-900 mt-1.5">{k.value}</p>
                </div>
              ))}
            </div>
          )}

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs">
            <div className="flex border-b border-slate-200 overflow-x-auto">
              {TABS.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={`inline-flex items-center gap-1.5 px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                    tab === t.id ? 'border-[#08775A] text-[#08775A]' : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <t.icon className="h-3.5 w-3.5" /> {t.label}
                </button>
              ))}
            </div>
            <div className="p-4">
              {!selectedPanel ? (
                <EmptyState title="Select a panel" description="Choose a Corporate Panel above to continue." />
              ) : tab === 'verification' ? (
                <PanelVerificationPanel panel={selectedPanel} />
              ) : tab === 'statement' ? (
                <PanelInterimStatementSection
                  statement={statement}
                  isLoading={isStatementLoading}
                  loadError={statementError}
                  onRetry={() => loadStatement(corporatePanelId)}
                />
              ) : (
                <PanelRemittanceHistorySection
                  remittances={remittances}
                  isLoading={isRemittancesLoading}
                  loadError={remittancesError}
                  onRetry={() => loadRemittances(corporatePanelId)}
                />
              )}
            </div>
          </div>
        </>
      )}

      {isRecordOpen && selectedPanel && (
        <RecordPanelRemittanceModal
          corporatePanelId={selectedPanel.id}
          corporatePanelName={selectedPanel.name}
          outstandingInvoices={outstandingInvoices}
          onClose={() => setIsRecordOpen(false)}
          onRecorded={() => {
            setIsRecordOpen(false);
            loadStatement(corporatePanelId);
            loadRemittances(corporatePanelId);
          }}
        />
      )}
    </div>
  );
};
