import React, { useEffect, useState, useMemo } from 'react';
import {
  Loader2,
  Plus,
  X,
  Layers,
  ArrowDownLeft,
  ArrowUpRight,
  RotateCcw,
  AlertTriangle,
  Package,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import apiClient from '../services/apiClient';
import { pharmacyApi, MedicineRow } from '../services/pharmacyApi';
import { formatNumber, formatDateTime } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { PharmacyKpiHeader, KpiItem } from '../components/PharmacyKpiHeader';
import { PharmacyDataTable, Column } from '../components/PharmacyDataTable';

const TYPE_CONFIG: Record<string, { label: string; style: string }> = {
  PURCHASE_IN: { label: 'Purchase In', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  POS_SALE_OUT: { label: 'POS Sale Out', style: 'bg-blue-50 text-blue-700 border-blue-200' },
  HMS_DISPENSE_OUT: { label: 'HMS Dispense Out', style: 'bg-purple-50 text-purple-700 border-purple-200' },
  SALES_RETURN_IN: { label: 'Sales Return In', style: 'bg-teal-50 text-teal-700 border-teal-200' },
  PURCHASE_RETURN_OUT: { label: 'Purchase Return Out', style: 'bg-amber-50 text-amber-700 border-amber-200' },
  POSITIVE_ADJUSTMENT: { label: 'Positive Adjustment', style: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  NEGATIVE_ADJUSTMENT: { label: 'Negative Adjustment', style: 'bg-rose-50 text-rose-700 border-rose-200' },
  OPENING_STOCK: { label: 'Opening Stock', style: 'bg-slate-100 text-slate-700 border-slate-200' },
};

const ADJUSTMENT_TYPES = [
  { value: 'DAMAGE', label: 'Damage / Breakage' },
  { value: 'EXPIRY', label: 'Expiry Disposal' },
  { value: 'COUNT_CORRECTION', label: 'Physical Count Correction' },
  { value: 'LOSS', label: 'Loss / Pilferage' },
  { value: 'SURPLUS', label: 'Physical Surplus Found' },
  { value: 'QUARANTINE', label: 'Quarantine / Recall' },
];

export const StockMovementsPage: React.FC<{ canAdjust: boolean }> = ({ canAdjust }) => {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [medicines, setMedicines] = useState<MedicineRow[]>([]);
  const [showAdjust, setShowAdjust] = useState(false);
  const [form, setForm] = useState({ medicineId: '', type: 'DAMAGE', quantity: '', reason: '' });
  const [saving, setSaving] = useState(false);

  // Filter
  const [typeFilter, setTypeFilter] = useState('ALL');

  const load = () => {
    setLoading(true);
    apiClient
      .get('/pharmacy/stock-movements')
      .then((r) => setRows(r.data.data))
      .catch(() => toast.error('Failed to load stock movements.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    pharmacyApi.listMedicines().then(setMedicines);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Top KPI calculations
  const totalMovements = rows.length;
  const inwardCount = rows.filter((r) =>
    ['PURCHASE_IN', 'SALES_RETURN_IN', 'POSITIVE_ADJUSTMENT', 'OPENING_STOCK'].includes(r.movementType)
  ).length;
  const outwardCount = rows.filter((r) =>
    ['POS_SALE_OUT', 'HMS_DISPENSE_OUT', 'PURCHASE_RETURN_OUT', 'NEGATIVE_ADJUSTMENT'].includes(r.movementType)
  ).length;
  const adjustmentCount = rows.filter((r) =>
    ['POSITIVE_ADJUSTMENT', 'NEGATIVE_ADJUSTMENT'].includes(r.movementType)
  ).length;

  const kpis: KpiItem[] = [
    {
      label: 'Total Stock Movements',
      value: totalMovements,
      icon: Layers,
      subtitle: 'Complete physical audit trail',
      tone: 'info',
    },
    {
      label: 'Inward Receipts',
      value: inwardCount,
      icon: TrendingUp,
      subtitle: 'Purchases, returns & stock additions',
      tone: 'success',
    },
    {
      label: 'Outward Dispenses',
      value: outwardCount,
      icon: TrendingDown,
      subtitle: 'Sales & inpatient fulfillment',
      tone: 'default',
    },
    {
      label: 'Adjustments Posted',
      value: adjustmentCount,
      icon: AlertTriangle,
      subtitle: 'Damage, expiry & corrections',
      tone: adjustmentCount > 0 ? 'warning' : 'default',
    },
  ];

  const handleAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.medicineId || !Number(form.quantity) || !form.reason.trim()) {
      toast.error('Medicine, quantity and reason are required.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.post('/pharmacy/stock-adjustments', {
        medicineId: form.medicineId,
        type: form.type,
        quantity: Number(form.quantity),
        reason: form.reason.trim(),
      });
      toast.success('Stock adjustment posted successfully.');
      setShowAdjust(false);
      setForm({ medicineId: '', type: 'DAMAGE', quantity: '', reason: '' });
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to post adjustment.');
    } finally {
      setSaving(false);
    }
  };

  const filteredRows = useMemo(() => {
    if (typeFilter === 'ALL') return rows;
    return rows.filter((r) => r.movementType === typeFilter);
  }, [rows, typeFilter]);

  const columns: Column<any>[] = [
    {
      key: 'createdAt',
      header: 'Date & Time',
      width: '150px',
      render: (m) => (
        <span className="text-xs text-slate-700 whitespace-nowrap">
          {formatDateTime(m.createdAt)}
        </span>
      ),
    },
    {
      key: 'movementType',
      header: 'Movement Type',
      width: '160px',
      render: (m) => {
        const conf = TYPE_CONFIG[m.movementType] || { label: m.movementType, style: 'bg-slate-100 text-slate-700' };
        return (
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${conf.style}`}>
            {conf.label}
          </span>
        );
      },
    },
    {
      key: 'medicine',
      header: 'Medicine & Formulation',
      render: (m) => (
        <div>
          <div className="font-bold text-slate-900 text-xs">{m.medicine?.name || '—'}</div>
          {m.medicine?.code && (
            <div className="text-[10px] text-slate-400 font-mono">{m.medicine.code}</div>
          )}
        </div>
      ),
    },
    {
      key: 'batch',
      header: 'Batch No',
      width: '120px',
      render: (m) => (
        <span className="font-mono text-xs text-slate-600">
          {m.batch?.batchNumber || <span className="text-slate-400 font-sans">—</span>}
        </span>
      ),
    },
    {
      key: 'quantityDelta',
      header: 'Quantity Delta',
      align: 'right',
      width: '130px',
      render: (m) => {
        const delta = Number(m.quantityDelta || 0);
        const isPos = delta >= 0;
        return (
          <span
            className={`font-black tabular-nums text-xs ${
              isPos ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {isPos ? '+' : ''}
            {formatNumber(delta)}
          </span>
        );
      },
    },
    {
      key: 'actor',
      header: 'Logged By',
      render: (m) => (
        <span className="text-xs text-slate-700">
          {m.actor?.fullName || m.actor?.username || 'System'}
        </span>
      ),
    },
  ];

  return (
    <div className="p-5 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Stock Movement Center
            </h1>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Perpetual Ledger
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Every inventory receipt, POS sale, inpatient fulfillment, and approved adjustment.
          </p>
        </div>

        {canAdjust && (
          <button
            type="button"
            onClick={() => setShowAdjust(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" /> New Approved Adjustment
          </button>
        )}
      </div>

      {/* KPI Cards */}
      <PharmacyKpiHeader items={kpis} />

      {/* Main Table */}
      <PharmacyDataTable
        columns={columns}
        data={filteredRows}
        loading={loading}
        searchPlaceholder="Search by medicine name, batch number, or actor…"
        searchFilter={(m, q) =>
          (m.medicine?.name && m.medicine.name.toLowerCase().includes(q)) ||
          (m.batch?.batchNumber && m.batch.batchNumber.toLowerCase().includes(q)) ||
          (m.actor?.fullName && m.actor.fullName.toLowerCase().includes(q)) ||
          (m.actor?.username && m.actor.username.toLowerCase().includes(q))
        }
        onRefresh={load}
        filterControls={
          <div className="w-48">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full h-9 px-2.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
            >
              <option value="ALL">All Movement Types</option>
              <option value="PURCHASE_IN">Purchase Inwards</option>
              <option value="POS_SALE_OUT">POS Retail Sales</option>
              <option value="HMS_DISPENSE_OUT">HMS Inpatient Dispenses</option>
              <option value="SALES_RETURN_IN">Sales Returns</option>
              <option value="PURCHASE_RETURN_OUT">Purchase Returns</option>
              <option value="POSITIVE_ADJUSTMENT">Positive Adjustments</option>
              <option value="NEGATIVE_ADJUSTMENT">Negative Adjustments</option>
            </select>
          </div>
        }
        emptyTitle="No Movements Found"
        emptyDescription="No stock movement records match your filter criteria."
      />

      {/* Adjustment Modal */}
      {showAdjust && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-emerald-400" />
                Record Stock Adjustment
              </h3>
              <button
                type="button"
                onClick={() => setShowAdjust(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleAdjust} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Medicine Item *
                </label>
                <select
                  value={form.medicineId}
                  onChange={(e) => setForm({ ...form, medicineId: e.target.value })}
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                >
                  <option value="">Select medicine from formulary…</option>
                  {medicines.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.name} ({m.code}) — {m.currentStock} {m.unit} in stock
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Adjustment Reason *
                  </label>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg font-medium focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  >
                    {ADJUSTMENT_TYPES.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.quantity}
                    onChange={(e) => setForm({ ...form, quantity: e.target.value })}
                    placeholder="e.g. 5"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg font-bold text-slate-900 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Audit Notes / Explanation *
                </label>
                <textarea
                  rows={3}
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Detail the circumstances of this adjustment for compliance audit…"
                  className="w-full p-2.5 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAdjust(false)}
                  className="px-4 py-2 font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 transition-colors flex items-center gap-1.5"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Post Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
