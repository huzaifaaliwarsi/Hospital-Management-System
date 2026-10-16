/**
 * STANDALONE PHARMACY PROJECT (ISOLATED LEGACY COMPONENT)
 * 
 * Pharmacy is NOT an HMS portal in the finalized 5-portal architecture.
 * This component is preserved and isolated here so it can later be moved
 * into the standalone Pharmacy project and integrated with the main HMS.
 * 
 * Do NOT delete this component or merge its logic into General Inventory.
 */

import React from 'react';
import {
  Pill,
  ShoppingCart,
  ClipboardList,
  CheckCircle2,
  AlertCircle,
  CalendarX,
  Clock,
  ArrowLeftRight,
  Plus,
  Coins,
  Receipt,
  Search,
  Check,
} from 'lucide-react';
import { formatPKR } from '../../utils/formatters';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';

export const PharmacyDashboard: React.FC = () => {
  const { navigate } = useRouter();
  const { currentUser } = useAuth();

  // 8 Specified Pharmacy Top KPIs
  const pharmacyKpis = [
    { title: "Today's Pharmacy Sales", value: 'PKR 465,200', sub: '312 retail slips', icon: Coins, color: 'text-[#0e7d5a] bg-[#effaf5]' },
    { title: "Today's Prescriptions", value: '312 Rx', sub: 'OPD & Inpatient orders', icon: Pill, color: 'text-[#129b70] bg-[#effaf5]' },
    { title: 'Pending Medicine Requests', value: '8 Requests', sub: 'From Wards & OT', icon: ClipboardList, color: 'text-amber-700 bg-amber-50' },
    { title: 'Dispensed Medicines', value: '148 Orders', sub: 'Fully verified & labeled', icon: CheckCircle2, color: 'text-[#0e7d5a] bg-[#effaf5]' },
    { title: 'Low Stock Alert', value: '9 Items', sub: 'Below minimum safety limit', icon: AlertCircle, color: 'text-rose-700 bg-rose-50' },
    { title: 'Near Expiry (30 Days)', value: '14 Items', sub: 'Action required: FEFO', icon: CalendarX, color: 'text-amber-700 bg-amber-50' },
    { title: 'Expired Stock (Quarantined)', value: '3 Items', sub: 'Isolated in disposal lock', icon: CalendarX, color: 'text-red-800 bg-red-50' },
    { title: 'Pharmacy Stock Value', value: 'PKR 3,420,000', sub: 'On-shelf retail inventory', icon: ShoppingCart, color: 'text-[#129b70] bg-[#effaf5]' },
  ];

  // Dispensing / Medicine Requests Table (Strictly required columns: Dispensed By, Patient Name & MR Number, Quantity & Medicine Name, Batch No, Time, Invoice Reference / Status)
  const recentDispensing = [
    {
      slipNo: 'RX-2026-0994',
      invoiceRef: 'INV-PH-8841',
      patientName: 'Zainab Bibi',
      mrn: 'MRN-2026-0914',
      medicineName: 'Augmentin 625mg Tab',
      quantity: '2 Strips (20 Tabs)',
      batchNo: 'AUG-2025-C1',
      dispensedBy: 'Ali Hassan (Pharmacist)',
      time: '11:20 AM',
      status: 'Dispensed' as const,
    },
    {
      slipNo: 'RX-2026-0993',
      invoiceRef: 'IPD-REQ-044',
      patientName: 'Muhammad Tariq Khan',
      mrn: 'MRN-2026-0842',
      medicineName: 'Inj. Heparin 25,000 IU',
      quantity: '2 Vials',
      batchNo: 'HEP-994-A',
      dispensedBy: 'Ali Hassan (Pharmacist)',
      time: '11:05 AM',
      status: 'Dispensed' as const,
    },
    {
      slipNo: 'RX-2026-0992',
      invoiceRef: 'INV-PH-8840',
      patientName: 'Khadija Bibi',
      mrn: 'MRN-2026-0744',
      medicineName: 'Panadol CF & Brufen 400',
      quantity: '3 Strips + 1 Box',
      batchNo: 'PAN-2026-01',
      dispensedBy: 'Sajid Mehmood (Pharm Assistant)',
      time: '10:48 AM',
      status: 'Dispensed' as const,
    },
    {
      slipNo: 'RX-2026-0991',
      invoiceRef: 'IPD-REQ-043',
      patientName: 'Zubaida Begum',
      mrn: 'MRN-2026-0839',
      medicineName: 'Inj. Meropenem 1g IV',
      quantity: '4 Vials',
      batchNo: 'MR-9901-X',
      dispensedBy: 'Ali Hassan (Pharmacist)',
      time: '10:30 AM',
      status: 'Dispensed' as const,
    },
    {
      slipNo: 'RX-2026-0990',
      invoiceRef: 'INV-PH-8839',
      patientName: 'Rashid Ahmed',
      mrn: 'MRN-2026-0899',
      medicineName: 'Nexum 40mg (Esomeprazole)',
      quantity: '2 Strips (28 Caps)',
      batchNo: 'NEX-882-B',
      dispensedBy: 'Ali Hassan (Pharmacist)',
      time: '10:12 AM',
      status: 'Dispensed' as const,
    },
  ];

  // Near Expiry & Low Stock fast inspection
  const criticalPharmacyStock = [
    { name: 'Inj. Ceftriaxone 1g IV', category: 'Injectables', currentStock: '24 Vials', minLevel: '100 Vials', status: 'Low Stock' },
    { name: 'Humalog Mix 25 KwikPen', category: 'Insulin / Cold Storage', currentStock: '15 Pens', minLevel: '30 Pens', status: 'Near Expiry (18d)' },
    { name: 'Inj. Meropenem 1g', category: 'Antibiotics IV', currentStock: '32 Vials', minLevel: '60 Vials', status: 'Near Expiry (24d)' },
    { name: 'Brufen Syrup 120ml', category: 'Pediatrics', currentStock: '6 Bottles', minLevel: '50 Bottles', status: 'Expired (Isolated)' },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Pharmacy Action Banner */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#129b70]" />
            <h1 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Hospital Pharmacy & Dispensary Counter
            </h1>
            <span className="text-[10px] bg-[#effaf5] text-[#0e7d5a] border border-[#c2e7db] font-semibold px-2 py-0.5 rounded">
              Shift: Main Outpatient & Inpatient Dispensary
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Dispensing Pharmacist: <strong className="text-slate-800">{currentUser?.name}</strong> • FEFO Batch Allocation Active
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/pharmacy/new_pharmacy_sale')}
            className="py-1.5 px-3 rounded bg-[#129b70] hover:bg-[#0e7d5a] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <ShoppingCart className="h-3.5 w-3.5" />
            <span>New Retail Sale (POS)</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/pharmacy/inpatient_medicine_requests')}
            className="py-1.5 px-3 rounded bg-[#0e7d5a] hover:bg-[#0b6448] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <ClipboardList className="h-3.5 w-3.5" />
            <span>Process Inpatient Rx (8)</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/pharmacy/request_stock_from_inventory')}
            className="py-1.5 px-3 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <ArrowLeftRight className="h-3.5 w-3.5 text-amber-700" />
            <span>Requisition from Central Store</span>
          </button>
        </div>
      </div>

      {/* 8 Specified Top Pharmacy KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {pharmacyKpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-xs flex flex-col justify-between">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-tight truncate">
                  {kpi.title}
                </span>
                <div className={`p-1 rounded ${kpi.color}`}>
                  <Icon className="h-3 w-3" />
                </div>
              </div>
              <div className="mt-1.5">
                <div className="text-sm font-bold text-slate-900 tracking-tight truncate">
                  {kpi.value}
                </div>
                <div className="text-[9px] text-slate-500 mt-0.5 truncate">{kpi.sub}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Dispensing Audit Table (Explicit columns required) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recent Dispensing & Prescription Fulfillment Log
            </h2>
            <p className="text-[11px] text-slate-500">
              Audit log with Dispensed By, Patient MRN, Medicine Name, Batch Number & Timestamp
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/pharmacy/sales_history')}
            className="text-xs text-[#0e7d5a] font-semibold hover:underline"
          >
            Full Dispensing History →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-2.5 px-3 font-semibold">Slip #</th>
                <th className="py-2.5 px-3 font-semibold">Invoice Ref</th>
                <th className="py-2.5 px-3 font-semibold">Patient Name & MRN</th>
                <th className="py-2.5 px-3 font-semibold">Quantity & Medicine Name</th>
                <th className="py-2.5 px-3 font-semibold">Batch No</th>
                <th className="py-2.5 px-3 font-semibold">Dispensed By</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                <th className="py-2.5 px-3 font-semibold text-right">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentDispensing.map((item, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-[#0e7d5a]">{item.slipNo}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{item.invoiceRef}</td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-900">{item.patientName}</div>
                    <div className="text-[10px] text-slate-400 font-mono">{item.mrn}</div>
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="font-semibold text-slate-900">{item.medicineName}</div>
                    <div className="text-[10px] text-[#0e7d5a] font-medium">{item.quantity}</div>
                  </td>
                  <td className="py-2.5 px-3 font-mono text-[11px] font-semibold text-slate-700">{item.batchNo}</td>
                  <td className="py-2.5 px-3 text-slate-700 text-[11px] font-medium">{item.dispensedBy}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      <Check className="h-3 w-3" />
                      <span>{item.status}</span>
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-500 font-mono text-[11px]">{item.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Critical Stock & Batch Status */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 text-amber-900">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span>Pharmacy On-Shelf Critical Stock & Batch Status</span>
          </h2>
          <button
            type="button"
            onClick={() => navigate('/pharmacy/request_stock_from_inventory')}
            className="text-xs text-[#0e7d5a] font-semibold hover:underline"
          >
            Create Store Requisition →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {criticalPharmacyStock.map((s, i) => (
            <div key={i} className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-slate-900 leading-tight">{s.name}</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    s.status.includes('Low')
                      ? 'bg-rose-100 text-rose-800'
                      : s.status.includes('Expired')
                      ? 'bg-red-200 text-red-900'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {s.status}
                </span>
              </div>
              <div className="text-[10px] text-slate-500">{s.category}</div>
              <div className="pt-1 flex justify-between text-xs text-slate-700">
                <span>Stock: <strong>{s.currentStock}</strong></span>
                <span className="text-slate-400 text-[10px]">Min: {s.minLevel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
export default PharmacyDashboard;
