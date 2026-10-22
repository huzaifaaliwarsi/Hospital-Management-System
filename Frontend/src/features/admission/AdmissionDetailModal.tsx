import { ServiceSourcePicker } from '../../components/forms/ServiceSourcePicker';
import { selectionFromSource } from '../../utils/serviceSelection';
import { AdmissionLedgerButton } from './AdmissionLedgerButton';
import { fetchAdmissionLedger, AdmissionLedger } from '../../services/admissionBillingService';
import { HOSPITAL_SERVICE_SOURCE, OUTSOURCED_SERVICE_SOURCE, NO_ACTIVE_DEPARTMENT_SERVICES, serviceSourceOptions, servicesForSource } from '../../utils/serviceSelection';
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
  FileText,
  CheckCircle2,
  Pencil,
  Check,
  X,
  ArrowRight,
  Clock,
  CreditCard,
  Bed,
  RefreshCw,
  Printer,
  Send,
  ArrowDown,
  AlertTriangle,
  ShieldAlert,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { PanelBadge } from '../../components/common/PanelBadge';
import { Select, NumberInput, TextInput, Textarea, Toggle, ServiceChecklist } from '../../components/forms/FormControls';
import { formatPKR } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';
import { DepartmentService, fetchDepartments } from '../../services/departmentService';
import { Department } from '../../types/department';
import { StaffUserService, fetchStaffUsers } from '../../services/staffUserService';
import { StaffUser } from '../../types/staffUser';
import { ServiceRatesService, fetchServices } from '../../services/serviceRatesService';
import { HospitalService } from '../../types/serviceRates';
import { TransferLocationFields } from './TransferLocationFields';
import { pharmacyApiService, BackendMedicine } from '../../services/pharmacyApiService';
import {
  fetchAdmissionDetail,
  checkInAdmission,
  transferAdmissionBed,
  addAdmissionService,
  changeAdmissionMedicationMode,
  createAdmissionPharmacyRequest,
  grantAdmissionClearance,
  requestAdmissionPayment,
  dischargeAdmission,
  resumeAdmissionActive,
  AdmissionDetail,
  AdmissionPharmacyRequestRecord,
  MedicationMode,
  ClearanceType,
} from '../../services/admissionService';
import { ClinicalDischargeModal } from './ClinicalDischargeModal';
import { HighCostMedicineAuthorizationModal } from './HighCostMedicineAuthorizationModal';
import { DischargeSlipPrintModal } from './DischargeSlipPrintModal';

type Tab = 'overview' | 'services' | 'medication' | 'pharmacy' | 'bed' | 'clearances';

const TABS: { id: Tab; label: string; icon: React.ElementType }[] = [
  { id: 'overview', label: 'Overview', icon: User },
  { id: 'services', label: 'Services', icon: Stethoscope },
  { id: 'medication', label: 'Medication', icon: Pill },
  { id: 'pharmacy', label: 'Pharmacy', icon: Pill },
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
  const [ledgerSummary, setLedgerSummary] = useState<AdmissionLedger['summary'] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const [allStaff, setAllStaff] = useState<StaffUser[]>(() => StaffUserService.getStaffUsers());
  const doctors = useMemo(() => allStaff.filter((s) => s.staffCategory === 'Doctor' && s.status === 'ACTIVE'), [allStaff]);

  // ── Hierarchical Service Selection (Category/Department -> Services) ──────────
  const [selectedDeptFilter, setSelectedDeptFilter] = useState<string>(HOSPITAL_SERVICE_SOURCE);
  const [allDepartments, setAllDepartments] = useState<Department[]>(() => DepartmentService.getDepartments());
  const [allServices, setAllServices] = useState<HospitalService[]>(() => ServiceRatesService.getServices());

  useEffect(() => {

    fetchDepartments().then(setAllDepartments).catch(() => {});
    fetchStaffUsers().then(setAllStaff).catch(() => {});
  }, []);


  const availableServices = useMemo(
    () => servicesForSource(allServices, selectedDeptFilter),
    [allServices, selectedDeptFilter]
  );

  const selectedDeptObj = useMemo(() => {
    return allDepartments.find((d) => d.id === selectedDeptFilter) || null;
  }, [allDepartments, selectedDeptFilter]);

  const isCurrentSelectionOutsourced = useMemo(() => {
    return selectionFromSource(selectedDeptFilter).providerType === 'OUTSOURCED' || selectedDeptObj?.fulfillmentOwnership === 'Outsourced';
  }, [selectedDeptFilter, selectedDeptObj, allDepartments]);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [admission, ledger] = await Promise.all([fetchAdmissionDetail(admissionId), fetchAdmissionLedger(admissionId, true)]);
      setDetail(admission);
      setLedgerSummary(ledger.summary);
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

  useEffect(() => {
    let disposed = false;
    let refreshing = false;
    const syncPharmacy = async () => {
      if (document.hidden || refreshing) return;
      refreshing = true;
      try {
        const [admission, ledger] = await Promise.all([fetchAdmissionDetail(admissionId), fetchAdmissionLedger(admissionId, true)]);
        if (!disposed) {
          setDetail(previous => previous ? { ...previous, pharmacyRequests: admission.pharmacyRequests } : previous);
          setLedgerSummary(ledger.summary);
        }
      } catch {
        // Retain the last successful view; the regular refresh surfaces errors.
      } finally {
        refreshing = false;
      }
    };
    const timer = window.setInterval(syncPharmacy, 5000);
    window.addEventListener('focus', syncPharmacy);
    return () => { disposed = true; window.clearInterval(timer); window.removeEventListener('focus', syncPharmacy); };
  }, [admissionId]);

  const refresh = async (message: string) => {
    toast.success(message);
    setActionError(null);
    await load();
    onChanged?.();
  };

  // ── Services & Charges ──────────────────────────────────────────────
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);
  useEffect(() => {
    setSelectedServiceIds((ids) => ids.filter((id) => availableServices.some((s) => s.id === id)));
  }, [availableServices]);
  const [lineQty, setLineQty] = useState(1);
  const [linePerformedBy, setLinePerformedBy] = useState('');
  const [lineArrangementMode, setLineArrangementMode] = useState<'HOSPITAL_MANAGED' | 'SELF'>('HOSPITAL_MANAGED');

  // Inline Fulfillment Mode editing state
  const [isEditingMedMode, setIsEditingMedMode] = useState(false);
  const [inlineMode, setInlineMode] = useState<MedicationMode>('HOSPITAL_MANAGED');
  const [inlineReason, setInlineReason] = useState('Updated during active care');
  const [isUpdatingMode, setIsUpdatingMode] = useState(false);

  useEffect(() => {
    const defaultMode = isCurrentSelectionOutsourced
      ? detail?.outsourcedFulfillmentMode ?? 'HOSPITAL_MANAGED'
      : detail?.medicationMode === 'SELF'
      ? 'SELF'
      : 'HOSPITAL_MANAGED';
    setLineArrangementMode(defaultMode);
  }, [isCurrentSelectionOutsourced, detail?.outsourcedFulfillmentMode, detail?.medicationMode]);

  const handleSaveInlineMode = async () => {
    if (!detail) return;
    setIsUpdatingMode(true);
    try {
      await changeAdmissionMedicationMode(admissionId, {
        mode: inlineMode,
        reason: inlineReason.trim() || 'Updated during active care',
      });
      setIsEditingMedMode(false);
      setLineArrangementMode(inlineMode === 'HOSPITAL_MANAGED' ? 'HOSPITAL_MANAGED' : 'SELF');
      await refresh('Admission fulfillment mode updated successfully.');
    } catch (err: any) {
      toast.error(err?.message || 'Failed to update fulfillment mode.');
    } finally {
      setIsUpdatingMode(false);
    }
  };

  const selectedServices = useMemo(() => {
    return allServices.filter((s) => selectedServiceIds.includes(s.id));
  }, [allServices, selectedServiceIds]);

  const selectedServicesTotal = useMemo(() => {
    return selectedServices.reduce((sum, s) => sum + (s.standardRate || 0), 0) * (lineQty || 1);
  }, [selectedServices, lineQty]);

  const handleAddService = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedServiceIds.length === 0) {
      setActionError('Please select at least one service or procedure.');
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      for (const serviceId of selectedServiceIds) {
        await addAdmissionService(admissionId, {
          serviceRateId: serviceId,
          ...selectionFromSource(selectedDeptFilter),
          quantity: lineQty,
          performedByStaffId: linePerformedBy || undefined,
          arrangementMode: 'HOSPITAL_MANAGED',
        });
      }
      const count = selectedServiceIds.length;
      setSelectedServiceIds([]);
      setLineQty(1);
      setLinePerformedBy('');
      await refresh(
        `${count} ${count === 1 ? 'service' : 'services'} added to patient invoice.`,
      );
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
  interface PharmLineState {
    medicineId: string;
    requestedQuantity: number;
    unit: string;
    conversionToBase: number;
    overrideSaleRate?: number | null;
  }

  const [medicines, setMedicines] = useState<BackendMedicine[]>([]);
  const [isLoadingMedicines, setIsLoadingMedicines] = useState(false);
  const [pharmLines, setPharmLines] = useState<PharmLineState[]>([
    { medicineId: '', requestedQuantity: 1, unit: 'Unit', conversionToBase: 1 },
  ]);
  const [pharmNotes, setPharmNotes] = useState('');

  const getAvailableUnitsForMedicine = (med?: BackendMedicine) => {
    if (!med) return [{ label: 'Unit', value: 'Unit', conversionToBase: 1, overrideSaleRate: null }];
    const baseName = med.baseUnit?.name || med.unit || 'Unit';
    const map = new Map<string, { label: string; value: string; conversionToBase: number; overrideSaleRate?: number | null }>();

    // Base Unit is always conversion 1
    map.set(baseName.toLowerCase(), {
      label: `${baseName} (Base Unit)`,
      value: baseName,
      conversionToBase: 1,
      overrideSaleRate: null,
    });

    // Add all packaging levels configured by pharmacy staff
    if (Array.isArray(med.packagingLevels)) {
      for (const lvl of med.packagingLevels) {
        const uName = lvl.unit?.name;
        if (!uName) continue;
        const conv = Number(lvl.conversionToBase) || 1;
        const override = lvl.overrideSaleRate !== undefined && lvl.overrideSaleRate !== null ? Number(lvl.overrideSaleRate) : null;
        map.set(uName.toLowerCase(), {
          label: conv > 1 ? `${uName} (${conv} ${baseName})` : uName,
          value: uName,
          conversionToBase: conv,
          overrideSaleRate: override,
        });
      }
    }

    return Array.from(map.values());
  };

  const loadMedicines = async (showToast = false) => {
    setIsLoadingMedicines(true);
    try {
      const data = await pharmacyApiService.getMedicines();
      setMedicines(data);
      if (showToast) toast.success(`Synced ${data.length} medicines from Pharmacy stock`);
    } catch {
      setMedicines([]);
      if (showToast) toast.error('Failed to sync pharmacy medicines');
    } finally {
      setIsLoadingMedicines(false);
    }
  };

  useEffect(() => {
    if (tab === 'pharmacy') {
      loadMedicines();
    }
  }, [tab]);

  const handleCreatePharmacyRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const validLines = pharmLines
      .filter((l) => l.medicineId && l.requestedQuantity > 0)
      .map((l) => {
        const med = medicines.find((m) => m.id === l.medicineId);
        const conv = l.conversionToBase || 1;
        const totalBaseQty = Math.round((l.requestedQuantity || 1) * conv * 1000) / 1000;
        const baseUnitName = med?.baseUnit?.name || med?.unit || 'Unit';
        const unitName = l.unit || baseUnitName;
        const linePackagingNote =
          conv > 1
            ? `${l.requestedQuantity} ${unitName} (${totalBaseQty} ${baseUnitName})`
            : `${l.requestedQuantity} ${unitName}`;

        return {
          medicineId: l.medicineId,
          requestedQuantity: totalBaseQty,
          unit: unitName,
          conversionToBase: conv,
          saleUnitQuantity: l.requestedQuantity,
          notes: linePackagingNote,
        };
      });

    if (validLines.length === 0) {
      setActionError('Add at least one medicine with a quantity.');
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      const created = await createAdmissionPharmacyRequest(admissionId, { notes: pharmNotes.trim() || undefined, lines: validLines });
      setPharmLines([{ medicineId: '', requestedQuantity: 1, unit: 'Unit', conversionToBase: 1 }]);
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
  const [transferVersion, setTransferVersion] = useState(0);

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
      setTransferVersion((version) => version + 1);
      setTransferReason('');
      await refresh('Bed transfer completed.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to transfer bed.');
    } finally {
      setIsSaving(false);
    }
  };

  // ── Clearances ───────────────────────────────────────────────────────
  const handleRequestBillingClearance = async () => {
    const outstanding = ledgerSummary?.outstandingBalance ?? detail?.totalOutstanding ?? 0;
    if (outstanding <= 0) {
      toast.info('No outstanding balance. Patient has settled all hospital dues.');
      return;
    }
    setIsSaving(true);
    setActionError(null);
    try {
      await requestAdmissionPayment(admissionId, {
        requestType: 'FINAL',
        requestedAmount: outstanding,
        notes: `Discharge billing clearance requested. Outstanding balance: ${formatPKR(outstanding)}.`,
      });
      toast.success(`Discharge billing clearance request sent to Front Desk for ${formatPKR(outstanding)}!`);
      await refresh(`Discharge clearance request sent to Front Desk (${formatPKR(outstanding)}).`);
    } catch (err: any) {
      setActionError(err?.message || 'Failed to send billing clearance request to Front Desk.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleGrantClearance = async (clearanceType: ClearanceType) => {
    setIsSaving(true);
    setActionError(null);
    try {
      const res = await grantAdmissionClearance(admissionId, { clearanceType });
      if (res?.pendingPayment) {
        toast.info(res.message || 'Discharge clearance request sent to Front Desk! Outstanding payment required.');
        await refresh(res.message || 'Discharge clearance request sent to Front Desk.');
      } else {
        toast.success(`${CLEARANCE_LABEL[clearanceType]} clearance granted.`);
        await refresh(`${CLEARANCE_LABEL[clearanceType]} clearance granted.`);
      }
    } catch (err: any) {
      setActionError(err?.message || 'Failed to grant clearance.');
      toast.info(err?.message || 'Clearance blocked: outstanding balance. Front Desk has been notified.');
      await load();
    } finally {
      setIsSaving(false);
    }
  };

  const [isClinicalDischargeOpen, setIsClinicalDischargeOpen] = useState(false);
  const [isPrintSlipOpen, setIsPrintSlipOpen] = useState(false);
  const [highCostTarget, setHighCostTarget] = useState<AdmissionPharmacyRequestRecord | null>(null);
  const [isDischarging, setIsDischarging] = useState(false);

  const isAllClearancesReady = useMemo(() => {
    const outstanding = ledgerSummary?.outstandingBalance ?? detail?.totalOutstanding ?? 0;
    return outstanding <= 0;
  }, [ledgerSummary?.outstandingBalance, detail?.totalOutstanding]);

  const [isResuming, setIsResuming] = useState(false);
  const handleResumeActive = async () => {
    setIsResuming(true);
    setActionError(null);
    try {
      await resumeAdmissionActive(admissionId);
      toast.success('Patient stay resumed to ACTIVE status.');
      await refresh('Admission status resumed to ACTIVE.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to resume active stay.');
    } finally {
      setIsResuming(false);
    }
  };

  const handleFinalDischarge = async () => {
    setIsDischarging(true);
    setActionError(null);
    try {
      await dischargeAdmission(admissionId);
      await refresh('Patient discharged successfully. Bed freed to AVAILABLE.');
    } catch (err: any) {
      setActionError(err?.message || 'Failed to discharge patient.');
    } finally {
      setIsDischarging(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={
        detail ? (
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="font-mono text-xs font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
              {detail.admissionNumber}
            </span>
            <span className="text-base font-bold text-slate-900 tracking-tight">{detail.patientName}</span>
            {detail.payerType === 'Corporate / Panel' ? (
              <PanelBadge />
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                Self-Pay
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${
                detail.status === 'ACTIVE'
                  ? 'bg-[#effaf5] text-[#08775A] border-[#c2e7db]'
                  : detail.status === 'DISCHARGE_PENDING'
                  ? 'bg-amber-50 text-amber-800 border-amber-200'
                  : detail.status === 'DISCHARGED'
                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                  : 'bg-blue-50 text-blue-700 border-blue-200'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  detail.status === 'ACTIVE' ? 'bg-[#08775A]' : 'bg-amber-500'
                }`}
              />
              {detail.status.replace(/_/g, ' ')}
            </span>
            {detail.status === 'DISCHARGE_PENDING' && (
              <button
                type="button"
                onClick={handleResumeActive}
                disabled={isResuming}
                className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-white text-emerald-700 border border-emerald-300 hover:bg-emerald-50 shadow-2xs transition-colors cursor-pointer disabled:opacity-60"
                title="Revert back to Active Inpatient Stay"
              >
                {isResuming ? 'Resuming…' : '↺ Resume Active Stay'}
              </button>
            )}
          </div>
        ) : (
          'Admission'
        )
      }
      subtitle={
        detail ? (
          <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5 flex-wrap">
            <span className="font-semibold text-slate-700">{detail.departmentName}</span>
            <span className="text-slate-300">•</span>
            <span>Dr. {detail.doctorName || 'Not assigned'}</span>
            {detail.rmoName && (
              <>
                <span className="text-slate-300">•</span>
                <span>RMO: {detail.rmoName}</span>
              </>
            )}
            <span className="text-slate-300">•</span>
            <span className="font-medium text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/80">
              {detail.bedLabel || 'No bed assigned'}
            </span>
          </div>
        ) : undefined
      }
      maxWidth="5xl"
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-16 text-slate-500 gap-2 text-sm">
          <Loader2 className="h-5 w-5 animate-spin text-[#08775A]" /> Loading admission…
        </div>
      ) : loadError || !detail ? (
        <div className="text-center py-10">
          <p className="text-rose-600 text-sm">{loadError}</p>
          <button onClick={load} className="mt-2 px-3 py-1.5 bg-[#08775A] text-white text-xs rounded-lg cursor-pointer">Retry</button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Segmented Inpatient Action Tabs (Responsive Grid, Never Overflows) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-1 p-1 bg-slate-100/90 rounded-xl border border-slate-200/80 shadow-2xs">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setTab(t.id)}
                className={`inline-flex items-center justify-center gap-1.5 px-2 py-2 text-xs rounded-lg font-bold transition-all text-center cursor-pointer ${
                  tab === t.id
                    ? 'bg-white text-[#08775A] shadow-xs border border-slate-200/80 ring-1 ring-slate-900/5'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                }`}
              >
                <t.icon className={`h-3.5 w-3.5 shrink-0 ${tab === t.id ? 'text-[#08775A]' : 'text-slate-400'}`} />
                <span className="truncate">{t.label}</span>
              </button>
            ))}
          </div>

          {actionError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" /> {actionError}
            </div>
          )}

          {tab === 'overview' && (
            <div className="space-y-4">
              {/* Cohesive Admission Summary Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                {/* Dark Emerald Header Strip */}
                <div className="bg-[#0e5944] px-4 py-2.5 flex items-center justify-between text-white flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <User className="h-4 w-4 text-emerald-300" />
                    <span className="text-xs font-bold tracking-wide">
                      Patient Inpatient File — <span className="font-mono text-emerald-200">{detail.patientMrNumber}</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {detail.dischargeSummary && (
                      <button
                        type="button"
                        onClick={() => setIsPrintSlipOpen(true)}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg text-emerald-100 hover:text-white bg-emerald-800/80 hover:bg-emerald-800 border border-emerald-600/50 transition-colors cursor-pointer"
                        title="Print Official Physical Discharge Slip"
                      >
                        <Printer className="h-3.5 w-3.5" />
                        <span>Print Discharge Form</span>
                      </button>
                    )}
                    <AdmissionLedgerButton
                      admissionId={admissionId}
                      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg text-emerald-200 hover:text-white bg-emerald-950/60 hover:bg-emerald-950 border border-emerald-700/50 transition-colors cursor-pointer"
                    >
                      <FileText className="h-3.5 w-3.5" />
                      <span>View Ledger</span>
                    </AdmissionLedgerButton>
                  </div>
                </div>

                {/* Card Body: Balanced Metadata Layout */}
                <div className="p-4 grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 text-xs bg-slate-50/40">
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">Department</span>
                    <span className="font-bold text-slate-900 truncate block mt-0.5" title={detail.departmentName}>
                      {detail.departmentName || 'Not assigned'}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">Ward / Room / Bed</span>
                    <span className="font-bold text-slate-900 truncate block mt-0.5" title={detail.bedLabel || ''}>
                      {detail.bedLabel || 'No bed assigned'}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">Attending Doctor</span>
                    <span className="font-bold text-slate-900 truncate block mt-0.5" title={detail.doctorName}>
                      {detail.doctorName || 'Not assigned'}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">Assigned RMO</span>
                    <span className="font-bold text-slate-900 truncate block mt-0.5" title={detail.rmoName || ''}>
                      {detail.rmoName || 'None assigned'}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">Medication Mode</span>
                    <span className="font-bold text-slate-900 truncate block mt-0.5">
                      {detail.medicationMode === 'HOSPITAL_MANAGED' ? 'Hospital Managed' : 'Self Arranged'}
                    </span>
                  </div>
                </div>

                {/* Diagnosis (if provided) */}
                {detail.diagnosis && (
                  <div className="px-4 py-3 bg-white border-t border-slate-200/80 text-xs flex items-start gap-2.5">
                    <div className="p-1 rounded-md bg-[#effaf5] text-[#08775A] shrink-0 mt-0.5 border border-[#c2e7db]">
                      <Stethoscope className="h-3.5 w-3.5" />
                    </div>
                    <div>
                      <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider block">Admission Diagnosis</span>
                      <p className="text-slate-800 font-medium leading-relaxed mt-0.5">{detail.diagnosis}</p>
                    </div>
                  </div>
                )}

                {/* Card Footer: Clean Timeline */}
                <div className="px-4 py-2.5 bg-slate-50/90 border-t border-slate-200/80 text-[11px] text-slate-600 flex items-center justify-between flex-wrap gap-2">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span>
                      <strong className="font-bold text-slate-700">Expected:</strong> {detail.expectedAt || '—'}
                    </span>
                    <span>
                      <strong className="font-bold text-slate-700">Admitted:</strong> {detail.admittedAt || '—'}
                    </span>
                    <span>
                      <strong className="font-bold text-slate-700">Discharged:</strong> {detail.dischargedAt || '—'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Financial Snapshot Telemetry on Overview */}
              <div className="bg-white border border-slate-200/80 rounded-2xl p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] space-y-3">
                <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-[#08775A]" />
                    <span className="text-xs font-bold text-slate-900">Inpatient Financial Snapshot</span>
                  </div>
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {(ledgerSummary?.outstandingBalance ?? detail.totalOutstanding) > 0 && (
                      <button
                        type="button"
                        disabled={isSaving}
                        onClick={() => handleGrantClearance('HOSPITAL_BILLING')}
                        className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-bold bg-amber-700 hover:bg-amber-800 text-white rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-60"
                        title="Send discharge billing clearance request to Front Desk for outstanding balance"
                      >
                        <Send className="h-3.5 w-3.5" />
                        <span>Request Clearance from Front Desk ({formatPKR(ledgerSummary?.outstandingBalance ?? detail.totalOutstanding)})</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setTab('services')}
                      className="text-[11px] font-bold text-[#08775A] hover:underline flex items-center gap-1 cursor-pointer"
                    >
                      Manage Services &amp; Invoices <ArrowRight className="h-3 w-3" />
                    </button>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      Total Billed
                    </span>
                    <span className="text-base font-bold font-mono text-slate-900 tabular-nums block mt-0.5">
                      {formatPKR(detail.invoices.reduce((s, i) => s + i.total, 0))}
                    </span>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      Advance / Deposit
                    </span>
                    <span className="text-base font-bold font-mono text-emerald-700 tabular-nums block mt-0.5">
                      {formatPKR(detail.unallocatedAdvanceTotal || 0)}
                    </span>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      Available Credit
                    </span>
                    <span className="text-base font-bold font-mono text-emerald-800 tabular-nums block mt-0.5">
                      {formatPKR(ledgerSummary?.availableCredit || 0)}
                    </span>
                  </div>
                  <div
                    className={`p-3 rounded-xl border ${
                      (ledgerSummary?.outstandingBalance ?? detail.totalOutstanding) > 0
                        ? 'bg-amber-50/80 border-amber-200'
                        : 'bg-slate-50/70 border-slate-200/80'
                    }`}
                  >
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      Total Outstanding
                    </span>
                    <span
                      className={`text-base font-bold font-mono tabular-nums block mt-0.5 ${
                        (ledgerSummary?.outstandingBalance ?? detail.totalOutstanding) > 0
                          ? 'text-amber-800'
                          : 'text-slate-900'
                      }`}
                    >
                      {formatPKR(ledgerSummary?.outstandingBalance ?? detail.totalOutstanding)}
                    </span>
                  </div>
                </div>
              </div>

              {detail.status === 'DISCHARGE_PENDING' && isAllClearancesReady && (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2.5 text-emerald-900 font-semibold">
                    <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                    <div>
                      <p className="font-bold text-emerald-950">Discharge Cleared &amp; Ready</p>
                      <p className="text-[11px] text-emerald-800 font-normal">All 3 clearance gates are approved. Ready to finalize discharge.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={handleFinalDischarge}
                    disabled={isDischarging}
                    className="px-4 py-2 bg-[#08775A] hover:bg-[#065f46] text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-60 text-xs transition-colors"
                  >
                    {isDischarging && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Complete Final Discharge &amp; Free Bed</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {tab === 'services' && (
            <div className="space-y-4">
              {/* Unified Inpatient Financial Telemetry & Fulfillment Surface */}
              <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-[0_2px_8px_rgba(0,0,0,0.03)] space-y-3.5">
                {/* Top Action Row: Fulfillment Mode + Ledger Drill-down */}
                <div className="flex items-center justify-between flex-wrap gap-2.5 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-500">Fulfillment Mode:</span>
                    <span
                      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold border ${
                        detail.medicationMode === 'HOSPITAL_MANAGED'
                          ? 'bg-[#effaf5] text-[#08775A] border-[#c2e7db]'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full ${
                          detail.medicationMode === 'HOSPITAL_MANAGED' ? 'bg-[#08775A]' : 'bg-slate-400'
                        }`}
                      />
                      {detail.medicationMode === 'HOSPITAL_MANAGED' ? 'Hospital Managed' : 'Self Arranged'}
                    </span>
                    <span className="text-[11px] text-slate-400 hidden sm:inline">
                      (Default for new procedures)
                    </span>

                    {(detail.status === 'ACTIVE' || detail.status === 'DISCHARGE_PENDING') && (
                      <button
                        type="button"
                        onClick={() => setTab('medication')}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#08775A] hover:text-[#065f46] hover:bg-[#effaf5] px-2 py-0.5 rounded-md border border-[#c2e7db] transition-colors cursor-pointer"
                        title="Configure policy in Medication tab"
                      >
                        <Pill className="h-3 w-3" /> Manage in Medication Tab
                      </button>
                    )}
                  </div>

                  <AdmissionLedgerButton
                    admissionId={admissionId}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl text-[#08775A] bg-[#effaf5] hover:bg-[#c2e7db]/50 border border-[#c2e7db] shadow-2xs transition-colors cursor-pointer"
                  >
                    <FileText className="h-3.5 w-3.5" /> View Full Patient Ledger
                  </AdmissionLedgerButton>
                </div>

                {/* Balanced 4-Column Financial Telemetry Strip */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      Total Billed
                    </span>
                    <span className="text-base font-bold font-mono text-slate-900 tabular-nums block mt-0.5">
                      {formatPKR(detail.invoices.reduce((s, i) => s + i.total, 0))}
                    </span>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      Advance / Deposit
                    </span>
                    <span className="text-base font-bold font-mono text-emerald-700 tabular-nums block mt-0.5">
                      {formatPKR(detail.unallocatedAdvanceTotal || 0)}
                    </span>
                  </div>
                  <div className="bg-slate-50/70 p-3 rounded-xl border border-slate-200/80">
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      Available Credit
                    </span>
                    <span className="text-base font-bold font-mono text-emerald-800 tabular-nums block mt-0.5">
                      {formatPKR(ledgerSummary?.availableCredit || 0)}
                    </span>
                  </div>
                  <div
                    className={`p-3 rounded-xl border ${
                      (ledgerSummary?.outstandingBalance ?? detail.totalOutstanding) > 0
                        ? 'bg-amber-50/80 border-amber-200'
                        : 'bg-slate-50/70 border-slate-200/80'
                    }`}
                  >
                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider block">
                      Total Outstanding
                    </span>
                    <span
                      className={`text-base font-bold font-mono tabular-nums block mt-0.5 ${
                        (ledgerSummary?.outstandingBalance ?? detail.totalOutstanding) > 0
                          ? 'text-amber-800'
                          : 'text-slate-900'
                      }`}
                    >
                      {formatPKR(ledgerSummary?.outstandingBalance ?? detail.totalOutstanding)}
                    </span>
                  </div>
                </div>

                {/* Outstanding Alert Strip with Front Desk Clearance Action */}
                {(ledgerSummary?.outstandingBalance ?? detail.totalOutstanding) > 0 && (
                  <div className="mt-3 p-3.5 rounded-xl bg-amber-50/90 border border-amber-200/90 flex items-center justify-between flex-wrap gap-2.5 text-xs text-amber-900">
                    <div className="flex items-center gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
                      <div>
                        <span className="font-bold block text-amber-950">Patient has unpaid dues ({formatPKR(ledgerSummary?.outstandingBalance ?? detail.totalOutstanding)})</span>
                        <span className="text-[11px] text-amber-800">Discharge clearance requires settlement of this balance at Front Desk.</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isSaving}
                      onClick={handleRequestBillingClearance}
                      className="px-3.5 py-1.5 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-lg shadow-xs disabled:opacity-60 transition-colors cursor-pointer flex items-center gap-1.5"
                      title="Send clearance and payment notification to Front Desk"
                    >
                      <Send className="h-3 w-3" />
                      <span>Request Front Desk Clearance</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Department Invoices & Line Items */}
              {detail.invoices.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200/80 p-8 text-center text-xs text-slate-400 font-medium">
                  No department service invoices posted to this admission yet.
                </div>
              ) : (
                detail.invoices.map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-white rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.03)] overflow-hidden"
                  >
                    {/* Dark Emerald Header Strip (§4.1 / §4.5) */}
                    <div className="bg-[#0e5944] px-4 py-2.5 flex items-center justify-between text-white flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-emerald-300" />
                        <span className="text-xs font-bold tracking-wide text-white">
                          {inv.departmentName} — <span className="font-mono text-emerald-200">{inv.invoiceNumber}</span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {inv.outstanding === 0 ? (
                          <span className="px-2.5 py-0.5 rounded-full bg-emerald-950/70 text-emerald-200 border border-emerald-700/50 text-[11px] font-bold">
                            Settled
                          </span>
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-200 border border-amber-400/40 text-[11px] font-bold font-mono">
                            Outstanding: {formatPKR(inv.outstanding)}
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead className="bg-[#effaf5] border-b border-[#c2e7db] sticky top-0 z-10">
                          <tr>
                            <th className="py-2.5 px-4 text-left font-bold text-[#08775A]">Service / Procedure</th>
                            <th className="py-2.5 px-3 text-right font-bold text-[#08775A]">Qty</th>
                            <th className="py-2.5 px-4 text-right font-bold text-[#08775A]">Amount (PKR)</th>
                            <th className="py-2.5 px-4 text-left font-bold text-[#08775A]">Performed By</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {inv.lines.map((l, idx) => {
                            const isSelf =
                              l.discountReason?.includes('Self-Arranged') ||
                              l.discountReason?.includes('Self Arranged') ||
                              (l.lineNet === 0 && l.lineGross === 0);

                            return (
                              <tr
                                key={l.id}
                                className={`transition-colors hover:bg-[#e7f6f1]/40 ${
                                  idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'
                                }`}
                              >
                                <td className="py-2.5 px-4 font-semibold text-slate-900">
                                  <div className="flex items-center gap-2">
                                    <span>{l.serviceName}</span>
                                    {isSelf && (
                                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
                                        Self Arranged
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-right font-mono text-slate-700 font-semibold">{l.quantity}</td>
                                <td className="py-2.5 px-4 text-right font-mono font-bold tabular-nums">
                                  {isSelf ? (
                                    <span className="text-slate-500 text-xs">
                                      PKR 0 <span className="text-[10px] text-slate-400 font-normal">(Self)</span>
                                    </span>
                                  ) : (
                                    <span className="text-slate-900">{formatPKR(l.lineNet)}</span>
                                  )}
                                </td>
                                <td className="py-2.5 px-4 text-slate-600 font-medium">
                                  {l.performedByName || '—'}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))
              )}

              {(detail.status === 'ACTIVE' || detail.status === 'DISCHARGE_PENDING') && (
                <form onSubmit={handleAddService} className="space-y-3.5 p-4 bg-slate-50/60 rounded-2xl border border-slate-200/80 shadow-[0_2px_8px_rgba(0,0,0,0.02)]">
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-200/80">
                    <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                      <div className="h-6 w-6 rounded-lg bg-[#effaf5] border border-[#c2e7db] text-[#08775A] flex items-center justify-center font-bold">
                        <Plus className="h-3.5 w-3.5" />
                      </div>
                      <span>Add Clinical Service / Procedure</span>
                    </h4>
                    <span className="text-[11px] font-medium text-slate-500">
                      Auto-posted to inpatient stay invoice
                    </span>
                  </div>

                  {/* 1. Doctor / Consultant (Optional) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-600 uppercase tracking-wider mb-1">
                      Doctor / Consultant <span className="font-normal text-slate-400 lowercase">(optional)</span>
                    </label>
                    <select
                      aria-label="Doctor (Optional)"
                      className="block w-full text-xs px-2.5 py-2 border border-[#c2e7db] rounded-lg bg-white text-[#111827] font-medium focus:outline-none focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A] cursor-pointer transition-colors"
                      value={linePerformedBy}
                      onChange={(e) => setLinePerformedBy(e.target.value)}
                    >
                      <option value="">Select Doctor (Optional)</option>
                      {doctors.map((d) => (
                        <option key={d.id} value={d.id}>
                          {d.fullName} {d.designation ? `(${d.designation})` : ''}
                        </option>
                      ))}
                    </select>
                  </div>

                  {/* 2. Department / Source Filter */}
                  <ServiceSourcePicker
                    value={selectedDeptFilter}
                    onChange={(value) => {
                      setSelectedDeptFilter(value);
                      setSelectedServiceIds([]);
                    }}
                    departments={allDepartments}
                    onServices={setAllServices}
                  />

                  {/* 3. Searchable Multi-Select Service Checklist */}
                  <ServiceChecklist
                    label="Select Services / Procedures / Investigations"
                    services={availableServices}
                    selectedServiceIds={selectedServiceIds}
                    onChange={setSelectedServiceIds}
                    maxHeightClass="max-h-48"
                    emptyMessage={
                      availableServices.length === 0
                        ? NO_ACTIVE_DEPARTMENT_SERVICES
                        : 'No services available in this department'
                    }
                  />

                  {selectedServiceIds.length > 0 && (
                    <div className="flex items-center justify-between gap-3 p-2.5 bg-[#effaf5] border border-[#c2e7db] rounded-xl text-xs flex-wrap">
                      <div className="flex items-center gap-1.5 font-bold text-[#08775A]">
                        <CheckCircle2 className="h-4 w-4 shrink-0" />
                        <span>{selectedServiceIds.length} {selectedServiceIds.length === 1 ? 'service' : 'services'} selected ({formatPKR(selectedServicesTotal)})</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const btn = document.getElementById('btn-add-service-submit');
                            btn?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                            btn?.focus();
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-[#08775A] bg-white hover:bg-slate-50 border border-[#c2e7db] rounded-lg shadow-2xs cursor-pointer transition-colors"
                          title="Scroll down to customize quantity or arrangement"
                        >
                          <ArrowDown className="h-3.5 w-3.5" />
                          <span>Scroll Down to Actions</span>
                        </button>
                        <button
                          type="submit"
                          disabled={isSaving}
                          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs cursor-pointer transition-colors disabled:opacity-60"
                        >
                          {isSaving ? 'Adding…' : 'Add Now'}
                        </button>
                      </div>
                    </div>
                  )}

                  {selectedServices.length > 0 && (
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-2xs">
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-medium">Selected:</span>
                        <span className="font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded-md">
                          {selectedServices.length} {selectedServices.length === 1 ? 'service' : 'services'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-medium">Destination:</span>
                        <span className="font-semibold text-slate-800">
                          {detail.invoices[0]?.invoiceNumber || 'Inpatient Stay Invoice'}
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <span className="text-slate-500 font-medium">Total:</span>
                        <span className="font-bold font-mono text-base text-[#08775A] tabular-nums">
                          {formatPKR(selectedServicesTotal)}
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between gap-3 pt-1">
                    <div className="w-48">
                      <NumberInput label="Quantity (per service)" min={1} value={lineQty} onChange={(e) => setLineQty(Number(e.target.value) || 1)} />
                    </div>
                    <button
                      id="btn-add-service-submit"
                      type="submit"
                      disabled={isSaving || selectedServiceIds.length === 0}
                      className="px-5 py-2.5 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs disabled:opacity-60 cursor-pointer transition-colors"
                    >
                      {isSaving
                        ? 'Adding…'
                        : selectedServiceIds.length > 1
                        ? `Add ${selectedServiceIds.length} Services to Patient`
                        : 'Add Service to Patient'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {tab === 'medication' && (
            <div className="space-y-4">
              {/* Inpatient Medication Policy Configuration Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                <div className="bg-[#0e5944] px-4 py-3 flex items-center justify-between text-white flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Pill className="h-4 w-4 text-emerald-300" />
                    <div>
                      <h4 className="text-xs font-bold tracking-wide">Inpatient Medication Supply Policy</h4>
                      <p className="text-[11px] text-emerald-200/90 font-normal">
                        Defines whether medications are requisitioned via Central Pharmacy or sourced externally
                      </p>
                    </div>
                  </div>
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold border ${
                      detail.medicationMode === 'HOSPITAL_MANAGED'
                        ? 'bg-emerald-950/70 text-emerald-200 border-emerald-700/60'
                        : 'bg-slate-900/60 text-slate-200 border-slate-700'
                    }`}
                  >
                    <span
                      className={`h-1.5 w-1.5 rounded-full ${
                        detail.medicationMode === 'HOSPITAL_MANAGED' ? 'bg-emerald-400' : 'bg-slate-400'
                      }`}
                    />
                    Current: {detail.medicationMode === 'HOSPITAL_MANAGED' ? 'Hospital Managed' : 'Self Arranged'}
                  </span>
                </div>

                <form onSubmit={handleChangeMode} className="p-4 space-y-4">
                  {/* 3 Prominent Safety & Audit Alerts */}
                  <div className="space-y-2.5">
                    {/* Alert 1: Financial Reporting & Audit Integrity */}
                    <div className="p-3 rounded-xl bg-amber-50/90 border border-amber-200/90 flex items-start gap-2.5 text-xs text-amber-950">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-amber-900">Financial Reporting &amp; Audit Alert: </span>
                        <span>
                          Altering this policy changes pharmaceutical revenue attribution, daily IPD ledger settlement balances, and shift-end financial reports. Verify with clinical/admin lead before switching.
                        </span>
                      </div>
                    </div>

                    {/* Alert 2: Stock Deduction Policy */}
                    <div className="p-3 rounded-xl bg-blue-50/90 border border-blue-200/90 flex items-start gap-2.5 text-xs text-blue-950">
                      <Pill className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-blue-900">Central Pharmacy Inventory Policy: </span>
                        <span>
                          Under <strong>Hospital Managed</strong>, medicines are fulfilled and deducted from live pharmacy batch inventory. Under <strong>Self Arranged (PKR 0)</strong>, pharmacy stock requisitions are locked to prevent unaccounted drug leakage.
                        </span>
                      </div>
                    </div>

                    {/* Alert 3: Discharge Clearance Rule */}
                    <div className="p-3 rounded-xl bg-rose-50/90 border border-rose-200/90 flex items-start gap-2.5 text-xs text-rose-950">
                      <ShieldAlert className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold text-rose-900">Discharge Balance &amp; Dues Notice: </span>
                        <span>
                          Any medicines already dispensed prior to a policy switch remain permanently on the patient's billing ledger. Switching to Self Arranged does not cancel past charges — all dues must be settled at Front Desk prior to discharge.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Visual Policy Selector Cards */}
                  <div>
                    <label className="text-[11px] font-bold text-slate-600 uppercase tracking-wider block mb-2">
                      Select Fulfillment Policy
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <button
                        type="button"
                        onClick={() => setNewMode('HOSPITAL_MANAGED')}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                          newMode === 'HOSPITAL_MANAGED'
                            ? 'border-[#08775A] bg-[#effaf5] text-[#08775A] ring-1 ring-[#08775A] shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${newMode === 'HOSPITAL_MANAGED' ? 'bg-[#08775A] text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <Pill className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-900">Hospital Managed</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-800">
                            Pharmacy Active
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-normal mt-2 leading-relaxed">
                          Medications are requisitioned directly from Central Hospital Pharmacy, automatically deducted from stock, and billed to patient inpatient file.
                        </p>
                      </button>

                      <button
                        type="button"
                        onClick={() => setNewMode('SELF')}
                        className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative ${
                          newMode === 'SELF'
                            ? 'border-slate-800 bg-slate-100 text-slate-900 ring-1 ring-slate-800 shadow-xs'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50/50'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className={`p-1.5 rounded-lg ${newMode === 'SELF' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-500'}`}>
                              <User className="h-4 w-4" />
                            </div>
                            <span className="text-xs font-bold text-slate-900">Self Arranged (Patient)</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-slate-200 text-slate-700">
                            PKR 0 Hospital Billing
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-normal mt-2 leading-relaxed">
                          Attendant or patient procures medications externally. Zero pharmacy charges are added to the hospital admission ledger.
                        </p>
                      </button>
                    </div>
                  </div>

                  <div>
                    <Textarea
                      label="Reason / Clinical Justification for Policy Change"
                      required
                      rows={2}
                      placeholder="e.g. Attendant preference, consultant orders, switch to in-house pharmacy stock…"
                      value={modeReason}
                      onChange={(e) => setModeReason(e.target.value)}
                    />
                  </div>

                  {newMode !== detail.medicationMode && (
                    <div className="p-3 rounded-xl bg-amber-50 border border-amber-300/80 flex items-center gap-2.5 text-xs text-amber-950 animate-in fade-in duration-150">
                      <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0" />
                      <div>
                        <span className="font-bold">Confirmation Required: </span>
                        <span>
                          You are switching fulfillment from <strong>{detail.medicationMode === 'HOSPITAL_MANAGED' ? 'Hospital Managed' : 'Self Arranged'}</strong> to <strong>{newMode === 'HOSPITAL_MANAGED' ? 'Hospital Managed' : 'Self Arranged'}</strong>. This event will be recorded in the audit trail.
                        </span>
                      </div>
                    </div>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-slate-100">
                    <span className="text-[11px] text-slate-500">
                      {newMode === detail.medicationMode
                        ? 'Select an alternate policy above to update'
                        : 'Review policy and confirm mode change'}
                    </span>
                    <button
                      type="submit"
                      disabled={isSaving || newMode === detail.medicationMode}
                      className="px-4 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs transition-colors cursor-pointer disabled:opacity-50 inline-flex items-center gap-1.5"
                    >
                      {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                      <span>Update Medication Policy</span>
                    </button>
                  </div>
                </form>
              </div>

              {/* Policy Change Audit Trail */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                <div className="bg-slate-50/80 border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Medication Policy Audit Trail
                    </span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-200/80 text-slate-700 rounded-full">
                    {detail.medicationModeHistory.length} {detail.medicationModeHistory.length === 1 ? 'event' : 'events'}
                  </span>
                </div>

                {detail.medicationModeHistory.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 font-medium">
                    No medication policy switches recorded. Initial admission policy remains active.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#effaf5] border-b border-[#c2e7db]/70 text-[11px] font-bold text-[#08775A] uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4">Transition</th>
                          <th className="py-2.5 px-4">Reason / Notes</th>
                          <th className="py-2.5 px-4 text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.medicationModeHistory.map((h) => (
                          <tr key={h.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-4">
                              <span className="inline-flex items-center gap-1.5 font-bold">
                                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-600 border border-slate-200">
                                  {h.previousMode === 'HOSPITAL_MANAGED' ? 'Hospital' : 'Self'}
                                </span>
                                <ArrowRight className="h-3 w-3 text-slate-400" />
                                <span className={`px-2 py-0.5 rounded text-[10px] border ${
                                  h.newMode === 'HOSPITAL_MANAGED'
                                    ? 'bg-[#effaf5] text-[#08775A] border-[#c2e7db]'
                                    : 'bg-slate-800 text-white border-slate-800'
                                }`}>
                                  {h.newMode === 'HOSPITAL_MANAGED' ? 'Hospital Managed' : 'Self Arranged'}
                                </span>
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-600 font-medium">{h.reason}</td>
                            <td className="py-2.5 px-4 text-slate-400 text-right font-mono text-[11px] whitespace-nowrap">
                              {h.changedAt}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'pharmacy' && (
            <div className="space-y-4">
              {detail.medicationMode !== 'HOSPITAL_MANAGED' ? (
                <div className="bg-amber-50/80 border border-amber-200 rounded-2xl p-5 text-xs text-amber-900 flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-xl bg-amber-100 text-amber-700 shrink-0">
                      <AlertCircle className="h-5 w-5" />
                    </div>
                    <div>
                      <h4 className="font-bold text-amber-950 text-sm">Pharmacy Requisitions Locked (Self-Arranged Mode)</h4>
                      <p className="text-amber-800 mt-1 leading-relaxed">
                        This patient admission is currently configured for <strong>Self-Arranged Medications</strong>. Inpatient medicine orders from the Central Hospital Pharmacy are disabled.
                      </p>
                      <p className="text-amber-700 text-[11px] mt-1.5">
                        To request medicines from the Central Pharmacy, switch the policy to Hospital Managed.
                      </p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setNewMode('HOSPITAL_MANAGED');
                      setTab('medication');
                    }}
                    className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-xl shadow-xs shrink-0 cursor-pointer text-xs transition-colors"
                  >
                    Switch to Hospital Managed
                  </button>
                </div>
              ) : (
                <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                  <div className="bg-[#0e5944] px-4 py-3 flex items-center justify-between text-white flex-wrap gap-2">
                    <div className="flex items-center gap-2">
                      <Pill className="h-4 w-4 text-emerald-300" />
                      <h4 className="text-xs font-bold tracking-wide">Inpatient Medicine Requisition</h4>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        disabled={isLoadingMedicines}
                        onClick={() => loadMedicines(true)}
                        className="px-2.5 py-1 text-[11px] font-medium bg-emerald-900/80 hover:bg-emerald-800 disabled:opacity-50 text-emerald-100 rounded-lg border border-emerald-700/60 flex items-center gap-1.5 transition-colors cursor-pointer"
                        title="Reload latest medicines and live stock from Pharmacy"
                      >
                        <RefreshCw className={`h-3 w-3 ${isLoadingMedicines ? 'animate-spin' : ''}`} />
                        <span>Sync Stock</span>
                      </button>
                      <span className="px-2.5 py-0.5 text-[10px] font-bold bg-emerald-950/70 text-emerald-200 border border-emerald-700/60 rounded-full">
                        Live Central Pharmacy Stock
                      </span>
                    </div>
                  </div>

                  <form onSubmit={handleCreatePharmacyRequest} className="p-4 space-y-3.5">
                    {pharmLines.map((line, idx) => {
                      const selMed = medicines.find((m) => m.id === line.medicineId);
                      const availableUnits = getAvailableUnitsForMedicine(selMed);
                      const conv = line.conversionToBase || 1;
                      const baseUnitName = selMed?.baseUnit?.name || selMed?.unit || 'Unit';
                      const selectedUnitName = line.unit || baseUnitName;
                      const effectiveUnitPrice =
                        line.overrideSaleRate !== undefined && line.overrideSaleRate !== null
                          ? Number(line.overrideSaleRate)
                          : Number(selMed?.saleRate || 0) * conv;
                      const subtotal = effectiveUnitPrice * (line.requestedQuantity || 1);
                      const totalBaseQty = Math.round((line.requestedQuantity || 1) * conv * 1000) / 1000;

                      return (
                        <div key={idx} className="space-y-2 p-3 bg-slate-50/60 border border-slate-200/80 rounded-xl">
                          <div className="flex flex-col sm:flex-row sm:items-start gap-2.5">
                            <div className="flex-1">
                              <Select
                                label={idx === 0 ? 'Select Medicine from Pharmacy Stock' : undefined}
                                placeholder="Choose medicine from pharmacy…"
                                options={medicines.map((m) => {
                                  const packNames = (m.packagingLevels || []).map((p) => p.unit?.name).filter(Boolean);
                                  const packInfo = packNames.length > 0 ? ` • ${packNames.join('/')}` : '';
                                  return {
                                    label: `${m.name}${m.code ? ` (${m.code})` : ''} — Stock: ${m.currentStock} ${m.unit || ''} (Rs. ${m.saleRate}${packInfo})`,
                                    value: m.id,
                                  };
                                })}
                                value={line.medicineId}
                                onChange={(e) => {
                                  const chosenMed = medicines.find((m) => m.id === e.target.value);
                                  const units = getAvailableUnitsForMedicine(chosenMed);
                                  const defaultUnit = units[0]?.value || chosenMed?.unit || 'Unit';
                                  const defaultConv = units[0]?.conversionToBase ?? 1;
                                  const defaultOverride = units[0]?.overrideSaleRate ?? null;
                                  const next = [...pharmLines];
                                  next[idx] = {
                                    medicineId: e.target.value,
                                    requestedQuantity: next[idx]?.requestedQuantity || 1,
                                    unit: defaultUnit,
                                    conversionToBase: defaultConv,
                                    overrideSaleRate: defaultOverride,
                                  };
                                  setPharmLines(next);
                                }}
                              />
                            </div>
                            <div className="w-full sm:w-28 shrink-0">
                              <NumberInput
                                label={idx === 0 ? 'Requested Qty' : undefined}
                                min={1}
                                value={line.requestedQuantity}
                                onChange={(e) => {
                                  const next = [...pharmLines];
                                  next[idx] = { ...next[idx], requestedQuantity: Number(e.target.value) || 1 };
                                  setPharmLines(next);
                                }}
                              />
                            </div>
                            <div className="w-full sm:w-44 shrink-0">
                              <Select
                                label={idx === 0 ? 'Packaging / Unit' : undefined}
                                options={availableUnits.map((u) => ({
                                  label: u.label,
                                  value: u.value,
                                }))}
                                value={line.unit || baseUnitName}
                                onChange={(e) => {
                                  const units = getAvailableUnitsForMedicine(selMed);
                                  const matched = units.find((u) => u.value === e.target.value);
                                  const next = [...pharmLines];
                                  next[idx] = {
                                    ...next[idx],
                                    unit: e.target.value,
                                    conversionToBase: matched?.conversionToBase ?? 1,
                                    overrideSaleRate: matched?.overrideSaleRate ?? null,
                                  };
                                  setPharmLines(next);
                                }}
                              />
                            </div>
                            {pharmLines.length > 1 && (
                              <div className={idx === 0 ? 'sm:pt-6 pt-0' : 'sm:pt-1 pt-0 self-end sm:self-auto'}>
                                <button
                                  type="button"
                                  title="Remove item"
                                  onClick={() => setPharmLines(pharmLines.filter((_, i) => i !== idx))}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer"
                                >
                                  <X className="h-4 w-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* Medicine Details Card Shown Underneath When Selected */}
                          {selMed && (
                            <div className="mt-2 p-2.5 bg-white rounded-lg border border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs animate-in fade-in duration-150">
                              <div>
                                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Unit Price</span>
                                <span className="font-bold text-slate-900 block mt-0.5 font-mono">
                                  {formatPKR(effectiveUnitPrice)}
                                  <span className="text-[10.5px] font-normal text-slate-500 ml-1">/ {selectedUnitName}</span>
                                </span>
                                {conv > 1 && (
                                  <span className="text-[10px] text-slate-400 font-normal block">
                                    ({formatPKR(Number(selMed.saleRate || 0))} / {baseUnitName})
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Available Stock</span>
                                <span
                                  className={`font-bold block mt-0.5 ${
                                    Number(selMed.currentStock) > 0 ? 'text-emerald-700' : 'text-rose-600'
                                  }`}
                                >
                                  {selMed.currentStock} {baseUnitName}
                                </span>
                                {conv > 1 && Number(selMed.currentStock) > 0 && (
                                  <span className="text-[10px] text-slate-400 font-normal block">
                                    (~{(Number(selMed.currentStock) / conv).toFixed(1)} {selectedUnitName})
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Requested In Base</span>
                                <span className="font-bold text-indigo-700 block mt-0.5 font-mono">
                                  {line.requestedQuantity || 1} {selectedUnitName}
                                </span>
                                {conv > 1 && (
                                  <span className="text-slate-500 font-normal text-[10px] block">
                                    = {totalBaseQty} {baseUnitName}
                                  </span>
                                )}
                              </div>
                              <div>
                                <span className="text-[10.5px] font-bold text-slate-400 uppercase tracking-wider block">Estimated Subtotal</span>
                                <span className="font-bold text-emerald-800 block mt-0.5 font-mono">
                                  {formatPKR(subtotal)}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={() =>
                        setPharmLines([
                          ...pharmLines,
                          { medicineId: '', requestedQuantity: 1, unit: 'Unit', conversionToBase: 1 },
                        ])
                      }
                      className="inline-flex items-center gap-1.5 text-xs font-bold text-[#08775A] hover:text-[#065f46] hover:bg-[#effaf5] px-2.5 py-1 rounded-lg border border-[#c2e7db] transition-colors cursor-pointer"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      <span>Add another medicine line</span>
                    </button>

                    <Textarea
                      label="Special Clinical Instructions / Dosage Notes (optional)"
                      rows={2}
                      placeholder="e.g. Dosage instructions, administration route (IV/IM/Oral), stat/routine priority…"
                      value={pharmNotes}
                      onChange={(e) => setPharmNotes(e.target.value)}
                    />

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-slate-500">
                        Orders are sent immediately to Central Pharmacy for fulfillment
                      </span>
                      <button
                        type="submit"
                        disabled={isSaving}
                        className="px-5 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        <span>{isSaving ? 'Submitting to Pharmacy…' : 'Submit Medicine Requisition'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Inpatient Pharmacy Orders History */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                <div className="bg-slate-50/80 border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Requisition History &amp; Dispensation Status
                    </span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-200/80 text-slate-700 rounded-full">
                    {detail.pharmacyRequests.length} {detail.pharmacyRequests.length === 1 ? 'order' : 'orders'}
                  </span>
                </div>

                {detail.pharmacyRequests.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 font-medium">
                    No medicine requisitions submitted for this inpatient stay yet.
                  </div>
                ) : (
                  <div className="divide-y divide-slate-100">
                    {detail.pharmacyRequests.map((r) => {
                      const shortReqId = r.medicineRequestNumber.replace(/^REQ-\d{2}-/, 'REQ-');
                      return (
                        <div key={r.id} className="p-4 hover:bg-slate-50/50 transition-colors space-y-2.5">
                          <div className="flex items-center justify-between flex-wrap gap-2">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                                {shortReqId}
                              </span>
                              <span className="text-xs text-slate-500 font-mono text-[11px]">{r.requestedAt}</span>
                              {r.requestedByLabel && (
                                <span className="text-[11px] text-slate-400">• By {r.requestedByLabel}</span>
                              )}
                            </div>
                            {r.status === 'DISPENSED' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
                                <span className="w-1.5 h-1.5 rounded-full bg-[#08775A]" />
                                DISPENSED
                              </span>
                            ) : r.status === 'AUTHORIZATION_REQUIRED' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                                HIGH COST AUTHORIZATION REQUIRED
                              </span>
                            ) : r.status === 'REJECTED' || r.status === 'CANCELLED' ? (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
                                {r.status}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
                                <span className="w-1.5 h-1.5 rounded-full bg-sky-500 animate-pulse" />
                                {r.status.replaceAll('_', ' ')}
                              </span>
                            )}
                          </div>

                          <div className="flex flex-wrap gap-1.5">
                            {r.lines.map((l, idx) => (
                              <span
                                key={`${l.medicineName}-${idx}`}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-200/80 text-slate-800 text-xs shadow-2xs"
                              >
                                <span>{l.medicineName}</span>
                                <strong className="text-[#08775A] font-bold font-mono">× {l.requestedQuantity}</strong>
                              </span>
                            ))}
                          </div>

                          {r.lines.some((l) => l.notes) && (
                            <p className="text-[11px] text-slate-500 italic bg-slate-50 p-2 rounded-lg border border-slate-200/60">
                              Instructions: {r.lines.map((l) => l.notes).filter(Boolean).join('; ')}
                            </p>
                          )}

                          {r.status === 'AUTHORIZATION_REQUIRED' && (
                            <div className="pt-1">
                              <button
                                type="button"
                                onClick={() => setHighCostTarget(r)}
                                className="px-3 py-1.5 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl shadow-xs transition-colors cursor-pointer"
                              >
                                Review High-Cost Authorization
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'bed' && (
            <div className="space-y-4">
              {/* Active Inpatient Bed Telemetry Card */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                <div className="bg-[#0e5944] px-4 py-3 flex items-center justify-between text-white flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Bed className="h-4 w-4 text-emerald-300" />
                    <div>
                      <h4 className="text-xs font-bold tracking-wide">Active Inpatient Bed Telemetry</h4>
                      <p className="text-[11px] text-emerald-200/90 font-normal">
                        Physical location &amp; bed allocation for current admission
                      </p>
                    </div>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-950/70 text-emerald-200 border border-emerald-700/60">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    OCCUPIED
                  </span>
                </div>

                <div className="p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs bg-slate-50/40">
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">Assigned Department</span>
                    <span className="font-bold text-slate-900 truncate block mt-0.5 text-sm" title={detail.departmentName}>
                      {detail.departmentName || 'Not assigned'}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">Allocated Ward / Room / Bed</span>
                    <span className="font-bold text-[#08775A] truncate block mt-0.5 text-sm" title={detail.bedLabel || ''}>
                      {detail.bedLabel || 'No bed assigned'}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">Attending Physician</span>
                    <span className="font-bold text-slate-900 truncate block mt-0.5 text-sm" title={detail.doctorName}>
                      {detail.doctorName || 'Not assigned'}
                    </span>
                  </div>
                  <div className="bg-white p-3 rounded-xl border border-slate-200/80 shadow-2xs">
                    <span className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider block">Assigned RMO</span>
                    <span className="font-bold text-slate-900 truncate block mt-0.5 text-sm" title={detail.rmoName || ''}>
                      {detail.rmoName || 'None assigned'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Inter-Ward Bed Transfer Action Form */}
              {(detail.status === 'ACTIVE' || detail.status === 'DISCHARGE_PENDING') && (
                <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                  <div className="bg-slate-50/80 border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ArrowLeftRight className="h-3.5 w-3.5 text-[#08775A]" />
                      <span className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                        Initiate Inter-Ward Bed Transfer
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500">
                      Reallocates bed and releases current bed to AVAILABLE
                    </span>
                  </div>

                  <form onSubmit={handleTransferBed} className="p-4 space-y-3.5">
                    <TransferLocationFields
                      refreshVersion={transferVersion}
                      bedId={targetBedId}
                      onChange={setTargetBedId}
                      currentBedId={detail.bedId}
                    />

                    <TextInput
                      label="Reason / Clinical Justification for Bed Transfer"
                      required
                      placeholder="e.g. Shifted to ICU for monitoring, post-op step down to General Ward, attendant requested private room…"
                      value={transferReason}
                      onChange={(e) => setTransferReason(e.target.value)}
                    />

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-slate-500">
                        Transfer takes effect immediately across all nursing stations
                      </span>
                      <button
                        type="submit"
                        disabled={isSaving || !targetBedId || !transferReason.trim()}
                        className="px-5 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        <span>{isSaving ? 'Transferring Bed…' : 'Execute Bed Transfer'}</span>
                      </button>
                    </div>
                  </form>
                </div>
              )}

              {/* Bed Transfer History Log */}
              <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                <div className="bg-slate-50/80 border-b border-slate-200/80 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Clock className="h-3.5 w-3.5 text-slate-500" />
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                      Bed Movement &amp; Transfer History
                    </span>
                  </div>
                  <span className="px-2 py-0.5 text-[10px] font-bold bg-slate-200/80 text-slate-700 rounded-full">
                    {detail.bedTransfers.length} {detail.bedTransfers.length === 1 ? 'movement' : 'movements'}
                  </span>
                </div>

                {detail.bedTransfers.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-400 font-medium">
                    Patient has remained in their initial allocated bed since admission.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-[#effaf5] border-b border-[#c2e7db]/70 text-[11px] font-bold text-[#08775A] uppercase tracking-wider">
                        <tr>
                          <th className="py-2.5 px-4">From → To Bed</th>
                          <th className="py-2.5 px-4">Reason</th>
                          <th className="py-2.5 px-4">Transferred By</th>
                          <th className="py-2.5 px-4 text-right">Timestamp</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {detail.bedTransfers.map((t) => (
                          <tr key={t.id} className="hover:bg-slate-50/60 transition-colors">
                            <td className="py-2.5 px-4">
                              <span className="inline-flex items-center gap-1.5 font-bold">
                                <span className="px-2 py-0.5 rounded text-[10px] bg-slate-100 text-slate-700 border border-slate-200">
                                  {t.fromBedLabel}
                                </span>
                                <ArrowRight className="h-3 w-3 text-slate-400" />
                                <span className="px-2 py-0.5 rounded text-[10px] bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
                                  {t.toBedLabel}
                                </span>
                              </span>
                            </td>
                            <td className="py-2.5 px-4 text-slate-700 font-medium">{t.reason}</td>
                            <td className="py-2.5 px-4 text-slate-500">{t.transferredByLabel}</td>
                            <td className="py-2.5 px-4 text-slate-400 text-right font-mono text-[11px] whitespace-nowrap">
                              {t.transferredAt}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === 'clearances' && (
            <div className="space-y-4">
              {/* Protocol Overview Strip */}
              {(() => {
                const visibleClearances = detail.clearances.filter((c) => c.clearanceType !== 'PHARMACY');
                return (
                  <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
                    <div className="bg-[#0e5944] px-4 py-3 flex items-center justify-between text-white flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className="h-4 w-4 text-emerald-300" />
                        <div>
                          <h4 className="text-xs font-bold tracking-wide">Inpatient Discharge Protocol &amp; Gate Verification</h4>
                          <p className="text-[11px] text-emerald-200/90 font-normal">
                            Mandatory clearances required prior to patient release and bed clearance (Clinical &amp; Hospital Billing)
                          </p>
                        </div>
                      </div>
                      <span className="px-2.5 py-1 text-xs font-bold rounded-full bg-emerald-950/70 text-emerald-200 border border-emerald-700/60">
                        {visibleClearances.filter((c) => c.status === 'CLEARED' || c.status === 'NOT_APPLICABLE').length} / {visibleClearances.length} Gates Approved
                      </span>
                    </div>

                    <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      {visibleClearances.map((c) => {
                    const isCleared = c.status === 'CLEARED' && (c.clearanceType !== 'HOSPITAL_BILLING' || ((ledgerSummary?.outstandingBalance ?? detail.totalOutstanding) === 0));
                    const isNA = c.status === 'NOT_APPLICABLE';
                    return (
                      <div
                        key={c.id}
                        className={`p-4 rounded-xl border flex flex-col justify-between gap-3 transition-all ${
                          isCleared
                            ? 'bg-[#effaf5]/50 border-[#c2e7db]'
                            : isNA
                            ? 'bg-slate-50/70 border-slate-200'
                            : 'bg-white border-amber-200/80 shadow-2xs'
                        }`}
                      >
                        <div className="space-y-1.5">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-bold text-slate-900">
                              {CLEARANCE_LABEL[c.clearanceType]} Gate
                            </span>
                            {isCleared ? (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
                                <Check className="h-3 w-3" /> Cleared
                              </span>
                            ) : isNA ? (
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-600 border border-slate-200">
                                N/A
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                                Pending
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-500 leading-relaxed">
                            {c.clearanceType === 'CLINICAL'
                              ? 'Attending physician clinical authorization, final diagnosis, and discharge summary.'
                              : c.clearanceType === 'HOSPITAL_BILLING'
                              ? 'Finance clearance verifying settlement of room charges, services, and inpatient dues.'
                              : 'Reconciliation of inpatient medications, drug returns, and pharmacy billing closure.'}
                          </p>

                          {isCleared && c.clearedByLabel && (
                            <span className="text-[10.5px] text-slate-500 block pt-1 border-t border-slate-200/60">
                              Approved by <strong className="text-slate-800">{c.clearedByLabel}</strong> • {c.clearedAt}
                            </span>
                          )}
                        </div>

                        <div className="pt-2">
                          {isCleared || isNA ? (
                            <div className="flex items-center gap-1 text-xs font-bold text-[#08775A]">
                              <CheckCircle2 className="h-4 w-4" /> Gate Satisfied
                            </div>
                          ) : c.clearanceType === 'CLINICAL' ? (
                            <button
                              type="button"
                              onClick={() => setIsClinicalDischargeOpen(true)}
                              className="w-full px-3 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs transition-colors cursor-pointer text-center"
                            >
                              Doctor Discharge Authorization
                            </button>
                          ) : c.clearanceType === 'HOSPITAL_BILLING' && ((ledgerSummary?.outstandingBalance ?? detail.totalOutstanding) > 0) ? (
                            <div className="space-y-2">
                              <div className="p-2 rounded-lg bg-amber-50 border border-amber-200 text-[11px] text-amber-900 flex items-center justify-between">
                                <span className="font-semibold">Outstanding Due:</span>
                                <span className="font-bold font-mono text-amber-800">{formatPKR(ledgerSummary?.outstandingBalance ?? detail.totalOutstanding)}</span>
                              </div>
                              <button
                                type="button"
                                disabled={isSaving}
                                onClick={handleRequestBillingClearance}
                                className="w-full px-3 py-2 text-xs font-bold text-white bg-amber-700 hover:bg-amber-800 rounded-xl shadow-xs disabled:opacity-60 transition-colors cursor-pointer text-center flex items-center justify-center gap-1.5"
                                title="Send clearance and payment notification to Front Desk"
                              >
                                <Send className="h-3.5 w-3.5" />
                                <span>Request Billing Clearance from Front Desk</span>
                              </button>
                            </div>
                          ) : (
                            <button
                              type="button"
                              disabled={isSaving}
                              onClick={() => handleGrantClearance(c.clearanceType)}
                              className="w-full px-3 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs disabled:opacity-60 transition-colors cursor-pointer text-center"
                            >
                              Grant {CLEARANCE_LABEL[c.clearanceType]} Clearance
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Doctor Discharge Summary Card */}
          {detail.dischargeSummary && (
            <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-[0_2px_8px_rgba(0,0,0,0.03)]">
              <div className="bg-[#0e5944] px-4 py-2.5 text-xs font-bold text-white flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-emerald-300" />
                  <span className="tracking-wide">Doctor / RMO Discharge Summary Record</span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsPrintSlipOpen(true)}
                    className="px-2.5 py-1 text-[11px] font-bold bg-white text-[#0e5944] hover:bg-emerald-50 rounded-lg shadow-xs flex items-center gap-1.5 cursor-pointer transition-colors"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Print Official Discharge Form</span>
                  </button>
                  <span className="text-emerald-200 font-mono text-[11px] font-normal">{detail.dischargeSummary.authorizedAt}</span>
                </div>
              </div>
              <div className="p-4 space-y-2 text-xs bg-slate-50/40">
                <p><strong className="text-slate-700">Final Diagnosis:</strong> <span className="text-slate-900 font-medium">{detail.dischargeSummary.finalDiagnosis}</span></p>
                {detail.dischargeSummary.associatedDiagnosisA && (
                  <p><strong className="text-slate-700">(a) Ass Diagnosis:</strong> <span className="text-slate-800">{detail.dischargeSummary.associatedDiagnosisA}</span></p>
                )}
                {detail.dischargeSummary.associatedDiagnosisB && (
                  <p><strong className="text-slate-700">(b) Ass Diagnosis:</strong> <span className="text-slate-800">{detail.dischargeSummary.associatedDiagnosisB}</span></p>
                )}
                {detail.dischargeSummary.weightOnDischarge && (
                  <p><strong className="text-slate-700">Discharge Weight:</strong> <span className="text-slate-900 font-bold">{detail.dischargeSummary.weightOnDischarge}</span></p>
                )}
                <p><strong className="text-slate-700">Condition at Discharge:</strong> <span className="text-slate-900 font-medium">{detail.dischargeSummary.conditionAtDischarge}</span></p>
                {detail.dischargeSummary.prescriptionOnDischarge && (
                  <p><strong className="text-slate-700">Prescription on Discharge:</strong> <span className="text-slate-800 font-medium">{detail.dischargeSummary.prescriptionOnDischarge}</span></p>
                )}
                <p className="text-[11px] text-slate-500 pt-1.5 border-t border-slate-200/60">
                  Authorized by <strong className="text-slate-800">{detail.dischargeSummary.doctorNameSnapshot}</strong>
                  {detail.dischargeSummary.doctorDepartmentSnapshot && ` (${detail.dischargeSummary.doctorDepartmentSnapshot})`}
                </p>
              </div>
            </div>
          )}

          {/* Ready for Final Release Card */}
          {isAllClearancesReady && detail.status !== 'DISCHARGED' && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2.5 text-emerald-900 font-semibold">
                <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
                <div>
                  <p className="font-bold text-emerald-950 text-sm">All Discharge Clearances Satisfied</p>
                  <p className="text-[11px] text-emerald-800 font-normal">
                    Clinical and Hospital Billing gates are fully approved. Patient is cleared for discharge (all hospital &amp; pharmacy dues settled).
                  </p>
                </div>
              </div>
                  <button
                    type="button"
                    onClick={handleFinalDischarge}
                    disabled={isDischarging}
                    className="px-5 py-2.5 bg-[#08775A] hover:bg-[#065f46] text-white font-bold rounded-xl shadow-xs flex items-center gap-1.5 shrink-0 cursor-pointer disabled:opacity-60 text-xs transition-colors"
                  >
                    {isDischarging && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    <span>Complete Final Discharge &amp; Release Bed</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {isClinicalDischargeOpen && (
        <ClinicalDischargeModal
          admission={detail}
          outstanding={ledgerSummary?.outstandingBalance ?? detail?.totalOutstanding ?? 0}
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

      {isPrintSlipOpen && detail && detail.dischargeSummary && (
        <DischargeSlipPrintModal
          admission={detail}
          summary={detail.dischargeSummary}
          onClose={() => setIsPrintSlipOpen(false)}
        />
      )}
    </Modal>
  );
};
