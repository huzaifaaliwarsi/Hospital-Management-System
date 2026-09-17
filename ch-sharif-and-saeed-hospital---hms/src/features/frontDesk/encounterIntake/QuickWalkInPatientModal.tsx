import React, { useState } from 'react';
import { Zap, AlertCircle, Loader2, User, Phone, Calendar, Weight, ShieldAlert } from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { TextInput, NumberInput } from '../../../components/forms/FormControls';
import { Patient, PatientGender, PatientFormData } from '../../../types/patient';
import { createPatient } from '../../../services/patientRegistryService';
import { useAuth } from '../../../context/AuthContext';

interface QuickWalkInPatientModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPatientCreated: (patient: Patient, weight?: number) => void;
  encounterTypeLabel?: string;
}

export const QuickWalkInPatientModal: React.FC<QuickWalkInPatientModalProps> = ({
  isOpen,
  onClose,
  onPatientCreated,
  encounterTypeLabel = 'Walk-In',
}) => {
  const { currentUser } = useAuth();
  const [fullName, setFullName] = useState('');
  const [fatherGuardianName, setFatherGuardianName] = useState('');
  const [phone, setPhone] = useState('');
  const [age, setAge] = useState<number | ''>('');
  const [gender, setGender] = useState<PatientGender>('Male');
  const [weight, setWeight] = useState<number | ''>('');

  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const resetForm = () => {
    setFullName('');
    setFatherGuardianName('');
    setPhone('');
    setAge('');
    setGender('Male');
    setWeight('');
    setFormError(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const trimmedName = fullName.trim();
    const trimmedGuardian = fatherGuardianName.trim();
    const trimmedPhone = phone.trim();

    if (!trimmedName) {
      setFormError('Patient Full Name is required.');
      return;
    }
    if (!trimmedGuardian) {
      setFormError('Father / Guardian Name is required.');
      return;
    }
    if (!trimmedPhone || trimmedPhone.replace(/\D/g, '').length < 10) {
      setFormError('A valid phone number (at least 10 digits) is required.');
      return;
    }
    if (age === '' || Number(age) < 0 || Number(age) > 130) {
      setFormError('Please enter a valid age in years.');
      return;
    }

    setIsSubmitting(true);
    try {
      const currentYear = new Date().getFullYear();
      const birthYear = Math.max(1900, currentYear - Number(age));
      const dateOfBirth = `${birthYear}-01-01`;

      const patientData: PatientFormData = {
        fullName: trimmedName,
        fatherGuardianName: trimmedGuardian,
        guardianRelation: 'Father',
        gender,
        dateOfBirth,
        age: Number(age),
        ageIsEstimated: true,
        primaryPhone: trimmedPhone,
        alternatePhone: '',
        cnic: '',
        passportNumber: '',
        email: '',
        addressLine1: '',
        addressLine2: '',
        city: 'Gujrat',
        province: 'Punjab',
        country: 'Pakistan',
        bloodGroup: 'Unknown',
        payerType: 'Self Pay',
        panelId: '',
        panelName: '',
        panelMemberId: '',
        emergencyContactName: '',
        emergencyContactRelation: '',
        emergencyContactPhone: '',
        status: 'ACTIVE',
      };

      const res = await createPatient(patientData, currentUser);
      if (!res.success || !res.patient) {
        setFormError(res.error || 'Failed to quickly register walk-in patient.');
        return;
      }

      onPatientCreated(res.patient, weight === '' ? undefined : Number(weight));
      resetForm();
      onClose();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to register patient.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="md"
      title={
        <div className="flex items-center gap-2">
          <div className="h-7 w-7 rounded-lg bg-emerald-100 text-[#08775A] flex items-center justify-center">
            <Zap className="h-4 w-4" />
          </div>
          <div>
            <span className="text-sm font-bold text-slate-900">Quick Patient Registration ({encounterTypeLabel})</span>
            <span className="block text-[11px] font-normal text-slate-500">Fast-track intake in seconds. Only core info required.</span>
          </div>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-3.5 pt-1">
        {formError && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        {/* Full Name & Guardian Name */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextInput
            label="Patient Full Name"
            placeholder="e.g. Muhammad Ali"
            required
            autoFocus
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
          />
          <TextInput
            label="Father / Guardian Name"
            placeholder="e.g. Muhammad Akram"
            required
            value={fatherGuardianName}
            onChange={(e) => setFatherGuardianName(e.target.value)}
          />
        </div>

        {/* Contact Phone & Age */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <TextInput
            label="Contact Phone"
            placeholder="0300-1234567"
            required
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
          />
          <NumberInput
            label="Age (in Years)"
            placeholder="e.g. 30"
            required
            min={0}
            max={130}
            value={age}
            onChange={(e) => setAge(e.target.value === '' ? '' : Number(e.target.value))}
          />
        </div>

        {/* Gender Selection Pills */}
        <div>
          <label className="block text-xs font-semibold text-slate-700 mb-1.5">Gender *</label>
          <div className="grid grid-cols-3 gap-2">
            {(['Male', 'Female', 'Other / Not Specified'] as PatientGender[]).map((g) => {
              const selected = gender === g;
              return (
                <button
                  type="button"
                  key={g}
                  onClick={() => setGender(g)}
                  className={`py-2 px-3 text-xs font-semibold rounded-lg border text-center transition-all ${
                    selected
                      ? 'bg-[#08775A] text-white border-[#08775A] shadow-xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  {g === 'Other / Not Specified' ? 'Other' : g}
                </button>
              );
            })}
          </div>
        </div>

        {/* Optional Weight */}
        <div>
          <NumberInput
            label="Weight in kg (Optional)"
            placeholder="e.g. 68"
            min={1}
            max={350}
            step={0.5}
            value={weight}
            onChange={(e) => setWeight(e.target.value === '' ? '' : Number(e.target.value))}
          />
          <span className="text-[10px] text-slate-400 mt-1 block">
            Optional vital sign for dosage or clinical reference.
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSubmitting}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>Saving…</span>
              </>
            ) : (
              <>
                <Zap className="h-3.5 w-3.5" />
                <span>Save & Select Patient</span>
              </>
            )}
          </button>
        </div>
      </form>
    </Modal>
  );
};
