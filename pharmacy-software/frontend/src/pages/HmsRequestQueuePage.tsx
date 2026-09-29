import React, { useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, X, Check, Ban, ShieldAlert, Eye, Settings2 } from 'lucide-react';
import { pharmacyApi, MedicineRow } from '../services/pharmacyApi';
import { formatPKR, formatNumber } from '../utils/format';
import { useToast } from '../context/ToastContext';

const STATUS_STYLE: Record<string, string> = {
  REQUESTED: 'bg-amber-50 text-amber-700 border-amber-200',
  ACCEPTED: 'bg-[#effaf5] text-[#0e7d5a] border-[#c2e7db]',
  PARTIALLY_ACCEPTED: 'bg-blue-50 text-blue-700 border-blue-200',
  DISPENSED: 'bg-[#effaf5] text-[#0e7d5a] border-[#c2e7db]',
  REJECTED: 'bg-rose-50 text-rose-700 border-rose-200',
};

interface RequestLineRow {
  id: string;
  medicineId: string;
  medicine: MedicineRow;
  requestedQuantity: string | number;
  dispensedQuantity: string | number;
}
interface RequestRow {
  id: string;
  requestNumber: string;
  externalAdmissionRef: string;
  patientNameSnapshot?: string | null;
  urgency?: string | null;
  status: string;
  requestedAt: string;
  approvedById?: string | null;
  approvedByUser?: { fullName: string } | null;
  handledByUser?: { fullName: string } | null;
  rejectionReason?: string | null;
  lines: RequestLineRow[];
  invoice?: { invoiceNumber: string; total: string; paidTotal: string; outstanding: string; clearanceStatus?: string | null } | null;
}

function estimatedValue(req: RequestRow): number {
  return req.lines.reduce((sum, l) => sum + Number(l.requestedQuantity) * Number(l.medicine.saleRate), 0);
}

export const HmsRequestQueuePage: React.FC<{ canApprove: boolean }> = ({ canApprove }) => {
  const [rows, setRows] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [settings, setSettings] = useState<any | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [detail, setDetail] = useState<RequestRow | null>(null);
  const toast = useToast();

  const load = () => {
    setLoading(true);
    pharmacyApi.listHmsRequests(statusFilter || undefined).then(setRows).catch(() => toast.error('Failed to load requests.')).finally(() => setLoading(false));
  };
  useEffect(load, [statusFilter]);
  useEffect(() => {
    pharmacyApi.getHmsSettings().then(setSettings);
  }, []);

  const summary = useMemo(() => {
    const s = { pending: 0, partial: 0, dispensed: 0, rejected: 0, needsApproval: 0 };
    for (const r of rows) {
      if (r.status === 'REQUESTED') s.pending += 1;
      if (r.status === 'PARTIALLY_ACCEPTED') s.partial += 1;
      if (r.status === 'DISPENSED') s.dispensed += 1;
      if (r.status === 'REJECTED') s.rejected += 1;
      if (settings?.highValueApprovalEnabled && r.status === 'REQUESTED' && !r.approvedById && estimatedValue(r) >= Number(settings.highValueThreshold)) s.needsApproval += 1;
    }
    return s;
  }, [rows, settings]);

  const handleApprove = async (id: string) => {
    try {
      await pharmacyApi.approveHmsRequest(id);
      toast.success('Request approved for dispensing.');
      load();
      setDetail(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to approve.');
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Reason for rejection:');
    if (!reason) return;
    try {
      await pharmacyApi.rejectHmsRequest(id, reason);
      toast.success('Request rejected.');
      load();
      setDetail(null);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to reject.');
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-[#111827]">Hospital Request Queue</h2>
          <p className="text-xs text-[#52665e]">pharmacy.md §7 — Accept & Dispense / Partial Fulfill / Reject, real FEFO, separate Pharmacy Invoice.</p>
        </div>
        <div className="flex items-center gap-2">
          {canApprove && (
            <button onClick={() => setShowSettings(true)} className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#52665e] border border-[#e2eae5] hover:bg-[#f0faf6] rounded-lg">
              <Settings2 className="h-3.5 w-3.5" /> High-Value Settings
            </button>
          )}
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#129b70] hover:bg-[#0e7d5a] rounded-lg shadow-xs">
            <Plus className="h-3.5 w-3.5" /> Log Request
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Pending', value: summary.pending, filter: 'REQUESTED' },
          { label: 'Partial', value: summary.partial, filter: 'PARTIALLY_ACCEPTED' },
          { label: 'Fulfilled', value: summary.dispensed, filter: 'DISPENSED' },
          { label: 'Rejected', value: summary.rejected, filter: 'REJECTED' },
          { label: 'Needs Approval', value: summary.needsApproval, filter: '' },
        ].map((c) => (
          <button key={c.label} onClick={() => setStatusFilter(c.filter)} className={`bg-white rounded-lg border p-3 text-left hover:border-[#c2e7db] ${statusFilter === c.filter && c.filter ? 'border-[#129b70] ring-1 ring-[#129b70]' : 'border-[#e2eae5]'}`}>
            <div className="text-[10px] font-semibold text-[#52665e] uppercase">{c.label}</div>
            <div className="text-lg font-bold text-[#111827]">{c.value}</div>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border border-[#e2eae5] overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-[#f6faf8]">
            <tr className="text-[11px] font-bold uppercase tracking-wide text-[#52665e]">
              <th className="py-2.5 px-3 text-left">Request</th>
              <th className="py-2.5 px-3 text-left">Admission Ref</th>
              <th className="py-2.5 px-3 text-left">Patient</th>
              <th className="py-2.5 px-3 text-left">Urgency</th>
              <th className="py-2.5 px-3 text-right">Est. Value</th>
              <th className="py-2.5 px-3 text-center">Status</th>
              <th className="py-2.5 px-3 text-center">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={7} className="py-10 text-center text-[#52665e]"><Loader2 className="h-4 w-4 animate-spin inline mr-2" />Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-[#94a3b8]">No requests yet.</td></tr>
            ) : (
              rows.map((r) => {
                const needsApproval = settings?.highValueApprovalEnabled && r.status === 'REQUESTED' && !r.approvedById && estimatedValue(r) >= Number(settings.highValueThreshold);
                return (
                  <tr key={r.id} className="border-t border-[#f0f4f2]">
                    <td className="py-2 px-3 font-mono text-xs">{r.requestNumber}</td>
                    <td className="py-2 px-3 text-[#52665e]">{r.externalAdmissionRef}</td>
                    <td className="py-2 px-3">{r.patientNameSnapshot || '—'}</td>
                    <td className="py-2 px-3 text-xs">{r.urgency || '—'}</td>
                    <td className="py-2 px-3 text-right tabular-nums">{formatPKR(estimatedValue(r))}</td>
                    <td className="py-2 px-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${STATUS_STYLE[r.status]}`}>{r.status.replace('_', ' ')}</span>
                        {needsApproval && <span title="High-value approval required"><ShieldAlert className="h-3.5 w-3.5 text-amber-600" /></span>}
                      </div>
                    </td>
                    <td className="py-2 px-3 text-center"><button onClick={() => setDetail(r)} className="text-[#52665e] hover:text-[#129b70]"><Eye className="h-4 w-4" /></button></td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {showSettings && settings && (
        <SettingsModal settings={settings} onClose={() => setShowSettings(false)} onSaved={(s) => { setSettings(s); setShowSettings(false); }} />
      )}
      {showCreate && <CreateRequestModal onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
      {detail && (
        <DetailModal
          request={detail}
          settings={settings}
          canApprove={canApprove}
          onClose={() => setDetail(null)}
          onApprove={() => handleApprove(detail.id)}
          onReject={() => handleReject(detail.id)}
          onFulfilled={() => { setDetail(null); load(); }}
        />
      )}
    </div>
  );
};

// ── High-Value Settings ─────────────────────────────────────────────────
const SettingsModal: React.FC<{ settings: any; onClose: () => void; onSaved: (s: any) => void }> = ({ settings, onClose, onSaved }) => {
  const [enabled, setEnabled] = useState<boolean>(settings.highValueApprovalEnabled);
  const [threshold, setThreshold] = useState<string>(String(settings.highValueThreshold));
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  const handleSave = async () => {
    setSaving(true);
    try {
      const updated = await pharmacyApi.updateHmsSettings({ highValueApprovalEnabled: enabled, highValueThreshold: Number(threshold) || 0 });
      toast.success('Settings saved.');
      onSaved(updated);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white rounded-xl w-full max-w-sm shadow-2xl border border-[#e2eae5]">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#e2eae5]">
          <h3 className="text-sm font-bold text-[#111827]">High-Value Medicine Approval</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-[#94a3b8]" /></button>
        </div>
        <div className="p-5 space-y-3">
          <label className="flex items-center gap-2 text-xs text-[#2d3748]">
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} /> Require approval above a threshold
          </label>
          <div>
            <label className="block text-[11px] font-semibold text-[#52665e] mb-1">Threshold (PKR)</label>
            <input type="number" disabled={!enabled} value={threshold} onChange={(e) => setThreshold(e.target.value)} className="w-full h-9 px-3 text-sm border border-[#e2eae5] rounded-lg disabled:bg-slate-50" />
          </div>
          <p className="text-[10.5px] text-[#94a3b8]">pharmacy.md §7.3 — a request at/above this value is blocked from dispensing until an Admin/Super Admin approves it.</p>
          <button onClick={handleSave} disabled={saving} className="w-full h-9 text-xs font-semibold text-white bg-[#129b70] hover:bg-[#0e7d5a] rounded-lg disabled:opacity-60">{saving ? 'Saving…' : 'Save Settings'}</button>
        </div>
      </div>
    </div>
  );
};

// ── Log Request (stand-in for the future live HMS submission) ─────────────
const CreateRequestModal: React.FC<{ onClose: () => void; onCreated: () => void }> = ({ onClose, onCreated }) => {
  const [medicines, setMedicines] = useState<MedicineRow[]>([]);
  const [admissionRef, setAdmissionRef] = useState('');
  const [patientName, setPatientName] = useState('');
  const [urgency, setUrgency] = useState('ROUTINE');
  const [lines, setLines] = useState<{ medicineId: string; requestedQuantity: string }[]>([{ medicineId: '', requestedQuantity: '' }]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    pharmacyApi.listMedicines().then(setMedicines);
  }, []);

  const updateLine = (idx: number, patch: Partial<{ medicineId: string; requestedQuantity: string }>) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, { medicineId: '', requestedQuantity: '' }]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const handleSubmit = async () => {
    if (!admissionRef.trim()) return toast.error('Admission reference is required.');
    const validLines = lines.filter((l) => l.medicineId && Number(l.requestedQuantity) > 0);
    if (validLines.length === 0) return toast.error('Add at least one medicine + quantity.');
    setSaving(true);
    try {
      await pharmacyApi.createHmsRequest({
        externalAdmissionRef: admissionRef.trim(),
        patientNameSnapshot: patientName.trim() || undefined,
        urgency,
        lines: validLines.map((l) => ({ medicineId: l.medicineId, requestedQuantity: Number(l.requestedQuantity) })),
      });
      toast.success('Request logged.');
      onCreated();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to log request.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white rounded-xl w-full max-w-lg shadow-2xl border border-[#e2eae5] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#e2eae5]">
          <h3 className="text-sm font-bold text-[#111827]">Log Medicine Request</h3>
          <button onClick={onClose}><X className="h-4 w-4 text-[#94a3b8]" /></button>
        </div>
        <div className="p-5 space-y-3 overflow-y-auto">
          <p className="text-[10.5px] text-amber-700 bg-amber-50 border border-amber-200 rounded-md p-2">Stand-in for the future live HMS submission (pharmacy.md §15) — same shape either way.</p>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Admission Ref *"><input value={admissionRef} onChange={(e) => setAdmissionRef(e.target.value)} placeholder="e.g. A-102" className="input" /></Field>
            <Field label="Urgency">
              <select value={urgency} onChange={(e) => setUrgency(e.target.value)} className="input">
                <option value="ROUTINE">Routine</option><option value="URGENT">Urgent</option><option value="STAT">STAT</option>
              </select>
            </Field>
          </div>
          <Field label="Patient Name"><input value={patientName} onChange={(e) => setPatientName(e.target.value)} className="input" /></Field>

          <div className="space-y-2">
            <label className="block text-[11px] font-semibold text-[#52665e]">Medicines</label>
            {lines.map((l, idx) => (
              <div key={idx} className="flex items-center gap-1.5">
                <select value={l.medicineId} onChange={(e) => updateLine(idx, { medicineId: e.target.value })} className="input flex-1">
                  <option value="">Select medicine…</option>
                  {medicines.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                </select>
                <input type="number" min={0} value={l.requestedQuantity} onChange={(e) => updateLine(idx, { requestedQuantity: e.target.value })} placeholder="Qty" className="input w-24" />
                {lines.length > 1 && <button onClick={() => removeLine(idx)} className="text-rose-500"><X className="h-3.5 w-3.5" /></button>}
              </div>
            ))}
            <button onClick={addLine} className="text-xs font-semibold text-[#129b70] hover:underline">+ Add medicine</button>
          </div>
        </div>
        <div className="p-4 border-t border-[#e2eae5] flex justify-end gap-2">
          <button onClick={onClose} className="px-4 py-2 text-xs font-semibold text-[#52665e] border border-[#e2eae5] rounded-lg">Cancel</button>
          <button onClick={handleSubmit} disabled={saving} className="px-4 py-2 text-xs font-semibold text-white bg-[#129b70] hover:bg-[#0e7d5a] rounded-lg disabled:opacity-60">{saving ? 'Submitting…' : 'Submit Request'}</button>
        </div>
        <style>{`.input { width: 100%; height: 2.25rem; padding: 0 0.75rem; font-size: 0.875rem; background: white; border: 1px solid #e2eae5; border-radius: 0.5rem; }`}</style>
      </div>
    </div>
  );
};

// ── Detail / Fulfill ────────────────────────────────────────────────────
const DetailModal: React.FC<{
  request: RequestRow;
  settings: any;
  canApprove: boolean;
  onClose: () => void;
  onApprove: () => void;
  onReject: () => void;
  onFulfilled: () => void;
}> = ({ request, settings, canApprove, onClose, onApprove, onReject, onFulfilled }) => {
  const [dispenseQty, setDispenseQty] = useState<Record<string, string>>(
    Object.fromEntries(request.lines.map((l) => [l.id, String(Math.max(0, Number(l.requestedQuantity) - Number(l.dispensedQuantity)))])),
  );
  const [fulfilling, setFulfilling] = useState(false);
  const toast = useToast();

  const needsApproval = settings?.highValueApprovalEnabled && request.status === 'REQUESTED' && !request.approvedById && estimatedValue(request) >= Number(settings.highValueThreshold);
  const canFulfill = (request.status === 'REQUESTED' || request.status === 'PARTIALLY_ACCEPTED') && !needsApproval;

  const handleFulfill = async () => {
    const lines = request.lines
      .map((l) => ({ requestLineId: l.id, dispenseQuantity: Number(dispenseQty[l.id] || 0) }))
      .filter((l) => l.dispenseQuantity > 0);
    if (lines.length === 0) return toast.error('Enter a dispense quantity for at least one line.');
    setFulfilling(true);
    try {
      await pharmacyApi.fulfillHmsRequest(request.id, lines);
      toast.success('Dispensed — Pharmacy invoice created/updated.');
      onFulfilled();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to dispense.');
    } finally {
      setFulfilling(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50">
      <div className="bg-white rounded-xl w-full max-w-2xl shadow-2xl border border-[#e2eae5] max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-3 border-b border-[#e2eae5]">
          <div>
            <h3 className="text-sm font-bold text-[#111827]">{request.requestNumber}</h3>
            <p className="text-[11px] text-[#52665e]">Admission {request.externalAdmissionRef} {request.patientNameSnapshot ? `· ${request.patientNameSnapshot}` : ''}</p>
          </div>
          <button onClick={onClose}><X className="h-4 w-4 text-[#94a3b8]" /></button>
        </div>

        <div className="p-5 space-y-4 overflow-y-auto">
          {needsApproval && (
            <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
              <ShieldAlert className="h-4 w-4 shrink-0 mt-0.5" />
              <span>Estimated value {formatPKR(estimatedValue(request))} is at/above the high-value threshold ({formatPKR(settings.highValueThreshold)}) — an Admin/Super Admin must approve before dispensing.</span>
            </div>
          )}
          {request.status === 'REJECTED' && request.rejectionReason && (
            <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-900 text-xs">Rejected: {request.rejectionReason}</div>
          )}

          <table className="w-full text-sm">
            <thead className="bg-[#f6faf8]">
              <tr className="text-[10px] font-bold uppercase text-[#52665e]">
                <th className="py-2 px-2 text-left">Medicine</th>
                <th className="py-2 px-2 text-right">Requested</th>
                <th className="py-2 px-2 text-right">Dispensed</th>
                <th className="py-2 px-2 text-right">Remaining</th>
                {canFulfill && <th className="py-2 px-2 text-right">Dispense Now</th>}
              </tr>
            </thead>
            <tbody>
              {request.lines.map((l) => {
                const remaining = Number(l.requestedQuantity) - Number(l.dispensedQuantity);
                return (
                  <tr key={l.id} className="border-t border-[#f0f4f2]">
                    <td className="py-1.5 px-2 font-semibold text-[#111827]">{l.medicine.name}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{formatNumber(l.requestedQuantity)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{formatNumber(l.dispensedQuantity)}</td>
                    <td className="py-1.5 px-2 text-right tabular-nums">{formatNumber(remaining)}</td>
                    {canFulfill && (
                      <td className="py-1.5 px-2 text-right">
                        <input
                          type="number"
                          min={0}
                          max={remaining}
                          value={dispenseQty[l.id] ?? ''}
                          onChange={(e) => setDispenseQty((prev) => ({ ...prev, [l.id]: e.target.value }))}
                          className="w-20 h-7 text-right text-xs border border-[#e2eae5] rounded px-1.5"
                        />
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>

          {request.invoice && (
            <div className="border-t border-[#e2eae5] pt-3 text-xs space-y-1">
              <p className="font-semibold text-[#111827]">Pharmacy Invoice {request.invoice.invoiceNumber}</p>
              <div className="flex justify-between"><span>Total</span><span className="tabular-nums font-bold">{formatPKR(request.invoice.total)}</span></div>
              <div className="flex justify-between"><span>Paid</span><span className="tabular-nums">{formatPKR(request.invoice.paidTotal)}</span></div>
              <div className="flex justify-between"><span>Outstanding</span><span className="tabular-nums font-bold">{formatPKR(request.invoice.outstanding)}</span></div>
              <div className="flex justify-between"><span>Clearance</span><span className="font-semibold">{request.invoice.clearanceStatus ?? '—'}</span></div>
              <p className="text-[10.5px] text-[#94a3b8]">Collect payment from Sales / Invoices — Outstanding auto-clears when fully paid.</p>
            </div>
          )}
        </div>

        <div className="p-4 border-t border-[#e2eae5] flex items-center justify-end gap-2">
          {request.status === 'REQUESTED' && (
            <button onClick={onReject} className="px-4 py-2 text-xs font-semibold text-rose-700 border border-rose-200 bg-rose-50 hover:bg-rose-100 rounded-lg flex items-center gap-1.5"><Ban className="h-3.5 w-3.5" /> Reject</button>
          )}
          {needsApproval && canApprove && (
            <button onClick={onApprove} className="px-4 py-2 text-xs font-semibold text-amber-800 border border-amber-300 bg-amber-50 hover:bg-amber-100 rounded-lg flex items-center gap-1.5"><ShieldAlert className="h-3.5 w-3.5" /> Approve High-Value</button>
          )}
          {canFulfill && (
            <button onClick={handleFulfill} disabled={fulfilling} className="px-4 py-2 text-xs font-semibold text-white bg-[#129b70] hover:bg-[#0e7d5a] rounded-lg disabled:opacity-60 flex items-center gap-1.5">
              {fulfilling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />} Dispense
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-semibold text-[#52665e] mb-1">{label}</label>
    {children}
  </div>
);
