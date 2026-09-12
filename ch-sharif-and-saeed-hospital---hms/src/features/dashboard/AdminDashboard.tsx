import React from 'react';
import {
  Users,
  UserCheck,
  Bed,
  CreditCard,
  AlertCircle,
  Clock,
  Building2,
  Calendar,
  DollarSign,
  TrendingUp,
  Stethoscope,
  ShieldAlert,
  ArrowUpRight,
  Pill,
  Boxes,
  FileSpreadsheet,
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatPKR } from '../../utils/formatters';
import { HOSPITAL_INFO } from '../../constants';
import { useRouter } from '../../context/RouterContext';

export const AdminDashboard: React.FC = () => {
  const { navigate } = useRouter();

  const adminKpis = [
    {
      title: 'Doctors On Duty',
      value: '14 Active',
      sub: '4 on call',
      icon: UserCheck,
      color: 'text-[#08775A] bg-[#effaf5] border-[#c2e7db]',
    },
    {
      title: 'Hospital Patients',
      value: '284 Total',
      sub: '192 OPD • 54 IPD • 38 ER',
      icon: Users,
      color: 'text-[#08775A] bg-[#dff5ea] border-[#c2e7db]',
    },
    {
      title: 'Bed Occupancy',
      value: '82%',
      sub: '54 / 68 Beds Occupied',
      icon: Bed,
      color: 'text-[#08775A] bg-[#effaf5] border-[#c2e7db]',
    },
    {
      title: "Today's Realized Revenue",
      value: 'PKR 1,280,000',
      sub: 'Collections: 90.1%',
      icon: CreditCard,
      color: 'text-emerald-700 bg-emerald-50 border-emerald-200',
    },
    {
      title: 'Staff On Shift',
      value: '42 Members',
      sub: 'Full operational coverage',
      icon: Clock,
      color: 'text-teal-700 bg-teal-50 border-teal-200',
    },
    {
      title: 'Stock & Expiry Alerts',
      value: '7 Items',
      sub: '4 low stock • 3 near expiry',
      icon: AlertCircle,
      color: 'text-amber-700 bg-amber-50 border-amber-200',
    },
  ];

  const doctorsList = [
    { name: 'Prof. Dr. Tariq Saeed', department: 'Cardiology', timing: '09:00 AM - 02:00 PM', patients: 24, status: 'Active' as const },
    { name: 'Dr. Farhana Yasmeen', department: 'Gynaecology & Obs', timing: '10:00 AM - 04:00 PM', patients: 32, status: 'Active' as const },
    { name: 'Dr. M. Sharif Chaudhary', department: 'Orthopedics', timing: '08:30 AM - 01:30 PM', patients: 19, status: 'Active' as const },
    { name: 'Dr. Salman Haider', department: 'Internal Medicine', timing: '11:00 AM - 05:00 PM', patients: 28, status: 'Active' as const },
    { name: 'Dr. Kamran Akram', department: 'General Surgery', timing: 'In OT (Surgeries)', patients: 12, status: 'In OT' as const },
  ];

  const wardOccupancies = [
    { ward: 'ICU / CCU', total: 12, occupied: 10, rate: 83, color: 'bg-rose-500' },
    { ward: 'Private Rooms', total: 16, occupied: 14, rate: 87, color: 'bg-[#149E75]' },
    { ward: 'Semi-Private Ward', total: 20, occupied: 16, rate: 80, color: 'bg-[#08775A]' },
    { ward: 'General Male & Female', total: 20, occupied: 14, rate: 70, color: 'bg-[#149E75]' },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Super Admin Protection Security Policy Banner */}
      <div className="p-3 bg-slate-900 border border-slate-800 rounded-lg text-white flex flex-wrap items-center justify-between gap-3 shadow-sm">
        <div className="flex items-center gap-2.5">
          <div className="h-7 w-7 rounded bg-[#149E75]/30 text-[#6ee7b7] flex items-center justify-center shrink-0">
            <ShieldAlert className="h-4 w-4" />
          </div>
          <div>
            <div className="text-xs font-semibold tracking-wide">
              ADMIN WORKSTATION • GOVERNANCE LOCK ENFORCED
            </div>
            <div className="text-[11px] text-slate-400">
              Per hospital security architecture: Admin accounts cannot delete, deactivate, or modify Super Admin credentials or root permissions.
            </div>
          </div>
        </div>
        <div className="text-[10px] font-mono bg-slate-800 text-slate-300 px-2.5 py-1 rounded border border-slate-700">
          Super Admin: Immutable
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {adminKpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between"
            >
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                  {kpi.title}
                </span>
                <div className={`p-1 rounded ${kpi.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-base font-bold text-slate-900 tracking-tight">
                  {kpi.value}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">{kpi.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main 2-Column Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Left 2 Cols: Doctors on Duty & Department Status */}
        <div className="lg:col-span-2 space-y-5">
          {/* Active Doctors on Duty */}
          <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Active Doctors & Consultant Clinics Today
                </h2>
                <p className="text-[11px] text-slate-500">
                  Duty roster and OPD attendance tracking
                </p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/admin/staff_users')}
                className="text-xs text-[#08775A] font-semibold hover:underline"
              >
                View Full Roster →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                    <th className="py-2 px-3 font-semibold">Doctor Name</th>
                    <th className="py-2 px-3 font-semibold">Specialty / Dept</th>
                    <th className="py-2 px-3 font-semibold">Clinic Timings</th>
                    <th className="py-2 px-3 font-semibold text-center">Patients Booked</th>
                    <th className="py-2 px-3 font-semibold text-center">Duty Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {doctorsList.map((doc, i) => (
                    <tr key={i} className="hover:bg-slate-50/70 transition-colors">
                      <td className="py-2 px-3 font-medium text-slate-900">{doc.name}</td>
                      <td className="py-2 px-3 text-slate-600">{doc.department}</td>
                      <td className="py-2 px-3 text-slate-500 font-mono text-[11px]">{doc.timing}</td>
                      <td className="py-2 px-3 text-center font-semibold text-slate-800">
                        {doc.patients}
                      </td>
                      <td className="py-2 px-3 text-center">
                        <span
                          className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                            doc.status === 'In OT'
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-[#effaf5] text-[#08775A] border border-[#c2e7db]'
                          }`}
                        >
                          {doc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Quick Setup & Management Actions */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Administrative Quick Actions
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                onClick={() => navigate('/admin/staff_users')}
                className="p-3 rounded-lg border border-slate-200 hover:border-[#149E75] hover:bg-[#effaf5]/50 text-left transition-all group"
              >
                <Stethoscope className="h-4 w-4 text-[#149E75] mb-1 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-semibold text-slate-900">Manage Doctors</div>
                <div className="text-[10px] text-slate-500">Rosters & commissions</div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/services_rates')}
                className="p-3 rounded-lg border border-slate-200 hover:border-[#149E75] hover:bg-[#effaf5]/50 text-left transition-all group"
              >
                <FileSpreadsheet className="h-4 w-4 text-[#08775A] mb-1 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-semibold text-slate-900">Services & Rates</div>
                <div className="text-[10px] text-slate-500">Tariffs & charges</div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/wards_rooms_beds')}
                className="p-3 rounded-lg border border-slate-200 hover:border-[#149E75] hover:bg-[#effaf5]/50 text-left transition-all group"
              >
                <Bed className="h-4 w-4 text-[#08775A] mb-1 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-semibold text-slate-900">Wards & Beds</div>
                <div className="text-[10px] text-slate-500">Rooms & capacity</div>
              </button>

              <button
                type="button"
                onClick={() => navigate('/admin/billing_reports')}
                className="p-3 rounded-lg border border-slate-200 hover:border-[#149E75] hover:bg-[#effaf5]/50 text-left transition-all group"
              >
                <TrendingUp className="h-4 w-4 text-[#149E75] mb-1 group-hover:scale-110 transition-transform" />
                <div className="text-xs font-semibold text-slate-900">Revenue Audits</div>
                <div className="text-[10px] text-slate-500">Department receipts</div>
              </button>
            </div>
          </div>
        </div>

        {/* Right 1 Col: Ward Occupancy & Operational Warnings */}
        <div className="space-y-5">
          {/* Inpatient Bed Status */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3">
              Ward Bed Capacity Overview
            </h2>
            <div className="space-y-3">
              {wardOccupancies.map((w, idx) => (
                <div key={idx} className="space-y-1">
                  <div className="flex justify-between text-xs font-medium text-slate-700">
                    <span>{w.ward}</span>
                    <span className="font-semibold text-slate-900">
                      {w.occupied}/{w.total} ({w.rate}%)
                    </span>
                  </div>
                  <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${w.color} rounded-full transition-all`}
                      style={{ width: `${w.rate}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
              <span className="text-slate-500">Available Vacant Beds:</span>
              <span className="font-bold text-emerald-700">14 Beds Free</span>
            </div>
          </div>

          {/* Operational Notices */}
          <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-3 flex items-center gap-1.5 text-amber-900">
              <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
              <span>Stock & Pharmacy Alerts</span>
            </h2>
            <div className="space-y-2 text-xs">
              <div className="p-2.5 rounded bg-rose-50 border border-rose-200 text-rose-800 leading-snug">
                <div className="font-bold text-[11px]">Surgical Gloves 7.5 Latex</div>
                <div className="text-[10px] text-rose-700 mt-0.5">
                  Out of Stock in OT • Central store requisition pending
                </div>
              </div>

              <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-800 leading-snug">
                <div className="font-bold text-[11px]">Inj. Ceftriaxone 1g IV</div>
                <div className="text-[10px] text-amber-700 mt-0.5">
                  Low Stock (24 vials remaining) • Reorder trigger: 100
                </div>
              </div>

              <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-800 leading-snug">
                <div className="font-bold text-[11px]">Humalog Mix 25 KwikPen</div>
                <div className="text-[10px] text-amber-700 mt-0.5">
                  Near Expiry (18 days remaining, Batch HM-2024-B9)
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
