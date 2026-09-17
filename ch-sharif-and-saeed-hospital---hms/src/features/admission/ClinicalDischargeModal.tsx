import React, { useState } from 'react';
import { AlertCircle, Loader2, ShieldCheck } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { TextInput, Textarea, DatePicker } from '../../components/forms/FormControls';
import { useToast } from '../../context/ToastContext';
import { clinicalDischarge, AdmissionRecord } from '../../services/admissionService';

interface ClinicalDischargeModalProps {
  admission: AdmissionRecord;
  onClose: () => void;
  onDischarged: () => void;
}

/**
 * Doctor Clinical Discharge Authorization (HMS_V7.2_NEW_REQUIREMENTS.md
 * §2.4) — the only way the CLINICAL clearance gate can be cleared. The
 * doctor re-authenticates with their own clinical-discharge credential
 * (separate from portal login) and completes the Discharge Summary; the
 * Admission-portal user who opened this modal never has to (and cannot)
 * grant this gate themselves.
 */
export const ClinicalDischargeModal: React.FC<ClinicalDischargeModalProps> = ({ admission, onClose, onDischarged }) => {
  const toast = useToast();
  const [doctorUsername, setDoctorUsername] = useState('');
  const [doctorPassword, setDoctorPassword] = useState('');
  const [finalDiagnosis, setFinalDiagnosis] = useState('');
  const [treatmentSummary, setTreatmentSummary] = useState('');
  const [conditionAtDischarge, setConditionAtDischarge] = useState('');
  const [medicinesInstructions, setMedicinesInstructions] = useState('');
  const [followUpAdvice, setFollowUpAdvice] = useState('');
  const [followUpDate, setFollowUpDate] = useState('');
  const [additionalNotes, setAdditionalNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!doctorUsername.trim() || !doctorPassword) {
      setError('Doctor username and password are required.');
      return;
    }
    if (!finalDiagnosis.trim() || !treatmentSummary.trim() || !conditionAtDischarge.trim() || !medicinesInstructions.trim()) {
      setError('Final Diagnosis, Treatment Summary, Condition at Discharge and Medicines/Instructions are required.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await clinicalDischarge(admission.id, {
        doctorUsername: doctorUsername.trim(),
        doctorPassword,
        dischargeSummary: {
          finalDiagnosis: finalDiagnosis.trim(),
          treatmentSummary: treatmentSummary.trim(),
          conditionAtDischarge: conditionAtDischarge.trim(),
          medicinesInstructions: medicinesInstructions.trim(),
          followUpAdvice: followUpAdvice.trim() || undefined,
          followUpDate: followUpDate || undefined,
          additionalNotes: additionalNotes.trim() || undefined,
        },
      });
      toast.success(`${admission.patientName} clinically discharged — routed to Front Desk for billing.`);
      onDischarged();
    } catch (err: any) {
      setError(err?.message || 'Failed to authorize clinical discharge.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Doctor Discharge Authorization"
      subtitle={`${admission.admissionNumber} — ${admission.patientName}. Only the authorizing doctor's own credential can clear this gate.`}
      maxWidth="2xl"
    >
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        <div className="p-3 bg-[#effaf5] border border-[#c2e7db] rounded-lg space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-[#08775A] flex items-center gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" /> Doctor Credentials
          </h4>
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Doctor Username" required autoComplete="off" value={doctorUsername} onChange={(e) => setDoctorUsername(e.target.value)} />
            <TextInput label="Doctor Password" required type="password" autoComplete="off" value={doctorPassword} onChange={(e) => setDoctorPassword(e.target.value)} />
          </div>
        </div>

        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Discharge Summary</h4>
          <Textarea label="Final Diagnosis" required rows={2} value={finalDiagnosis} onChange={(e) => setFinalDiagnosis(e.target.value)} />
          <Textarea label="Treatment / Procedures" required rows={2} value={treatmentSummary} onChange={(e) => setTreatmentSummary(e.target.value)} />
          <Textarea label="Condition at Discharge" required rows={2} value={conditionAtDischarge} onChange={(e) => setConditionAtDischarge(e.target.value)} />
          <Textarea label="Medicines / Instructions" required rows={2} value={medicinesInstructions} onChange={(e) => setMedicinesInstructions(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Follow-Up Advice (optional)" value={followUpAdvice} onChange={(e) => setFollowUpAdvice(e.target.value)} />
            <DatePicker label="Follow-Up Date (optional)" value={followUpDate} onChange={(e) => setFollowUpDate(e.target.value)} />
          </div>
          <Textarea label="Additional Notes (optional)" rows={2} value={additionalNotes} onChange={(e) => setAdditionalNotes(e.target.value)} />
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button>
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Authorize Clinical Discharge
          </button>
        </div>
      </form>
    </Modal>
  );
};
