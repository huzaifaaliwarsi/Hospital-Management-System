import React, { useEffect, useState } from 'react';
import { AlertCircle, Loader2, ShieldAlert } from 'lucide-react';
import { Modal } from '../../components/common/Modal';
import { TextInput, Textarea, Checkbox } from '../../components/forms/FormControls';
import { formatPKR } from '../../utils/formatters';
import { useToast } from '../../context/ToastContext';
import { fetchHighCostMedicinePolicy, HighCostMedicinePolicy } from '../../services/highCostMedicinePolicyService';
import {
  authorizeHighCostMedicine,
  rejectHighCostMedicine,
  AdmissionPharmacyRequestRecord,
} from '../../services/admissionService';

interface HighCostMedicineAuthorizationModalProps {
  admissionId: string;
  request: AdmissionPharmacyRequestRecord;
  onClose: () => void;
  onResolved: () => void;
}

/**
 * High-Cost Medicine Authorization (HMS_V7.2_NEW_REQUIREMENTS.md §2.6) —
 * shown when a pharmacy request is blocked at `AUTHORIZATION_REQUIRED`.
 * Attendant/Management sections are shown only per the configured policy;
 * management approval is a real credential check server-side, never a
 * free-typed name.
 */
export const HighCostMedicineAuthorizationModal: React.FC<HighCostMedicineAuthorizationModalProps> = ({
  admissionId,
  request,
  onClose,
  onResolved,
}) => {
  const toast = useToast();
  const [policy, setPolicy] = useState<HighCostMedicinePolicy | null>(null);
  const [isLoadingPolicy, setIsLoadingPolicy] = useState(true);

  const [attendantName, setAttendantName] = useState('');
  const [attendantRelation, setAttendantRelation] = useState('');
  const [attendantContact, setAttendantContact] = useState('');
  const [attendantConfirmed, setAttendantConfirmed] = useState(false);
  const [managementUsername, setManagementUsername] = useState('');
  const [managementPassword, setManagementPassword] = useState('');
  const [managementReason, setManagementReason] = useState('');
  const [panelAuthorizationRef, setPanelAuthorizationRef] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isRejecting, setIsRejecting] = useState(false);

  useEffect(() => {
    fetchHighCostMedicinePolicy()
      .then(setPolicy)
      .catch(() => setPolicy(null))
      .finally(() => setIsLoadingPolicy(false));
  }, []);

  const auth = request.highCostAuthorization;

  const handleAuthorize = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsSaving(true);
    try {
      await authorizeHighCostMedicine(admissionId, request.id, {
        attendantName: attendantName.trim() || undefined,
        attendantRelation: attendantRelation.trim() || undefined,
        attendantContact: attendantContact.trim() || undefined,
        attendantConfirmed,
        managementUsername: managementUsername.trim() || undefined,
        managementPassword: managementPassword || undefined,
        managementReason: managementReason.trim() || undefined,
        panelAuthorizationRef: panelAuthorizationRef.trim() || undefined,
      });
      toast.success('High-cost medicine request authorized — released to Pharmacy.');
      onResolved();
    } catch (err: any) {
      setError(err?.message || 'Failed to authorize this request.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setError('A reason is required to reject this request.');
      return;
    }
    setError(null);
    setIsRejecting(true);
    try {
      await rejectHighCostMedicine(admissionId, request.id, rejectReason.trim());
      toast.success('High-cost medicine request rejected.');
      onResolved();
    } catch (err: any) {
      setError(err?.message || 'Failed to reject this request.');
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="High-Cost Medicine Authorization"
      subtitle={`${request.medicineRequestNumber} — line amount exceeds the configured threshold.`}
      maxWidth="2xl"
    >
      {isLoadingPolicy ? (
        <div className="flex items-center justify-center py-10 text-slate-400 gap-2 text-xs">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading policy…
        </div>
      ) : (
        <form onSubmit={handleAuthorize} className="space-y-3">
          {error && (
            <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
              <AlertCircle className="h-4 w-4 shrink-0" /> {error}
            </div>
          )}

          {auth && (
            <div className="grid grid-cols-2 gap-2.5 text-xs">
              <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                <span className="text-[10px] text-amber-700 uppercase block">Line Amount</span>
                <span className="font-bold text-amber-900">{formatPKR(auth.lineTotal)}</span>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                <span className="text-[10px] text-slate-500 uppercase block">Threshold</span>
                <span className="font-bold text-slate-800">{formatPKR(auth.thresholdAmount)}</span>
              </div>
            </div>
          )}

          {policy?.attendantConfirmationRequired && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Attendant Confirmation</h4>
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="Attendant Name" value={attendantName} onChange={(e) => setAttendantName(e.target.value)} />
                <TextInput label="Relationship" value={attendantRelation} onChange={(e) => setAttendantRelation(e.target.value)} />
              </div>
              <TextInput label="Contact / CNIC (optional)" value={attendantContact} onChange={(e) => setAttendantContact(e.target.value)} />
              <Checkbox
                label="Attendant confirms authorization for this high-cost medicine"
                checked={attendantConfirmed}
                onChange={(e) => setAttendantConfirmed(e.target.checked)}
              />
            </div>
          )}

          {policy?.managementApprovalRequired && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                <ShieldAlert className="h-3.5 w-3.5" /> Management Authorization (Admin / Super Admin)
              </h4>
              <div className="grid grid-cols-2 gap-3">
                <TextInput label="Username" autoComplete="off" value={managementUsername} onChange={(e) => setManagementUsername(e.target.value)} />
                <TextInput label="Password" type="password" autoComplete="off" value={managementPassword} onChange={(e) => setManagementPassword(e.target.value)} />
              </div>
              <TextInput label="Reason / Note (optional)" value={managementReason} onChange={(e) => setManagementReason(e.target.value)} />
            </div>
          )}

          <TextInput label="Panel Authorization Reference (optional)" value={panelAuthorizationRef} onChange={(e) => setPanelAuthorizationRef(e.target.value)} />

          <div className="border-t border-slate-200 pt-3 space-y-2">
            <Textarea label="Reject Reason (only needed if declining)" rows={2} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)} />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={onClose} className="px-3 py-2 text-xs font-semibold text-slate-600">Cancel</button>
              <button
                type="button"
                disabled={isRejecting}
                onClick={handleReject}
                className="px-4 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 rounded-lg disabled:opacity-60"
              >
                {isRejecting ? 'Rejecting…' : 'Reject'}
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 inline-flex items-center gap-1.5"
              >
                {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Authorize
              </button>
            </div>
          </div>
        </form>
      )}
    </Modal>
  );
};
