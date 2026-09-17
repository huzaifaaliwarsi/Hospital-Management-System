import React, { useMemo, useState } from 'react';
import { AlertCircle, Loader2, BedDouble } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Select, TextInput } from '../../components/forms/FormControls';
import { useToast } from '../../context/ToastContext';
import { WardsRoomsBedsService } from '../../services/wardsRoomsBedsService';
import { checkInAdmission, AdmissionRecord } from '../../services/admissionService';

interface CheckInAdmissionModalProps {
  admission: AdmissionRecord;
  onClose: () => void;
  onCheckedIn: () => void;
}

/** Admission Check-In (§4.7 Sub-flow B) — assign an available bed, preferring the admitting department's own beds. */
export const CheckInAdmissionModal: React.FC<CheckInAdmissionModalProps> = ({ admission, onClose, onCheckedIn }) => {
  const toast = useToast();
  const [bedId, setBedId] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const availableBeds = useMemo(() => {
    const beds = WardsRoomsBedsService.getBeds().filter((b) => b.occupancyStatus === 'Available');
    const sameDept = beds.filter((b) => b.departmentId === admission.departmentId);
    const otherDept = beds.filter((b) => b.departmentId !== admission.departmentId);
    return [...sameDept, ...otherDept];
  }, [admission.departmentId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bedId) {
      setError('Select a bed.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await checkInAdmission(admission.id, { bedId, notes: notes.trim() || undefined });
      toast.success(`${admission.patientName} checked in.`);
      onCheckedIn();
    } catch (err: any) {
      setError(err?.message || 'Failed to check in.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title="Admission Check-In" subtitle={`${admission.admissionNumber} — ${admission.patientName}`} maxWidth="md">
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}
        <Select
          label="Assign Bed"
          required
          placeholder={availableBeds.length === 0 ? 'No available beds' : 'Choose an available bed…'}
          options={availableBeds.map((b) => ({ label: `${b.wardName} / ${b.roomName} / ${b.bedNumber}`, value: b.id }))}
          value={bedId}
          onChange={(e) => setBedId(e.target.value)}
          hint={`${admission.departmentName}'s own beds are listed first.`}
        />
        <TextInput label="Notes (optional)" value={notes} onChange={(e) => setNotes(e.target.value)} />
        <div className="flex justify-end gap-2 pt-2">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button>
          <button
            type="submit"
            disabled={isSaving || availableBeds.length === 0}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <BedDouble className="h-3.5 w-3.5" /> Check In
          </button>
        </div>
      </form>
    </Modal>
  );
};
