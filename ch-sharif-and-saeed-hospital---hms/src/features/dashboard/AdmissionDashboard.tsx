import React from 'react';
import {
  Bed,
  Users,
  Activity,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowLeftRight,
  Plus,
  ShieldCheck,
  Building,
  HeartPulse,
} from 'lucide-react';
import { StatusBadge } from '../../components/common/StatusBadge';
import { formatPKR } from '../../utils/formatters';
import { useRouter } from '../../context/RouterContext';

export const AdmissionDashboard: React.FC = () => {
  const { navigate } = useRouter();

  const ipdKpis = [
    { title: 'Total Hospital Beds', value: '120 Beds', sub: 'Across 6 Wards & ICUs', icon: Bed, color: 'text-[#0e7d5a] bg-[#effaf5]' },
    { title: 'Occupied Beds', value: '98 (81.6%)', sub: 'Active inpatient census', icon: Users, color: 'text-[#129b70] bg-[#effaf5]' },
    { title: 'Available Vacant Beds', value: '22 Free', sub: 'Ready for admissions', icon: CheckCircle2, color: 'text-[#0e7d5a] bg-[#effaf5]' },
    { title: 'Critical / ICU Beds', value: '14 / 16', sub: '87.5% Critical occupancy', icon: Activity, color: 'text-rose-700 bg-rose-50' },
    { title: 'Pending Requisitions', value: '7 Requests', sub: 'ER & OPD referrals waiting', icon: ClipboardList, color: 'text-amber-700 bg-amber-50' },
    { title: "Today's Discharges", value: '12 Discharged', sub: 'All clearance verified', icon: Clock, color: 'text-[#129b70] bg-[#effaf5]' },
  ];

  // Specific Ward & Bed Occupancy Breakdown
  const wardBreakdown = [
    { name: 'NICU (Neonatal ICU)', total: 20, occupied: 17, available: 3, rate: 85, color: 'bg-rose-600' },
    { name: 'PICU (Pediatric ICU)', total: 10, occupied: 7, available: 3, rate: 70, color: 'bg-[#0e7d5a]' },
    { name: 'PEDS Ward', total: 20, occupied: 18, available: 2, rate: 90, color: 'bg-[#129b70]' },
    { name: 'Private Deluxe Ward', total: 20, occupied: 19, available: 1, rate: 95, color: 'bg-[#14b885]' },
    { name: 'Semi-Private Ward', total: 30, occupied: 24, available: 6, rate: 80, color: 'bg-[#0e7d5a]' },
    { name: 'General Medical & Surgical', total: 20, occupied: 13, available: 7, rate: 65, color: 'bg-[#129b70]' },
  ];

  // Active Inpatients with Discharge Clearance
  const activeInpatients = [
    {
      mrn: 'MRN-2026-0842',
      patient: 'Muhammad Tariq Khan',
      ageGender: '56 / M',
      wardBed: 'Private Suite 304 (Bed 304-A)',
      consultant: 'Prof. Dr. Tariq Saeed',
      diagnosis: 'Acute Coronary Syndrome',
      admittedAt: '03-Sep-2026 (3 days)',
      depositPaid: 85000,
      interimDue: 14200,
      billingClearance: 'Pending',
      pharmacyClearance: 'Approved',
    },
    {
      mrn: 'MRN-2026-0839',
      patient: 'Zubaida Begum',
      ageGender: '62 / F',
      wardBed: 'ICU Bed 04',
      consultant: 'Dr. Salman Haider',
      diagnosis: 'Severe DKA with Sepsis',
      admittedAt: '05-Sep-2026 (1 day)',
      depositPaid: 50000,
      interimDue: 28400,
      billingClearance: 'Pending',
      pharmacyClearance: 'Pending',
    },
    {
      mrn: 'MRN-2026-0821',
      patient: 'Hamza Farooq',
      ageGender: '28 / M',
      wardBed: 'General Male (Bed MS-12)',
      consultant: 'Dr. Kamran Akram',
      diagnosis: 'Post Lap. Appendectomy',
      admittedAt: '04-Sep-2026 (2 days)',
      depositPaid: 35000,
      interimDue: 0,
      billingClearance: 'Approved',
      pharmacyClearance: 'Approved',
    },
    {
      mrn: 'MRN-2026-0815',
      patient: 'Saima Jamil',
      ageGender: '34 / F',
      wardBed: 'Maternity Ward (Bed MAT-06)',
      consultant: 'Dr. Farhana Yasmeen',
      diagnosis: 'Elective C-Section (Post-op)',
      admittedAt: '05-Sep-2026 (1 day)',
      depositPaid: 60000,
      interimDue: 8200,
      billingClearance: 'Pending',
      pharmacyClearance: 'Approved',
    },
    {
      mrn: 'MRN-2026-0798',
      patient: 'Abdul Rehman',
      ageGender: '45 / M',
      wardBed: 'Ortho Ward A (Bed OR-02)',
      consultant: 'Dr. M. Sharif Chaudhary',
      diagnosis: 'Tibia-Fibula Fracture',
      admittedAt: '01-Sep-2026 (5 days)',
      depositPaid: 75000,
      interimDue: 0,
      billingClearance: 'Approved',
      pharmacyClearance: 'Approved',
    },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Top Banner & Quick Controls */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#129b70]" />
            <h1 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Inpatient Admission & Bed Allocation Center
            </h1>
            <span className="text-[10px] bg-[#effaf5] text-[#0e7d5a] border border-[#c2e7db] font-semibold px-2 py-0.5 rounded">
              Bed Capacity: 81.6% Occupied
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Real-time ward bed allocations, inpatient daily orders & multi-department discharge clearances
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/admission/new_admission')}
            className="py-1.5 px-3 rounded bg-[#129b70] hover:bg-[#0e7d5a] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Inpatient Admission</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/admission/bed_availability')}
            className="py-1.5 px-3 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Bed className="h-3.5 w-3.5 text-[#0e7d5a]" />
            <span>Bed Availability Matrix</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/admission/bed_transfers')}
            className="py-1.5 px-3 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-slate-600" />
            <span>Bed Transfer</span>
          </button>
        </div>
      </div>

      {/* 6 Key IPD KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {ipdKpis.map((k, i) => {
          const Icon = k.icon;
          return (
            <div key={i} className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate">
                  {k.title}
                </span>
                <div className={`p-1 rounded ${k.color}`}>
                  <Icon className="h-3.5 w-3.5" />
                </div>
              </div>
              <div className="mt-2">
                <div className="text-base font-bold text-slate-900 tracking-tight">
                  {k.value}
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5 truncate">{k.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Ward Occupancy Status Grid */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Hospital Ward & Unit Bed Occupancy Status
            </h2>
            <p className="text-[11px] text-slate-500">
              Breakdown across specialized intensive care and inpatient wards
            </p>
          </div>
          <span className="text-xs font-semibold text-[#0e7d5a] bg-[#effaf5] border border-[#c2e7db] px-2 py-0.5 rounded">
            22 Total Vacant Beds Available
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
          {wardBreakdown.map((w, idx) => (
            <div key={idx} className="p-3 rounded-lg border border-slate-200/90 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-900">{w.name}</span>
                <span className="text-xs font-bold text-slate-800">{w.rate}% Occupied</span>
              </div>
              <div className="h-2 w-full bg-slate-200 rounded-full overflow-hidden">
                <div className={`h-full ${w.color} rounded-full transition-all`} style={{ width: `${w.rate}%` }} />
              </div>
              <div className="flex justify-between text-[11px] text-slate-500 pt-0.5">
                <span>Occupied: <strong className="text-slate-800">{w.occupied}</strong> / {w.total}</span>
                <span className="text-emerald-700 font-bold">{w.available} Available</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Active Inpatients & Discharge Clearance Table */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Active Inpatients & Discharge Clearance Tracker
            </h2>
            <p className="text-[11px] text-slate-500">
              Multi-department clearance (Billing Desk + Pharmacy Dispensary) required before final discharge
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/admission/active_admissions')}
            className="text-xs text-[#0e7d5a] font-semibold hover:underline"
          >
            All Active Admissions →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-2.5 px-3 font-semibold">MRN</th>
                <th className="py-2.5 px-3 font-semibold">Patient Name</th>
                <th className="py-2.5 px-3 font-semibold">Ward & Bed Allocation</th>
                <th className="py-2.5 px-3 font-semibold">Consultant</th>
                <th className="py-2.5 px-3 font-semibold">Admitted At</th>
                <th className="py-2.5 px-3 font-semibold text-right">Deposit Paid</th>
                <th className="py-2.5 px-3 font-semibold text-center">Billing Clearance</th>
                <th className="py-2.5 px-3 font-semibold text-center">Pharmacy Clearance</th>
                <th className="py-2.5 px-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {activeInpatients.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-[#0e7d5a]">{item.mrn}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-900">{item.patient}</div>
                    <div className="text-[10px] text-slate-500">{item.ageGender} • {item.diagnosis}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <span className="inline-flex px-2 py-0.5 rounded text-[11px] font-semibold bg-[#effaf5] text-[#0e7d5a] border border-[#c2e7db]">
                      {item.wardBed}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-slate-700">{item.consultant}</td>
                  <td className="py-2.5 px-3 text-slate-500 text-[11px]">{item.admittedAt}</td>
                  <td className="py-2.5 px-3 text-right font-semibold text-slate-900">
                    {formatPKR(item.depositPaid)}
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                        item.billingClearance === 'Approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.billingClearance}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${
                        item.pharmacyClearance === 'Approved'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {item.pharmacyClearance}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    <button
                      type="button"
                      onClick={() => navigate('/admission/patient_file')}
                      className="px-2 py-1 text-[11px] font-semibold text-[#0e7d5a] hover:bg-[#effaf5] rounded border border-[#c2e7db]"
                    >
                      Patient File
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
