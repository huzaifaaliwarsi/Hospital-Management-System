import React, { useEffect, useMemo, useState } from 'react';
import { Pill, Eye } from 'lucide-react';
import { Select, TextInput } from '../../components/forms/FormControls';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { pharmacyApiService } from '../../services/pharmacyApiService';
import { AdmissionDetailModal } from './AdmissionDetailModal';

const STATUS_BADGE: Record<string, string> = {
  REQUESTED: 'bg-blue-100 text-blue-700',
  AUTHORIZATION_REQUIRED: 'bg-amber-100 text-amber-800',
  ACCEPTED: 'bg-indigo-100 text-indigo-700',
  PARTIALLY_FULFILLED: 'bg-indigo-100 text-indigo-700',
  FULFILLED: 'bg-emerald-100 text-emerald-800',
  REJECTED: 'bg-rose-100 text-rose-700',
};

interface PharmacyRequestRow {
  id: string;
  medicineRequestNumber: string;
  admissionId: string;
  admissionNumber: string;
  patientName: string;
  bedLabel: string;
  medicines: string;
  status: string;
  requestedByLabel: string;
  requestedAt: string;
}

function toRow(raw: any): PharmacyRequestRow {
  const admission = raw.admissionRecord || {};
  const bed = admission.bed;
  return {
    id: raw.id,
    medicineRequestNumber: raw.medicineRequestNumber,
    admissionId: admission.id,
    admissionNumber: admission.admissionNumber || '—',
    patientName: admission.panelPatient?.fullName || admission.selfPayEncounter?.fullName || 'Unknown',
    bedLabel: bed ? `${bed.room?.name || ''} / ${bed.bedNumber}`.replace(/^\s*\/\s*/, '') : '—',
    medicines: (raw.lines || []).map((l: any) => `${l.medicine?.name || 'Medicine'} × ${Number(l.requestedQuantity)}`).join(', '),
    status: raw.status,
    requestedByLabel: raw.requestedBy?.username || '—',
    requestedAt: raw.requestedAt ? new Date(raw.requestedAt).toLocaleString('en-PK', { dateStyle: 'medium', timeStyle: 'short' }) : '—',
  };
}

const STATUS_OPTIONS = [
  { label: 'REQUESTED', value: 'REQUESTED' },
  { label: 'AUTHORIZATION REQUIRED', value: 'AUTHORIZATION_REQUIRED' },
  { label: 'ACCEPTED', value: 'ACCEPTED' },
  { label: 'PARTIALLY FULFILLED', value: 'PARTIALLY_FULFILLED' },
  { label: 'FULFILLED', value: 'FULFILLED' },
  { label: 'REJECTED', value: 'REJECTED' },
];

/**
 * Hospital-Managed medicine requests raised from active admissions — a
 * consolidated, real feed over `/pharmacy-bridge/requests` (the same data
 * the standalone Pharmacy side works from), read-only here since Admission
 * never dispenses (`pharmacy-bridge:create` isn't in the ADMISSION role's
 * permission set). Every row opens the admission's own Pharmacy tab for
 * detail / high-cost authorization.
 */
export const PharmacyRequestsView: React.FC = () => {
  const [rows, setRows] = useState<PharmacyRequestRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const raw = await pharmacyApiService.getInpatientRequests(statusFilter || undefined);
      setRows(raw.map(toRow));
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load pharmacy requests.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusFilter]);

  const filtered = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.patientName.toLowerCase().includes(q) ||
        r.admissionNumber.toLowerCase().includes(q) ||
        r.medicineRequestNumber.toLowerCase().includes(q) ||
        r.medicines.toLowerCase().includes(q),
    );
  }, [rows, searchTerm]);

  const pendingAuthCount = useMemo(() => rows.filter((r) => r.status === 'AUTHORIZATION_REQUIRED').length, [rows]);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center gap-2.5">
        <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
          <Pill className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-900">Pharmacy Requests</h1>
          <p className="text-xs text-slate-500 mt-0.5">Every Hospital-Managed medicine request raised from an active admission.</p>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
          <span className="text-[10px] text-slate-500 uppercase font-bold block">Total Requests</span>
          <span className="text-lg font-bold text-slate-900">{rows.length}</span>
        </div>
        <div className="bg-white rounded-xl border border-amber-200 p-4 shadow-xs">
          <span className="text-[10px] text-amber-700 uppercase font-bold block">Authorization Required</span>
          <span className="text-lg font-bold text-amber-800">{pendingAuthCount}</span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Select
            label="Status"
            placeholder="All Statuses"
            options={STATUS_OPTIONS}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
          <TextInput
            label="Search"
            placeholder="Patient, admission #, medicine…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? (
          <LoadingState message="Loading pharmacy requests…" />
        ) : loadError ? (
          <ErrorState message={loadError} onRetry={load} />
        ) : filtered.length === 0 ? (
          <EmptyState title="No pharmacy requests" description="Requests raised from Hospital-Managed admissions will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  {['Request #', 'Admission #', 'Patient', 'Bed', 'Medicines', 'Status', 'Requested By', 'Requested At', 'Actions'].map((h) => (
                    <th key={h} className="text-left px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-slate-700">{r.medicineRequestNumber}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-mono text-slate-600">{r.admissionNumber}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap font-semibold text-slate-900">{r.patientName}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-600">{r.bedLabel}</td>
                    <td className="px-3 py-2.5 text-slate-600 max-w-xs truncate" title={r.medicines}>{r.medicines}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${STATUS_BADGE[r.status] || 'bg-slate-100 text-slate-600'}`}>
                        {r.status.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-500">{r.requestedByLabel}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap text-slate-400">{r.requestedAt}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <button type="button" title="Open Admission" onClick={() => setDetailId(r.admissionId)} className="p-1.5 rounded-md text-[#08775A] hover:bg-[#effaf5]">
                        <Eye className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailId && <AdmissionDetailModal admissionId={detailId} initialTab="pharmacy" onClose={() => setDetailId(null)} onChanged={load} />}
    </div>
  );
};
