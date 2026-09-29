import React, { useEffect, useState, useMemo } from 'react';
import {
  Loader2,
  Plus,
  Search,
  X,
  Pill,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Package,
  Layers,
} from 'lucide-react';
import { pharmacyApi, MedicineRow } from '../services/pharmacyApi';
import { formatPKR, formatNumber } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { PharmacyKpiHeader, KpiItem } from '../components/PharmacyKpiHeader';
import { PharmacyDataTable, Column } from '../components/PharmacyDataTable';

const emptyForm = {
  code: '',
  name: '',
  category: '',
  unit: 'Tablet',
  batchManaged: true,
  reorderLevel: '10',
  saleRate: '0',
  taxPercent: '0',
};

export const MedicinesPage: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const toast = useToast();
  const [rows, setRows] = useState<MedicineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  // Category filter
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [stockStatusFilter, setStockStatusFilter] = useState('ALL');

  const load = () => {
    setLoading(true);
    pharmacyApi
      .listMedicines(search || undefined)
      .then(setRows)
      .catch(() => toast.error('Failed to load medicines catalogue.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  // Categories list
  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort();
  }, [rows]);

  // Top KPI calculations
  const totalItems = rows.length;
  const outOfStockCount = rows.filter((r) => r.isOutOfStock).length;
  const lowStockCount = rows.filter((r) => r.isLowStock && !r.isOutOfStock).length;
  const normalStockCount = rows.filter((r) => !r.isOutOfStock && !r.isLowStock).length;

  const kpis: KpiItem[] = [
    {
      label: 'Total Formulary Items',
      value: totalItems,
      icon: Pill,
      subtitle: `${categories.length} therapeutic categories`,
      tone: 'info',
    },
    {
      label: 'Sufficient Stock',
      value: normalStockCount,
      icon: CheckCircle2,
      subtitle: 'Above reorder threshold',
      tone: 'success',
    },
    {
      label: 'Low Stock Items',
      value: lowStockCount,
      icon: AlertTriangle,
      subtitle: 'Reorder required soon',
      tone: lowStockCount > 0 ? 'warning' : 'default',
    },
    {
      label: 'Out of Stock Items',
      value: outOfStockCount,
      icon: AlertCircle,
      subtitle: 'Urgent procurement needed',
      tone: outOfStockCount > 0 ? 'danger' : 'success',
    },
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim() || !form.unit.trim()) {
      toast.error('Code, Name, and Unit are required.');
      return;
    }
    setSaving(true);
    try {
      await pharmacyApi.createMedicine({
        code: form.code.trim(),
        name: form.name.trim(),
        category: form.category.trim() || undefined,
        unit: form.unit.trim(),
        batchManaged: form.batchManaged,
        reorderLevel: Number(form.reorderLevel) || 0,
        saleRate: Number(form.saleRate) || 0,
        taxPercent: Number(form.taxPercent) || 0,
      });
      toast.success(`Medicine "${form.name}" added to formulary.`);
      setShowModal(false);
      setForm(emptyForm);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to create medicine.');
    } finally {
      setSaving(false);
    }
  };

  // Filtered dataset
  const filteredRows = useMemo(() => {
    return rows.filter((m) => {
      if (categoryFilter !== 'ALL' && m.category !== categoryFilter) return false;
      if (stockStatusFilter === 'OUT' && !m.isOutOfStock) return false;
      if (stockStatusFilter === 'LOW' && (!m.isLowStock || m.isOutOfStock)) return false;
      if (stockStatusFilter === 'OK' && (m.isOutOfStock || m.isLowStock)) return false;
      return true;
    });
  }, [rows, categoryFilter, stockStatusFilter]);

  const columns: Column<MedicineRow>[] = [
    {
      key: 'code',
      header: 'Item Code',
      width: '120px',
      render: (m) => <span className="font-mono text-xs font-bold text-slate-800">{m.code}</span>,
    },
    {
      key: 'name',
      header: 'Medicine Name & Category',
      render: (m) => (
        <div>
          <div className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
            <Pill className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>{m.name}</span>
          </div>
          {m.category && (
            <div className="text-[10px] text-slate-400 mt-0.5 pl-5">
              Category: <span className="font-medium text-slate-600">{m.category}</span>
            </div>
          )}
        </div>
      ),
    },
    {
      key: 'unit',
      header: 'Unit / Packaging',
      width: '120px',
      render: (m) => (
        <span className="text-xs text-slate-700 bg-slate-100 px-2 py-0.5 rounded font-medium">
          {m.unit}
        </span>
      ),
    },
    {
      key: 'saleRate',
      header: 'Sale Rate (PKR)',
      align: 'right',
      width: '130px',
      render: (m) => (
        <span className="font-bold tabular-nums text-xs text-slate-900">
          {formatPKR(m.saleRate)}
        </span>
      ),
    },
    {
      key: 'currentStock',
      header: 'Current Stock',
      align: 'right',
      width: '140px',
      render: (m) => {
        const stock = Number(m.currentStock || 0);
        return (
          <span
            className={`font-extrabold tabular-nums text-xs ${
              m.isOutOfStock
                ? 'text-rose-700'
                : m.isLowStock
                ? 'text-amber-700'
                : 'text-emerald-800'
            }`}
          >
            {formatNumber(stock)} {m.unit}
          </span>
        );
      },
    },
    {
      key: 'reorderLevel',
      header: 'Reorder Level',
      align: 'center',
      width: '120px',
      render: (m) => (
        <span className="text-xs text-slate-500 tabular-nums">
          {formatNumber(m.reorderLevel)} {m.unit}
        </span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      align: 'center',
      width: '110px',
      render: (m) => {
        if (m.isOutOfStock) {
          return (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200 uppercase tracking-wider">
              Out of Stock
            </span>
          );
        }
        if (m.isLowStock) {
          return (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200 uppercase tracking-wider">
              Low Stock
            </span>
          );
        }
        return (
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 uppercase tracking-wider">
            In Stock
          </span>
        );
      },
    },
  ];

  return (
    <div className="p-5 sm:p-6 space-y-5 max-w-7xl mx-auto">
      {/* Page Title */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">
              Medicine Stock &amp; Formulary
            </h1>
            <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200">
              Inventory Master
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Real-time medicine balances, FEFO batch tracking, retail prices, and reorder warnings.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-xl shadow-xs transition-colors"
          >
            <Plus className="h-4 w-4" /> Add New Medicine
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
        searchPlaceholder="Search medicine name, item code, barcode…"
        searchFilter={(m, q) =>
          m.name.toLowerCase().includes(q) ||
          m.code.toLowerCase().includes(q) ||
          (m.category && m.category.toLowerCase().includes(q))
        }
        onRefresh={load}
        filterControls={
          <>
            <div className="w-40">
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full h-9 px-2.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
              >
                <option value="ALL">All Categories</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div className="w-36">
              <select
                value={stockStatusFilter}
                onChange={(e) => setStockStatusFilter(e.target.value)}
                className="w-full h-9 px-2.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
              >
                <option value="ALL">All Statuses</option>
                <option value="OK">In Stock Only</option>
                <option value="LOW">Low Stock</option>
                <option value="OUT">Out of Stock</option>
              </select>
            </div>
          </>
        }
        emptyTitle="No Medicines Found"
        emptyDescription="No medicine in the inventory matches your filter criteria."
      />

      {/* Add Medicine Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-900 text-white">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Pill className="h-4 w-4 text-emerald-400" />
                Add Medicine to Formulary
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSave} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Medicine Code *
                  </label>
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. MED-010"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Unit / Form *
                  </label>
                  <input
                    value={form.unit}
                    onChange={(e) => setForm({ ...form, unit: e.target.value })}
                    placeholder="e.g. Tablet, Syrup, Ampoule"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Medicine Name &amp; Strength *
                </label>
                <input
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Augmentin 625mg Tablet"
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg font-semibold focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Therapeutic Category
                </label>
                <input
                  value={form.category}
                  onChange={(e) => setForm({ ...form, category: e.target.value })}
                  placeholder="e.g. Antibiotics, Analgesics, Cardiac"
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                />
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Sale Rate (PKR) *
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.saleRate}
                    onChange={(e) => setForm({ ...form, saleRate: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg font-bold focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Tax / GST %
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.taxPercent}
                    onChange={(e) => setForm({ ...form, taxPercent: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Reorder Alert Qty
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.reorderLevel}
                    onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={form.batchManaged}
                  onChange={(e) => setForm({ ...form, batchManaged: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Batch-managed inventory (FEFO First-Expiry-First-Out)</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
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
                  Save Medicine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
