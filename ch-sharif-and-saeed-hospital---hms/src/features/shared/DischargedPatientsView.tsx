import React, { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, RefreshCw } from 'lucide-react';
import { TextInput } from '../../components/forms/FormControls';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { AdmissionRecord, fetchAdmissions } from '../../services/admissionService';
import { AdmissionLedgerButton } from '../admission/AdmissionLedgerButton';

export const DischargedPatientsView: React.FC = () => {
  const [patients, setPatients] = useState<AdmissionRecord[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setIsLoading(true);
    setError(null);
    try {
      setPatients(await fetchAdmissions({ status: 'DISCHARGED' }));
    } catch (err: any) {
      setError(err?.message || 'Failed to load discharged patients.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    return patients.filter((patient) => [patient.patientName, patient.patientMrNumber, patient.admissionNumber, patient.departmentName]
      .some((value) => value.toLowerCase().includes(term)));
  }, [patients, search]);

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Discharged Patients</h1>
            <p className="text-xs text-slate-500 mt-0.5">Completed admissions and their patient ledgers.</p>
          </div>
        </div>
        <button type="button" onClick={load} disabled={isLoading} className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#08775A] rounded-lg hover:bg-[#effaf5] disabled:opacity-50">
          <RefreshCw className="h-3.5 w-3.5" /> Refresh
        </button>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs">
        <TextInput label="Search discharged patients" placeholder="Patient name, MR number, admission number or department" value={search} onChange={(e) => setSearch(e.target.value)} />
        <p className="text-[11px] text-slate-500 mt-3">{filtered.length} discharged admission(s)</p>
      </div>
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {isLoading ? <LoadingState message="Loading discharged patients..." /> : error ? <ErrorState message={error} onRetry={load} /> : filtered.length === 0 ? (
          <EmptyState title="No discharged patients found" description="Completed discharges matching your search will appear here." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>{['Admission #', 'Patient', 'Department', 'Doctor', 'Admitted', 'Discharged', 'Actions'].map((label) => (
                  <th key={label} className="text-left px-3 py-2.5 font-semibold text-slate-600 whitespace-nowrap">{label}</th>
                ))}</tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((patient) => (
                  <tr key={patient.id} className="hover:bg-slate-50/60">
                    <td className="px-3 py-2.5 font-mono whitespace-nowrap">{patient.admissionNumber}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="font-semibold text-slate-900">{patient.patientName}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{patient.patientMrNumber}</div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{patient.departmentName}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{patient.doctorName || 'Not Assigned'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{patient.admittedAt || 'Not available'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap">{patient.dischargedAt || 'Not available'}</td>
                    <td className="px-3 py-2.5 whitespace-nowrap"><AdmissionLedgerButton admissionId={patient.id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
