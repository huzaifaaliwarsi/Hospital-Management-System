import React, { useState } from 'react';
import { StatusBadge } from '../../components/common/StatusBadge';
import {
  TextInput,
  NumberInput,
  CurrencyInput,
  PhoneInput,
  DatePicker,
  DateRange,
  Select,
  MultiSelect,
  SearchableSelect,
  Textarea,
  Checkbox,
  RadioGroup,
  Toggle,
  FileUpload,
} from '../../components/forms/FormControls';
import {
  DoctorSelector,
  DepartmentSelector,
  ServiceSelector,
  PaymentMethodSelector,
  PatientSelector,
  UserSelector,
} from '../../components/forms/SpecializedSelectors';
import { Modal } from '../../components/common/Modal';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { Drawer } from '../../components/common/Drawer';
import { EmptyState, LoadingState, ErrorState } from '../../components/common/StateViews';
import { useToast } from '../../context/ToastContext';
import { StatusType } from '../../types';
import {
  Sparkles,
  ShieldAlert,
  Layers,
  CheckCircle2,
  FileCheck,
  AlertCircle,
  FileText,
  UserCheck,
  Building,
} from 'lucide-react';

export const DesignSystemShowcase: React.FC = () => {
  const toast = useToast();

  // Form states
  const [textVal, setTextVal] = useState('MRN-2026-0842');
  const [numVal, setNumVal] = useState('45');
  const [currVal, setCurrVal] = useState('12500');
  const [phoneVal, setPhoneVal] = useState('0300 1234567');
  const [dateVal, setDateVal] = useState('2026-09-06');
  const [startDate, setStartDate] = useState('2026-09-01');
  const [endDate, setEndDate] = useState('2026-09-06');
  const [selectVal, setSelectVal] = useState('opd');
  const [multiVal, setMultiVal] = useState<string[]>(['ecg', 'cbc']);
  const [searchVal, setSearchVal] = useState('dept_cardiology');
  const [textareaVal, setTextareaVal] = useState(
    'Patient presented with acute retrosternal chest pain radiating to left shoulder.'
  );
  const [chkVal, setChkVal] = useState(true);
  const [radioVal, setRadioVal] = useState('cash');
  const [toggleVal, setToggleVal] = useState(true);

  // Specialized selector states
  const [doctorVal, setDoctorVal] = useState('doc_1');
  const [deptVal, setDeptVal] = useState('dept_cardiology');
  const [serviceVal, setServiceVal] = useState('srv_1');
  const [pmVal, setPmVal] = useState('cash');
  const [patientVal, setPatientVal] = useState('pat_1');
  const [userVal, setUserVal] = useState('usr_superadmin');

  // Modals & Drawers state
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isDetailsDrawerOpen, setIsDetailsDrawerOpen] = useState(false);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);

  const allStatuses: StatusType[] = [
    'Active',
    'Inactive',
    'Pending',
    'Paid',
    'Partially Paid',
    'Unpaid',
    'Cancelled',
    'Refunded',
    'Admitted',
    'Discharged',
    'In Stock',
    'Low Stock',
    'Out of Stock',
    'Expired',
    'Near Expiry',
  ];

  return (
    <div className="space-y-8 animate-in fade-in pb-12">
      {/* Header Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-3 rounded-xl bg-blue-900 text-white shadow-sm">
            <Sparkles className="h-6 w-6 text-blue-300" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">
              Hospital ERP Design System & UI Specification
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Standardized components, enterprise typography, clinical status badges, and interaction modals for CH Sharif & Saeed Hospital
            </p>
          </div>
        </div>
      </div>

      {/* Section 1: Standardized Status Badges (All 15) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">1. Standardized Status Badges (15 Types)</h3>
          <p className="text-xs text-slate-500">
            Strict WCAG contrast compliance. Green for positive/paid, Amber for warnings/pending, Red for critical/danger, Slate for neutral/inactive.
          </p>
        </div>

        <div className="flex flex-wrap gap-2.5">
          {allStatuses.map((st) => (
            <StatusBadge key={st} status={st} size="md" />
          ))}
        </div>

        <div className="pt-2">
          <span className="text-[11px] font-semibold text-slate-400 block mb-1.5 uppercase tracking-wide">
            Compact Size (Table Cells):
          </span>
          <div className="flex flex-wrap gap-2">
            {allStatuses.map((st) => (
              <StatusBadge key={st} status={st} size="sm" />
            ))}
          </div>
        </div>
      </div>

      {/* Section 2: Global Form Components */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-5">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">2. Global Form Controls & Specialized Selectors</h3>
          <p className="text-xs text-slate-500">
            Consistent inputs with label support, mandatory indicators, error validation, hints, and custom icons.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <TextInput
            label="Patient MRN Number"
            required
            value={textVal}
            onChange={(e) => setTextVal(e.target.value)}
            hint="Auto-generated unique hospital identifier"
          />

          <NumberInput
            label="Patient Age"
            required
            value={numVal}
            onChange={(e) => setNumVal(e.target.value)}
            min={0}
            max={120}
          />

          <CurrencyInput
            label="Consultation Fee (PKR)"
            required
            value={currVal}
            onChange={(e) => setCurrVal(e.target.value)}
          />

          <PhoneInput
            label="Emergency Contact Phone"
            required
            value={phoneVal}
            onChange={(e) => setPhoneVal(e.target.value)}
          />

          <DatePicker
            label="Admission Date"
            required
            value={dateVal}
            onChange={(e) => setDateVal(e.target.value)}
          />

          <DateRange
            label="Report Billing Period"
            startDate={startDate}
            endDate={endDate}
            onChangeStartDate={setStartDate}
            onChangeEndDate={setEndDate}
          />

          <Select
            label="Visit Type"
            value={selectVal}
            onChange={(e) => setSelectVal(e.target.value)}
            options={[
              { value: 'opd', label: 'Outpatient Clinic (OPD)' },
              { value: 'emergency', label: 'Emergency & Trauma' },
              { value: 'ipd', label: 'Inpatient Ward Admission' },
            ]}
          />

          <MultiSelect
            label="Required Diagnostic Investigations"
            value={multiVal}
            onChange={setMultiVal}
            options={[
              { value: 'cbc', label: 'Complete Blood Count (CBC)' },
              { value: 'ecg', label: '12-Lead Electrocardiogram (ECG)' },
              { value: 'xray', label: 'Digital Chest X-Ray PA' },
              { value: 'echo', label: '2D Color Doppler Echo' },
            ]}
          />

          <SearchableSelect
            label="Searchable Department"
            value={searchVal}
            onChange={setSearchVal}
            options={[
              { value: 'dept_cardiology', label: 'Cardiology & Cath Lab' },
              { value: 'dept_ortho', label: 'Orthopedics & Spine Surgery' },
              { value: 'dept_peds', label: 'Pediatrics & Neonatology' },
              { value: 'dept_genmed', label: 'General Medicine & Diabetology' },
            ]}
          />
        </div>

        {/* Specialized Hospital Selectors */}
        <div className="pt-2 border-t border-slate-100">
          <p className="text-xs font-bold text-blue-900 mb-3 uppercase tracking-wide">
            Domain-Specific Selectors:
          </p>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <DoctorSelector value={doctorVal} onChange={setDoctorVal} required />
            <PatientSelector value={patientVal} onChange={setPatientVal} required />
            <ServiceSelector value={serviceVal} onChange={setServiceVal} required />
            <DepartmentSelector value={deptVal} onChange={setDeptVal} />
            <PaymentMethodSelector value={pmVal} onChange={setPmVal} required />
            <UserSelector value={userVal} onChange={setUserVal} required />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          <Textarea
            label="Clinical Admission Notes / Symptoms"
            value={textareaVal}
            onChange={(e) => setTextareaVal(e.target.value)}
            rows={3}
          />

          <FileUpload
            label="Patient Clinical Attachment (X-Ray / Lab Report)"
            hint="Supports DICOM, PDF, JPEG, PNG up to 10MB"
            onFileSelect={(file) =>
              toast.success(`Attached ${file.name} to patient docket.`, 'File Verified')
            }
          />
        </div>

        <div className="flex flex-wrap items-center gap-8 pt-2">
          <Checkbox
            label="Send automated SMS confirmation to patient"
            hint="Dispatches Urdu & English visit token via SMS gateway"
            checked={chkVal}
            onChange={(e) => setChkVal(e.target.checked)}
          />

          <Toggle
            label="Emergency Fast-Track Triage"
            hint="Bypasses standard registration queue"
            checked={toggleVal}
            onChange={setToggleVal}
          />

          <RadioGroup
            name="billing_channel"
            label="Billing Settlement Channel"
            inline
            value={radioVal}
            onChange={setRadioVal}
            options={[
              { value: 'cash', label: 'Cash (PKR)' },
              { value: 'card', label: 'Debit/Credit Card' },
              { value: 'panel', label: 'Corporate Panel' },
            ]}
          />
        </div>
      </div>

      {/* Section 3: Modal & Drawer Dialogs */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">3. Modal & Drawer Dialog Triggers</h3>
          <p className="text-xs text-slate-500">
            Enterprise confirmation boxes, form dialogs, slide-over details inspectors, and history drawers.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => setIsConfirmOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-blue-900 text-white hover:bg-blue-800 shadow-xs"
          >
            Open General Confirmation
          </button>

          <button
            type="button"
            onClick={() => setIsDeleteOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 shadow-xs"
          >
            Open Delete / Danger Dialog
          </button>

          <button
            type="button"
            onClick={() => setIsFormModalOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-slate-800 text-white hover:bg-slate-700 shadow-xs"
          >
            Open Form Modal (Add Record)
          </button>

          <button
            type="button"
            onClick={() => setIsDetailsDrawerOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-teal-800 text-white hover:bg-teal-700 shadow-xs"
          >
            Open Patient Details Drawer
          </button>

          <button
            type="button"
            onClick={() => setIsHistoryDrawerOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-indigo-800 text-white hover:bg-indigo-700 shadow-xs"
          >
            Open Activity / Audit Drawer
          </button>
        </div>
      </div>

      {/* Section 4: Toast Notifications */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">4. Global Toast Notifications</h3>
          <p className="text-xs text-slate-500">
            Real-time visual alerts with auto-dismiss timers, clear icons, and accessible labels.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() =>
              toast.success('Patient registry file updated with latest lab results.', 'Operation Successful')
            }
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-300 hover:bg-emerald-100"
          >
            Trigger Success Toast
          </button>

          <button
            type="button"
            onClick={() =>
              toast.warning('Amoxicillin capsule stock has dropped below 50 strips.', 'Inventory Warning')
            }
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-amber-50 text-amber-800 border border-amber-300 hover:bg-amber-100"
          >
            Trigger Warning Toast
          </button>

          <button
            type="button"
            onClick={() =>
              toast.error('Invalid CNIC checksum. Hospital registry requires standard 13-digit identity format.', 'Validation Error')
            }
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-rose-50 text-rose-800 border border-rose-300 hover:bg-rose-100"
          >
            Trigger Error Toast
          </button>

          <button
            type="button"
            onClick={() =>
              toast.info('Shift handover log has been finalized by Dr. Tariq Saeed.', 'Staff Information')
            }
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-blue-50 text-blue-800 border border-blue-300 hover:bg-blue-100"
          >
            Trigger Info Toast
          </button>
        </div>
      </div>

      {/* Section 5: State Views (Empty, Loading, Error) */}
      <div className="bg-white rounded-xl border border-slate-200 p-6 shadow-xs space-y-4">
        <div className="border-b border-slate-100 pb-3">
          <h3 className="text-sm font-bold text-slate-900">5. Standardized Empty, Loading & Error States</h3>
          <p className="text-xs text-slate-500">
            Unified patterns across all future modules, reports, and table views.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="border border-slate-200 rounded-lg p-3">
            <EmptyState
              title="No Patient Bills Found"
              description="No active invoices were found for the selected department filter."
              actionLabel="Create Invoice"
              onAction={() => toast.info('Opened New Invoice form')}
            />
          </div>

          <div className="border border-slate-200 rounded-lg p-3 flex items-center justify-center">
            <LoadingState message="Fetching clinical registry..." />
          </div>

          <div className="border border-slate-200 rounded-lg p-3">
            <ErrorState
              title="Telemetry Sync Failed"
              message="Could not reach central ICU telemetry server."
              onRetry={() => toast.info('Reconnected to telemetry')}
            />
          </div>
        </div>
      </div>

      {/* Live Modals & Drawers */}
      <ConfirmModal
        isOpen={isConfirmOpen}
        onClose={() => setIsConfirmOpen(false)}
        onConfirm={() => {
          setIsConfirmOpen(false);
          toast.success('Discharge summary approved and sent to billing desk.');
        }}
        title="Approve Patient Discharge"
        message="Are you sure you want to approve the discharge summary for Muhammad Tariq Khan (Bed 304-A)? All clinical orders and pharmacy ledgers will be closed."
        confirmLabel="Approve Discharge"
      />

      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => setIsDeleteOpen(false)}
        onConfirm={() => {
          setIsDeleteOpen(false);
          toast.error('Admission record cancelled and bed marked vacant.');
        }}
        title="Cancel Patient Admission"
        message="Warning: This action will cancel the admission slip and restore bed availability. An audit entry will be permanently logged."
        variant="danger"
        confirmLabel="Confirm Cancellation"
      />

      {/* Form Modal */}
      <Modal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        title="Register New OPD Patient"
        subtitle="Step 1 of 2: Basic demographic & triage details"
        maxWidth="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsFormModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setIsFormModalOpen(false);
                toast.success('Patient MRN-2026-0924 registered successfully.');
              }}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-900 text-white hover:bg-blue-800 shadow-xs"
            >
              Register & Print Token
            </button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Full Patient Name" required placeholder="e.g. Asad Ullah" />
            <PhoneInput label="Mobile Phone" required />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <NumberInput label="Age (Years)" required placeholder="32" />
            <Select
              label="Gender"
              required
              options={[
                { value: 'm', label: 'Male' },
                { value: 'f', label: 'Female' },
                { value: 'o', label: 'Other' },
              ]}
            />
          </div>
          <DoctorSelector value={doctorVal} onChange={setDoctorVal} required />
        </div>
      </Modal>

      {/* Details Drawer */}
      <Drawer
        isOpen={isDetailsDrawerOpen}
        onClose={() => setIsDetailsDrawerOpen(false)}
        title="Inpatient Record: Muhammad Tariq Khan"
        subtitle="MRN-2026-0842 • Admitted to Executive Suite 304"
        width="lg"
      >
        <div className="space-y-4 text-xs">
          <div className="p-3.5 bg-blue-50/70 border border-blue-100 rounded-lg flex items-center justify-between">
            <div>
              <span className="font-bold text-blue-950 text-sm">Active Inpatient</span>
              <p className="text-blue-800 text-[11px]">Admitted today at 06:15 AM</p>
            </div>
            <StatusBadge status="Admitted" />
          </div>

          <div className="space-y-2 border border-slate-200 rounded-lg p-3">
            <h4 className="font-bold text-slate-800 text-xs">Attending Care Team</h4>
            <div className="grid grid-cols-2 gap-2 text-slate-600">
              <div>Consultant: <strong>Prof. Dr. Tariq Saeed</strong></div>
              <div>Department: <strong>Cardiology</strong></div>
              <div>Assigned Nurse: <strong>Sr. Maryam Bibi</strong></div>
              <div>Diet Plan: <strong>Low Sodium Cardiac</strong></div>
            </div>
          </div>

          <div className="space-y-2 border border-slate-200 rounded-lg p-3">
            <h4 className="font-bold text-slate-800 text-xs">Primary Diagnosis</h4>
            <p className="text-slate-600 leading-relaxed">
              Acute Coronary Syndrome (NSTEMI). Undergoing serial troponin monitoring and scheduled for coronary angiography.
            </p>
          </div>
        </div>
      </Drawer>

      {/* History / Audit Drawer */}
      <Drawer
        isOpen={isHistoryDrawerOpen}
        onClose={() => setIsHistoryDrawerOpen(false)}
        title="Patient Activity & Modification History"
        subtitle="Chronological audit records for MRN-2026-0842"
        width="md"
      >
        <div className="space-y-3 text-xs">
          <div className="border-l-2 border-blue-900 pl-3 py-1 space-y-0.5">
            <p className="font-bold text-slate-900">Bed Allocation: Executive Suite 304</p>
            <p className="text-[11px] text-slate-500">Today, 06:15 AM by Receptionist Asif</p>
          </div>

          <div className="border-l-2 border-slate-300 pl-3 py-1 space-y-0.5">
            <p className="font-bold text-slate-900">Lab Order CBC & Trop-I Created</p>
            <p className="text-[11px] text-slate-500">Today, 06:22 AM by Dr. Salman Haider</p>
          </div>

          <div className="border-l-2 border-slate-300 pl-3 py-1 space-y-0.5">
            <p className="font-bold text-slate-900">Emergency Resuscitation Protocol Signed</p>
            <p className="text-[11px] text-slate-500">Today, 06:30 AM by ER Resident</p>
          </div>
        </div>
      </Drawer>
    </div>
  );
};
