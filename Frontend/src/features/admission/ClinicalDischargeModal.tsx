import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  UserRound,
  Stethoscope,
  Lock,
  Calendar,
  FileText,
  KeyRound,
  RefreshCw,
  Printer,
} from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { TextInput, Textarea, DatePicker } from '../../components/forms/FormControls';
import { useToast } from '../../context/ToastContext';
import {
  clinicalDischarge,
  verifyDischargeDoctor,
  AdmissionRecord,
  DischargeDoctor,
  AdmissionDischargeSummary,
} from '../../services/admissionService';
import { DischargeSlipPrintModal } from './DischargeSlipPrintModal';

interface ClinicalDischargeModalProps {
  admission: AdmissionRecord;
  onClose: () => void;
  onDischarged: () => void;
}

type FinalOutcome = 'Discharge' | 'Lama' | 'DOR' | 'Died';

export const ClinicalDischargeModal: React.FC<ClinicalDischargeModalProps> = ({
  admission,
  onClose,
  onDischarged,
}) => {
  const toast = useToast();

  // Verification state (Doctor or RMO)
  const [doctorUsername, setDoctorUsername] = useState('');
  const [doctorPassword, setDoctorPassword] = useState('');
  const [doctor, setDoctor] = useState<DischargeDoctor | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);

  // Form Fields - Top Metadata
  const defaultDischargeDate = new Date().toISOString().slice(0, 10);
  const [dischargeDate, setDischargeDate] = useState(defaultDischargeDate);
  const [nicu, setNicu] = useState('');
  const [weightOnAdmission, setWeightOnAdmission] = useState(
    admission.weightKg ? `${admission.weightKg} kg` : ''
  );
  const [weightOnDischarge, setWeightOnDischarge] = useState('');

  // Editable Demographics fallback
  const [patientFatherName, setPatientFatherName] = useState(admission.patientFatherName || '');
  const [patientAge, setPatientAge] = useState(admission.patientAge || '');
  const [patientGender, setPatientGender] = useState(admission.patientGender || '');
  const [patientAddress, setPatientAddress] = useState(admission.patientAddress || '');

  // Form Fields - Numbered Sections (1 to 8)
  const [finalDiagnosis, setFinalDiagnosis] = useState(admission.diagnosis || '');
  const [associatedDiagnosisA, setAssociatedDiagnosisA] = useState('');
  const [associatedDiagnosisB, setAssociatedDiagnosisB] = useState('');
  const [history, setHistory] = useState('');
  const [examination, setExamination] = useState('');
  const [investigations, setInvestigations] = useState('');
  const [treatmentSummary, setTreatmentSummary] = useState('');
  const [prescriptionOnDischarge, setPrescriptionOnDischarge] = useState('');
  const [followUpVisit, setFollowUpVisit] = useState('');
  const [finalOutcome, setFinalOutcome] = useState<FinalOutcome>('Discharge');

  const [error, setErrorState] = useState<string | null>(null);
  const setError = (msg: string | null) => {
    setErrorState(msg);
    if (msg) toast.error(msg, 'Validation / Auth Error');
  };

  const [isSaving, setIsSaving] = useState(false);
  const [savedSummaryForPrint, setSavedSummaryForPrint] = useState<AdmissionDischargeSummary | null>(null);

  // Reset verified doctor if credentials are edited
  const changeCredential = (patch: { username?: string; password?: string }) => {
    if (patch.username !== undefined) setDoctorUsername(patch.username);
    if (patch.password !== undefined) setDoctorPassword(patch.password);
    if (doctor) setDoctor(null);
  };

  const handleVerify = async () => {
    if (!doctorUsername.trim() || !doctorPassword) {
      setError('Doctor or RMO username and password are required.');
      return;
    }
    setIsVerifying(true);
    setErrorState(null);
    try {
      const verified = await verifyDischargeDoctor(doctorUsername.trim(), doctorPassword);
      setDoctor(verified);
      toast.success(`Verified: ${verified.fullName} (${verified.designation || verified.department || 'Clinical Staff'})`);
    } catch (err: any) {
      setError(err?.message || 'Invalid clinician credentials.');
    } finally {
      setIsVerifying(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctor) {
      await handleVerify();
      return;
    }
    if (!finalDiagnosis.trim()) {
      setError('Final Diagnosis is required.');
      return;
    }

    setIsSaving(true);
    setErrorState(null);
    try {
      const summaryPayload = {
        finalDiagnosis: finalDiagnosis.trim(),
        associatedDiagnosisA: associatedDiagnosisA.trim() || undefined,
        associatedDiagnosisB: associatedDiagnosisB.trim() || undefined,
        history: history.trim() || undefined,
        examination: examination.trim() || undefined,
        investigations: investigations.trim() || undefined,
        treatmentSummary: treatmentSummary.trim() || 'Patient managed conservatively in ward and responded satisfactorily.',
        conditionAtDischarge: 'Stable',
        prescriptionOnDischarge: prescriptionOnDischarge.trim() || undefined,
        medicinesInstructions: prescriptionOnDischarge.trim() || undefined,
        followUpAdvice: followUpVisit.trim() || undefined,
        nicu: nicu.trim() || undefined,
        weightOnAdmission: weightOnAdmission.trim() || undefined,
        weightOnDischarge: weightOnDischarge.trim() || undefined,
        finalOutcome,
        dischargeDate: dischargeDate || undefined,
      };

      await clinicalDischarge(admission.id, {
        doctorUsername: doctorUsername.trim(),
        doctorPassword,
        dischargeSummary: summaryPayload,
      });

      toast.success(`${admission.patientName} discharged by ${doctor.fullName}. Official discharge form generated.`);

      // Prepare local summary object to display print modal immediately
      const generatedSummary: AdmissionDischargeSummary = {
        ...summaryPayload,
        medicinesInstructions: summaryPayload.medicinesInstructions || '',
        conditionAtDischarge: 'Stable',
        treatmentSummary: summaryPayload.treatmentSummary,
        doctorNameSnapshot: doctor.fullName,
        doctorDepartmentSnapshot: doctor.department || undefined,
        doctorDesignation: doctor.designation || undefined,
        authorizedAt: new Date().toLocaleString('en-PK'),
      };

      setSavedSummaryForPrint(generatedSummary);
    } catch (err: any) {
      setError(err?.message || 'Failed to authorize clinical discharge.');
    } finally {
      setIsSaving(false);
    }
  };

  // If discharge succeeded and print modal is active, display it
  if (savedSummaryForPrint) {
    return (
      <DischargeSlipPrintModal
        admission={{
          ...admission,
          patientFatherName: patientFatherName || admission.patientFatherName,
          patientAge: patientAge || admission.patientAge,
          patientGender: patientGender || admission.patientGender,
          patientAddress: patientAddress || admission.patientAddress,
        }}
        summary={savedSummaryForPrint}
        onClose={() => {
          setSavedSummaryForPrint(null);
          onDischarged();
        }}
      />
    );
  }

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-emerald-100 text-[#08775A] flex items-center justify-center shrink-0">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-bold text-slate-900 leading-tight">
              Patient Discharge Form (RMO / Doctor)
            </div>
            <div className="text-[11px] text-slate-500 font-medium mt-0.5 flex items-center gap-2 flex-wrap">
              <span className="font-mono font-bold text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                {admission.admissionNumber}
              </span>
              <span className="font-semibold text-slate-800">{admission.patientName}</span>
              {admission.patientMrNumber && (
                <span className="text-slate-500">MR: {admission.patientMrNumber}</span>
              )}
              {admission.departmentName && (
                <span className="text-slate-500">• {admission.departmentName}</span>
              )}
              {admission.bedLabel && (
                <span className="text-slate-500">• {admission.bedLabel}</span>
              )}
            </div>
          </div>
        </div>
      }
      maxWidth="4xl"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-center gap-2.5 text-xs text-rose-700 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* STEP 1: DOCTOR / RMO CREDENTIALS & DIGITAL SIGNATURE */}
        <div className="p-4 bg-slate-50/80 border border-slate-200 rounded-2xl space-y-3">
          <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#08775A]" />
              <span className="text-xs font-bold uppercase tracking-wider text-slate-800">
                Step 1 — Doctor / RMO Verification &amp; Digital Signature
              </span>
            </div>
            <span className="text-[10.5px] font-medium text-slate-500">
              RMO or Consultant Attending Clinician
            </span>
          </div>

          {!doctor ? (
            <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-3 items-end">
              <div>
                <TextInput
                  label="Clinician Username (Doctor / RMO) *"
                  required
                  autoComplete="off"
                  placeholder="e.g. dr_ahmed or rmo_fahad"
                  value={doctorUsername}
                  onChange={(e) => changeCredential({ username: e.target.value })}
                />
              </div>
              <div>
                <TextInput
                  label="Password *"
                  required
                  type="password"
                  autoComplete="new-password"
                  placeholder="••••••••••••"
                  value={doctorPassword}
                  onChange={(e) => changeCredential({ password: e.target.value })}
                />
              </div>
              <button
                type="button"
                onClick={handleVerify}
                disabled={isVerifying}
                className="h-9 px-4 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs disabled:opacity-60 inline-flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
              >
                {isVerifying ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    <span>Verifying…</span>
                  </>
                ) : (
                  <>
                    <KeyRound className="h-3.5 w-3.5" />
                    <span>Verify Clinician</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-emerald-100 text-[#08775A] flex items-center justify-center shrink-0 border border-emerald-300">
                  <UserRound className="h-5 w-5" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-bold text-slate-900">{doctor.fullName}</p>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                      <CheckCircle2 className="h-3 w-3" /> Verified Clinician
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-0.5">
                    {[doctor.designation, doctor.department, `Emp ID: ${doctor.employeeId}`].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDoctor(null)}
                className="text-xs font-semibold text-slate-500 hover:text-slate-800 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" />
                <span>Change</span>
              </button>
            </div>
          )}
        </div>

        {/* STEP 2: DISCHARGE FORM (FAITHFULLY REPLICATING PHYSICAL CLINIC FORM) */}
        <fieldset
          disabled={!doctor}
          className={`space-y-4 transition-opacity duration-200 ${
            doctor ? 'opacity-100' : 'opacity-40 pointer-events-none'
          }`}
        >
          {/* Paper Form Preview Header Card */}
          <div className="border border-slate-300 rounded-2xl bg-white p-5 shadow-xs space-y-4">
            {/* Physical Clinic Stationery Header */}
            <div className="text-center border-b-2 border-slate-800 pb-3">
              <h2 className="text-lg font-black tracking-wider text-slate-900 uppercase">
                CH. SHARIF &amp; SAEED
              </h2>
              <p className="text-xs font-bold tracking-widest text-slate-700 uppercase">
                Maternal and Child Care Clinic
              </p>
              <p className="text-[11px] text-slate-500">
                B-144, Main Sharah-e-Quaideen, Near Underpass, Karachi. Phone: 0301-6569996
              </p>
              <span className="inline-block mt-1 px-3 py-0.5 text-xs font-black tracking-widest text-slate-900 uppercase bg-slate-100 rounded-md border border-slate-300">
                (DISCHARGE FORM)
              </span>
            </div>

            {/* Top Demographics Matrix: Auto-populated from DB & Editable Fields */}
            <div className="bg-slate-50/70 p-4 rounded-xl border border-slate-200 space-y-3">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                <span>Patient Demographics &amp; Stay Details</span>
                <span className="text-[10px] text-emerald-700 font-semibold lowercase">
                  (dynamic records from admission + manual inputs)
                </span>
              </div>

              {/* Row 1: Admission & Discharge Dates + NICU */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Date of Admission (from Admission)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={admission.admittedAt || admission.createdAt || '—'}
                    className="w-full px-3 py-2 text-xs font-semibold bg-slate-100 border border-slate-200 rounded-xl text-slate-700 cursor-not-allowed"
                  />
                </div>
                <div>
                  <DatePicker
                    label="Date of Discharge *"
                    value={dischargeDate}
                    onChange={(e) => setDischargeDate(e.target.value)}
                  />
                </div>
                <div>
                  <TextInput
                    label="NICU (Manual Entry)"
                    placeholder="e.g. Cot 3 / Ward / N/A"
                    value={nicu}
                    onChange={(e) => setNicu(e.target.value)}
                  />
                </div>
              </div>

              {/* Row 2: Weights & Patient Identity */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="text-[11px] font-bold text-slate-700 block mb-1">
                    Patient Name (from Admission)
                  </label>
                  <input
                    type="text"
                    disabled
                    value={`${admission.patientName} ${admission.patientMrNumber ? `(${admission.patientMrNumber})` : ''}`}
                    className="w-full px-3 py-2 text-xs font-bold bg-slate-100 border border-slate-200 rounded-xl text-slate-900 cursor-not-allowed"
                  />
                </div>
                <div>
                  <TextInput
                    label="Weight on Admission"
                    placeholder="e.g. 3.1 kg"
                    value={weightOnAdmission}
                    onChange={(e) => setWeightOnAdmission(e.target.value)}
                  />
                  <span className="text-[10px] text-slate-500 font-medium block mt-1">
                    {admission.weightKg ? 'Auto-loaded from admission intake' : 'Manual entry'}
                  </span>
                </div>
                <div>
                  <TextInput
                    label="Weight on Discharge *"
                    placeholder="e.g. 3.4 kg"
                    value={weightOnDischarge}
                    onChange={(e) => setWeightOnDischarge(e.target.value)}
                  />
                  <span className="text-[10px] text-emerald-700 font-medium block mt-1">
                    Manual RMO / Doctor entry
                  </span>
                </div>
              </div>

              {/* Row 3: Father's Name, Age, Gender, Address */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <div className="sm:col-span-4">
                  <TextInput
                    label="Father's Name"
                    placeholder="Father / Guardian Name"
                    value={patientFatherName}
                    onChange={(e) => setPatientFatherName(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <TextInput
                    label="Age"
                    placeholder="e.g. 25Y / 4M"
                    value={patientAge}
                    onChange={(e) => setPatientAge(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <TextInput
                    label="Gender"
                    placeholder="Male / Female"
                    value={patientGender}
                    onChange={(e) => setPatientGender(e.target.value)}
                  />
                </div>
                <div className="sm:col-span-4">
                  <TextInput
                    label="Address"
                    placeholder="Patient residential address"
                    value={patientAddress}
                    onChange={(e) => setPatientAddress(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* Numbered Sections (1 to 8 as per the paper form) */}
            <div className="space-y-4 pt-1">
              {/* 1. Final Diagnosis & Associated Diagnoses */}
              <div className="p-3.5 bg-slate-50/50 rounded-xl border border-slate-200 space-y-2.5">
                <span className="text-xs font-bold text-slate-900 block">
                  1. Final Diagnosis &amp; Associated Diagnoses
                </span>
                <TextInput
                  label="Final Diagnosis *"
                  required
                  placeholder="e.g. Acute Bronchiolitis / Normal Vaginal Delivery"
                  value={finalDiagnosis}
                  onChange={(e) => setFinalDiagnosis(e.target.value)}
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <TextInput
                    label="(a) Ass Diagnosis"
                    placeholder="Associated / Secondary Diagnosis (a)"
                    value={associatedDiagnosisA}
                    onChange={(e) => setAssociatedDiagnosisA(e.target.value)}
                  />
                  <TextInput
                    label="(b) Ass Diagnosis"
                    placeholder="Associated / Secondary Diagnosis (b)"
                    value={associatedDiagnosisB}
                    onChange={(e) => setAssociatedDiagnosisB(e.target.value)}
                  />
                </div>
              </div>

              {/* 2. History */}
              <div>
                <Textarea
                  label="2. History"
                  rows={2}
                  placeholder="Chief complaints, presenting symptoms, illness history..."
                  value={history}
                  onChange={(e) => setHistory(e.target.value)}
                />
              </div>

              {/* 3. Examination */}
              <div>
                <Textarea
                  label="3. Examination"
                  rows={2}
                  placeholder="Clinical findings at discharge (vital signs, systemic exam, chest, abdomen, wound status)..."
                  value={examination}
                  onChange={(e) => setExamination(e.target.value)}
                />
              </div>

              {/* 4. Investigations */}
              <div>
                <Textarea
                  label="4. Investigations"
                  rows={2}
                  placeholder="CBC, CRP, ultrasound, blood cultures, X-Ray, labs summary..."
                  value={investigations}
                  onChange={(e) => setInvestigations(e.target.value)}
                />
              </div>

              {/* 5. Summary */}
              <div>
                <Textarea
                  label="5. Summary (Course in Hospital / Treatment Provided) *"
                  required
                  rows={3}
                  placeholder="Hospital course, interventions, procedures performed, antibiotics given, progress notes..."
                  value={treatmentSummary}
                  onChange={(e) => setTreatmentSummary(e.target.value)}
                />
              </div>

              {/* 6. Prescription on Discharge */}
              <div>
                <Textarea
                  label="6. Prescription on Discharge (Discharge Medications)"
                  rows={3}
                  placeholder="Medicine name, dosage, frequency, duration, special instructions..."
                  value={prescriptionOnDischarge}
                  onChange={(e) => setPrescriptionOnDischarge(e.target.value)}
                />
              </div>

              {/* 7. Follow-up Visit */}
              <div>
                <TextInput
                  label="7. Follow-up Visit"
                  placeholder="e.g. Review in OPD on 2026-10-27 with repeat CBC / SOS if fever recurs"
                  value={followUpVisit}
                  onChange={(e) => setFollowUpVisit(e.target.value)}
                />
              </div>

              {/* 8. Final Outcome Checkboxes */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-xs font-bold text-slate-900 block mb-2.5">
                  8. Final outcome
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {(['Discharge', 'Lama', 'DOR', 'Died'] as FinalOutcome[]).map((opt) => (
                    <label
                      key={opt}
                      onClick={() => setFinalOutcome(opt)}
                      className={`flex items-center gap-2.5 p-2.5 rounded-xl border cursor-pointer transition-all ${
                        finalOutcome === opt
                          ? 'bg-[#effaf5] border-[#08775A] text-[#08775A] font-bold shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                      }`}
                    >
                      <input
                        type="radio"
                        name="finalOutcome"
                        value={opt}
                        checked={finalOutcome === opt}
                        onChange={() => setFinalOutcome(opt)}
                        className="h-4 w-4 text-[#08775A] focus:ring-[#08775A]"
                      />
                      <span className="text-xs">{opt}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </fieldset>

        {/* Modal Action Bar */}
        <div className="flex items-center justify-between pt-3 border-t border-slate-200">
          <div className="text-xs text-slate-500">
            {doctor ? (
              <span className="inline-flex items-center gap-1.5 text-emerald-800 font-semibold">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Authorized by {doctor.fullName}</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-slate-500">
                <Lock className="h-3.5 w-3.5" />
                <span>Doctor or RMO verification required</span>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving || !doctor}
              className="px-5 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Authorizing &amp; Saving…</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Authorize &amp; Generate Form</span>
                </>
              )}
            </button>
          </div>
        </div>
      </form>
    </Modal>
  );
};
