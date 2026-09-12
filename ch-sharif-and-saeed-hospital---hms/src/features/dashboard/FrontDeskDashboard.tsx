import React, { useState } from 'react';
import {
  Users,
  Stethoscope,
  Eye,
  AlertTriangle,
  Receipt,
  CreditCard,
  Clock,
  Plus,
  Search,
  CheckCircle2,
  FileSpreadsheet,
  Building2,
  ShieldCheck,
  RotateCcw,
  AlertCircle,
  Coins,
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatPKR } from '../../utils/formatters';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';

export const FrontDeskDashboard: React.FC = () => {
  const { navigate } = useRouter();
  const { currentUser } = useAuth();

  const [filterQuery, setFilterQuery] = useState('');

  // 8 Specified Top KPI Metrics for Front Desk & Billing
  const kpis = [
    { title: "Today's Patients", value: '284', sub: '+14% vs yesterday', icon: Users, color: 'text-[#0e7d5a] bg-[#effaf5]' },
    { title: 'OPD Patients', value: '192', sub: '14 Clinics running', icon: Stethoscope, color: 'text-[#129b70] bg-[#effaf5]' },
    { title: 'Observation Cases', value: '38', sub: 'Day-care monitoring', icon: Eye, color: 'text-[#0e7d5a] bg-[#effaf5]' },
    { title: 'Emergency Patients', value: '14', sub: 'Triage red/yellow', icon: AlertTriangle, color: 'text-rose-700 bg-rose-50' },
    { title: "Today's Invoices", value: '342 Slips', sub: 'Avg PKR 4,153 / invoice', icon: Receipt, color: 'text-[#0e7d5a] bg-[#effaf5]' },
    { title: 'Cash Collected', value: 'PKR 640,000', sub: 'Counter cash drawer', icon: Coins, color: 'text-[#129b70] bg-[#effaf5]' },
    { title: 'Online / POS', value: 'PKR 537,600', sub: 'Card & JazzCash/EasyPaisa', icon: CreditCard, color: 'text-[#0e7d5a] bg-[#effaf5]' },
    { title: 'Outstanding Balance', value: 'PKR 140,500', sub: 'Pending corporate claims', icon: AlertCircle, color: 'text-amber-700 bg-amber-50' },
  ];

  // Recent Patients
  const recentPatients = [
    { mrn: 'MRN-2026-0914', name: 'Zainab Bibi', ageGender: '31 / F', type: 'OPD', doctor: 'Dr. Farhana Yasmeen', phone: '0301-4491204', status: 'In Consultation', time: '11:15 AM' },
    { mrn: 'MRN-2026-0913', name: 'Muhammad Bilal', ageGender: '42 / M', type: 'Emergency', doctor: 'Dr. Salman Haider', phone: '0322-8119022', status: 'Triage Red', time: '11:05 AM' },
    { mrn: 'MRN-2026-0912', name: 'Rashida Perveen', ageGender: '58 / F', type: 'Observation', doctor: 'Dr. M. Sharif Chaudhary', phone: '0345-9921443', status: 'Under Observation', time: '10:50 AM' },
    { mrn: 'MRN-2026-0911', name: 'Hamza Farooq', ageGender: '25 / M', type: 'OPD', doctor: 'Prof. Dr. Tariq Saeed', phone: '0300-1284755', status: 'Token Issued', time: '10:45 AM' },
    { mrn: 'MRN-2026-0910', name: 'Khadija Begum', ageGender: '64 / F', type: 'OPD', doctor: 'Dr. Kamran Akram', phone: '0313-5592811', status: 'Completed', time: '10:30 AM' },
  ];

  // Recent Invoices
  const recentInvoices = [
    { invoiceNo: 'INV-2026-342', mrn: 'MRN-2026-0914', patient: 'Zainab Bibi', gross: 3500, discount: 0, net: 3500, paid: 3500, due: 0, mode: 'Cash', status: 'Paid' as const, time: '11:18 AM' },
    { invoiceNo: 'INV-2026-341', mrn: 'MRN-2026-0913', patient: 'Muhammad Bilal', gross: 12500, discount: 500, net: 12000, paid: 12000, due: 0, mode: 'POS Card', status: 'Paid' as const, time: '11:08 AM' },
    { invoiceNo: 'INV-2026-340', mrn: 'MRN-2026-0912', patient: 'Rashida Perveen', gross: 8500, discount: 0, net: 8500, paid: 4000, due: 4500, mode: 'Cash', status: 'Partially Paid' as const, time: '10:52 AM' },
    { invoiceNo: 'INV-2026-339', mrn: 'MRN-2026-0890', patient: 'State Life / A. Qadir', gross: 45000, discount: 0, net: 45000, paid: 0, due: 45000, mode: 'Corporate Panel', status: 'Pending' as const, time: '10:40 AM' },
  ];

  // Recent Payments (Strict Requirement: All financial entries must display Created By, Collected By, Date, Time)
  const recentPayments = [
    { receiptNo: 'RCT-2026-881', invoiceNo: 'INV-2026-342', patient: 'Zainab Bibi', amount: 3500, mode: 'Cash', createdBy: 'Ahmed Raza (Billing Officer)', collectedBy: 'Ahmed Raza (Counter 1)', date: '06-Sep-2026', time: '11:18 AM' },
    { receiptNo: 'RCT-2026-880', invoiceNo: 'INV-2026-341', patient: 'Muhammad Bilal', amount: 12000, mode: 'POS Card (HBL)', createdBy: 'Ahmed Raza (Billing Officer)', collectedBy: 'Ahmed Raza (Counter 1)', date: '06-Sep-2026', time: '11:08 AM' },
    { receiptNo: 'RCT-2026-879', invoiceNo: 'INV-2026-340', patient: 'Rashida Perveen', amount: 4000, mode: 'Cash', createdBy: 'Ahmed Raza (Billing Officer)', collectedBy: 'Ahmed Raza (Counter 1)', date: '06-Sep-2026', time: '10:52 AM' },
    { receiptNo: 'RCT-2026-878', invoiceNo: 'INV-2026-335', patient: 'Kamran Bhatti', amount: 2200, mode: 'EasyPaisa', createdBy: 'Sana Tariq (Billing Cashier)', collectedBy: 'Sana Tariq (Counter 2)', date: '06-Sep-2026', time: '10:15 AM' },
    { receiptNo: 'RCT-2026-877', invoiceNo: 'INV-2026-332', patient: 'Khadija Bibi', amount: 8450, mode: 'Cash', createdBy: 'Ahmed Raza (Billing Officer)', collectedBy: 'Ahmed Raza (Counter 1)', date: '06-Sep-2026', time: '09:55 AM' },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Front Desk Header & Quick Action Buttons */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-600" />
            <h1 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Front Desk & Billing Cashiering Terminal
            </h1>
            <span className="text-[10px] bg-[#effaf5] text-[#0e7d5a] border border-[#c2e7db] font-semibold px-2 py-0.5 rounded">
              Active Shift: Morning (Counter 01)
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Operator: <span className="font-semibold text-slate-800">{currentUser?.name}</span> ({currentUser?.role}) • Shift collections automatically tracked
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/front-desk/register_patient')}
            className="py-1.5 px-3 rounded bg-[#129b70] hover:bg-[#0e7d5a] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Register New Patient</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/front-desk/new_invoice')}
            className="py-1.5 px-3 rounded bg-[#0e7d5a] hover:bg-[#0b6448] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Receipt className="h-3.5 w-3.5" />
            <span>New Invoice Slip</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/front-desk/panel_verification')}
            className="py-1.5 px-3 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <ShieldCheck className="h-3.5 w-3.5 text-[#0e7d5a]" />
            <span>Verify Corporate Panel</span>
          </button>
        </div>
      </div>

      {/* 8 Requested Front Desk KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {kpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate">
                  {k.title}
                </span>
                <div className={`p-1 rounded ${k.color}`}>
                  <Icon className="h-3 w-3" />
                </div>
              </div>
              <div className="mt-1.5">
                <div className="text-sm font-bold text-slate-900 tracking-tight truncate">
                  {k.value}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5 truncate">{k.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Section 1: Recent Patients & Recent Invoices */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Recent Patients Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recent Registered Patients (Today)
            </h2>
            <button
              type="button"
              onClick={() => navigate('/front-desk/patient_registry')}
              className="text-xs text-[#0e7d5a] font-semibold hover:underline"
            >
              Patient Registry →
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-2 px-3 font-semibold">MRN</th>
                  <th className="py-2 px-3 font-semibold">Patient Name</th>
                  <th className="py-2 px-3 font-semibold">Flow Type</th>
                  <th className="py-2 px-3 font-semibold">Consultant / Unit</th>
                  <th className="py-2 px-3 font-semibold text-center">Status</th>
                  <th className="py-2 px-3 font-semibold text-right">Time</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentPatients.map((p, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2 px-3 font-mono text-[11px] font-semibold text-[#0e7d5a]">{p.mrn}</td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-900">{p.name}</div>
                      <div className="text-[10px] text-slate-400">{p.ageGender} • {p.phone}</div>
                    </td>
                    <td className="py-2 px-3">
                      <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-700">
                        {p.type}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-600 text-[11px]">{p.doctor}</td>
                    <td className="py-2 px-3 text-center">
                      <span className="inline-flex px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                        {p.status}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-right text-slate-500 font-mono text-[11px]">{p.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recent Invoices Table */}
        <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden flex flex-col">
          <div className="p-3 border-b border-slate-100 flex items-center justify-between">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recent Billing Invoices
            </h2>
            <button
              type="button"
              onClick={() => navigate('/front-desk/invoices')}
              className="text-xs text-[#0e7d5a] font-semibold hover:underline"
            >
              All Invoices →
            </button>
          </div>

          <div className="overflow-x-auto flex-1">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                  <th className="py-2 px-3 font-semibold">Invoice #</th>
                  <th className="py-2 px-3 font-semibold">Patient</th>
                  <th className="py-2 px-3 font-semibold text-right">Net</th>
                  <th className="py-2 px-3 font-semibold text-right">Paid</th>
                  <th className="py-2 px-3 font-semibold text-right">Due</th>
                  <th className="py-2 px-3 font-semibold text-center">Mode</th>
                  <th className="py-2 px-3 font-semibold text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {recentInvoices.map((inv, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                    <td className="py-2 px-3 font-mono text-[11px] font-semibold text-slate-900">{inv.invoiceNo}</td>
                    <td className="py-2 px-3">
                      <div className="font-semibold text-slate-900">{inv.patient}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{inv.mrn}</div>
                    </td>
                    <td className="py-2 px-3 text-right font-semibold text-slate-900">{formatPKR(inv.net)}</td>
                    <td className="py-2 px-3 text-right font-semibold text-emerald-700">{formatPKR(inv.paid)}</td>
                    <td className="py-2 px-3 text-right font-semibold text-rose-700">
                      {inv.due > 0 ? formatPKR(inv.due) : '—'}
                    </td>
                    <td className="py-2 px-3 text-center text-[11px] text-slate-600">{inv.mode}</td>
                    <td className="py-2 px-3 text-center">
                      <StatusBadge status={inv.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 2: Recent Payments with Traceability Stamps */}
      {/* (MANDATORY REQUIREMENT: All financial entries must display: Created By, Collected By, Date, Time) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
              <CreditCard className="h-4 w-4 text-emerald-700" />
              <span>Cashiering Audit Log • Real-Time Payments Traceability</span>
            </h2>
            <p className="text-[11px] text-slate-500">
              Mandatory hospital clinical governance: Every receipt logged with Created By, Collected By, Date & Timestamp
            </p>
          </div>
          <div className="text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded">
            Total Shift Receipts: PKR 1,177,600
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-2.5 px-3 font-semibold">Receipt No</th>
                <th className="py-2.5 px-3 font-semibold">Invoice Ref</th>
                <th className="py-2.5 px-3 font-semibold">Patient Name</th>
                <th className="py-2.5 px-3 font-semibold text-right">Amount Received</th>
                <th className="py-2.5 px-3 font-semibold">Payment Mode</th>
                <th className="py-2.5 px-3 font-semibold">Created By</th>
                <th className="py-2.5 px-3 font-semibold">Collected By</th>
                <th className="py-2.5 px-3 font-semibold">Date</th>
                <th className="py-2.5 px-3 font-semibold text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentPayments.map((p, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2 px-3 font-mono text-[11px] font-bold text-emerald-800">{p.receiptNo}</td>
                  <td className="py-2 px-3 font-mono text-[11px] text-slate-600">{p.invoiceNo}</td>
                  <td className="py-2 px-3 font-semibold text-slate-900">{p.patient}</td>
                  <td className="py-2 px-3 text-right font-bold text-slate-900">{formatPKR(p.amount)}</td>
                  <td className="py-2 px-3">
                    <span className="inline-flex px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-700">
                      {p.mode}
                    </span>
                  </td>
                  <td className="py-2 px-3 text-slate-700 text-[11px] font-medium">{p.createdBy}</td>
                  <td className="py-2 px-3 text-slate-700 text-[11px] font-medium">{p.collectedBy}</td>
                  <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{p.date}</td>
                  <td className="py-2 px-3 text-right text-slate-600 font-mono text-[11px]">{p.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
