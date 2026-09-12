import React, { useState } from 'react';
import {
  Boxes,
  Truck,
  ArrowRight,
  ClipboardList,
  AlertCircle,
  AlertTriangle,
  Package,
  ArrowLeftRight,
  CheckCircle2,
  Building2,
  FileSpreadsheet,
  Check,
  Tag,
  Coins,
} from 'lucide-react';
import { formatPKR } from '../../utils/formatters';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';

export const InventoryDashboard: React.FC = () => {
  const { navigate } = useRouter();
  const { currentUser } = useAuth();
  const toast = useToast();

  // 8 Specified General Hospital Inventory Top KPIs
  const inventoryKpis = [
    { title: 'Total Catalog Items', value: '840 Items', sub: 'Consumables, Linens & Disposables', icon: Package, color: 'text-amber-700 bg-amber-50' },
    { title: 'Current Warehouse Stock', value: 'PKR 8.4M', sub: 'Hospital general valuation', icon: Boxes, color: 'text-[#0e7d5a] bg-[#effaf5]' },
    { title: 'Low Stock Items', value: '12 Items', sub: 'Below reorder threshold', icon: AlertCircle, color: 'text-rose-700 bg-rose-50' },
    { title: 'Out of Stock', value: '2 Items', sub: 'Urgent procurement required', icon: AlertTriangle, color: 'text-red-700 bg-red-50' },
    { title: 'Pending Dept Requisitions', value: '6 Requests', sub: 'Awaiting store issuance', icon: ClipboardList, color: 'text-[#129b70] bg-[#effaf5]' },
    { title: "Today's Inward GRNs", value: '4 GRNs', sub: 'Inward goods PKR 320,000', icon: Truck, color: 'text-[#0e7d5a] bg-[#effaf5]' },
    { title: 'Active Suppliers', value: '28 Vendors', sub: 'Verified hospital suppliers', icon: Building2, color: 'text-blue-700 bg-blue-50' },
    { title: 'Monthly Procurement', value: 'PKR 2.15M', sub: 'General hospital spend', icon: Coins, color: 'text-[#0e7d5a] bg-[#effaf5]' },
  ];

  // Department Stock Requests with interactive "Issue to Department"
  const [pendingRequests, setPendingRequests] = useState([
    {
      reqId: 'REQ-2026-088',
      dept: 'Operation Theater (OT)',
      requestedItem: 'Surgical Gloves 7.5 Latex Powder-Free',
      qtyRequested: '200 Pairs',
      warehouseStock: '1,240 Pairs',
      priority: 'High',
      status: 'Pending Issuance' as 'Pending Issuance' | 'Issued',
    },
    {
      reqId: 'REQ-2026-087',
      dept: 'Emergency & Triage',
      requestedItem: 'IV Cannula 20G (Pink) with Port',
      qtyRequested: '300 Pcs',
      warehouseStock: '650 Pcs',
      priority: 'Urgent',
      status: 'Pending Issuance' as 'Pending Issuance' | 'Issued',
    },
    {
      reqId: 'REQ-2026-086',
      dept: 'Inpatient General Ward A',
      requestedItem: 'Cotton Crepe Bandage 10cm',
      qtyRequested: '50 Rolls',
      warehouseStock: '340 Rolls',
      priority: 'Normal',
      status: 'Pending Issuance' as 'Pending Issuance' | 'Issued',
    },
    {
      reqId: 'REQ-2026-085',
      dept: 'ICU / High Dependency Unit',
      requestedItem: 'Suction Catheter 14 Fr Sterile',
      qtyRequested: '40 Pcs',
      warehouseStock: '180 Pcs',
      priority: 'Urgent',
      status: 'Pending Issuance' as 'Pending Issuance' | 'Issued',
    },
    {
      reqId: 'REQ-2026-084',
      dept: 'Housekeeping & Sanitation',
      requestedItem: 'Hospital Grade Surface Disinfectant 5L',
      qtyRequested: '10 Cans',
      warehouseStock: '45 Cans',
      priority: 'Normal',
      status: 'Pending Issuance' as 'Pending Issuance' | 'Issued',
    },
  ]);

  // Recent Goods Received Notes (GRN #, Supplier, Total Items, Received Date, Received By, Status)
  const recentGrns = [
    {
      grnNo: 'GRN-2026-042',
      poNo: 'PO-9912',
      supplier: 'Premier Surgical & Healthcare Supplies',
      totalItems: '8 Line Items (Disposables & Sutures)',
      invoiceAmount: 245000,
      receivedDate: 'Today, 09:30 AM',
      receivedBy: 'Usman Ali (Store Manager)',
      status: 'Verified & Stocked' as const,
    },
    {
      grnNo: 'GRN-2026-041',
      poNo: 'PO-9910',
      supplier: 'Al-Madina Hospital Linens & Textiles',
      totalItems: '4 Line Items (Bed Sheets & Scrub Suits)',
      invoiceAmount: 180000,
      receivedDate: 'Today, 08:45 AM',
      receivedBy: 'Usman Ali (Store Manager)',
      status: 'Verified & Stocked' as const,
    },
    {
      grnNo: 'GRN-2026-040',
      poNo: 'PO-9908',
      supplier: 'CleanTech Hygiene & Chemical Solutions',
      totalItems: '6 Line Items (Disinfectants & Handrubs)',
      invoiceAmount: 95000,
      receivedDate: 'Yesterday, 04:15 PM',
      receivedBy: 'Tahir Abbas (Store Officer)',
      status: 'Verified & Stocked' as const,
    },
    {
      grnNo: 'GRN-2026-039',
      poNo: 'PO-9905',
      supplier: 'National Medical Gas & Equipment Co',
      totalItems: '2 Line Items (Oxygen Flowmeters & Tubing)',
      invoiceAmount: 120000,
      receivedDate: 'Yesterday, 02:00 PM',
      receivedBy: 'Usman Ali (Store Manager)',
      status: 'Verified & Stocked' as const,
    },
  ];

  const handleIssueToDepartment = (reqId: string, item: string, dept: string) => {
    setPendingRequests((prev) =>
      prev.map((r) => (r.reqId === reqId ? { ...r, status: 'Issued' } : r))
    );
    toast.success(
      `Stock transfer approved. ${item} issued to ${dept} from Central Warehouse.`,
      'Department Stock Issued'
    );
  };

  // Critical Hospital General Supplies & Reorder Triggers
  const criticalStockItems = [
    { name: 'IV Cannula 20G Pink', category: 'Medical Disposables', currentStock: '45 Pcs', reorderLevel: '150 Pcs', status: 'Low Stock' },
    { name: 'Disposable Syringes 5ml', category: 'General Consumables', currentStock: '120 Pcs', reorderLevel: '300 Pcs', status: 'Low Stock' },
    { name: 'Surgical Gauze 90cm x 100m', category: 'Surgical Sundries', currentStock: '4 Rolls', reorderLevel: '15 Rolls', status: 'Low Stock' },
    { name: 'Sterile Surgical Gowns XL', category: 'OT Linens', currentStock: '0 Pcs', reorderLevel: '50 Pcs', status: 'Out of Stock' },
  ];

  return (
    <div className="space-y-5 animate-in fade-in duration-200">
      {/* Central Inventory Header & Actions */}
      <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-[#129b70]" />
            <h1 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Central Hospital Store & General Inventory
            </h1>
            <span className="text-[10px] bg-[#effaf5] text-[#0e7d5a] border border-[#c2e7db] font-semibold px-2 py-0.5 rounded">
              Warehouse Station: Main Central Store
            </span>
          </div>
          <p className="text-[11px] text-slate-500 mt-0.5">
            Store Manager: <strong className="text-slate-800">{currentUser?.name}</strong> • Departmental issuance, Goods Inward (GRN), and supplier ledger control
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/inventory/purchases_goods_receipt')}
            className="py-1.5 px-3 rounded bg-[#129b70] hover:bg-[#0e7d5a] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <Truck className="h-3.5 w-3.5" />
            <span>Goods Receipt (GRN)</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/inventory/department_issue_return')}
            className="py-1.5 px-3 rounded bg-[#0e7d5a] hover:bg-[#0b6448] text-white text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-colors"
          >
            <ArrowLeftRight className="h-3.5 w-3.5" />
            <span>Issue to Department</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/inventory/suppliers')}
            className="py-1.5 px-3 rounded bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 text-xs font-semibold flex items-center gap-1.5 transition-colors"
          >
            <Building2 className="h-3.5 w-3.5 text-slate-600" />
            <span>Supplier Ledger</span>
          </button>
        </div>
      </div>

      {/* 8 Specified Top Inventory KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {inventoryKpis.map((kpi, idx) => {
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

      {/* Department Requisitions & Store Issuance Queue */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Hospital Departmental Stock Requisitions
            </h2>
            <p className="text-[11px] text-slate-500">
              Inward stock requisitions from Wards, Operation Theaters, Emergency & Support Departments
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/inventory/department_issue_return')}
            className="text-xs text-[#0e7d5a] font-semibold hover:underline"
          >
            View All Issues / Returns →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-2.5 px-3 font-semibold">Req #</th>
                <th className="py-2.5 px-3 font-semibold">Department</th>
                <th className="py-2.5 px-3 font-semibold">Item Description</th>
                <th className="py-2.5 px-3 font-semibold">Qty Requested</th>
                <th className="py-2.5 px-3 font-semibold">Store Balance</th>
                <th className="py-2.5 px-3 font-semibold text-center">Priority</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
                <th className="py-2.5 px-3 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pendingRequests.map((req, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-[#0e7d5a]">{req.reqId}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{req.dept}</td>
                  <td className="py-2.5 px-3 text-slate-800">{req.requestedItem}</td>
                  <td className="py-2.5 px-3 font-bold text-[#0e7d5a]">{req.qtyRequested}</td>
                  <td className="py-2.5 px-3 font-medium text-slate-600">{req.warehouseStock}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                        req.priority === 'Urgent'
                          ? 'bg-rose-100 text-rose-800'
                          : req.priority === 'High'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {req.priority}
                    </span>
                  </td>
                  <td className="py-2.5 px-3 text-center">
                    {req.status === 'Issued' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded">
                        <Check className="h-3 w-3" />
                        <span>Issued</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-semibold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                        Pending
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {req.status === 'Issued' ? (
                      <span className="text-[11px] text-slate-400 font-medium italic">Dispatched</span>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleIssueToDepartment(req.reqId, req.requestedItem, req.dept)}
                        className="py-1 px-2.5 rounded bg-[#129b70] hover:bg-[#0e7d5a] text-white text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <ArrowRight className="h-3 w-3" />
                        <span>Issue Stock</span>
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Recent Goods Received Notes (GRN) */}
      <div className="bg-white rounded-lg border border-slate-200 shadow-xs overflow-hidden">
        <div className="p-3.5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              Recent Inward Goods Received Notes (GRN)
            </h2>
            <p className="text-[11px] text-slate-500">
              Procurement receiving logs, supplier invoices & warehouse inspection audit
            </p>
          </div>
          <button
            type="button"
            onClick={() => navigate('/inventory/purchases_goods_receipt')}
            className="text-xs text-[#0e7d5a] font-semibold hover:underline"
          >
            All Goods Receipts →
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-600 border-b border-slate-200">
                <th className="py-2.5 px-3 font-semibold">GRN #</th>
                <th className="py-2.5 px-3 font-semibold">PO #</th>
                <th className="py-2.5 px-3 font-semibold">Supplier Name</th>
                <th className="py-2.5 px-3 font-semibold">Consignment Summary</th>
                <th className="py-2.5 px-3 font-semibold text-right">Invoice Value</th>
                <th className="py-2.5 px-3 font-semibold">Received Date</th>
                <th className="py-2.5 px-3 font-semibold">Inspected By</th>
                <th className="py-2.5 px-3 font-semibold text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {recentGrns.map((grn, idx) => (
                <tr key={idx} className="hover:bg-slate-50/70 transition-colors">
                  <td className="py-2.5 px-3 font-mono text-[11px] font-bold text-[#0e7d5a]">{grn.grnNo}</td>
                  <td className="py-2.5 px-3 font-mono text-[11px] text-slate-600">{grn.poNo}</td>
                  <td className="py-2.5 px-3 font-semibold text-slate-900">{grn.supplier}</td>
                  <td className="py-2.5 px-3 text-slate-600">{grn.totalItems}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">
                    {formatPKR(grn.invoiceAmount)}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">{grn.receivedDate}</td>
                  <td className="py-2.5 px-3 text-slate-700 text-[11px]">{grn.receivedBy}</td>
                  <td className="py-2.5 px-3 text-center">
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                      <Check className="h-3 w-3" />
                      <span>{grn.status}</span>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Critical General Store Reorder Status */}
      <div className="bg-white rounded-lg border border-slate-200 p-4 shadow-xs">
        <div className="flex items-center justify-between mb-3 border-b border-slate-100 pb-2">
          <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5 text-amber-900">
            <AlertCircle className="h-4 w-4 text-amber-600" />
            <span>Store Low Stock & Purchase Reorder Alerts</span>
          </h2>
          <button
            type="button"
            onClick={() => navigate('/inventory/purchase_requirements')}
            className="text-xs text-[#0e7d5a] font-semibold hover:underline"
          >
            Create Purchase Requirement →
          </button>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {criticalStockItems.map((item, i) => (
            <div key={i} className="p-3 rounded-lg border border-slate-200 bg-slate-50/70 space-y-1.5">
              <div className="flex justify-between items-start">
                <span className="text-xs font-semibold text-slate-900 leading-tight">{item.name}</span>
                <span
                  className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    item.status.includes('Out')
                      ? 'bg-rose-100 text-rose-800'
                      : 'bg-amber-100 text-amber-800'
                  }`}
                >
                  {item.status}
                </span>
              </div>
              <div className="text-[10px] text-slate-500">{item.category}</div>
              <div className="pt-1 flex justify-between text-xs text-slate-700">
                <span>Stock: <strong>{item.currentStock}</strong></span>
                <span className="text-slate-400 text-[10px]">Reorder: {item.reorderLevel}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
