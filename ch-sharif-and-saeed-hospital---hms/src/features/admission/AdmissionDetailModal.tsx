import React, { useEffect, useMemo, useState } from 'react';
import {
  Loader2,
  AlertCircle,
  User,
  Stethoscope,
  Pill,
  ArrowLeftRight,
  ShieldCheck,
  Plus,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { PanelBadge } from '../../components/common/PanelBadge';
import { Select, NumberInput, TextInput, Textarea, Toggle } from '../../components/forms/FormControls';
import { formatPKR } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';
import { DepartmentService } from '../../services/departmentService';
import { StaffUserService } from '../../services/staffUserService';
import { ServiceRatesService } from '../../services/serviceRatesService';
import { WardsRoomsBedsService } from '../../services/wardsRoomsBedsService';
import { pharmacyApiService, BackendMedicine } from '../../services/pharmacyApiService';
import {
  fetchAdmissionDetail,
  checkInAdmission,
  transferAdmissionBed,
  addAdmissionService,
  changeAdmissionMedicationMode,
  createAdmissionPharmacyRequest,
  grantAdmissionClearance,
  AdmissionDetail,
  AdmissionPharmacyRequestRecord,
  MedicationMode,
  ClearanceType,
} from '../../services/admissionService';
import { ClinicalDischargeModal } from './ClinicalDischargeModal';
import { HighCostMedicineAuthorizationModal } from './HighCostMedicineAuthorizationModal';

type Tab = 'overview' | 'services' | 'medication' | 'pharmacy' | 'bed' | 'clearances';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'services', label: 'Services & Charges', icon: Stethoscope },
  { id: 'medication', label: 'Medication Mode', icon: Pill },
  { id: 'pharmacy', label: 'Pharmacy Requests', icon: Pill },
  { id: 'bed', label: 'Bed Transfer', icon: ArrowLeftRight },
  { id: 'clearances', label: 'Clearances', icon: ShieldCheck },
];

const CLEARANCE_LABEL: Record<ClearanceType, string> = {
  CLINICAL: 'Clinical',
  HOSPITAL_BILLING: 'Hospital Billing',
  PHARMACY: 'Pharmacy',
};

interface AdmissionDetailModalProps {
  admissionId: string;
  initialTab?: Tab;
  onClose: () => void;
  onChanged?: () => void;
}

/**
 * Central action surface for an Active Admission — Services/Charges,
 * Medication Mode, Pharmacy Requests, Bed Transfer and Clearances all live
 * as tabs here (mirrors `InvoiceDetailModal`'s always-all-actions-visible
 * pattern), reused across several Admission nav items that all ultimately
 * act on one admission record.
 *
 * Clearances reflect the CURRENT backend mechanism — any portal user can
 * grant any gate. Doctor-credential re-authentication (v7.2 §2.4) is a
 * separate, not-yet-built pass; this modal doesn't pretend otherwise.
 */
export const AdmissionDetailModal: React.FC<AdmissionDetailModalProps> = ({ admissionId, initialTab = 'overview', onClose, onChanged }) => {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>(initialTab);
  const [detail, setDetail] = useState<AdmissionDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const doctors = useMemo(() => StaffUserService.getStaffUsers().filter((s) => s.staffCategory === 'Doctor' && s.status === 'ACTIVE'), []);
  const services = useMemo(() => ServiceRatesService.getServices().filter((s) => s.status === 'Active'), []);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setDetail(await fetchAdmissionDetail(admissionId));
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load admission.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [admissionId]);

  const refresh = async (message: string) => {
    toast.success(message);
    setActionError(null);
    await load();
    onChanged?.();
  };

  // ── Services & Charges ──────────────────────────────────────────────
  const [lineServiceId, setLineServiceId] = useState('');
  const [lineQty, setLineQty] = useState(1);
  const [linePerformedBy, setLinePerformedBy] = useState('');

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lineServiceId) {
      setActionError('Select a service.');
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      await addAdmissionService(admissionId, { serviceRateId: lineServiceId, quantity: lineQty, performedByStaffId: linePerformedBy || undefined });
      setLineServiceId('');
      setLineQty(1);
      setLinePerformedBy('');
      await refresh('Service line added.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to add service.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Medication Mode ──────────────────────────────────────────────────
  const [newMode, setNewMode] = useState<MedicationMode>('SELF');
  const [modeReason, setModeReason] = useState('');

  useEffect(() => {
    if (detail) setNewMode(detail.medicationMode);
  }, [detail?.medicationMode]);

  const handleChangeMode = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modeReason.trim()) {
      setActionError('Reason for medication mode change is required.');
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      await changeAdmissionMedicationMode(admissionId, { mode: newMode, reason: modeReason.trim() });
      setModeReason('');
      await refresh('Medication mode updated.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to change medication mode.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Pharmacy Requests ────────────────────────────────────────────────
  const [medicines, setMedicines] = useState<BackendMedicine[]>([]);
  const [pharmLines, setPharmLines] = useState<{ medicineId: string; requestedQuantity: number }[]>([{ medicineId: '', requestedQuantity: 1 }]);
  const [pharmNotes, setPharmNotes] = useState('');

  useEffect(() => {
    if (tab === 'pharmacy' && medicines.length === 0) {
      pharmacyApiService.getMedicines().then(setMedicines).catch(() => setMedicines([]));
    }
  }, [tab]);

  const handleCreatePharmacyRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = pharmLines.filter((l) => l.medicineId && l.requestedQuantity > 0);
    if (validLines.length === 0) {
      setActionError('Add at least one medicine with a quantity.');
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      const created = await createAdmissionPharmacyRequest(admissionId, { notes: pharmNotes.trim() || undefined, lines: validLines });
      setPharmLines([{ medicineId: '', requestedQuantity: 1 }]);
      setPharmNotes('');
      if (created.status === 'AUTHORIZATION_REQUIRED') {
        toast.success('Pharmacy request created.');
        setActionError(null);
        await load();
        onChanged?.();
        setHighCostTarget(created);
      } else {
        await refresh('Pharmacy request created.');
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to create pharmacy request.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Bed Transfer ─────────────────────────────────────────────────────
  const [targetBedId, setTargetBedId] = useState('');
  const [transferReason, setTransferReason] = useState('');
  const availableBeds = useMemo(() => WardsRoomsBedsService.getBeds().filter((b) => b.occupancyStatus === 'Available'), []);

  const handleTransferBed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetBedId) {
      setActionError('Select a target bed.');
      return;
    }
    if (!transferReason.trim()) {
      setActionError('Reason for bed transfer is required.');
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      await transferAdmissionBed(admissionId, { targetBedId, reason: transferReason.trim() });
      setTargetBedId('');
      setTransferReason('');
      await refresh('Bed transfer completed.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to transfer bed.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Clearances ───────────────────────────────────────────────────────
  const handleGrantClearance = async (clearanceType: ClearanceType) => {
    setIsSaving(true);
    setActionError(null);
    try {
      await grantAdmissionClearance(admissionId, { clearanceType });
      await refresh(`${CLEARANCE_LABEL[clearanceType]} clearance granted.`);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to grant clearance.');
    } finally {
      setIsSaving(false);
    }
  };

  const [isClinicalDischargeOpen, setIsClinicalDischargeOpen] = useState(false);
  const [highCostTarget, setHighCostTarget] = useState<AdmissionPharmacyRequestRecord | null>(null);

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={detail ? `${detail.admissionNumber} — ${detail.patientName}` : 'Admission'}
      subtitle={detail ? `${detail.departmentName} • ${detail.doctorName} • ${detail.bedLabel || 'No bed assigned'}` : undefined}
      maxWidth="4xl"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-2 text-sm">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading admission…
        </div>
      ) : loadError || !detail ? (
        <div className="text-center py-10">
          <p className="text-rose-600 text-sm">{loadError}</p>
          <button onClick={load} className="mt-2 px-3 py-1.5 bg-[#08775A] text-white text-xs rounded-lg">Retry</button>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex border-b border-slate-200 overflow-x-auto -mx-6 px-6">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors ${
                  tab === t.id ? 'border-[#08775A] text-[#08775A]' : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <t.icon className="h-3.5 w-3.5" /> {t.label}
              </button>
            ))}
          </div>

          {actionError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {actionError}
            </div>
          )}

          {tab === 'overview' && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block">Payer</span>
                  <span className="font-semibold text-slate-900 flex items-center gap-1.5">
                    {detail.payerType === 'Corporate / Panel' ? <PanelBadge /> : 'Self-Pay'}
                  </span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block">Status</span>
                  <span className="font-bold text-slate-900">{detail.status}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block">Medication Mode</span>
                  <span className="font-bold text-slate-900">{detail.medicationMode}</span>
                </div>
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <span className="text-[10px] text-slate-500 uppercase block">MR Number</span>
                  <span className="font-semibold text-slate-900">{detail.patientMrNumber}</span>
                </div>
              </div>
              {detail.diagnosis && (
                <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
                  <span className="text-[10px] text-slate-500 uppercase block mb-0.5">Diagnosis</span>
                  {detail.diagnosis}
                </div>
              )}
              <div className="text-[11px] text-slate-500">
                Expected: {detail.expectedAt || '—'} • Admitted: {detail.admittedAt || '—'} • Discharged: {detail.dischargedAt || '—'}
              </div>
            </div>
          )}

          {tab === 'services' && (
            <div className="space-y-4">
              {detail.invoices.length === 0 ? (
                <p className="text-xs text-slate-400 py-4 text-center">No department invoices posted yet.</p>
              ) : (
                detail.invoices.map((inv) => (
                  <div key={inv.id} className="border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex items-center justify-between">
                      <span className="text-[11px] font-bold text-slate-600 uppercase">{inv.departmentName} — {inv.invoiceNumber}</span>
                      <span className="text-[11px] font-semibold text-amber-700">Outstanding: {formatPKR(inv.outstanding)}</span>
                    </div>
                    <table className="w-full text-left text-xs border-collapse">
                      <tbody className="divide-y divide-slate-100">
                        {inv.lines.map((l) => (
                          <tr key={l.id}>
                            <td className="py-1.5 px-3 font-medium text-slate-900">{l.serviceName}</td>
                            <td className="py-1.5 px-3 text-right">{l.quantity}</td>
                            <td className="py-1.5 px-3 text-right font-mono font-bold">{formatPKR(l.lineNet)}</td>
                            <td className="py-1.5 px-3 text-slate-500">{l.performedByName || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ))
              )}

              {detail.status === 'ACTIVE' && (
                <form onSubmit={handleAddService} className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#08775A] flex items-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" /> Add Service / Procedure
                  </h4>
                  <Select
                    label="Service"
                    required
                    options={services.map((s) => ({ label: `${s.name} — ${formatPKR(s.standardRate)}`, value: s.id }))}
                    value={lineServiceId}
                    onChange={(e) => setLineServiceId(e.target.value)}
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput label="Quantity" min={1} value={lineQty} onChange={(e) => setLineQty(Number(e.target.value) || 1)} />
                    <Select
                      label="Performed By (optional)"
                      options={doctors.map((d) => ({ label: d.fullName, value: d.id }))}
                      value={linePerformedBy}
                      onChange={(e) => setLinePerformedBy(e.target.value)}
                    />
                  </div>
                  <div className="flex justify-end">
                    <button type="submit" disabled={isSaving} className="px-4 py-1.5 text-xs font-semibold text-white bg-[#08775A] rounded-lg disabled:opacity-60">
                      {isSaving ? 'Adding…' : 'Add Service'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {tab === 'medication' && (
            <div className="space-y-4">
              <form onSubmit={handleChangeMode} className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                <Toggle
                  label="Hospital Managed Medication"
                  hint={newMode === 'HOSPITAL_MANAGED' ? 'Medicines requested via Hospital Pharmacy' : 'Patient/attendant sources medicines (Self)'}
                  checked={newMode === 'HOSPITAL_MANAGED'}
                  onChange={(checked) => setNewMode(checked ? 'HOSPITAL_MANAGED' : 'SELF')}
                />
                <Textarea label="Reason" required rows={2} value={modeReason} onChange={(e) => setModeReason(e.target.value)} />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={isSaving || newMode === detail.medicationMode}
                    className="px-4 py-1.5 text-xs font-semibold text-white bg-[#08775A] rounded-lg disabled:opacity-60"
                  >
                    {isSaving ? 'Saving…' : 'Update Mode'}
                  </button>
                </div>
              </form>

              {detail.medicationModeHistory.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 uppercase">History</div>
                  <table className="w-full text-left text-xs border-collapse">
                    <tbody className="divide-y divide-slate-100">
                      {detail.medicationModeHistory.map((h) => (
                        <tr key={h.id}>
                          <td className="py-1.5 px-3">{h.previousMode} → <strong>{h.newMode}</strong></td>
                          <td className="py-1.5 px-3 text-slate-500">{h.reason}</td>
                          <td className="py-1.5 px-3 text-slate-400 text-right whitespace-nowrap">{h.changedAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'pharmacy' && (
            <div className="space-y-4">
              {detail.medicationMode !== 'HOSPITAL_MANAGED' ? (
                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-2.5">
                  Pharmacy requests are only permitted when Medication Mode is Hospital Managed. Switch mode in the Medication Mode tab first.
                </p>
              ) : (
                <form onSubmit={handleCreatePharmacyRequest} className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#08775A]">New Medicine Request</h4>
                  {pharmLines.map((line, idx) => (
                    <div key={idx} className="grid grid-cols-3 gap-2 items-end">
                      <Select
                        label={idx === 0 ? 'Medicine' : undefined}
                        className="col-span-2"
                        placeholder="Choose medicine…"
                        options={medicines.map((m) => ({ label: `${m.name} (${m.code})`, value: m.id }))}
                        value={line.medicineId}
                        onChange={(e) => {
                          const next = [...pharmLines];
                          next[idx] = { ...next[idx], medicineId: e.target.value };
                          setPharmLines(next);
                        }}
                      />
                      <NumberInput
                        label={idx === 0 ? 'Qty' : undefined}
                        min={1}
                        value={line.requestedQuantity}
                        onChange={(e) => {
                          const next = [...pharmLines];
                          next[idx] = { ...next[idx], requestedQuantity: Number(e.target.value) || 1 };
                          setPharmLines(next);
                        }}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={() => setPharmLines([...pharmLines, { medicineId: '', requestedQuantity: 1 }])}
                    className="text-[11px] font-semibold text-[#08775A] hover:underline"
                  >
                    + Add another medicine
                  </button>
                  <Textarea label="Notes (optional)" rows={2} value={pharmNotes} onChange={(e) => setPharmNotes(e.target.value)} />
                  <div className="flex justify-end">
                    <button type="submit" disabled={isSaving} className="px-4 py-1.5 text-xs font-semibold text-white bg-[#08775A] rounded-lg disabled:opacity-60">
                      {isSaving ? 'Sending…' : 'Send Request'}
                    </button>
                  </div>
                </form>
              )}

              {detail.pharmacyRequests.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 uppercase">Request History</div>
                  {detail.pharmacyRequests.map((r) => (
                    <div key={r.id} className="px-3 py-2 border-b border-slate-100 last:border-0 text-xs">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-slate-700">{r.medicineRequestNumber}</span>
                        <span
                          className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                            r.status === 'AUTHORIZATION_REQUIRED' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-700'
                          }`}
                        >
                          {r.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                      <div className="text-slate-500 mt-1">
                        {r.lines.map((l) => `${l.medicineName} × ${l.requestedQuantity}`).join(', ')}
                      </div>
                      {r.status === 'AUTHORIZATION_REQUIRED' && (
                        <div className="mt-1.5">
                          <button
                            type="button"
                            onClick={() => setHighCostTarget(r)}
                            className="px-2.5 py-1 text-[11px] font-semibold text-white bg-amber-600 hover:bg-amber-700 rounded-md"
                          >
                            Authorize / Reject
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === 'bed' && (
            <div className="space-y-4">
              <p className="text-xs text-slate-600">Current bed: <strong>{detail.bedLabel || 'Not assigned'}</strong></p>
              {detail.status === 'ACTIVE' && (
                <form onSubmit={handleTransferBed} className="space-y-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
                  <Select
                    label="Target Bed"
                    required
                    placeholder="Choose an available bed…"
                    options={availableBeds.map((b) => ({ label: `${b.wardName} / ${b.roomName} / ${b.bedNumber}`, value: b.id }))}
                    value={targetBedId}
                    onChange={(e) => setTargetBedId(e.target.value)}
                  />
                  <TextInput label="Reason" required value={transferReason} onChange={(e) => setTransferReason(e.target.value)} />
                  <div className="flex justify-end">
                    <button type="submit" disabled={isSaving} className="px-4 py-1.5 text-xs font-semibold text-white bg-[#08775A] rounded-lg disabled:opacity-60">
                      {isSaving ? 'Transferring…' : 'Transfer Bed'}
                    </button>
                  </div>
                </form>
              )}

              {detail.bedTransfers.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 uppercase">Transfer History</div>
                  <table className="w-full text-left text-xs border-collapse">
                    <tbody className="divide-y divide-slate-100">
                      {detail.bedTransfers.map((t) => (
                        <tr key={t.id}>
                          <td className="py-1.5 px-3">{t.fromBedLabel} → <strong>{t.toBedLabel}</strong></td>
                          <td className="py-1.5 px-3 text-slate-500">{t.reason}</td>
                          <td className="py-1.5 px-3 text-slate-400 text-right whitespace-nowrap">{t.transferredAt}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === 'clearances' && (
            <div className="space-y-3">
              <p className="text-[11px] text-slate-500">
                Clinical discharge requires the authorizing doctor's own credential (§2.4) — an Admission user can never self-clear it. Hospital
                Billing and Pharmacy gates are granted by an authorized portal user as before.
              </p>
              {detail.clearances.map((c) => (
                <div key={c.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                  <div>
                    <span className="text-xs font-semibold text-slate-800">{CLEARANCE_LABEL[c.clearanceType]}</span>
                    {c.status === 'CLEARED' && c.clearedByLabel && (
                      <span className="text-[10px] text-slate-500 ml-2">by {c.clearedByLabel} • {c.clearedAt}</span>
                    )}
                  </div>
                  {c.status === 'CLEARED' ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800">Cleared</span>
                  ) : c.status === 'NOT_APPLICABLE' ? (
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 text-slate-600">N/A</span>
                  ) : c.clearanceType === 'CLINICAL' ? (
                    <button
                      type="button"
                      onClick={() => setIsClinicalDischargeOpen(true)}
                      className="px-3 py-1 text-[11px] font-semibold text-white bg-[#08775A] rounded-lg"
                    >
                      Doctor Discharge Authorization
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={() => handleGrantClearance(c.clearanceType)}
                      className="px-3 py-1 text-[11px] font-semibold text-white bg-[#08775A] rounded-lg disabled:opacity-60"
                    >
                      Grant
                    </button>
                  )}
                </div>
              ))}

              {detail.dischargeSummary && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 text-[11px] font-bold text-slate-600 uppercase">Discharge Summary</div>
                  <div className="p-3 space-y-1.5 text-xs">
                    <p><span className="text-slate-500">Final Diagnosis:</span> {detail.dischargeSummary.finalDiagnosis}</p>
                    <p><span className="text-slate-500">Condition at Discharge:</span> {detail.dischargeSummary.conditionAtDischarge}</p>
                    <p className="text-[11px] text-slate-400 pt-1">
                      Authorized by {detail.dischargeSummary.doctorNameSnapshot}
                      {detail.dischargeSummary.doctorDepartmentSnapshot && ` (${detail.dischargeSummary.doctorDepartmentSnapshot})`} •{' '}
                      {detail.dischargeSummary.authorizedAt}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isClinicalDischargeOpen && (
        <ClinicalDischargeModal
          admission={detail}
          onClose={() => setIsClinicalDischargeOpen(false)}
          onDischarged={async () => {
            setIsClinicalDischargeOpen(false);
            await load();
            onChanged?.();
          }}
        />
      )}

      {highCostTarget && (
        <HighCostMedicineAuthorizationModal
          admissionId={admissionId}
          request={highCostTarget}
          onClose={() => setHighCostTarget(null)}
          onResolved={async () => {
            setHighCostTarget(null);
            await load();
            onChanged?.();
          }}
        />
      )}
    </Modal>
  );
};
