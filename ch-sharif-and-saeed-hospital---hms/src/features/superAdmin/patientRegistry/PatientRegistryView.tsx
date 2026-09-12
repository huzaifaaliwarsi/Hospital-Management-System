import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  UserCheck,
  Building,
  CreditCard,
  CalendarPlus,
  Upload,
  Download,
  Plus,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import {
  Patient,
  PatientFormData,
  PatientFilterState,
  PatientStatus,
  ImportSummary,
} from '../../../types/patient';
import { User } from '../../../types';
import {
  getAllPatients,
  filterPatients,
  getPatientRegistryKpis,
  createPatient,
  updatePatient,
  updatePatientStatus,
} from '../../../services/patientRegistryService';
import { PatientFilterBar } from './PatientFilterBar';
import { PatientTable } from './PatientTable';
import { PatientModal } from './PatientModal';
import { PatientDetailDrawer } from './PatientDetailDrawer';
import { PatientStatusModal } from './PatientStatusModal';
import { PatientImportModal } from './PatientImportModal';
import { PatientExportModal } from './PatientExportModal';
import { PatientDossierModal } from './PatientDossierModal';

interface PatientRegistryViewProps {
  currentUser: User | null;
}

const DEFAULT_FILTERS: PatientFilterState = {
  searchTerm: '',
  gender: 'ALL',
  payerType: 'ALL',
  panelId: 'ALL',
  status: 'ALL',
};

export const PatientRegistryView: React.FC<PatientRegistryViewProps> = ({ currentUser }) => {
  // Master patient records
  const [patients, setPatients] = useState<Patient[]>([]);

  // Filter State
  const [filters, setFilters] = useState<PatientFilterState>(DEFAULT_FILTERS);

  // Modals & Drawers State
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);
  const [patientToEdit, setPatientToEdit] = useState<Patient | null>(null);

  const [detailDrawerPatient, setDetailDrawerPatient] = useState<Patient | null>(null);
  const [isDetailDrawerOpen, setIsDetailDrawerOpen] = useState(false);

  const [statusModalPatient, setStatusModalPatient] = useState<Patient | null>(null);
  const [isStatusModalOpen, setIsStatusModalOpen] = useState(false);

  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);

  const [dossierPatient, setDossierPatient] = useState<Patient | null>(null);
  const [isDossierModalOpen, setIsDossierModalOpen] = useState(false);

  // Toast Notification
  const [toastMessage, setToastMessage] = useState<{
    text: string;
    type: 'success' | 'error' | 'info';
  } | null>(null);

  // Load patient records on mount
  useEffect(() => {
    const list = getAllPatients();
    setPatients(list);
  }, []);

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Filtered dataset
  const filteredPatients = useMemo(() => {
    return filterPatients(patients, filters);
  }, [patients, filters]);

  // Overall KPIs
  const kpis = useMemo(() => {
    return getPatientRegistryKpis(patients);
  }, [patients]);

  // Handlers for Filters
  const handleFilterChange = <K extends keyof PatientFilterState>(
    key: K,
    value: PatientFilterState[K]
  ) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleResetFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  // Register or Update Patient Save
  const handleSavePatient = (formData: PatientFormData) => {
    if (patientToEdit) {
      // Update
      const res = updatePatient(patientToEdit.id, formData, currentUser);
      if (res.success && res.patient) {
        const updatedList = getAllPatients();
        setPatients(updatedList);
        setIsRegisterModalOpen(false);
        setPatientToEdit(null);
        showToast(`Patient ${res.patient.fullName} (${res.patient.mrNumber}) updated successfully.`);

        // If drawer is currently open for this patient, update it
        if (detailDrawerPatient?.id === res.patient.id) {
          setDetailDrawerPatient(res.patient);
        }
      } else {
        showToast(res.error || 'Failed to update patient.', 'error');
      }
    } else {
      // Create new
      const res = createPatient(formData, currentUser);
      if (res.success && res.patient) {
        const updatedList = getAllPatients();
        setPatients(updatedList);
        setIsRegisterModalOpen(false);
        showToast(
          `Registered ${res.patient.fullName} with permanent MR Number: ${res.patient.mrNumber}`
        );
      } else {
        showToast(res.error || 'Failed to register patient.', 'error');
      }
    }
  };

  // Open Edit Modal
  const handleOpenEdit = (patient: Patient) => {
    setPatientToEdit(patient);
    setIsRegisterModalOpen(true);
  };

  // Open Detail Drawer
  const handleOpenDetail = (patient: Patient) => {
    setDetailDrawerPatient(patient);
    setIsDetailDrawerOpen(true);
  };

  // Open Status Modal
  const handleOpenStatusModal = (patient: Patient) => {
    setStatusModalPatient(patient);
    setIsStatusModalOpen(true);
  };

  // Open Dossier Modal
  const handleOpenDossier = (patient: Patient) => {
    setDossierPatient(patient);
    setIsDossierModalOpen(true);
  };

  // Confirm Status Change
  const handleConfirmStatus = (patientId: string, newStatus: PatientStatus) => {
    const res = updatePatientStatus(patientId, newStatus, currentUser);
    if (res.success && res.patient) {
      const updatedList = getAllPatients();
      setPatients(updatedList);
      showToast(
        `Patient ${res.patient.fullName} (${res.patient.mrNumber}) status changed to ${newStatus}.`
      );
      if (detailDrawerPatient?.id === patientId) {
        setDetailDrawerPatient(res.patient);
      }
    } else {
      showToast(res.error || 'Failed to update status.', 'error');
    }
  };

  // Import completed
  const handleImportComplete = (summary: ImportSummary) => {
    const updatedList = getAllPatients();
    setPatients(updatedList);
    showToast(
      `Import complete: ${summary.patientsCreated} patient(s) registered with permanent MR numbers.`
    );
  };

  return (
    <div className="space-y-5">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-5 right-5 z-60 animate-in fade-in slide-in-from-top-4 duration-200">
          <div
            className={`flex items-center gap-2.5 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium ${
              toastMessage.type === 'success'
                ? 'bg-emerald-900 text-emerald-100 border-emerald-700'
                : toastMessage.type === 'error'
                ? 'bg-rose-900 text-rose-100 border-rose-700'
                : 'bg-slate-900 text-slate-100 border-slate-700'
            }`}
          >
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
            )}
            <span>{toastMessage.text}</span>
            <button
              onClick={() => setToastMessage(null)}
              className="ml-2 text-xs opacity-70 hover:opacity-100"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Header & Primary Actions */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <span>Hospital Administration</span>
            <span>/</span>
            <span className="text-[#08775A] font-medium">Patient Registry</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900 flex items-center gap-2.5">
            <span>Patient Registry</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
              MPI Central Directory
            </span>
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Permanent Master Patient Index (MPI), collision-safe MR number allocation, and payer classification
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Import Excel */}
          <button
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Import Patients via Excel Spreadsheets"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            <span>Import Excel</span>
          </button>

          {/* Export */}
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
            title="Export Registry as PDF or Excel"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            <span>Export</span>
          </button>

          {/* Register New Patient */}
          <button
            onClick={() => {
              setPatientToEdit(null);
              setIsRegisterModalOpen(true);
            }}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#08775A] hover:bg-[#07664d] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors cursor-pointer"
            title="Register a new patient and allocate permanent MR Number"
          >
            <Plus className="w-4 h-4" />
            <span>Register New Patient</span>
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Total Registered */}
        <div className="bg-white border border-[#e2eae5] rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Total Registered</span>
            <Users className="w-4 h-4 text-[#08775A]" />
          </div>
          <div className="text-xl font-bold text-slate-900">{kpis.total}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Permanent MR Numbers</div>
        </div>

        {/* Active Patients */}
        <div className="bg-white border border-[#e2eae5] rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Active Patients</span>
            <UserCheck className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-xl font-bold text-emerald-700">{kpis.active}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Eligible for visits</div>
        </div>

        {/* Self Pay */}
        <div className="bg-white border border-[#e2eae5] rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Self Pay</span>
            <CreditCard className="w-4 h-4 text-slate-600" />
          </div>
          <div className="text-xl font-bold text-slate-800">{kpis.selfPay}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Direct billing</div>
        </div>

        {/* Corporate / Panel */}
        <div className="bg-white border border-[#e2eae5] rounded-xl p-3.5 shadow-2xs">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">Corporate / Panel</span>
            <Building className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-xl font-bold text-blue-700">{kpis.panel}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">Institutional cover</div>
        </div>

        {/* Registered This Month */}
        <div className="bg-white border border-[#e2eae5] rounded-xl p-3.5 shadow-2xs col-span-2 sm:col-span-1">
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="text-xs font-medium">New This Month</span>
            <CalendarPlus className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-xl font-bold text-purple-700">{kpis.newThisMonth}</div>
          <div className="text-[11px] text-slate-400 mt-0.5">September 2026 intake</div>
        </div>
      </div>

      {/* Filter Bar */}
      <PatientFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        totalCount={patients.length}
        filteredCount={filteredPatients.length}
      />

      {/* Table */}
      <PatientTable
        patients={filteredPatients}
        totalUnfilteredCount={patients.length}
        onViewPatient={handleOpenDetail}
        onEditPatient={handleOpenEdit}
        onChangeStatus={handleOpenStatusModal}
        onRegisterNew={() => {
          setPatientToEdit(null);
          setIsRegisterModalOpen(true);
        }}
        onResetFilters={handleResetFilters}
      />

      {/* MODALS */}
      {/* Register / Edit Patient Modal */}
      <PatientModal
        isOpen={isRegisterModalOpen}
        onClose={() => {
          setIsRegisterModalOpen(false);
          setPatientToEdit(null);
        }}
        onSave={handleSavePatient}
        patientToEdit={patientToEdit}
        onOpenExistingPatient={(existing) => {
          setIsRegisterModalOpen(false);
          setPatientToEdit(null);
          handleOpenDetail(existing);
        }}
      />

      {/* Patient Detail Drawer */}
      <PatientDetailDrawer
        isOpen={isDetailDrawerOpen}
        onClose={() => {
          setIsDetailDrawerOpen(false);
          setDetailDrawerPatient(null);
        }}
        patient={detailDrawerPatient}
        onEdit={handleOpenEdit}
        onChangeStatus={handleOpenStatusModal}
        onPrintDossier={handleOpenDossier}
      />

      {/* Patient Status Change Modal */}
      <PatientStatusModal
        isOpen={isStatusModalOpen}
        onClose={() => {
          setIsStatusModalOpen(false);
          setStatusModalPatient(null);
        }}
        patient={statusModalPatient}
        onConfirmStatus={handleConfirmStatus}
      />

      {/* Patient Import Modal */}
      <PatientImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={handleImportComplete}
        currentUser={currentUser}
      />

      {/* Patient Export Modal */}
      <PatientExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        patients={filteredPatients}
        filters={filters}
        currentUser={currentUser}
      />

      {/* Patient Printable Dossier Modal */}
      <PatientDossierModal
        isOpen={isDossierModalOpen}
        onClose={() => {
          setIsDossierModalOpen(false);
          setDossierPatient(null);
        }}
        patient={dossierPatient}
      />
    </div>
  );
};
