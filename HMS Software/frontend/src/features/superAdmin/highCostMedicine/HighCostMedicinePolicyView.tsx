import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Check,
  Ban,
  User,
  Pill,
  RefreshCw,
  Building2,
  Sliders,
  AlertCircle,
  Info,
} from 'lucide-react';
import {
  HighCostMedicinePolicy,
  CombinedLogic,
  ThresholdBasis,
  COMBINED_LOGIC_LABELS,
  fetchHighCostMedicinePolicy,
  updateHighCostMedicinePolicy,
} from '../../../services/highCostMedicinePolicyService';
import {
  listPendingHighCostAuthorizations,
  authorizeHighCostMedicine,
  rejectHighCostMedicine,
} from '../../../services/admissionService';
import { NumberInput, Select, Toggle } from '../../../components/forms/FormControls';
import { useToast } from '../../../context/ToastContext';

export const HighCostMedicinePolicyView: React.FC = () => {
  const toast = useToast();
  const [activeTab, setActiveTab] = useState<'queue' | 'policy'>('queue');

  // Policy configuration state
  const [policy, setPolicy] = useState<HighCostMedicinePolicy | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Pending queue state
  const [pendingList, setPendingList] = useState<any[]>([]);
  const [loadingQueue, setLoadingQueue] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [rejectionModalTarget, setRejectionModalTarget] = useState<any | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');

  const loadPolicy = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setPolicy(await fetchHighCostMedicinePolicy());
    } catch (err: any) {
      setLoadError(err?.response?.data?.error?.message || err?.message || 'Failed to load the High-Cost Medicine policy.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadQueue = async () => {
    setLoadingQueue(true);
    try {
      const data = await listPendingHighCostAuthorizations();
      setPendingList(data);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load pending authorizations');
    } finally {
      setLoadingQueue(false);
    }
  };

  useEffect(() => {
    loadPolicy();
    loadQueue();
  }, []);

  const handleSavePolicy = async () => {
    if (!policy) return;
    setIsSaving(true);
    try {
      const updated = await updateHighCostMedicinePolicy({
        enabled: policy.enabled,
        thresholdAmount: policy.thresholdAmount,
        thresholdBasis: policy.thresholdBasis,
        attendantConfirmationRequired: policy.attendantConfirmationRequired,
        managementApprovalRequired: policy.managementApprovalRequired,
        combinedLogic: policy.combinedLogic,
        panelPreauthRequired: policy.panelPreauthRequired,
      });
      setPolicy(updated);
      toast.success('High-Cost Medicine policy saved.');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to save policy.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleApprove = async (auth: any) => {
    const clearance = auth.pharmacyClearance;
    const admissionId = clearance.admissionRecordId;
    const clearanceId = clearance.id;

    setActionInProgress(auth.id);
    try {
      await authorizeHighCostMedicine(admissionId, clearanceId, {
        managementReason: 'Approved by Super Admin / Management',
        attendantConfirmed: auth.attendantConfirmed ?? true,
      });
      toast.success('High-Cost medicine authorized successfully! Pharmacy dispensing unblocked.');
      await loadQueue();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to authorize medicine');
    } finally {
      setActionInProgress(null);
    }
  };

  const handleConfirmReject = async () => {
    if (!rejectionModalTarget) return;
    if (!rejectionReason.trim()) {
      toast.error('Please enter a rejection reason.');
      return;
    }

    const clearance = rejectionModalTarget.pharmacyClearance;
    const admissionId = clearance.admissionRecordId;
    const clearanceId = clearance.id;

    setActionInProgress(rejectionModalTarget.id);
    try {
      await rejectHighCostMedicine(admissionId, clearanceId, rejectionReason.trim());
      toast.success('High-Cost medicine rejected. Dispensing remains blocked in Pharmacy.');
      setRejectionModalTarget(null);
      setRejectionReason('');
      await loadQueue();
    } catch (err: any) {
      toast.error(err?.message || 'Failed to reject medicine');
    } finally {
      setActionInProgress(null);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2 text-sm">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading High-Cost Medicine policy…</span>
      </div>
    );
  }

  if (loadError || !policy) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertTriangle className="h-8 w-8 text-rose-500" />
        <p className="text-sm text-rose-700 font-medium">{loadError}</p>
        <button type="button" onClick={loadPolicy} className="px-4 py-2 bg-[#08775A] hover:bg-[#0e7d5a] text-white text-xs font-semibold rounded-lg">
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-150 max-w-5xl">
      {/* 1. Header Block */}
      <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-xl bg-[#effaf5] text-[#08775A] border border-[#c2e7db] flex items-center justify-center shadow-2xs">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-[#123e2b] tracking-tight">
                  High-Cost Medicine Approval &amp; Policy
                </h1>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#08775A]" />
                  PKR {policy.thresholdAmount.toLocaleString()} Threshold
                </span>
              </div>
              <p className="text-xs text-[#52665e] mt-0.5">
                Central approval workflow between IPD/Admission, Management, and Standalone Pharmacy.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={loadQueue}
              disabled={loadingQueue}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#08775A] bg-[#effaf5] hover:bg-[#e2f6ee] border border-[#c2e7db] rounded-lg transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingQueue ? 'animate-spin' : ''}`} />
              Refresh Queue
            </button>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex items-center gap-2 mt-5 pt-4 border-t border-[#e2eae5]">
          <button
            type="button"
            onClick={() => setActiveTab('queue')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'queue'
                ? 'bg-[#08775A] text-white shadow-xs'
                : 'text-[#52665e] hover:bg-[#f6faf8] border border-transparent'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending Approvals Queue</span>
            {pendingList.length > 0 && (
              <span className={`px-2 py-0.5 text-[10px] font-extrabold rounded-full ${
                activeTab === 'queue' ? 'bg-white text-[#08775A]' : 'bg-rose-100 text-rose-800'
              }`}>
                {pendingList.length}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('policy')}
            className={`inline-flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              activeTab === 'policy'
                ? 'bg-[#08775A] text-white shadow-xs'
                : 'text-[#52665e] hover:bg-[#f6faf8] border border-transparent'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Policy &amp; Threshold Configuration</span>
          </button>
        </div>
      </div>

      {/* 2. TAB: PENDING QUEUE */}
      {activeTab === 'queue' && (
        <div className="space-y-4">
          {pendingList.length === 0 ? (
            <div className="bg-white rounded-xl border border-[#e2eae5] p-12 text-center shadow-2xs">
              <div className="w-12 h-12 rounded-full bg-[#effaf5] text-[#08775A] flex items-center justify-center mx-auto mb-3">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <h3 className="text-base font-semibold text-[#111827]">No High-Cost Requests Pending</h3>
              <p className="text-xs text-[#52665e] max-w-md mx-auto mt-1">
                All inpatient medicine requests exceeding the threshold (PKR {policy.thresholdAmount.toLocaleString()}) have been reviewed. Dispensing in Pharmacy is unblocked.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {pendingList.map((auth) => {
                const clearance = auth.pharmacyClearance;
                const admission = clearance?.admissionRecord;
                const patientName = admission?.panelPatient?.fullName || admission?.selfPayEncounter?.fullName || 'Inpatient';
                const mrn = admission?.panelPatient?.mrNumber || admission?.selfPayEncounter?.mrNumber || 'N/A';
                const isPanel = Boolean(admission?.panelPatient);
                const companyName = admission?.panelPatient?.corporatePanel?.name;
                const wardName = admission?.bed?.room?.ward?.name || 'General Ward';
                const roomNumber = admission?.bed?.room?.roomNumber;
                const bedNumber = admission?.bed?.bedNumber;
                const doctorName = admission?.doctor?.fullName || 'Attending Physician';
                const lines = clearance?.lines || [];
                const lineTotal = Number(auth.lineTotal || 0);
                const isProcessing = actionInProgress === auth.id;

                return (
                  <div
                    key={auth.id}
                    className="bg-white rounded-xl border border-amber-200 shadow-xs p-5 hover:border-amber-300 transition-all space-y-4"
                  >
                    {/* Header Row */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-3 border-b border-slate-100">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono font-bold text-sm text-[#08775A]">{clearance.medicineRequestNumber}</span>
                          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-50 text-amber-800 border border-amber-200">
                            Awaiting Management Authorization
                          </span>
                          {isPanel ? (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200">
                              Panel: {companyName || 'Corporate'}
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                              Self-Pay Patient
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-4 text-xs text-slate-600 mt-2 flex-wrap">
                          <span className="font-semibold text-slate-900">{patientName} (MRN: {mrn})</span>
                          <span>•</span>
                          <span>{wardName} {roomNumber ? `· Room ${roomNumber}` : ''} {bedNumber ? `· Bed ${bedNumber}` : ''}</span>
                          <span>•</span>
                          <span>Doctor: {doctorName}</span>
                        </div>
                      </div>

                      {/* Right Amount Box */}
                      <div className="bg-amber-50/70 border border-amber-200/80 rounded-xl px-4 py-2 text-right shrink-0">
                        <span className="text-[10px] font-bold uppercase text-amber-700 block">Triggering Line Total</span>
                        <span className="text-lg font-black text-amber-950 font-mono">
                          PKR {lineTotal.toLocaleString('en-PK')}
                        </span>
                      </div>
                    </div>

                    {/* Medicine Line Details */}
                    <div>
                      <h4 className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
                        <Pill className="w-3.5 h-3.5 text-slate-400" />
                        Requested High-Cost Medications
                      </h4>
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-left text-xs">
                          <thead className="bg-slate-50 text-[11px] font-semibold text-slate-600 border-b border-slate-200">
                            <tr>
                              <th className="py-2 px-3">Medicine Name</th>
                              <th className="py-2 px-3 text-right">Requested Qty</th>
                              <th className="py-2 px-3 text-right">Standard Rate (PKR)</th>
                              <th className="py-2 px-3 text-right">Est. Total (PKR)</th>
                              <th className="py-2 px-3">Notes</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {lines.map((l: any) => {
                              const qty = Number(l.requestedQuantity || 0);
                              const rate = Number(l.medicine?.salePrice || 0);
                              const estLineTotal = qty * rate;
                              const isOverThreshold = estLineTotal >= policy.thresholdAmount;

                              return (
                                <tr key={l.id} className={isOverThreshold ? 'bg-amber-50/40' : 'bg-white'}>
                                  <td className="py-2 px-3 font-semibold text-slate-800">
                                    {l.medicine?.name || 'Medicine'}
                                    {isOverThreshold && (
                                      <span className="ml-2 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.5 rounded border border-amber-200">
                                        &ge; Threshold
                                      </span>
                                    )}
                                  </td>
                                  <td className="py-2 px-3 text-right font-mono font-medium">{qty}</td>
                                  <td className="py-2 px-3 text-right font-mono">{rate.toLocaleString('en-PK')}</td>
                                  <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">
                                    {estLineTotal.toLocaleString('en-PK')}
                                  </td>
                                  <td className="py-2 px-3 text-slate-500 text-[11px]">{l.notes || '—'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {/* Attendant Confirmation Status */}
                    {policy.attendantConfirmationRequired && (
                      <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs flex items-center justify-between gap-4">
                        <div className="flex items-center gap-2">
                          <User className="w-4 h-4 text-slate-500" />
                          <div>
                            <span className="font-semibold text-slate-800">
                              Guardian / Attendant Confirmation:
                            </span>{' '}
                            {auth.attendantName ? (
                              <span className="text-slate-700">
                                {auth.attendantName} ({auth.attendantRelation || 'Guardian'}) · {auth.attendantContact || 'No phone'}
                              </span>
                            ) : (
                              <span className="text-amber-700 italic">Not yet recorded by Admission Staff</span>
                            )}
                          </div>
                        </div>
                        <div>
                          {auth.attendantConfirmed ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" />
                              Confirmed
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-200">
                              Pending Confirmation
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Actions Bar */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <span className="text-[11px] text-slate-500">
                        Requested by {clearance.requestedBy?.displayName || clearance.requestedBy?.username || 'Staff'} on{' '}
                        {new Date(clearance.createdAt).toLocaleString('en-PK')}
                      </span>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setRejectionModalTarget(auth);
                            setRejectionReason('');
                          }}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                        >
                          <Ban className="w-3.5 h-3.5" />
                          Reject Request
                        </button>

                        <button
                          type="button"
                          onClick={() => handleApprove(auth)}
                          disabled={isProcessing}
                          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {isProcessing ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <Check className="w-3.5 h-3.5" />
                          )}
                          Approve &amp; Release to Pharmacy
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* 3. TAB: POLICY & THRESHOLD CONFIGURATION */}
      {activeTab === 'policy' && (
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5">
          <Toggle
            label="High-Cost Medicine Authorization Enabled"
            hint="When off, no medicine request is ever blocked by this policy."
            checked={policy.enabled}
            onChange={(checked) => setPolicy({ ...policy, enabled: checked })}
          />

          <div className={`space-y-5 ${policy.enabled ? '' : 'opacity-50 pointer-events-none'}`}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <NumberInput
                label="Threshold Amount (PKR)"
                hint="Management-configured — medicine line total at/above this value requires approval."
                min={0}
                step={500}
                value={policy.thresholdAmount}
                onChange={(e) => setPolicy({ ...policy, thresholdAmount: Number(e.target.value) || 0 })}
              />
              <Select
                label="Threshold Basis"
                options={[
                  { label: 'Line Total (recommended)', value: 'LINE_TOTAL' },
                  { label: 'Per Unit', value: 'PER_UNIT' },
                ]}
                value={policy.thresholdBasis}
                onChange={(e) => setPolicy({ ...policy, thresholdBasis: e.target.value as ThresholdBasis })}
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50/80 p-3.5 rounded-xl border border-slate-200">
              <Toggle
                label="Attendant Confirmation Required"
                hint="Admission staff records guardian acknowledgment."
                checked={policy.attendantConfirmationRequired}
                onChange={(checked) => setPolicy({ ...policy, attendantConfirmationRequired: checked })}
              />
              <Toggle
                label="Admin / Super Admin Approval Required"
                hint="Management approves through the Pending Queue."
                checked={policy.managementApprovalRequired}
                onChange={(checked) => setPolicy({ ...policy, managementApprovalRequired: checked })}
              />
            </div>

            <Select
              label="Combined Authorization Logic"
              hint="How Attendant Confirmation and Management Approval combine when both toggles above are on."
              options={(Object.keys(COMBINED_LOGIC_LABELS) as CombinedLogic[]).map((v) => ({ label: COMBINED_LOGIC_LABELS[v], value: v }))}
              value={policy.combinedLogic}
              onChange={(e) => setPolicy({ ...policy, combinedLogic: e.target.value as CombinedLogic })}
            />

            <Toggle
              label="Panel Preauthorization Add-On"
              hint="When on, a Panel patient's contract preauthorization is additionally required — hospital policy is never bypassed by panel coverage."
              checked={policy.panelPreauthRequired}
              onChange={(checked) => setPolicy({ ...policy, panelPreauthRequired: checked })}
            />
          </div>

          <div className="p-3 bg-blue-50/60 border border-blue-200 rounded-lg flex items-start gap-2.5 text-xs text-blue-900">
            <Info className="h-4 w-4 shrink-0 mt-0.5 text-blue-600" />
            <span>
              Once approved in HMS, Standalone Pharmacy is automatically synchronized via the real-time bridge. Dispensing is immediately unblocked without requiring duplicate authorization in Pharmacy.
            </span>
          </div>

          <div className="flex items-center justify-between pt-3 border-t border-slate-200 text-[11px] text-slate-400">
            <span>Last updated by {policy.updatedBy}</span>
            <button
              type="button"
              onClick={handleSavePolicy}
              disabled={isSaving}
              className="px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 cursor-pointer"
            >
              {isSaving ? 'Saving…' : 'Save Policy'}
            </button>
          </div>
        </div>
      )}

      {/* 4. Rejection Modal */}
      {rejectionModalTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white max-w-md w-full rounded-2xl p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <Ban className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-900">
                Reject High-Cost Medicine Request
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Request ref: <strong className="text-slate-800">{rejectionModalTarget.pharmacyClearance?.medicineRequestNumber}</strong>
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-xs font-semibold text-slate-700">
                Reason for Rejection *
              </label>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                placeholder="e.g., Guardian declined high-cost brand; alternative generic prescribed."
                rows={3}
                className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRejectionModalTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmReject}
                disabled={actionInProgress === rejectionModalTarget.id}
                className="px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs cursor-pointer disabled:opacity-60"
              >
                {actionInProgress === rejectionModalTarget.id ? 'Rejecting...' : 'Confirm Rejection'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
