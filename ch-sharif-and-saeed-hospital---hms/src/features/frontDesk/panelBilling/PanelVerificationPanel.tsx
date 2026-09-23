import React, { useMemo, useState } from 'react';
import { Search, ShieldCheck, ShieldAlert, Loader2, AlertCircle, Calculator } from 'lucide-react';
import { Select } from '../../../components/forms/FormControls';
import { formatPKR } from '../../../utils/formatters';
import { getAllPatients } from '../../../services/patientRegistryService';
import { ServiceRatesService } from '../../../services/serviceRatesService';
import { CorporatePanel } from '../../../services/panelService';
import {
  verifyPanelPatient,
  resolveContract,
  PanelMembershipVerification,
  ContractResolution,
} from '../../../services/panelBillingService';

interface PanelVerificationPanelProps {
  panel: CorporatePanel;
}

const SOURCE_LABEL: Record<ContractResolution['source'], string> = {
  COVERAGE: 'Configured coverage rule',
  LEGACY_DISCOUNT: 'Legacy flat discount',
  NOT_COVERED: 'Not covered — patient pays in full',
};

/**
 * Panel Verification + Contract Resolution (HMS_V7.2_NEW_REQUIREMENTS.md
 * §2.5/§3.3) — confirm a panel patient's active membership, then preview
 * Contract Amount / Patient Share / Panel Receivable for a chosen service
 * before it's ever posted to an invoice.
 */
export const PanelVerificationPanel: React.FC<PanelVerificationPanelProps> = ({ panel }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);

  const [verification, setVerification] = useState<PanelMembershipVerification | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);

  const [serviceRateId, setServiceRateId] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [contract, setContract] = useState<ContractResolution | null>(null);
  const [isResolving, setIsResolving] = useState(false);
  const [resolveError, setResolveError] = useState<string | null>(null);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.trim().toLowerCase();
    return getAllPatients()
      .filter((p) => p.payerType === 'Corporate / Panel' && p.panelId === panel.id)
      .filter((p) => p.fullName.toLowerCase().includes(q) || p.mrNumber.toLowerCase().includes(q) || p.primaryPhone.includes(q))
      .slice(0, 8);
  }, [searchTerm, panel.id]);

  const services = useMemo(() => ServiceRatesService.getServices().filter((s) => s.status === 'Active'), []);

  const handleSelectPatient = async (patientId: string) => {
    setSelectedPatientId(patientId);
    setSearchTerm('');
    setContract(null);
    setServiceRateId('');
    setIsVerifying(true);
    setVerifyError(null);
    try {
      setVerification(await verifyPanelPatient(patientId));
    } catch (err: any) {
      setVerifyError(err?.message || 'Failed to verify membership.');
      setVerification(null);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResolve = async (nextServiceRateId: string, nextQuantity: number) => {
    if (!selectedPatientId || !nextServiceRateId) {
      setContract(null);
      return;
    }
    setIsResolving(true);
    setResolveError(null);
    try {
      setContract(await resolveContract({ panelPatientId: selectedPatientId, serviceRateId: nextServiceRateId, quantity: nextQuantity }));
    } catch (err: any) {
      setResolveError(err?.message || 'Failed to resolve contract.');
      setContract(null);
    } finally {
      setIsResolving(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#08775A]">1. Panel Verification</h3>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder={`Search ${panel.name}'s patients by name, MRN or phone…`}
            className="w-full text-xs pl-8.5 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#149E75]"
          />
        </div>
        {searchResults.length > 0 && (
          <div className="border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-56 overflow-y-auto">
            {searchResults.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSelectPatient(p.id)}
                className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs flex items-center justify-between"
              >
                <div>
                  <span className="font-semibold text-slate-900">{p.fullName}</span>
                  <span className="text-slate-400 ml-2">
                    {p.mrNumber} • {p.primaryPhone}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400">{p.panelMemberId || 'no member ID'}</span>
              </button>
            ))}
          </div>
        )}

        {isVerifying ? (
          <div className="p-3 flex items-center gap-2 text-slate-400 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Verifying membership…
          </div>
        ) : verifyError ? (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" /> {verifyError}
          </div>
        ) : verification ? (
          <div
            className={`p-3 rounded-lg border flex items-start justify-between gap-3 ${
              verification.membershipActive ? 'bg-[#effaf5] border-[#c2e7db]' : 'bg-rose-50 border-rose-200'
            }`}
          >
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-slate-900 text-sm">{verification.panelPatient.fullName}</span>
                {verification.membershipActive ? (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-emerald-100 text-emerald-800">
                    <ShieldCheck className="h-3 w-3" /> Active Membership
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold bg-rose-100 text-rose-800">
                    <ShieldAlert className="h-3 w-3" /> Inactive
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500">
                {verification.panelPatient.mrNumber} • {verification.corporatePanel.organizationName} (
                {verification.panelPatient.panelMemberId || 'no member ID'})
              </span>
              <p className="text-[11px] text-slate-500">{verification.panelPatient.membershipStatus || 'ACTIVE'} ? Valid from {verification.panelPatient.membershipValidFrom?.slice(0, 10) || 'not specified'} through {verification.panelPatient.membershipValidTo?.slice(0, 10) || 'not specified'}</p>
              {verification.reasons.length > 0 && (
                <ul className="mt-1.5 space-y-0.5">
                  {verification.reasons.map((r) => (
                    <li key={r} className="text-[11px] text-rose-700 font-medium">
                      • {r}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        ) : null}
      </div>

      {verification?.membershipActive && (
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#08775A] flex items-center gap-1.5">
            <Calculator className="h-3.5 w-3.5" /> 2. Contract Resolution
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Select
              label="Service"
              className="sm:col-span-2"
              placeholder="Choose a service…"
              options={services.map((s) => ({ label: `${s.name} — ${formatPKR(s.standardRate)}`, value: s.id }))}
              value={serviceRateId}
              onChange={(e) => {
                setServiceRateId(e.target.value);
                handleResolve(e.target.value, quantity);
              }}
            />
            <Select
              label="Quantity"
              options={[1, 2, 3, 4, 5].map((n) => ({ label: String(n), value: String(n) }))}
              value={String(quantity)}
              onChange={(e) => {
                const q = Number(e.target.value);
                setQuantity(q);
                handleResolve(serviceRateId, q);
              }}
            />
          </div>

          {isResolving ? (
            <div className="p-3 flex items-center gap-2 text-slate-400 text-xs">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Resolving contract…
            </div>
          ) : resolveError ? (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" /> {resolveError}
            </div>
          ) : contract ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200"><span className="text-[10px] text-slate-500 uppercase block">Standard Gross</span><span className="font-bold">{formatPKR(contract.grossAmount)}</span></div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200"><span className="text-[10px] text-slate-500 uppercase block">Contract Adjustment</span><span className="font-bold">{formatPKR(contract.discountAmount)}</span><span className="block text-slate-500">{contract.matchedScope ?? 'No matching rule'}</span></div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Contract Amount</span>
                <span className="font-bold text-slate-800">{formatPKR(contract.contractAmount)}</span>
              </div>
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-[10px] text-amber-700 uppercase block">Patient Share</span>
                <span className="font-bold text-amber-800">{formatPKR(contract.patientShare)}</span>
              </div>
              <div className="p-2.5 bg-purple-50 rounded-lg border border-purple-200">
                <span className="text-[10px] text-purple-700 uppercase block">Panel Receivable</span>
                <span className="font-bold text-purple-800">{formatPKR(contract.panelReceivable)}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Basis</span>
                <span className="font-semibold text-slate-700 text-[11px]">{SOURCE_LABEL[contract.source]}</span>
              </div>
              {contract.preauthorizationRequired && (
                <div className="col-span-2 sm:col-span-4 p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-[11px] text-amber-800 font-medium">
                  ⚠ Preauthorization required by this panel's contract before service is rendered.
                </div>
              )}
              {contract.capAmount != null && (
                <div className="col-span-2 sm:col-span-4 text-[11px] text-slate-500">
                  Coverage capped at {formatPKR(contract.capAmount)} per the panel's discount rule.
                </div>
              )}
            </div>
          ) : (
            <p className="text-[11px] text-slate-400">Choose a service above to preview the contract split.</p>
          )}
        </div>
      )}
    </div>
  );
};
