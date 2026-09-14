import React, { useState, useMemo } from 'react';
import { Stethoscope, Search, UserPlus, AlertCircle, CheckCircle2, Receipt } from 'lucide-react';
import { Patient } from '../../../types/patient';
import { getAllPatients, createPatient } from '../../../services/patientRegistryService';
import { PatientModal } from '../../superAdmin/patientRegistry/PatientModal';
import { PatientFormData } from '../../../types/patient';
import { DepartmentService } from '../../../services/departmentService';
import { StaffUserService } from '../../../services/staffUserService';
import { createEncounter, EncounterType, InvoiceDetail } from '../../../services/invoiceService';
import { useAuth } from '../../../context/AuthContext';
import { Select, Textarea } from '../../../components/forms/FormControls';
import { InvoiceDetailModal } from '../billing/InvoiceDetailModal';

/**
 * Real Walk-In / Encounter Intake — creates an OPD / Observation /
 * Emergency encounter via `POST /encounters` (real, tested backend), which
 * immediately opens the resulting invoice so Front Desk can add the first
 * service line and collect payment right away.
 */
export const WalkInIntakeView: React.FC = () => {
  const { currentUser } = useAuth();
  const [encounterType, setEncounterType] = useState<EncounterType>('OPD');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isPatientModalOpen, setIsPatientModalOpen] = useState(false);
  const [departmentId, setDepartmentId] = useState('');
  const [doctorId, setDoctorId] = useState('');
  const [notes, setNotes] = useState('');

  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [createdInvoiceId, setCreatedInvoiceId] = useState<string | null>(null);

  const departments = useMemo(() => DepartmentService.getDepartments().filter((d) => d.status === 'Active'), []);
  const doctors = useMemo(() => StaffUserService.getStaffUsers().filter((s) => s.staffCategory === 'Doctor' && s.status === 'ACTIVE'), []);

  const searchResults = useMemo(() => {
    if (!searchTerm.trim()) return [];
    const q = searchTerm.trim().toLowerCase();
    return getAllPatients()
      .filter((p) => p.fullName.toLowerCase().includes(q) || p.mrNumber.toLowerCase().includes(q) || p.primaryPhone.includes(q))
      .slice(0, 10);
  }, [searchTerm]);

  const handleRegisterNewPatient = async (data: PatientFormData) => {
    const res = await createPatient(data, currentUser);
    if (!res.success || !res.patient) {
      setFormError(res.error || 'Failed to register patient.');
      return;
    }
    setIsPatientModalOpen(false);
    setSelectedPatient(res.patient);
    setSearchTerm('');
  };

  const handleCreateEncounter = async () => {
    setFormError(null);
    if (!selectedPatient) {
      setFormError('Search and select (or register) a patient first.');
      return;
    }
    setIsSaving(true);
    try {
      const invoice: InvoiceDetail = await createEncounter({
        encounterType,
        panelPatientId: selectedPatient.payerType === 'Corporate / Panel' ? selectedPatient.id : '',
        selfPayEncounterId: selectedPatient.payerType === 'Self Pay' ? selectedPatient.id : '',
        departmentId,
        doctorStaffId: doctorId,
        notes,
      });
      setCreatedInvoiceId(invoice.id);
    } catch (err: any) {
      setFormError(err?.response?.data?.error?.message || err?.message || 'Failed to create encounter.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    setSelectedPatient(null);
    setSearchTerm('');
    setDepartmentId('');
    setDoctorId('');
    setNotes('');
    setFormError(null);
    setCreatedInvoiceId(null);
  };

  return (
    <div className="max-w-2xl mx-auto space-y-5 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs">
        <div className="flex items-center gap-2.5">
          <div className="h-9 w-9 rounded-xl bg-[#effaf5] text-[#08775A] flex items-center justify-center">
            <Stethoscope className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Walk-In / Encounter Intake</h1>
            <p className="text-xs text-slate-500 mt-0.5">Register an OPD, Observation or Emergency encounter and open its invoice.</p>
          </div>
        </div>
      </div>

      {formError && (
        <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700 font-medium">
          <AlertCircle className="h-4 w-4 shrink-0" /> {formError}
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <Select
          label="Encounter Type"
          options={[
            { label: 'OPD', value: 'OPD' },
            { label: 'Observation', value: 'OBSERVATION' },
            { label: 'Emergency', value: 'EMERGENCY' },
          ]}
          value={encounterType}
          onChange={(e) => setEncounterType(e.target.value as EncounterType)}
        />

        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#08775A] mb-2">Patient</h3>
          {selectedPatient ? (
            <div className="flex items-center justify-between p-3 bg-[#effaf5] border border-[#c2e7db] rounded-lg">
              <div>
                <span className="font-bold text-slate-900 text-sm">{selectedPatient.fullName}</span>
                <span className="text-[11px] text-slate-500 block">{selectedPatient.mrNumber} • {selectedPatient.payerType}</span>
              </div>
              <button type="button" onClick={() => setSelectedPatient(null)} className="text-xs font-semibold text-slate-500 hover:text-rose-600">Change</button>
            </div>
          ) : (
            <>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by name, MRN or phone…"
                  className="w-full text-xs pl-8.5 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#149E75]"
                />
              </div>
              {searchResults.length > 0 && (
                <div className="mt-2 border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-48 overflow-y-auto">
                  {searchResults.map((p) => (
                    <button key={p.id} type="button" onClick={() => { setSelectedPatient(p); setSearchTerm(''); }} className="w-full text-left px-3 py-2 hover:bg-slate-50 text-xs flex items-center justify-between">
                      <span><span className="font-semibold text-slate-900">{p.fullName}</span> <span className="text-slate-400 ml-2">{p.mrNumber}</span></span>
                      <span className="text-[10px] text-slate-500">{p.payerType}</span>
                    </button>
                  ))}
                </div>
              )}
              <button type="button" onClick={() => setIsPatientModalOpen(true)} className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-[#08775A] hover:underline">
                <UserPlus className="h-3.5 w-3.5" /> Register New Patient
              </button>
            </>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select label="Department (optional)" options={departments.map((d) => ({ label: d.name, value: d.id }))} value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} />
          <Select label="Doctor (optional)" options={doctors.map((d) => ({ label: d.fullName, value: d.id }))} value={doctorId} onChange={(e) => setDoctorId(e.target.value)} />
        </div>

        <Textarea label="Notes (optional)" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />

        <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-200">
          <button type="button" onClick={handleReset} className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50">Reset</button>
          <button
            type="button"
            onClick={handleCreateEncounter}
            disabled={isSaving}
            className="inline-flex items-center gap-1.5 px-5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60"
          >
            <Receipt className="h-3.5 w-3.5" />
            {isSaving ? 'Creating…' : 'Create Encounter & Open Invoice'}
          </button>
        </div>
      </div>

      <PatientModal isOpen={isPatientModalOpen} onClose={() => setIsPatientModalOpen(false)} onSave={handleRegisterNewPatient} />

      {createdInvoiceId && (
        <InvoiceDetailModal invoiceId={createdInvoiceId} onClose={handleReset} onChanged={() => {}} />
      )}
    </div>
  );
};
