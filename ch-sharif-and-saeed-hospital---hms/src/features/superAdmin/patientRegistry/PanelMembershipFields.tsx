import React, { useEffect, useState } from 'react';
import type { PanelMembershipDetails } from '../../../types/patient';
import apiClient from '../../../services/apiClient';
import { formatDateDDMMYYYY, formatDateTimeDDMMYYYY } from '../../../utils/formatters';
import { DateInputControl } from '../../../components/forms/FormControls';

interface Revision {
  id: string;
  recordedAt: string;
  recordedByLabel: string;
  snapshot: PanelMembershipDetails & { panelMemberId?: string };
}
const detailFields = [
  ['policyNumber', 'Policy / contract number'],
  ['planName', 'Plan'],
  ['principalMemberName', 'Principal member name'],
  ['memberRelationship', 'Relationship to principal member'],
] as const;

export default function PanelMembershipFields({ value, onChange, patientId, datesRequired }: {
  key?: React.Key;
  value: PanelMembershipDetails;
  onChange: (patch: Partial<PanelMembershipDetails>) => void;
  patientId?: string;
  datesRequired?: boolean;
}) {
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [rows, setRows] = useState<Revision[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!patientId) return;
    let ignore = false;
    setLoading(true);
    setError('');
    apiClient.get<{ data: Revision[]; meta: { pagination: { totalPages: number } } }>(`/patients/panel/${patientId}/membership-history?page=${page}&pageSize=10`)
      .then(res => { if (!ignore) { setRows(res.data.data); setPages(res.data.meta.pagination.totalPages); } })
      .catch(err => { if (!ignore) setError(err.message || 'Could not load membership history'); })
      .finally(() => { if (!ignore) setLoading(false); });
    return () => { ignore = true; };
  }, [patientId, page, retry]);
  const inputClass = 'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm';
  return <div className="mt-4 space-y-3">
    <h4 className="text-sm font-semibold">Membership details</h4>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <label className="text-xs">Membership status
        <select className={inputClass} value={value.membershipStatus || 'ACTIVE'} onChange={e => onChange({ membershipStatus: e.target.value as PanelMembershipDetails['membershipStatus'] })}>
          <option value="ACTIVE">Active</option><option value="SUSPENDED">Suspended</option><option value="CANCELLED">Cancelled</option>
        </select>
      </label>
      <div className="text-xs text-slate-500 self-center">Expiry is checked from the saved dates. Membership status is separate from patient status.</div>
      <DateInputControl
        label={`Valid from${datesRequired ? ' *' : ''}`}
        required={datesRequired}
        value={value.membershipValidFrom || ''}
        max={value.membershipValidTo || undefined}
        onChange={e => onChange({ membershipValidFrom: e.target.value })}
      />
      <DateInputControl
        label={`Valid through${datesRequired ? ' *' : ''}`}
        required={datesRequired}
        value={value.membershipValidTo || ''}
        min={value.membershipValidFrom || undefined}
        onChange={e => onChange({ membershipValidTo: e.target.value })}
      />
      {detailFields.map(([key, label]) => <label key={key} className="text-xs">{label}<input className={inputClass} maxLength={key === 'memberRelationship' ? 100 : 150} value={value[key] || ''} onChange={e => onChange({ [key]: e.target.value })} /></label>)}
    </div>
    {patientId && <details className="rounded-lg border p-3">
      <summary className="cursor-pointer text-sm font-semibold">Saved membership history</summary>
      {loading ? <p className="text-xs py-2">Loading history…</p> : error ? <p role="alert" className="text-xs text-red-600 py-2">{error} <button type="button" onClick={() => setRetry(n => n + 1)}>Retry</button></p> : <>
        {!rows.length && <p className="text-xs py-2">No saved revisions.</p>}
        {rows.map(row => <div key={row.id} className="border-t mt-2 pt-2 text-xs space-y-1">
          <p className="font-medium">{formatDateTimeDDMMYYYY(row.recordedAt)} — {row.recordedByLabel}</p>
          <p>{row.snapshot.panelMemberId || 'No member ID'} · {row.snapshot.membershipStatus || 'ACTIVE'} · {row.snapshot.membershipValidFrom ? formatDateDDMMYYYY(row.snapshot.membershipValidFrom) : 'No start date'} → {row.snapshot.membershipValidTo ? formatDateDDMMYYYY(row.snapshot.membershipValidTo) : 'No end date'}</p>
          {detailFields.map(([key, label]) => row.snapshot[key] ? <p key={key}>{label}: {row.snapshot[key]}</p> : null)}
        </div>)}
        <div className="flex justify-between mt-3 text-xs"><button type="button" disabled={page <= 1} onClick={() => setPage(n => n - 1)}>Previous</button><span>Page {page} / {pages}</span><button type="button" disabled={page >= pages} onClick={() => setPage(n => n + 1)}>Next</button></div>
      </>}
    </details>}
  </div>;
}
