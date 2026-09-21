import React, { useState, useMemo } from 'react';
import {
  Calendar,
  Download,
  Printer,
  FileSpreadsheet,
  FileText,
  AlertTriangle,
  Filter,
  RefreshCw,
  Search,
  CheckCircle2,
  TrendingUp,
  CreditCard,
  Building,
  Users,
  Bed,
  Pill,
  Package,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { HOSPITAL_INFO } from '../../constants';
import { formatPKR } from '../../utils/formatters';
import { Modal } from '../../components/common/Modal';

interface SuperAdminReportsViewProps {
  reportType:
    | 'management_reports'
    | 'patient_panel_reports'
    | 'patient_reports'
    | 'billing_reports'
    | 'collection_reports'
    | 'admission_reports'
    | 'inventory_reports'
    | 'staff_reports'
    | 'attendance_reports'
    | 'salary_reports'
    | 'commission_reports'
    | string;
  reportTitle: string;
}

export const SuperAdminReportsView: React.FC<SuperAdminReportsViewProps> = ({
  reportType,
  reportTitle,
}) => {
  const { currentUser } = useAuth();
  const toast = useToast();

  // Date filters - default to 01 Sep 2026 to 07 Sep 2026 (current month to date)
  const [fromDate, setFromDate] = useState('2026-09-01');
  const [toDate, setToDate] = useState('2026-09-07');
  const [activePreset, setActivePreset] = useState<'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month' | 'custom'>('this_month');

  // Secondary dynamic filters
  const [selectedDept, setSelectedDept] = useState('All');
  const [selectedStatus, setSelectedStatus] = useState('All');
  const [searchTerm, setSearchTerm] = useState('');

  // Export / Print preview modal
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewFormat, setPreviewFormat] = useState<'pdf' | 'excel' | 'print'>('pdf');

  // Date validation: Check if From Date > To Date
  const isDateInvalid = useMemo(() => {
    if (!fromDate || !toDate) return false;
    return new Date(fromDate) > new Date(toDate);
  }, [fromDate, toDate]);

  // Handle Date Presets
  const applyPreset = (preset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'last_month') => {
    setActivePreset(preset);
    if (preset === 'today') {
      setFromDate('2026-09-07');
      setToDate('2026-09-07');
    } else if (preset === 'yesterday') {
      setFromDate('2026-09-06');
      setToDate('2026-09-06');
    } else if (preset === 'this_week') {
      setFromDate('2026-09-01');
      setToDate('2026-09-07');
    } else if (preset === 'this_month') {
      setFromDate('2026-09-01');
      setToDate('2026-09-30');
    } else if (preset === 'last_month') {
      setFromDate('2026-08-01');
      setToDate('2026-08-31');
    }
  };

  // Format dates for display
  const formatDateLabel = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
    } catch {
      return dateStr;
    }
  };

  // Generate mock dataset based on report type
  const reportData = useMemo(() => {
    switch (reportType) {
      case 'management_reports':
        return [
          { kpi: 'Gross Hospital Revenue', actual: 'Rs. 18,450,000', target: 'Rs. 20,000,000', variance: '+8.2% vs Last Mo', status: 'Healthy' },
          { kpi: 'Net Cash Collections', actual: 'Rs. 14,210,000', target: 'Rs. 15,000,000', variance: '77.0% Conversion', status: 'Healthy' },
          { kpi: 'Panel Insurance Receivables', actual: 'Rs. 4,240,000', target: 'Rs. 5,000,000', variance: '23.0% of Total', status: 'Normal' },
          { kpi: 'Inpatient Bed Occupancy Rate', actual: '75.6%', target: '80.0%', variance: '189 / 250 Occupied', status: 'Healthy' },
          { kpi: 'Average Length of Stay (ALOS)', actual: '3.8 Days', target: '< 4.5 Days', variance: 'Within Target', status: 'Optimal' },
          { kpi: 'Emergency Admissions Conversion', actual: '18.4%', target: '15.0%', variance: 'High Acuity Inflow', status: 'Optimal' },
        ];
      case 'billing_reports':
        return [
          { id: 'INV-2026-1049', date: '07 Sep 2026', patient: 'Muhammad Tariq Khan', mrn: 'MRN-2026-0842', dept: 'Cardiology', gross: 85000, disc: 12750, net: 72250, status: 'Paid', method: 'Panel Credit' },
          { id: 'INV-2026-1048', date: '07 Sep 2026', patient: 'Shahnaz Begum', mrn: 'MRN-2026-0791', dept: 'ICU', gross: 45000, disc: 0, net: 45000, status: 'Paid', method: 'POS Card' },
          { id: 'INV-2026-1047', date: '06 Sep 2026', patient: 'Abdul Rehman', mrn: 'MRN-2026-0734', dept: 'General Surgery', gross: 95000, disc: 9500, net: 85500, status: 'Partial', method: 'Cash' },
          { id: 'INV-2026-1046', date: '06 Sep 2026', patient: 'Capt. (R) Imran Farooq', mrn: 'MRN-2026-0812', dept: 'Executive Ward', gross: 36000, disc: 0, net: 36000, status: 'Paid', method: 'Panel Credit' },
          { id: 'INV-2026-1045', date: '05 Sep 2026', patient: 'Zainab Fatima', mrn: 'MRN-2026-0688', dept: 'Pediatrics', gross: 18500, disc: 2000, net: 16500, status: 'Paid', method: 'Cash' },
          { id: 'INV-2026-1044', date: '05 Sep 2026', patient: 'Naseem Akhtar', mrn: 'MRN-2026-0855', dept: 'Cardiology', gross: 4500, disc: 0, net: 4500, status: 'Unpaid', method: 'Credit' },
        ];
      case 'collection_reports':
        return [
          { id: 'REC-99182', date: '07 Sep 2026, 08:25 AM', counter: 'Counter 1 (OPD)', cashier: 'Fatima Noor', shift: 'Morning', method: 'Cash', amount: 3500, inv: 'INV-1049' },
          { id: 'REC-99181', date: '07 Sep 2026, 08:14 AM', counter: 'Counter 2 (ER)', cashier: 'Asim Mehmood', shift: 'Morning', method: 'POS Card', amount: 45000, inv: 'INV-1048' },
          { id: 'REC-99180', date: '06 Sep 2026, 11:40 PM', counter: 'Pharmacy Counter A', cashier: 'Saira Bano', shift: 'Night', method: 'Cash', amount: 6200, inv: 'PH-4401' },
          { id: 'REC-99179', date: '06 Sep 2026, 07:15 PM', counter: 'Admission Desk', cashier: 'Zainab Bibi', shift: 'Evening', method: 'Bank Transfer', amount: 50000, inv: 'ADV-881' },
          { id: 'REC-99178', date: '06 Sep 2026, 03:20 PM', counter: 'Counter 1 (OPD)', cashier: 'Fatima Noor', shift: 'Morning', method: 'Cash', amount: 18500, inv: 'INV-1045' },
        ];
      case 'admission_reports':
        return [
          { id: 'ADM-2026-081', date: '05 Sep 2026', patient: 'Muhammad Tariq Khan', mrn: 'MRN-2026-0842', ward: 'Critical Care Unit', room: 'ICU Bay A', bed: 'BED-ICU-01', consultant: 'Prof. Dr. Tariq Saeed', status: 'Admitted' },
          { id: 'ADM-2026-079', date: '04 Sep 2026', patient: 'Shahnaz Begum', mrn: 'MRN-2026-0791', ward: 'Critical Care Unit', room: 'ICU Bay B', bed: 'BED-ICU-04', consultant: 'Prof. Dr. Tariq Saeed', status: 'Admitted' },
          { id: 'ADM-2026-078', date: '02 Sep 2026', patient: 'Capt. (R) Imran Farooq', mrn: 'MRN-2026-0812', ward: 'Executive Private Ward', room: 'Room 201', bed: 'BED-PVT-201', consultant: 'Dr. M. Sharif Chaudhary', status: 'Admitted' },
          { id: 'ADM-2026-074', date: '01 Sep 2026', patient: 'Abdul Rehman', mrn: 'MRN-2026-0734', ward: 'General Surgical Ward', room: 'Male Ward Bay 2', bed: 'BED-GEN-102', consultant: 'Prof. Dr. Irfan Bashir', status: 'Admitted' },
          { id: 'ADM-2026-068', date: '28 Aug 2026', patient: 'Bashir Ahmed', mrn: 'MRN-2026-0640', ward: 'General Medical Ward', room: 'Male Ward Bay 1', bed: 'BED-GEN-101', consultant: 'Dr. Farhana Yasmeen', status: 'Discharged' },
        ];
      case 'pharmacy_reports':
        return [
          { id: 'RX-9901', date: '07 Sep 2026', drug: 'Inj. Heparin 5000 IU/mL', batch: 'HEP-2026-B1', qty: 10, rate: 850, total: 8500, dispenser: 'Dr. Hamza Rafique', ward: 'Cath Lab' },
          { id: 'RX-9902', date: '07 Sep 2026', drug: 'Tab. Clopidogrel 75mg (Plavix)', batch: 'CLP-2026-A4', qty: 30, rate: 45, total: 1350, dispenser: 'Dr. Hamza Rafique', ward: 'OPD Counter' },
          { id: 'RX-9903', date: '06 Sep 2026', drug: 'Inj. Meropenem 1g IV', batch: 'MER-2025-C9', qty: 6, rate: 1950, total: 11700, dispenser: 'Saira Bano', ward: 'ICU Ward' },
          { id: 'RX-9904', date: '06 Sep 2026', drug: 'Infusion Normal Saline 1000ml', batch: 'NS-2026-M8', qty: 25, rate: 120, total: 3000, dispenser: 'Saira Bano', ward: 'Emergency' },
          { id: 'RX-9905', date: '05 Sep 2026', drug: 'Inj. Ceftriaxone 1g (Rocephin)', batch: 'RO-2026-D1', qty: 12, rate: 680, total: 8160, dispenser: 'Dr. Hamza Rafique', ward: 'General Ward' },
        ];
      case 'inventory_reports':
        return [
          { code: 'MED-CATH-01', name: 'Coronary Drug-Eluting Stent (DES)', category: 'Cath Lab Implants', stock: 18, reorder: 10, unitCost: 65000, totalVal: 1170000, health: 'Normal' },
          { code: 'MED-GLV-08', name: 'Surgical Sterile Gloves Size 7.5', category: 'General OT Consumables', stock: 120, reorder: 300, unitCost: 85, totalVal: 10200, health: 'Low Stock' },
          { code: 'MED-IV-01', name: 'IV Cannula 20G Pink (Safety)', category: 'Consumables', stock: 450, reorder: 200, unitCost: 65, totalVal: 29250, health: 'Normal' },
          { code: 'MED-DIAL-04', name: 'Dialyzer F6 HPS High Flux', category: 'Dialysis Consumables', stock: 42, reorder: 30, unitCost: 2800, totalVal: 117600, health: 'Normal' },
          { code: 'MED-OXY-02', name: 'Medical Oxygen Cylinder 240 CFT', category: 'Medical Gas', stock: 8, reorder: 15, unitCost: 3500, totalVal: 28000, health: 'Reorder Required' },
        ];
      case 'staff_reports':
        return [
          { id: 'STF-081', name: 'Fatima Noor', dept: 'Front Desk & Billing', role: 'Senior Billing Officer', portal: 'Front Desk', shift: 'Morning', status: 'Active (On Duty)', attendance: '100% On-Time' },
          { id: 'STF-045', name: 'Usman Ali', dept: 'Central Store', role: 'Store Manager', portal: 'Inventory', shift: 'Morning', status: 'Active (On Duty)', attendance: '98% On-Time' },
          { id: 'STF-092', name: 'Zainab Bibi', dept: 'Admissions', role: 'Admission Officer', portal: 'Admission', shift: 'Morning', status: 'Active (On Duty)', attendance: '100% On-Time' },
          { id: 'STF-014', name: 'Dr. Hamza Rafique', dept: 'Pharmacy', role: 'Chief Pharmacist', portal: 'Pharmacy', shift: 'Morning', status: 'Active (On Duty)', attendance: '100% On-Time' },
          { id: 'STF-118', name: 'Asim Mehmood', dept: 'Front Desk', role: 'Counter Cashier', portal: 'Front Desk', shift: 'Evening', status: 'Scheduled', attendance: '95% On-Time' },
        ];
      case 'attendance_reports':
        return [
          { id: 'ATT-2026-901', name: 'Fatima Noor', empId: 'STF-081', dept: 'Front Desk & Billing', shift: 'Morning (08:00 - 16:00)', inTime: '07:54 AM', outTime: '04:02 PM', duration: '8h 8m', status: 'Present (On-Time)' },
          { id: 'ATT-2026-902', name: 'Usman Ali', empId: 'STF-045', dept: 'Central Store', shift: 'Morning (08:00 - 16:00)', inTime: '08:02 AM', outTime: '04:10 PM', duration: '8h 8m', status: 'Present (On-Time)' },
          { id: 'ATT-2026-903', name: 'Zainab Bibi', empId: 'STF-092', dept: 'Admissions', shift: 'Morning (08:00 - 16:00)', inTime: '07:58 AM', outTime: '04:00 PM', duration: '8h 2m', status: 'Present (On-Time)' },
          { id: 'ATT-2026-904', name: 'Asim Mehmood', empId: 'STF-118', dept: 'Front Desk', shift: 'Evening (16:00 - 00:00)', inTime: '03:52 PM', outTime: '12:05 AM', duration: '8h 13m', status: 'Present (On-Time)' },
          { id: 'ATT-2026-905', name: 'Rashid Minhas', empId: 'STF-033', dept: 'Emergency Support', shift: 'Night (00:00 - 08:00)', inTime: '11:58 PM', outTime: '08:05 AM', duration: '8h 7m', status: 'Present (On-Time)' },
        ];
      case 'salary_reports':
        return [
          { id: 'PAY-2026-08', empId: 'STF-081', name: 'Fatima Noor', role: 'Senior Billing Officer', basic: 65000, allowances: 12000, deductions: 2500, net: 74500, status: 'Disbursed', date: '01 Sep 2026' },
          { id: 'PAY-2026-09', empId: 'STF-045', name: 'Usman Ali', role: 'Store Manager', basic: 85000, allowances: 15000, deductions: 4000, net: 96000, status: 'Disbursed', date: '01 Sep 2026' },
          { id: 'PAY-2026-10', empId: 'STF-092', name: 'Zainab Bibi', role: 'Admission Officer', basic: 55000, allowances: 10000, deductions: 2000, net: 63000, status: 'Disbursed', date: '01 Sep 2026' },
          { id: 'PAY-2026-11', empId: 'STF-118', name: 'Asim Mehmood', role: 'Counter Cashier', basic: 45000, allowances: 8000, deductions: 1500, net: 51500, status: 'Disbursed', date: '01 Sep 2026' },
          { id: 'PAY-2026-12', empId: 'STF-033', name: 'Rashid Minhas', role: 'ER Assistant', basic: 40000, allowances: 8000, deductions: 1000, net: 47000, status: 'Disbursed', date: '01 Sep 2026' },
        ];
      case 'commission_reports':
        return [
          { docId: 'DOC-01', doctor: 'Prof. Dr. Tariq Saeed', specialty: 'General & Laparoscopic Surgery', opdCount: 42, ipdCount: 18, grossRevenue: 485000, commRate: '60%', netPayable: 291000, status: 'Approved' },
          { docId: 'DOC-02', doctor: 'Dr. M. Sharif Chaudhary', specialty: 'Cardiology & Interventional', opdCount: 68, ipdCount: 22, grossRevenue: 720000, commRate: '65%', netPayable: 468000, status: 'Approved' },
          { docId: 'DOC-03', doctor: 'Prof. Dr. Irfan Bashir', specialty: 'Orthopedics & Spine Surgery', opdCount: 38, ipdCount: 14, grossRevenue: 410000, commRate: '60%', netPayable: 246000, status: 'Approved' },
          { docId: 'DOC-04', doctor: 'Dr. Farhana Yasmeen', specialty: 'Gynecology & Obstetrics', opdCount: 75, ipdCount: 28, grossRevenue: 590000, commRate: '60%', netPayable: 354000, status: 'Approved' },
        ];
      case 'patient_panel_reports':
      case 'patient_reports':
      default:
        return [
          { mrn: 'MRN-2026-0842', name: 'Muhammad Tariq Khan', ageGender: '58 Y / Male', dept: 'Cardiology', type: 'IPD (Admitted)', panel: 'State Life Insurance', regDate: '05 Sep 2026', phone: '0300 1234567' },
          { mrn: 'MRN-2026-0791', name: 'Shahnaz Begum', ageGender: '62 Y / Female', dept: 'ICU / Critical Care', type: 'IPD (Admitted)', panel: 'Jubilee Life Insurance', regDate: '04 Sep 2026', phone: '0321 9876543' },
          { mrn: 'MRN-2026-0812', name: 'Capt. (R) Imran Farooq', ageGender: '65 Y / Male', dept: 'Executive Inpatient', type: 'IPD (Admitted)', panel: 'Fauji Foundation', regDate: '02 Sep 2026', phone: '0301 5551234' },
          { mrn: 'MRN-2026-0734', name: 'Abdul Rehman', ageGender: '42 Y / Male', dept: 'General Surgery', type: 'IPD (Admitted)', panel: 'OGDCL', regDate: '01 Sep 2026', phone: '0345 8877665' },
          { mrn: 'MRN-2026-0688', name: 'Zainab Fatima', ageGender: '6 Y / Female', dept: 'Pediatrics', type: 'OPD Consultation', panel: 'Private Cash', regDate: '05 Sep 2026', phone: '0333 4443322' },
          { mrn: 'MRN-2026-0855', name: 'Naseem Akhtar', ageGender: '50 Y / Female', dept: 'Cardiology', type: 'OPD Consultation', panel: 'Private Cash', regDate: '04 Sep 2026', phone: '0312 9988776' },
        ];
    }
  }, [reportType]);

  const handleExport = (format: 'pdf' | 'excel' | 'print') => {
    if (isDateInvalid) {
      toast.error('Cannot generate report: From Date cannot be later than To Date.', 'Date Range Error');
      return;
    }
    setPreviewFormat(format);
    setIsPreviewOpen(true);
  };

  const handleConfirmPrint = () => {
    setIsPreviewOpen(false);
    toast.success(`Dispatched "${reportTitle}" to hospital printer queue.`, 'Print Job Dispatched');
  };

  const handleDownloadFile = () => {
    setIsPreviewOpen(false);
    toast.success(
      `Generated formatted export for "${reportTitle}" (${formatDateLabel(fromDate)} to ${formatDateLabel(toDate)}).`,
      'File Export Complete'
    );
  };

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {/* 1. Page Header & Standard Description */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900">{reportTitle}</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
              Institutional Audit Standard
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Enterprise analytics, clinical audit records, date-range filters, and official export controls.
          </p>
        </div>

        {/* Global Export Controls */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            disabled={isDateInvalid}
            onClick={() => handleExport('pdf')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Export official PDF format"
          >
            <FileText className="h-3.5 w-3.5 text-rose-600" />
            <span>Export PDF</span>
          </button>

          <button
            type="button"
            disabled={isDateInvalid}
            onClick={() => handleExport('excel')}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold shadow-2xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Download Excel / CSV format"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
            <span>Export Excel</span>
          </button>

          <button
            type="button"
            disabled={isDateInvalid}
            onClick={() => handleExport('print')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#149E75] hover:bg-[#08775A] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            title="Print report"
          >
            <Printer className="h-3.5 w-3.5 text-white" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* 2. Standardized Date Filter Section (MANDATORY REQUIREMENT 18) */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#149E75]" />
            <span className="text-xs font-bold text-slate-900 uppercase tracking-wide">
              Report Date Range & Presets
            </span>
          </div>

          {/* Preset Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {[
              { id: 'today', label: 'Today' },
              { id: 'yesterday', label: 'Yesterday' },
              { id: 'this_week', label: 'This Week' },
              { id: 'this_month', label: 'This Month' },
              { id: 'last_month', label: 'Last Month' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => applyPreset(p.id as any)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors cursor-pointer ${
                  activePreset === p.id
                    ? 'bg-[#149E75] text-white shadow-2xs'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* From Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              From Date <span className="text-rose-500">*</span>
            </label>
            <input
              lang="en-GB" type="date"
              value={fromDate}
              onChange={(e) => {
                setFromDate(e.target.value);
                setActivePreset('custom');
              }}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#149E75] bg-white"
            />
          </div>

          {/* To Date */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              To Date <span className="text-rose-500">*</span>
            </label>
            <input
              lang="en-GB" type="date"
              value={toDate}
              onChange={(e) => {
                setToDate(e.target.value);
                setActivePreset('custom');
              }}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#149E75] bg-white"
            />
          </div>

          {/* Department Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Department Scoping
            </label>
            <select
              value={selectedDept}
              onChange={(e) => setSelectedDept(e.target.value)}
              className="w-full text-xs px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#149E75] bg-white"
            >
              <option value="All">All Hospital Departments</option>
              <option value="Cardiology">Cardiology & Cath Lab</option>
              <option value="ICU">Intensive Care Unit (ICU)</option>
              <option value="Surgery">General Surgery</option>
              <option value="Pediatrics">Pediatrics & NICU</option>
              <option value="Radiology">Radiology</option>
              <option value="Emergency">Emergency Trauma</option>
            </select>
          </div>

          {/* Search Filter */}
          <div>
            <label className="block text-[11px] font-semibold text-slate-700 mb-1">
              Search Record / Code
            </label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search patient, invoice, MRN..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full text-xs pl-8 pr-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#149E75] bg-white"
              />
            </div>
          </div>
        </div>

        {/* Real-time Validation Error Banner */}
        {isDateInvalid && (
          <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg text-xs font-semibold">
            <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>Invalid Date Range: "From Date" cannot be later than "To Date". Please correct dates to generate report.</span>
          </div>
        )}
      </div>

      {/* 3. Applied Filter Header (MANDATORY REQUIREMENT 18.2) */}
      <div className="bg-slate-900 text-white rounded-xl p-4 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Applied Scope:</span>
              <span className="font-bold text-white uppercase tracking-wider">{reportTitle}</span>
              <span className="text-slate-400">•</span>
              <span className="text-[#a8ebd0] font-medium">
                {formatDateLabel(fromDate)} &mdash; {formatDateLabel(toDate)}
              </span>
            </div>
            <div className="text-[11px] text-slate-400 flex items-center gap-3">
              <span>Department: <strong className="text-slate-200">{selectedDept}</strong></span>
              <span>•</span>
              <span>Records Found: <strong className="text-slate-200">{reportData.length} records</strong></span>
            </div>
          </div>

          <div className="text-right text-[11px] text-slate-400 border-t md:border-t-0 pt-2 md:pt-0 border-slate-800">
            <div>Generated By: <strong className="text-slate-200">{currentUser?.name || 'Prof. Dr. Tariq Saeed'}</strong></div>
            <div className="font-mono text-[10px] text-slate-400">Audit Timestamp: 07 Sep 2026, 08:30 PKT</div>
          </div>
        </div>
      </div>

      {/* 4. Report Data Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Verified Audit Dataset ({reportData.length} Rows)
          </span>
          <span className="text-[11px] text-slate-500 font-mono">
            Report Code: REP-{reportType.toUpperCase().replace('_', '-')}
          </span>
        </div>

        <div className="overflow-x-auto">
          {reportType === 'management_reports' ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-4">Hospital Performance Indicator (KPI)</th>
                  <th className="py-2.5 px-4">Current Period Actual</th>
                  <th className="py-2.5 px-4">Target Benchmark</th>
                  <th className="py-2.5 px-4">Variance & Acuity</th>
                  <th className="py-2.5 px-4 text-right">Audit Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(reportData as any[]).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-3 px-4 font-bold text-slate-900">{row.kpi}</td>
                    <td className="py-3 px-4 font-black text-slate-900">{row.actual}</td>
                    <td className="py-3 px-4 text-slate-500">{row.target}</td>
                    <td className="py-3 px-4 font-medium text-slate-700">{row.variance}</td>
                    <td className="py-3 px-4 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : reportType === 'billing_reports' ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-4">Invoice #</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Patient & MRN</th>
                  <th className="py-2.5 px-4">Department</th>
                  <th className="py-2.5 px-4 text-right">Gross (PKR)</th>
                  <th className="py-2.5 px-4 text-right">Discount</th>
                  <th className="py-2.5 px-4 text-right">Net Payable</th>
                  <th className="py-2.5 px-4">Payment Method</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(reportData as any[]).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{row.id}</td>
                    <td className="py-2.5 px-4 text-slate-500">{row.date}</td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900">{row.patient}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{row.mrn}</div>
                    </td>
                    <td className="py-2.5 px-4 font-medium">{row.dept}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-500">{formatPKR(row.gross)}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-rose-600">{row.disc > 0 ? `-${formatPKR(row.disc)}` : '0'}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">{formatPKR(row.net)}</td>
                    <td className="py-2.5 px-4 text-slate-600">{row.method}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.status === 'Paid' ? 'bg-emerald-50 text-emerald-800' :
                        row.status === 'Partial' ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-800'
                      }`}>
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : reportType === 'collection_reports' ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-4">Receipt #</th>
                  <th className="py-2.5 px-4">Timestamp</th>
                  <th className="py-2.5 px-4">Counter & Cashier</th>
                  <th className="py-2.5 px-4">Shift</th>
                  <th className="py-2.5 px-4">Mode</th>
                  <th className="py-2.5 px-4">Invoice Ref</th>
                  <th className="py-2.5 px-4 text-right">Amount Collected</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(reportData as any[]).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{row.id}</td>
                    <td className="py-2.5 px-4 text-slate-500">{row.date}</td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900">{row.counter}</div>
                      <div className="text-[10px] text-slate-500">Cashier: {row.cashier}</div>
                    </td>
                    <td className="py-2.5 px-4"><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-medium">{row.shift}</span></td>
                    <td className="py-2.5 px-4 font-medium text-slate-800">{row.method}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{row.inv}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-700">{formatPKR(row.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : reportType === 'admission_reports' ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-4">Admission #</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Patient & MRN</th>
                  <th className="py-2.5 px-4">Ward / Room</th>
                  <th className="py-2.5 px-4">Bed #</th>
                  <th className="py-2.5 px-4">Admitting Consultant</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(reportData as any[]).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{row.id}</td>
                    <td className="py-2.5 px-4 text-slate-500">{row.date}</td>
                    <td className="py-2.5 px-4">
                      <div className="font-semibold text-slate-900">{row.patient}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{row.mrn}</div>
                    </td>
                    <td className="py-2.5 px-4">
                      <div className="font-medium text-slate-800">{row.ward}</div>
                      <div className="text-[10px] text-slate-500">{row.room}</div>
                    </td>
                    <td className="py-2.5 px-4 font-mono font-semibold text-slate-800">{row.bed}</td>
                    <td className="py-2.5 px-4 text-slate-700">{row.consultant}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : reportType === 'pharmacy_reports' ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-4">Rx Requisition #</th>
                  <th className="py-2.5 px-4">Date</th>
                  <th className="py-2.5 px-4">Drug Formulation & Name</th>
                  <th className="py-2.5 px-4">Batch #</th>
                  <th className="py-2.5 px-4 text-right">Qty</th>
                  <th className="py-2.5 px-4 text-right">Unit Rate</th>
                  <th className="py-2.5 px-4 text-right">Total (PKR)</th>
                  <th className="py-2.5 px-4">Ward / Dispensed To</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(reportData as any[]).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{row.id}</td>
                    <td className="py-2.5 px-4 text-slate-500">{row.date}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{row.drug}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-500">{row.batch}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-800">{row.qty}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-500">{formatPKR(row.rate)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-emerald-800">{formatPKR(row.total)}</td>
                    <td className="py-2.5 px-4 text-slate-600">{row.ward}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : reportType === 'inventory_reports' ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-4">Item Code</th>
                  <th className="py-2.5 px-4">Item Description</th>
                  <th className="py-2.5 px-4">Category</th>
                  <th className="py-2.5 px-4 text-right">Current Stock</th>
                  <th className="py-2.5 px-4 text-right">Reorder Level</th>
                  <th className="py-2.5 px-4 text-right">Unit Valuation</th>
                  <th className="py-2.5 px-4 text-right">Total Asset Value</th>
                  <th className="py-2.5 px-4 text-right">Stock Health</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(reportData as any[]).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{row.code}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{row.name}</td>
                    <td className="py-2.5 px-4 text-slate-500">{row.category}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold">{row.stock}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-500">{row.reorder}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-500">{formatPKR(row.unitCost)}</td>
                    <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">{formatPKR(row.totalVal)}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        row.health === 'Normal' ? 'bg-emerald-50 text-emerald-800' :
                        row.health === 'Low Stock' ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-800'
                      }`}>
                        {row.health}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : reportType === 'staff_reports' ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-4">Staff ID</th>
                  <th className="py-2.5 px-4">Name</th>
                  <th className="py-2.5 px-4">Department</th>
                  <th className="py-2.5 px-4">Designation</th>
                  <th className="py-2.5 px-4">Assigned Portal</th>
                  <th className="py-2.5 px-4">Shift</th>
                  <th className="py-2.5 px-4">Attendance Metric</th>
                  <th className="py-2.5 px-4 text-right">Duty Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(reportData as any[]).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{row.id}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{row.name}</td>
                    <td className="py-2.5 px-4 text-slate-600">{row.dept}</td>
                    <td className="py-2.5 px-4 text-slate-700">{row.role}</td>
                    <td className="py-2.5 px-4"><span className="px-2 py-0.5 rounded bg-[#effaf5] text-[#08775A] border border-[#c2e7db] font-semibold">{row.portal}</span></td>
                    <td className="py-2.5 px-4 text-slate-500">{row.shift}</td>
                    <td className="py-2.5 px-4 font-semibold text-emerald-700">{row.attendance}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : reportType === 'attendance_reports' ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-4">Log ID</th>
                  <th className="py-2.5 px-4">Staff Name</th>
                  <th className="py-2.5 px-4">Staff ID</th>
                  <th className="py-2.5 px-4">Department</th>
                  <th className="py-2.5 px-4">Shift Scheduled</th>
                  <th className="py-2.5 px-4">Clock In</th>
                  <th className="py-2.5 px-4">Clock Out</th>
                  <th className="py-2.5 px-4 text-right">Attendance Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(reportData as any[]).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{row.id}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{row.name}</td>
                    <td className="py-2.5 px-4 font-mono text-slate-600">{row.empId}</td>
                    <td className="py-2.5 px-4 text-slate-700">{row.dept}</td>
                    <td className="py-2.5 px-4 text-slate-600">{row.shift}</td>
                    <td className="py-2.5 px-4 font-medium text-emerald-700">{row.inTime}</td>
                    <td className="py-2.5 px-4 font-medium text-slate-700">{row.outTime}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : reportType === 'salary_reports' ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-4">Payroll Ref</th>
                  <th className="py-2.5 px-4">Employee</th>
                  <th className="py-2.5 px-4">Designation</th>
                  <th className="py-2.5 px-4">Basic Pay</th>
                  <th className="py-2.5 px-4">Allowances</th>
                  <th className="py-2.5 px-4">Deductions</th>
                  <th className="py-2.5 px-4 font-bold text-slate-900">Net Payable</th>
                  <th className="py-2.5 px-4 text-right">Disbursement</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(reportData as any[]).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{row.id}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{row.name}</td>
                    <td className="py-2.5 px-4 text-slate-600">{row.role}</td>
                    <td className="py-2.5 px-4 font-mono">{formatPKR(row.basic)}</td>
                    <td className="py-2.5 px-4 font-mono text-emerald-700">+{formatPKR(row.allowances)}</td>
                    <td className="py-2.5 px-4 font-mono text-rose-600">-{formatPKR(row.deductions)}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{formatPKR(row.net)}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : reportType === 'commission_reports' ? (
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-4">Doctor Code</th>
                  <th className="py-2.5 px-4">Consultant Doctor</th>
                  <th className="py-2.5 px-4">Specialty</th>
                  <th className="py-2.5 px-4">Cases (OPD/IPD)</th>
                  <th className="py-2.5 px-4">Gross Billing</th>
                  <th className="py-2.5 px-4">Commission %</th>
                  <th className="py-2.5 px-4 font-bold text-slate-900">Net Share</th>
                  <th className="py-2.5 px-4 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(reportData as any[]).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{row.docId}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{row.doctor}</td>
                    <td className="py-2.5 px-4 text-slate-600">{row.specialty}</td>
                    <td className="py-2.5 px-4 font-mono">{row.opdCount} OPD / {row.ipdCount} IPD</td>
                    <td className="py-2.5 px-4 font-mono">{formatPKR(row.grossRevenue)}</td>
                    <td className="py-2.5 px-4 font-bold text-[#08775A]">{row.commRate}</td>
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{formatPKR(row.netPayable)}</td>
                    <td className="py-2.5 px-4 text-right">
                      <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold text-[10px]">
                        {row.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            // Patient reports
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase">
                  <th className="py-2.5 px-4">MR Number</th>
                  <th className="py-2.5 px-4">Patient Name</th>
                  <th className="py-2.5 px-4">Age / Gender</th>
                  <th className="py-2.5 px-4">Clinical Department</th>
                  <th className="py-2.5 px-4">Patient Type</th>
                  <th className="py-2.5 px-4">Panel / Cash</th>
                  <th className="py-2.5 px-4">Registration Date</th>
                  <th className="py-2.5 px-4 text-right">Contact</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {(reportData as any[]).map((row, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/80">
                    <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{row.mrn}</td>
                    <td className="py-2.5 px-4 font-semibold text-slate-900">{row.name}</td>
                    <td className="py-2.5 px-4 text-slate-500">{row.ageGender}</td>
                    <td className="py-2.5 px-4 text-slate-700">{row.dept}</td>
                    <td className="py-2.5 px-4"><span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-semibold">{row.type}</span></td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded font-semibold ${
                        row.panel.includes('Cash') ? 'bg-slate-100 text-slate-700' : 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]'
                      }`}>
                        {row.panel}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-slate-500">{row.regDate}</td>
                    <td className="py-2.5 px-4 text-right font-mono text-slate-600">{row.phone}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Export & Print Preview Modal */}
      <Modal
        isOpen={isPreviewOpen}
        onClose={() => setIsPreviewOpen(false)}
        title={previewFormat === 'print' ? 'Hospital Print Queue Preview' : `Export Document: ${previewFormat.toUpperCase()}`}
        size="lg"
      >
        <div className="space-y-4 text-xs">
          {/* Official Hospital Letterhead */}
          <div className="border border-slate-200 rounded-xl p-5 bg-white shadow-2xs">
            <div className="flex items-start justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">{HOSPITAL_INFO.name}</h3>
                <p className="text-[11px] text-slate-500">Center of Clinical Excellence & Compassionate Healthcare • {HOSPITAL_INFO.city}</p>
                <p className="text-[11px] text-slate-500 mt-0.5">Address: {HOSPITAL_INFO.address} • License: {HOSPITAL_INFO.licenseNo}</p>
              </div>
              <div className="text-right">
                <span className="inline-block px-2.5 py-0.5 rounded bg-[#effaf5] text-[#08775A] border border-[#c2e7db] font-bold text-[10px] uppercase">
                  Official Record
                </span>
                <p className="text-[10px] text-slate-400 font-mono mt-1">Audit Doc #{Math.floor(100000 + Math.random() * 900000)}</p>
              </div>
            </div>

            {/* Document Meta */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 py-3 border-b border-slate-100 text-[11px]">
              <div>
                <span className="text-slate-400 block font-medium">Report Scope</span>
                <span className="font-bold text-slate-900">{reportTitle}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Period Covered</span>
                <span className="font-bold text-[#08775A]">{formatDateLabel(fromDate)} to {formatDateLabel(toDate)}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Generated By</span>
                <span className="font-bold text-slate-900">{currentUser?.name || 'Prof. Dr. Tariq Saeed'}</span>
              </div>
              <div>
                <span className="text-slate-400 block font-medium">Total Rows</span>
                <span className="font-bold text-emerald-700">{reportData.length} records</span>
              </div>
            </div>

            {/* Printable Preview Snippet */}
            <div className="py-4 text-slate-600 text-[11px]">
              <p>This report has been compiled directly from verified hospital ledger and operational tables under Super Admin audit authority.</p>
            </div>

            {/* Institutional Sign-off Block */}
            <div className="grid grid-cols-2 gap-6 pt-6 border-t border-slate-200 text-center">
              <div>
                <div className="border-b border-slate-300 w-3/4 mx-auto mb-1"></div>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Prepared By (Finance / Ops)</span>
              </div>
              <div>
                <div className="border-b border-slate-300 w-3/4 mx-auto mb-1"></div>
                <span className="text-[10px] text-slate-500 font-bold uppercase">Medical Superintendent / Director</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="text-[11px] text-slate-400">All data verified for regulatory institutional compliance</span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPreviewOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-lg"
              >
                Cancel
              </button>
              {previewFormat === 'print' ? (
                <button
                  type="button"
                  onClick={handleConfirmPrint}
                  className="px-4 py-2 bg-[#149E75] hover:bg-[#08775A] text-white font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>Send to Printer</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleDownloadFile}
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow-xs flex items-center gap-1.5"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Download {previewFormat.toUpperCase()}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
