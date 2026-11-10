import React, { useEffect, useState } from 'react';
import {
  Package,
  Truck,
  ArrowRight,
  AlertTriangle,
  RefreshCw,
  Building2,
  DollarSign,
  SlidersHorizontal,
  FileBarChart,
  Plus,
  Share2,
  CheckCircle2,
  Boxes,
  Layers,
} from 'lucide-react';
import { formatPKR, formatDateTimeDDMMYYYY, formatShortRef } from '../../utils/formatters';
import { useRouter } from '../../context/RouterContext';
import { useAuth } from '../../context/AuthContext';
import { inventoryApiService, BackendStockItem } from '../../services/inventoryApiService';
import { inventoryReportsApiService } from '../../services/inventoryReportsApiService';

export const InventoryDashboard: React.FC = () => {
  const { navigate } = useRouter();
  const { currentUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<BackendStockItem[]>([]);
  const [purchases, setPurchases] = useState<any[]>([]);
  const [departmentIssues, setDepartmentIssues] = useState<any[]>([]);
  const [summaryData, setSummaryData] = useState<{
    totalItems: number;
    totalStockValue: number;
    lowStockCount: number;
    outOfStockCount: number;
    purchasesInRangeAmount: number;
    issuesInRangeCount: number;
    supplierPayable: number;
  }>({
    totalItems: 0,
    totalStockValue: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    purchasesInRangeAmount: 0,
    issuesInRangeCount: 0,
    supplierPayable: 0,
  });

  const loadData = async () => {
    setLoading(true);
    try {
      const [itemsRes, summaryRes, purchasesRes, deptRes] = await Promise.all([
        inventoryApiService.getStockItems().catch(() => []),
        inventoryReportsApiService.getSummary({ preset: 'all' }).catch(() => null),
        inventoryReportsApiService.getPurchases({ preset: 'all' }).catch(() => ({ rows: [] })),
        inventoryReportsApiService.getDepartmentIssueReturn({ preset: 'all' }).catch(() => ({ rows: [] })),
      ]);

      const loadedItems: BackendStockItem[] = Array.isArray(itemsRes) ? itemsRes : [];
      setItems(loadedItems);

      const loadedPurchases = purchasesRes?.rows || [];
      setPurchases(loadedPurchases);

      const loadedIssues = deptRes?.rows || [];
      setDepartmentIssues(loadedIssues);

      const lowCount = loadedItems.filter(
        (i) => Number(i.currentStock) <= Number(i.reorderLevel) && Number(i.currentStock) > 0
      ).length;
      const outCount = loadedItems.filter((i) => Number(i.currentStock) <= 0).length;

      if (summaryRes) {
        setSummaryData({
          totalItems: summaryRes.totalItems || loadedItems.length,
          totalStockValue: Number(summaryRes.totalStockValue || 0),
          lowStockCount: summaryRes.lowStockCount ?? lowCount,
          outOfStockCount: summaryRes.outOfStockCount ?? outCount,
          purchasesInRangeAmount: Number(summaryRes.purchasesInRangeAmount || 0),
          issuesInRangeCount: summaryRes.issuesInRangeCount || loadedIssues.length,
          supplierPayable: Number(summaryRes.supplierPayable || 0),
        });
      } else {
        setSummaryData({
          totalItems: loadedItems.length,
          totalStockValue: 0,
          lowStockCount: lowCount,
          outOfStockCount: outCount,
          purchasesInRangeAmount: loadedPurchases.reduce((s: number, p: any) => s + Number(p.totalAmount || 0), 0),
          issuesInRangeCount: loadedIssues.length,
          supplierPayable: 0,
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const criticalItems = items
    .filter((i) => Number(i.currentStock) <= Number(i.reorderLevel))
    .slice(0, 6);

  return (
    <div className="space-y-4">
      {/* 1. Header Toolbar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 flex items-center justify-center">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-sm font-bold text-slate-900 tracking-tight">
                Central Inventory & Store Management
              </h1>
              <span className="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 font-semibold px-2 py-0.5 rounded-full">
                Live Store
              </span>
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              Logged in as <strong className="text-slate-800">{currentUser?.name || 'Store Manager'}</strong> • Real-time stock status, receipts, issues and ledger
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={loadData}
            title="Refresh Store Data"
            className="p-2 rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition-colors cursor-pointer"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin text-emerald-600' : ''}`} />
          </button>
          <button
            type="button"
            onClick={() => navigate('/inventory/department_issue')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Share2 className="h-3.5 w-3.5 text-slate-500" />
            <span>Issue Stock</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/inventory/stock_in')}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#129b70] hover:bg-[#0e7d5a] text-white text-xs font-semibold shadow-2xs transition-colors cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>New Stock In</span>
          </button>
        </div>
      </div>

      {/* 2. Primary 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        {/* Card 1: Stock Items & Valuation */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Total Stock Valuation
            </span>
            <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
              <Boxes className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {formatPKR(summaryData.totalStockValue)}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">{summaryData.totalItems}</span>
              <span>Cataloged items in store</span>
            </div>
          </div>
        </div>

        {/* Card 2: Procurement / Stock In */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Procurement & Receipts
            </span>
            <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
              <Truck className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {formatPKR(summaryData.purchasesInRangeAmount)}
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">{purchases.length}</span>
              <span>Goods Receipt Notes (GRNs)</span>
            </div>
          </div>
        </div>

        {/* Card 3: Department Issues */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Department Issues
            </span>
            <div className="p-2 rounded-lg bg-purple-50 text-purple-700">
              <Layers className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 tracking-tight">
              {departmentIssues.length} Dispatches
            </div>
            <div className="text-xs text-slate-500 mt-1 flex items-center gap-1.5">
              <span className="font-semibold text-slate-700">{summaryData.issuesInRangeCount}</span>
              <span>Requisitions fulfilled</span>
            </div>
          </div>
        </div>

        {/* Card 4: Low Stock Alerts */}
        <div className="bg-white p-4 rounded-xl border border-slate-200/80 shadow-2xs flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Stock Reorder Alerts
            </span>
            <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
              <AlertTriangle className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="text-xl font-bold text-slate-900 tracking-tight flex items-center gap-2">
              <span>{summaryData.lowStockCount + summaryData.outOfStockCount} Items</span>
            </div>
            <div className="text-xs mt-1 flex items-center gap-2">
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-100">
                {summaryData.outOfStockCount} Out
              </span>
              <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-amber-50 text-amber-700 border border-amber-100">
                {summaryData.lowStockCount} Low
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Main Dashboard Grid (Left: Tables, Right: Critical Alerts & Shortcuts) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Side: 8 Columns */}
        <div className="lg:col-span-8 space-y-4">
          {/* Recent Purchases & Goods Receipts (GRN) */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Recent Goods Received Notes (GRN)
                </h2>
                <p className="text-[11px] text-slate-500">Inward supplier consignments and purchase invoices</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/inventory/stock_in')}
                className="text-xs text-[#129b70] hover:text-[#0e7d5a] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200/80 text-[11px]">
                    <th className="py-2.5 px-3.5 font-semibold">GRN Ref</th>
                    <th className="py-2.5 px-3 font-semibold">Supplier</th>
                    <th className="py-2.5 px-3 font-semibold">Items</th>
                    <th className="py-2.5 px-3 font-semibold text-right">Amount</th>
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                    <th className="py-2.5 px-3.5 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {purchases.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-6 text-center text-slate-400 text-xs italic">
                        No goods received yet. Click "+ New Stock In" to add the first purchase.
                      </td>
                    </tr>
                  ) : (
                    purchases.slice(0, 5).map((p: any) => (
                      <tr key={p.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3.5 font-mono font-bold text-emerald-800">
                          <span className="bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-100">
                            {formatShortRef(p.invoiceReference, p.id, 'GRN')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900 truncate max-w-[160px]">
                          {p.supplier?.name || 'Supplier'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 truncate max-w-[150px]">
                          {p.lines?.[0]?.stockItem?.name ? (
                            <span>
                              {p.lines[0].stockItem.name}
                              {p.lines.length > 1 && (
                                <span className="text-[10px] text-slate-400 ml-1">
                                  (+{p.lines.length - 1} more)
                                </span>
                              )}
                            </span>
                          ) : (
                            '1 Item'
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-mono font-bold text-slate-900 text-right">
                          {formatPKR(p.totalAmount)}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                          {formatDateTimeDDMMYYYY(p.createdAt)}
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                            <CheckCircle2 className="h-2.5 w-2.5" />
                            <span>Received</span>
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Recent Department Stock Issues */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs overflow-hidden">
            <div className="p-3.5 border-b border-slate-100 flex items-center justify-between">
              <div>
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Recent Department Issues
                </h2>
                <p className="text-[11px] text-slate-500">Stock issued to hospital wards, OT, and clinics</p>
              </div>
              <button
                type="button"
                onClick={() => navigate('/inventory/department_issue')}
                className="text-xs text-[#129b70] hover:text-[#0e7d5a] font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <span>View All</span>
                <ArrowRight className="h-3 w-3" />
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 text-slate-600 border-b border-slate-200/80 text-[11px]">
                    <th className="py-2.5 px-3.5 font-semibold">Voucher</th>
                    <th className="py-2.5 px-3 font-semibold">Department</th>
                    <th className="py-2.5 px-3 font-semibold">Issued Items</th>
                    <th className="py-2.5 px-3 font-semibold">Date</th>
                    <th className="py-2.5 px-3.5 font-semibold text-center">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {departmentIssues.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-6 text-center text-slate-400 text-xs italic">
                        No department issues recorded yet.
                      </td>
                    </tr>
                  ) : (
                    departmentIssues.slice(0, 5).map((iss: any) => (
                      <tr key={iss.id} className="hover:bg-slate-50/70 transition-colors">
                        <td className="py-2.5 px-3.5 font-mono font-bold text-blue-800">
                          <span className="bg-blue-50 px-1.5 py-0.5 rounded border border-blue-100">
                            {formatShortRef(iss.voucherNo, iss.id, 'ISS')}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-medium text-slate-900">
                          {iss.department || iss.department?.name || 'Department'}
                        </td>
                        <td className="py-2.5 px-3 text-slate-600 truncate max-w-[200px]">
                          {iss.lines?.[0] ? (
                            <span>
                              {iss.lines[0].item || iss.lines[0].stockItem?.name || 'Item'} (
                              {iss.lines[0].issuedQty ?? iss.lines[0].quantity} {iss.lines[0].unit || ''})
                              {iss.lines.length > 1 && (
                                <span className="text-[10px] text-slate-400 ml-1">
                                  +{iss.lines.length - 1} more
                                </span>
                              )}
                            </span>
                          ) : (
                            '1 Item'
                          )}
                        </td>
                        <td className="py-2.5 px-3 text-slate-500 font-mono text-[11px]">
                          {formatDateTimeDDMMYYYY(iss.issuedAt)}
                        </td>
                        <td className="py-2.5 px-3.5 text-center">
                          <span className="inline-flex items-center text-[10px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">
                            {iss.status || 'ISSUED'}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Side: 4 Columns */}
        <div className="lg:col-span-4 space-y-4">
          {/* Critical Stock & Reorder Alerts */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4">
            <div className="flex items-center justify-between mb-3 pb-2 border-b border-slate-100">
              <div className="flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Reorder Alerts
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/inventory/stock_overview')}
                className="text-[11px] text-[#129b70] hover:underline font-semibold"
              >
                All Stock →
              </button>
            </div>

            {criticalItems.length === 0 ? (
              <div className="py-6 text-center text-slate-400 text-xs italic">
                <CheckCircle2 className="h-6 w-6 text-emerald-500 mx-auto mb-1 opacity-70" />
                All stock levels are optimal.
              </div>
            ) : (
              <div className="space-y-2">
                {criticalItems.map((item) => {
                  const isOut = Number(item.currentStock) <= 0;
                  return (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-lg border border-slate-200/80 bg-slate-50/50 hover:bg-slate-50 transition-colors flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-slate-900 truncate">
                            {item.name}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-0.5 font-mono">
                          <span>
                            On-Hand: <strong className={isOut ? 'text-rose-600' : 'text-amber-700'}>{item.currentStock}</strong>
                          </span>
                          <span>•</span>
                          <span>Reorder: {item.reorderLevel} {item.unit}</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => navigate('/inventory/stock_in')}
                        className={`text-[10px] font-semibold px-2 py-1 rounded transition-colors cursor-pointer shrink-0 ${
                          isOut
                            ? 'bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100'
                            : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'
                        }`}
                      >
                        + Order
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Quick Management Shortcuts */}
          <div className="bg-white rounded-xl border border-slate-200/80 shadow-2xs p-4 space-y-2.5">
            <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
              Store Quick Links
            </h2>

            <button
              type="button"
              onClick={() => navigate('/inventory/supplier_ledger')}
              className="w-full p-2.5 rounded-lg border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50/40 text-left transition-all flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-md bg-slate-100 group-hover:bg-emerald-100 text-slate-700 group-hover:text-emerald-800 transition-colors">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">Supplier Ledger</div>
                  <div className="text-[10px] text-slate-500">Payables & transaction history</div>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-700 transition-colors" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/inventory/adjustment')}
              className="w-full p-2.5 rounded-lg border border-slate-200 hover:border-purple-300 hover:bg-purple-50/40 text-left transition-all flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-md bg-slate-100 group-hover:bg-purple-100 text-slate-700 group-hover:text-purple-800 transition-colors">
                  <SlidersHorizontal className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">Stock Adjustments</div>
                  <div className="text-[10px] text-slate-500">Damage, expiry & corrections</div>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-purple-700 transition-colors" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/inventory/petty_cash_expenses')}
              className="w-full p-2.5 rounded-lg border border-slate-200 hover:border-amber-300 hover:bg-amber-50/40 text-left transition-all flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-md bg-slate-100 group-hover:bg-amber-100 text-slate-700 group-hover:text-amber-800 transition-colors">
                  <DollarSign className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">Petty Cash & Expenses</div>
                  <div className="text-[10px] text-slate-500">Daily store operational cash</div>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-amber-700 transition-colors" />
            </button>

            <button
              type="button"
              onClick={() => navigate('/inventory/inventory_summary')}
              className="w-full p-2.5 rounded-lg border border-slate-200 hover:border-blue-300 hover:bg-blue-50/40 text-left transition-all flex items-center justify-between cursor-pointer group"
            >
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-md bg-slate-100 group-hover:bg-blue-100 text-slate-700 group-hover:text-blue-800 transition-colors">
                  <FileBarChart className="h-4 w-4" />
                </div>
                <div>
                  <div className="text-xs font-semibold text-slate-900">Inventory Reports</div>
                  <div className="text-[10px] text-slate-500">Exports, movement & audit</div>
                </div>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-slate-400 group-hover:text-blue-700 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
