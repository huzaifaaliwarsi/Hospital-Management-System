import { TransferLocationFields } from './TransferLocationFields';
import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Loader2, BedDouble, ArrowLeftRight, CheckCircle2 } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { TextInput } from '../../components/forms/FormControls';
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
  const [transferReason, setTransferReason] = useState('');
  const [error, setErrorState] = useState<string | null>(null);
  const setError = (msg: string | null) => {
    setErrorState(msg);
    if (msg) toast.error(msg, 'Validation Error');
  };
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
          room: '',
          bed: parts[1],
        };
      }
    }
    return null;
  }, [assignedBed, admission.bedLabel]);

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
      await checkInAdmission(admission.id, { bedId, notes: notes.trim() || undefined, transferReason: transferReason.trim() || undefined });
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
          <div className="p-3.5 bg-slate-50/80 border border-slate-200 rounded-lg">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-medium bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  Assigned Bed
                </span>
                <span className="text-[11px] text-slate-400">Pre-allocated at Front Desk</span>
              </div>

              <button
                type="button"
                onClick={() => { setBedId(showChangeBed ? admission.bedId || '' : ''); setShowChangeBed((prev) => !prev); }}
                className="text-xs font-medium text-emerald-700 hover:text-emerald-800 hover:underline inline-flex items-center gap-1 cursor-pointer"
              >
                <ArrowLeftRight className="h-3 w-3" />
                <span>{showChangeBed ? 'Keep assigned bed' : 'Change bed'}</span>
              </button>
            </div>

            {parsedBedInfo ? (
              <div className="mt-3 pt-3 border-t border-slate-200/80 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[11px] font-normal text-slate-400 block">Department</span>
                  <span className="font-medium text-slate-800 truncate block mt-0.5" title={admission.departmentName}>
                    {admission.departmentName || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-normal text-slate-400 block">Ward</span>
                  <span className="font-medium text-slate-800 truncate block mt-0.5" title={parsedBedInfo.ward}>
                    {parsedBedInfo.ward || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-normal text-slate-400 block">Room</span>
                  <span className="font-medium text-slate-800 truncate block mt-0.5" title={parsedBedInfo.room}>
                    {parsedBedInfo.room || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-normal text-emerald-600 block">Bed</span>
                  <span className="font-semibold text-emerald-800 truncate block mt-0.5" title={parsedBedInfo.bed}>
                    {parsedBedInfo.bed ? (parsedBedInfo.bed.startsWith('Bed') ? parsedBedInfo.bed : `Bed ${parsedBedInfo.bed}`) : '—'}
                  </span>
                </div>
              </div>
            ) : (
              <div className="mt-3 pt-3 border-t border-slate-200/80 grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-[11px] font-normal text-slate-400 block">Department</span>
                  <span className="font-medium text-slate-800 truncate block mt-0.5" title={admission.departmentName}>
                    {admission.departmentName || '—'}
                  </span>
                </div>
                <div>
                  <span className="text-[11px] font-normal text-emerald-600 block">Bed</span>
                  <span className="font-semibold text-emerald-800 truncate block mt-0.5">
                    {assignedBedLabel}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Info when no bed was pre-allocated at Front Desk */}
        {!admission.bedId && admission.departmentName && (
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
            <span className="text-slate-500 font-normal">Department (from Front Desk):</span>
            <span className="font-medium text-slate-800">{admission.departmentName}</span>
          </div>
        )}

        {/* Bed Selection Dropdown (Shown if changing bed OR if no bed was assigned at Front Desk) */}
        {showChangeBed ? (
          <div className="p-3 bg-slate-50/70 border border-slate-200 rounded-lg space-y-2.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-medium text-slate-700">
                {admission.bedId ? 'Select New Bed' : 'Assign Bed *'}
              </label>
              {admission.bedId && bedId !== admission.bedId && (
                <button
                  type="button"
                  onClick={() => { setBedId(admission.bedId || ''); setShowChangeBed(false); }}
                  className="text-[11px] font-medium text-slate-500 hover:text-slate-800 underline cursor-pointer"
                >
                  Reset to Assigned Bed
                </button>
              )}
            </div>

            <TransferLocationFields bedId={bedId} onChange={setBedId} currentBedId={admission.bedId} />
            {admission.bedId && bedId !== admission.bedId && <TextInput label="Transfer Reason" required value={transferReason} onChange={(e) => setTransferReason(e.target.value)} />}

            {admission.bedId && bedId !== admission.bedId && selectedBedObject && (
              <div className="text-[11px] font-normal text-amber-800 bg-amber-50/80 border border-amber-200/80 rounded-md p-2 flex items-center gap-1.5">
                <span>
                  Previous bed will be released back to Available and{' '}
                  <strong className="font-semibold">
                    {[
                      selectedBedObject.wardName ? `Ward: ${selectedBedObject.wardName}` : '',
                      selectedBedObject.roomName ? `Room: ${selectedBedObject.roomName}` : '',
                      `Bed ${selectedBedObject.bedNumber}`,
                    ]
                      .filter(Boolean)
                      .join(' • ')}
                  </strong>{' '}
                  will be assigned.
                </span>
              </div>
            )}
          </div>
        ) : null}

        <TextInput label="Check-In Notes (optional)" placeholder="Clinical notes, vitals on arrival, attendant info…" value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-3.5 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-md transition-colors cursor-pointer">
            Cancel
          </button>
          <button
            type="submit"
            disabled={isSaving || !bedId}
            className="px-4 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 rounded-md shadow-xs disabled:opacity-50 inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            <BedDouble className="h-3.5 w-3.5" />
            <span>Check In</span>
          </button>
        </div>
      </form>
    </Modal>
  );
};
