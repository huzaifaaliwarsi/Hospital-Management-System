import React, { useState, useMemo } from 'react';
import { DataTable } from '../../components/tables/DataTable';
import { TableColumn } from '../../types';
import { StatusBadge } from '../../components/common/StatusBadge';
import { Modal } from '../../components/common/Modal';
import { ConfirmModal } from '../../components/common/ConfirmModal';
import { Drawer } from '../../components/common/Drawer';
import { useToast } from '../../context/ToastContext';
import { formatPKR } from '../../utils/formatters';
import {
  TextInput,
  NumberInput,
  Select,
} from '../../components/forms/FormControls';
import {
  DoctorSelector,
  DepartmentSelector,
  ServiceSelector,
} from '../../components/forms/SpecializedSelectors';
import {
  FileText,
  ShieldCheck,
  Building,
  CheckCircle2,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

interface ModulePlaceholderViewProps {
  moduleId: string;
  moduleName: string;
  groupTitle: string;
}

export const ModulePlaceholderView: React.FC<ModulePlaceholderViewProps> = ({
  moduleId,
  moduleName,
  groupTitle,
}) => {
  const toast = useToast();

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<any | null>(null);
  const [isDetailsOpen, setIsDetailsOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<any | null>(null);

  // Generate realistic dataset tailored to this module
  const { data, columns, title, description, addNewLabel } = useMemo(() => {
    // 1. Billing / Invoices / Payments
    if (
      moduleId === 'billing_desk' ||
      moduleId === 'invoices' ||
      moduleId === 'payments_receipts' ||
      moduleId === 'panel_corporate_billing' ||
      moduleId === 'refunds_adjustments'
    ) {
      const mockInvoices = [
        {
          id: 'INV-2026-1049',
          patient: 'Muhammad Tariq Khan',
          mrn: 'MRN-2026-0842',
          service: 'Coronary Angiography Package',
          amount: 85000,
          date: '2026-09-06',
          method: 'Card / POS',
          status: 'Paid',
        },
        {
          id: 'INV-2026-1048',
          patient: 'Zubaida Begum',
          mrn: 'MRN-2026-0839',
          service: 'ICU High Dependency Care (Day 1)',
          amount: 45000,
          date: '2026-09-06',
          method: 'Cash',
          status: 'Paid',
        },
        {
          id: 'INV-2026-1047',
          patient: 'Hamza Farooq',
          mrn: 'MRN-2026-0821',
          service: 'Laparoscopic Appendectomy OT Charges',
          amount: 65000,
          date: '2026-09-05',
          method: 'Panel Approval',
          status: 'Pending',
        },
        {
          id: 'INV-2026-1046',
          patient: 'Saima Jamil',
          mrn: 'MRN-2026-0815',
          service: 'Maternity C-Section Standard Package',
          amount: 55000,
          date: '2026-09-05',
          method: 'JazzCash',
          status: 'Paid',
        },
        {
          id: 'INV-2026-1045',
          patient: 'Abdul Qadir (State Life)',
          mrn: 'MRN-2026-0792',
          service: 'Dialysis Session + Lab Profile',
          amount: 14500,
          date: '2026-09-04',
          method: 'Corporate Panel',
          status: 'Partially Paid',
        },
      ];

      const cols: TableColumn<any>[] = [
        { key: 'id', header: 'Invoice #', width: '130px' },
        {
          key: 'patient',
          header: 'Patient / Party',
          render: (item) => (
            <div>
              <span className="font-semibold text-slate-900 block">{item.patient}</span>
              <span className="text-[10px] text-slate-400 font-mono">{item.mrn}</span>
            </div>
          ),
        },
        { key: 'service', header: 'Hospital Service / Billable Head' },
        {
          key: 'amount',
          header: 'Net Total',
          align: 'right',
          render: (item) => formatPKR(item.amount),
        },
        { key: 'method', header: 'Payment Channel' },
        { key: 'date', header: 'Billing Date', width: '110px' },
        {
          key: 'status',
          header: 'Status',
          align: 'center',
          render: (item) => <StatusBadge status={item.status} size="sm" />,
        },
      ];

      return {
        data: mockInvoices,
        columns: cols,
        title: `${moduleName} Management`,
        description: 'Audit-ready financial ledgers and billing settlements in PKR',
        addNewLabel: 'Create New Invoice',
      };
    }

    // 2. Pharmacy & Inventory
    if (
      moduleId.includes('pharmacy') ||
      moduleId.includes('inventory') ||
      moduleId.includes('stock') ||
      moduleId === 'items_medicines'
    ) {
      const mockItems = [
        {
          code: 'MED-INJ-004',
          name: 'Inj. Ceftriaxone 1g IV',
          generic: 'Ceftriaxone Sodium',
          category: 'Injectables',
          unitPrice: 420,
          stock: 24,
          reorder: 100,
          unit: 'Vials',
          status: 'Low Stock',
        },
        {
          code: 'MED-TAB-089',
          name: 'Tab. Augmentin 625mg',
          generic: 'Amoxicillin + Clavulanic Acid',
          category: 'Antibiotics',
          unitPrice: 380,
          stock: 45,
          reorder: 200,
          unit: 'Strips',
          status: 'Low Stock',
        },
        {
          code: 'MED-INS-002',
          name: 'Humalog Mix 25 KwikPen',
          generic: 'Insulin Lispro Protamine',
          category: 'Endocrinology',
          unitPrice: 2850,
          stock: 62,
          reorder: 20,
          unit: 'Pens',
          status: 'Near Expiry',
        },
        {
          code: 'MED-INJ-012',
          name: 'Inj. Heparin 25,000 IU',
          generic: 'Heparin Sodium',
          category: 'Cardiovascular',
          unitPrice: 950,
          stock: 8,
          reorder: 40,
          unit: 'Vials',
          status: 'Low Stock',
        },
        {
          code: 'CON-SUR-033',
          name: 'Surgical Latex Gloves (7.5)',
          generic: 'Powder-Free Sterile Gloves',
          category: 'OT Consumables',
          unitPrice: 120,
          stock: 0,
          reorder: 150,
          unit: 'Pairs',
          status: 'Out of Stock',
        },
      ];

      const cols: TableColumn<any>[] = [
        { key: 'code', header: 'Item Code', width: '120px' },
        {
          key: 'name',
          header: 'Medicine / Item',
          render: (item) => (
            <div>
              <span className="font-semibold text-slate-900 block">{item.name}</span>
              <span className="text-[10px] text-slate-400">{item.generic}</span>
            </div>
          ),
        },
        { key: 'category', header: 'Category' },
        {
          key: 'unitPrice',
          header: 'Unit Rate',
          align: 'right',
          render: (item) => formatPKR(item.unitPrice),
        },
        {
          key: 'stock',
          header: 'Current Stock',
          align: 'right',
          render: (item) => `${item.stock} ${item.unit}`,
        },
        {
          key: 'status',
          header: 'Stock Status',
          align: 'center',
          render: (item) => <StatusBadge status={item.status} size="sm" />,
        },
      ];

      return {
        data: mockItems,
        columns: cols,
        title: `${moduleName} Registry`,
        description: 'Hospital pharmacy dispensary and stock inventory ledgers',
        addNewLabel: 'Add New Medicine',
      };
    }

    // 3. Clinical & Doctors & Staff
    if (moduleId === 'doctors' || moduleId === 'staff' || moduleId === 'attendance') {
      const mockStaff = [
        {
          id: 'DOC-01',
          name: 'Prof. Dr. Tariq Saeed',
          specialty: 'Cardiology & Cath Lab',
          fee: 3500,
          room: 'Room 102 - Executive Block',
          phone: '0300 1234567',
          status: 'Active',
        },
        {
          id: 'DOC-02',
          name: 'Dr. M. Sharif Chaudhary',
          specialty: 'Orthopedics & Spine Surgery',
          fee: 3000,
          room: 'Room 108 - Ortho Wing',
          phone: '0321 9876543',
          status: 'Active',
        },
        {
          id: 'DOC-03',
          name: 'Dr. Ayesha Malik',
          specialty: 'Pediatrics & Neonatology',
          fee: 2500,
          room: 'Room 204 - Child Clinic',
          phone: '0333 4455667',
          status: 'Active',
        },
        {
          id: 'DOC-04',
          name: 'Dr. Salman Haider',
          specialty: 'General Medicine & Diabetology',
          fee: 2000,
          room: 'Room 105 - OPD Block',
          phone: '0301 7788990',
          status: 'Active',
        },
      ];

      const cols: TableColumn<any>[] = [
        { key: 'id', header: 'Doctor ID', width: '100px' },
        { key: 'name', header: 'Consultant / Staff Name' },
        { key: 'specialty', header: 'Specialty Department' },
        { key: 'room', header: 'Clinic Location' },
        {
          key: 'fee',
          header: 'OPD Fee',
          align: 'right',
          render: (item) => formatPKR(item.fee),
        },
        { key: 'phone', header: 'Direct Contact' },
        {
          key: 'status',
          header: 'Status',
          align: 'center',
          render: (item) => <StatusBadge status={item.status} size="sm" />,
        },
      ];

      return {
        data: mockStaff,
        columns: cols,
        title: `${moduleName} Directory`,
        description: 'Hospital medical specialists, clinical roster & room assignments',
        addNewLabel: 'Register Doctor / Staff',
      };
    }

    // Default: Patient Operations / Registry / Reports / General
    const defaultPatients = [
      {
        mrn: 'MRN-2026-0842',
        name: 'Muhammad Tariq Khan',
        ageGender: '56 / M',
        cnic: '35202-1928371-1',
        phone: '0300 4567891',
        dept: 'Cardiology',
        doctor: 'Prof. Dr. Tariq Saeed',
        registeredAt: '2026-09-06 06:15',
        status: 'Admitted',
      },
      {
        mrn: 'MRN-2026-0839',
        name: 'Zubaida Begum',
        ageGender: '62 / F',
        cnic: '35201-9988772-2',
        phone: '0321 9876543',
        dept: 'General Medicine',
        doctor: 'Dr. Salman Haider',
        registeredAt: '2026-09-06 04:30',
        status: 'Admitted',
      },
      {
        mrn: 'MRN-2026-0821',
        name: 'Hamza Farooq',
        ageGender: '28 / M',
        cnic: '35202-5544332-1',
        phone: '0333 1122334',
        dept: 'General Surgery',
        doctor: 'Dr. Kamran Akram',
        registeredAt: '2026-09-05 22:45',
        status: 'Admitted',
      },
      {
        mrn: 'MRN-2026-0815',
        name: 'Saima Jamil',
        ageGender: '34 / F',
        cnic: '35201-3322119-4',
        phone: '0301 7766554',
        dept: 'Obstetrics & Gynaecology',
        doctor: 'Dr. Farhana Yasmeen',
        registeredAt: '2026-09-05 14:20',
        status: 'Admitted',
      },
      {
        mrn: 'MRN-2026-0790',
        name: 'Abdul Rehman',
        ageGender: '45 / M',
        cnic: '35202-7788990-3',
        phone: '0345 8899001',
        dept: 'Orthopedics',
        doctor: 'Dr. M. Sharif Chaudhary',
        registeredAt: '2026-09-04 09:10',
        status: 'Discharged',
      },
    ];

    const defaultCols: TableColumn<any>[] = [
      { key: 'mrn', header: 'MRN #', width: '130px' },
      {
        key: 'name',
        header: 'Patient Details',
        render: (item) => (
          <div>
            <span className="font-semibold text-slate-900 block">{item.name}</span>
            <span className="text-[10px] text-slate-400 font-mono">
              CNIC: {item.cnic} • {item.ageGender}
            </span>
          </div>
        ),
      },
      { key: 'phone', header: 'Contact No.' },
      { key: 'dept', header: 'Department' },
      { key: 'doctor', header: 'Consultant' },
      { key: 'registeredAt', header: 'Registration Date', width: '130px' },
      {
        key: 'status',
        header: 'Status',
        align: 'center',
        render: (item) => <StatusBadge status={item.status} size="sm" />,
      },
    ];

    return {
      data: defaultPatients,
      columns: defaultCols,
      title: `${moduleName} Master Records`,
      description: `Operational data views and transaction logs for ${moduleName}`,
      addNewLabel: `Register New ${moduleName}`,
    };
  }, [moduleId, moduleName]);

  return (
    <div className="space-y-6 animate-in fade-in duration-150">
      {/* Module Overview Banner */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-slate-900">{moduleName}</h2>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              {groupTitle}
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">{description}</p>
        </div>

        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-50 text-blue-900 border border-blue-200 text-xs font-semibold">
            <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            Active Subsystem
          </span>
        </div>
      </div>

      {/* Global Enterprise DataTable Component */}
      <DataTable
        title={title}
        description={description}
        data={data}
        columns={columns}
        keyExtractor={(item) => item.id || item.mrn || item.code}
        addNewLabel={addNewLabel}
        onAddNew={() => setIsAddModalOpen(true)}
        onView={(item) => {
          setSelectedRecord(item);
          setIsDetailsOpen(true);
        }}
        onEdit={(item) => {
          toast.info(`Editing record: ${item.id || item.mrn || item.name}`, 'Edit Record');
        }}
        onDelete={(item) => {
          setRecordToDelete(item);
          setIsDeleteOpen(true);
        }}
        onPrintRow={(item) => {
          toast.success(`Printing official voucher for ${item.id || item.mrn || item.name}`, 'Voucher Dispatched');
        }}
        onRefresh={() => {
          toast.success('Data synchronized with hospital subsystem.', 'Refreshed');
        }}
      />

      {/* Form Modal (Add New Placeholder) */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title={addNewLabel}
        subtitle="Complete the required fields to commit to hospital records"
        maxWidth="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => {
                setIsAddModalOpen(false);
                toast.success('New record successfully queued.', 'Record Saved');
              }}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-blue-900 hover:bg-blue-800 text-white shadow-xs"
            >
              Save Record
            </button>
          </>
        }
      >
        <div className="space-y-4 py-2">
          <TextInput label="Primary Title / Name" required placeholder="Enter name or description" />
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Reference Code / ID" placeholder="AUTO-GENERATED" disabled />
            <NumberInput label="Units / Quantity / Fee" placeholder="0" />
          </div>
          <DepartmentSelector value="" onChange={() => {}} />
          <p className="text-[11px] text-slate-400">
            * Backend APIs and schema models will connect to this form in subsequent implementation phases.
          </p>
        </div>
      </Modal>

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={isDeleteOpen}
        onClose={() => {
          setIsDeleteOpen(false);
          setRecordToDelete(null);
        }}
        onConfirm={() => {
          setIsDeleteOpen(false);
          setRecordToDelete(null);
          toast.error('Record removed from operational queue.', 'Record Deleted');
        }}
        title="Confirm Record Deletion"
        message={`Are you sure you want to remove ${
          recordToDelete?.name || recordToDelete?.id || recordToDelete?.mrn
        }? This action will generate a permanent log in the hospital audit trail.`}
        variant="danger"
        confirmLabel="Yes, Delete Record"
      />

      {/* Record Details Slide-over Drawer */}
      <Drawer
        isOpen={isDetailsOpen}
        onClose={() => {
          setIsDetailsOpen(false);
          setSelectedRecord(null);
        }}
        title={`Record Specification: ${selectedRecord?.name || selectedRecord?.id || selectedRecord?.mrn}`}
        subtitle="Hospital Enterprise Document Inspector"
        width="lg"
      >
        {selectedRecord && (
          <div className="space-y-4 text-xs">
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                Record Attributes
              </span>
              <div className="grid grid-cols-2 gap-3">
                {Object.entries(selectedRecord).map(([k, v]) => (
                  <div key={k} className="border-b border-slate-200/60 pb-1.5">
                    <span className="text-[10px] font-semibold text-slate-500 uppercase block">
                      {k}
                    </span>
                    <span className="font-semibold text-slate-800 text-xs">
                      {typeof v === 'number' && (k.toLowerCase().includes('amount') || k.toLowerCase().includes('fee') || k.toLowerCase().includes('price'))
                        ? formatPKR(v)
                        : String(v)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 text-xs flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-700 shrink-0" />
              <span>
                Verified in CH Sharif & Saeed Hospital core schema registry.
              </span>
            </div>
          </div>
        )}
      </Drawer>
    </div>
  );
};
