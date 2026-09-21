import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, BedDouble, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { Select, TextInput } from '../../components/forms/FormControls';
import { useToast } from '../../context/ToastContext';
import { WardsRoomsBedsService, fetchWardHierarchy } from '../../services/wardsRoomsBedsService';
import { Bed } from '../../types/wardsRoomsBeds';
import { checkInAdmission, AdmissionRecord } from '../../services/admissionService';

interface CheckInAdmissionModalProps {
  admission: AdmissionRecord;
  onClose: () => void;
  onCheckedIn: () => void;
}

/** Admission Check-In (§4.7 Sub-flow B) — assign or confirm an available bed, preferring the admitting department's own beds. */
export const CheckInAdmissionModal: React.FC<CheckInAdmissionModalProps> = ({ admission, onClose, onCheckedIn }) => {
  const toast = useToast();
  const [bedId, setBedId] = useState(admission.bedId || '');
  const [showChangeBed, setShowChangeBed] = useState(!admission.bedId);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // The shared bed cache is primed once, fire-and-forget, at login — re-fetch here so this
  // modal always reflects the DB's current bed state instead of a possibly-empty/stale snapshot.
  const [allBeds, setAllBeds] = useState<Bed[]>(WardsRoomsBedsService.getBeds());
  useEffect(() => {
    fetchWardHierarchy().then(({ beds }) => setAllBeds(beds)).catch(() => {});
  }, []);

  useEffect(() => {
    if (admission.bedId && !bedId) {
      setBedId(admission.bedId);
    }
  }, [admission.bedId]);

  const assignedBed = useMemo(() => {
    if (!admission.bedId) return null;
    return allBeds.find((b) => b.id === admission.bedId) || null;
  }, [allBeds, admission.bedId]);

  const assignedBedLabel = assignedBed
    ? [
        assignedBed.wardName,
        assignedBed.roomName,
        /^bed\b/i.test(assignedBed.bedNumber.trim()) ? assignedBed.bedNumber.trim() : `Bed ${assignedBed.bedNumber.trim()}`,
      ]
        .filter(Boolean)
        .join(' / ')
    : (admission.bedLabel || 'Bed Assigned at Front Desk');

  const parsedBedInfo = useMemo(() => {
    if (assignedBed) {
      return {
        ward: assignedBed.wardName,
        room: assignedBed.roomName,
        bed: assignedBed.bedNumber,
      };
    }
    if (admission.bedLabel && admission.bedLabel.includes('/')) {
      const parts = admission.bedLabel.split('/').map((s) => s.trim());
      if (parts.length >= 3) {
        return {
          ward: parts[0],
          room: parts[1],
          bed: parts.slice(2).join(' / '),
        };
      } else if (parts.length === 2) {
        return {
          ward: parts[0],
          room: parts[1],
          bed: '',
        };
      }
    }
    return null;
  }, [assignedBed, admission.bedLabel]);

  const selectableBeds = useMemo(() => {
    // Include beds that are Available OR currently reserved for THIS admission
    const beds = allBeds.filter(
      (b) => b.operationalStatus === 'Active' && (b.occupancyStatus === 'Available' || b.id === admission.bedId)
    );
    const assigned = beds.filter((b) => b.id === admission.bedId);
    const sameDept = beds.filter((b) => b.id !== admission.bedId && b.departmentId === admission.departmentId);
    const otherDept = beds.filter((b) => b.id !== admission.bedId && b.departmentId !== admission.departmentId);
    return [...assigned, ...sameDept, ...otherDept];
  }, [allBeds, admission.bedId, admission.departmentId]);

  const bedOptions = useMemo(() => {
    const list = selectableBeds.map((b) => {
      const location = [
        b.wardName ? `Ward: ${b.wardName}` : '',
        b.roomName ? `Room: ${b.roomName}` : '',
        `Bed: ${b.bedNumber}`,
      ]
        .filter(Boolean)
        .join(' • ');
      return {
        label: b.id === admission.bedId ? `${location} ★ (Assigned at Front Desk)` : location,
        value: b.id,
      };
    });
    // If admission has a bedId not yet mapped in allBeds, ensure it appears as the selected option
    if (admission.bedId && !list.some((o) => o.value === admission.bedId)) {
      list.unshift({
        label: `${admission.bedLabel || 'Assigned Bed'} ★ (Assigned at Front Desk)`,
        value: admission.bedId,
      });
    }
    return list;
  }, [selectableBeds, admission.bedId, admission.bedLabel]);

  const selectedBedObject = useMemo(() => {
    return allBeds.find((b) => b.id === bedId) || null;
  }, [allBeds, bedId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bedId) {
      setError('Please select a bed for admission.');
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
      <form onSubmit={handleSubmit} className="space-y-3.5">
        {error && (
          <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </div>
        )}

        {/* Assigned Bed Banner (if pre-allocated at Front Desk) */}
        {admission.bedId && (
          <div className="p-3 bg-[#effaf5] border border-[#c2e7db] rounded-xl space-y-2.5">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-[#08775A]/10 text-[#08775A] flex items-center justify-center shrink-0">
                  <BedDouble className="h-4 w-4" />
                </div>
                <div className="text-xs font-bold text-[#08775A] flex items-center gap-1.5">
                  <span>Assigned Bed (from Front Desk)</span>
                  <CheckCircle2 className="h-3.5 w-3.5 text-[#08775A]" />
                </div>
              </div>

              <button
                type="button"
                onClick={() => setShowChangeBed((prev) => !prev)}
                className="px-2.5 py-1 text-xs font-semibold text-[#08775A] hover:text-[#065f46] hover:bg-[#08775A]/10 border border-[#08775A]/30 rounded-lg transition-colors inline-flex items-center gap-1 shrink-0 cursor-pointer"
              >
                <ArrowLeftRight className="h-3.5 w-3.5" />
                <span>{showChangeBed ? 'Hide Bed Selector' : 'Change Bed'}</span>
              </button>
            </div>

            {parsedBedInfo ? (
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-white rounded-lg p-2 border border-[#c2e7db]">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Ward</div>
                  <div className="text-xs font-bold text-slate-800 break-words mt-0.5" title={parsedBedInfo.ward}>
                    {parsedBedInfo.ward || '—'}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2 border border-[#c2e7db]">
                  <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Room</div>
                  <div className="text-xs font-bold text-slate-800 break-words mt-0.5" title={parsedBedInfo.room}>
                    {parsedBedInfo.room || '—'}
                  </div>
                </div>
                <div className="bg-white rounded-lg p-2 border border-[#c2e7db]">
                  <div className="text-[10px] font-bold text-[#08775A] uppercase tracking-wider">Bed</div>
                  <div className="text-xs font-black text-[#08775A] break-words mt-0.5" title={parsedBedInfo.bed}>
                    {parsedBedInfo.bed ? (parsedBedInfo.bed.startsWith('Bed') ? parsedBedInfo.bed : `Bed ${parsedBedInfo.bed}`) : '—'}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-xs font-bold text-slate-800">
                {assignedBedLabel}
              </div>
            )}
          </div>
        )}

        {/* Bed Selection Dropdown (Shown if changing bed OR if no bed was assigned at Front Desk) */}
        {showChangeBed ? (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">
                {admission.bedId ? 'Select Different Bed' : 'Assign Bed *'}
              </label>
              {admission.bedId && bedId !== admission.bedId && (
                <button
                  type="button"
                  onClick={() => setBedId(admission.bedId || '')}
                  className="text-[11px] font-semibold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Reset to Assigned Bed
                </button>
              )}
            </div>

            <Select
              options={bedOptions}
              value={bedId}
              onChange={(e) => setBedId(e.target.value)}
              placeholder={bedOptions.length === 0 ? 'No available beds' : 'Choose a bed…'}
              hint={`${admission.departmentName}'s beds are listed first.`}
            />

            {admission.bedId && bedId !== admission.bedId && selectedBedObject && (
              <div className="text-[11px] font-medium text-amber-800 bg-amber-50 border border-amber-200 rounded-lg p-2 flex items-center gap-1.5">
                <span>
                  ⚠️ Previous bed will be freed back to Available and{' '}
                  <strong>
                    {[
                      selectedBedObject.wardName ? `Ward: ${selectedBedObject.wardName}` : '',
                      selectedBedObject.roomName ? `Room: ${selectedBedObject.roomName}` : '',
                      `Bed ${selectedBedObject.bedNumber}`,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </strong>{' '}
                  will be occupied.
                </span>
              </div>
            )}
          </div>
        ) : null}

        <TextInput label="Check-In Notes (optional)" placeholder="Clinical notes, vitals on arrival, attendant info…" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer">Cancel</button>
          <button
            type="submit"
            disabled={isSaving || !bedId}
            className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5 cursor-pointer"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <BedDouble className="h-3.5 w-3.5" /> Check In
          </button>
        </div>
      </form>
    </Modal>
  );
};
