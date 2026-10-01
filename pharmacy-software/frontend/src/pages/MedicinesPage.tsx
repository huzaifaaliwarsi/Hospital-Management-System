import React, { useEffect, useState, useMemo, useRef } from 'react';
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
  Filter,
  RotateCcw,
  FileSpreadsheet,
  Download,
  FileText,
  Printer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Pencil,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar,
  Building2,
  BadgeCheck,
} from 'lucide-react';
import { pharmacyApi, MedicineRow, Unit, MedicineCategory } from '../services/pharmacyApi';
import { formatPKR, formatNumber } from '../utils/format';
import { useToast } from '../context/ToastContext';
import { PharmacyKpiHeader, KpiItem } from '../components/PharmacyKpiHeader';
import { MedicinePackagingFields, PackagingLevelForm, computeFlatConversions, flatToRelativeLevels } from '../components/MedicinePackagingFields';

const DOSAGE_FORM_OPTIONS = ['Tablet', 'Capsule', 'Syrup', 'Injection', 'Cream', 'Ointment', 'Drops', 'Suspension', 'Inhaler', 'Sachet'];

const emptyForm = {
  code: '',
  barcode: '',
  name: '',
  genericName: '',
  strength: '',
  dosageForm: '',
  categoryId: '',
  batchManaged: true,
  reorderLevel: '10',
  saleRate: '',
  taxPercent: '0',
};

const emptyPackaging = {
  baseUnitId: '',
  defaultPurchaseUnitId: '',
  baseIsSaleUnit: true,
  levels: [] as PackagingLevelForm[],
};

type SortField = 'code' | 'name' | 'category' | 'unit' | 'saleRate' | 'currentStock' | 'reorderLevel' | 'stockValue' | 'status';
type SortOrder = 'asc' | 'desc';

export const MedicinesPage: React.FC<{ canEdit: boolean }> = ({ canEdit }) => {
  const toast = useToast();
  const [rows, setRows] = useState<MedicineRow[]>([]);
  const [loading, setLoading] = useState(true);

  // Filter toolbar state (Top bar)
  const [searchInput, setSearchInput] = useState('');
  const [categoryInput, setCategoryInput] = useState('ALL');
  const [stockStatusInput, setStockStatusInput] = useState('ALL');
  const [unitInput, setUnitInput] = useState('ALL');

  // Applied filters (Triggered when user clicks "Filter" or resets)
  const [appliedFilters, setAppliedFilters] = useState({
    search: '',
    category: 'ALL',
    stockStatus: 'ALL',
    unit: 'ALL',
  });

  // Table In-Results quick search
  const [inResultSearch, setInResultSearch] = useState('');

  // Sorting
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showBatchesModal, setShowBatchesModal] = useState(false);
  const [selectedMedicine, setSelectedMedicine] = useState<MedicineRow | null>(null);
  const [medicineBatches, setMedicineBatches] = useState<any[]>([]);
  const [loadingBatches, setLoadingBatches] = useState(false);

  const [form, setForm] = useState(emptyForm);
  const [packaging, setPackaging] = useState(emptyPackaging);
  const [unitCatalog, setUnitCatalog] = useState<Unit[]>([]);
  const [loadingPackaging, setLoadingPackaging] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loadingNextCode, setLoadingNextCode] = useState(false);

  // Dual Synchronized Scrollbars Refs
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);
  const [tableScrollWidth, setTableScrollWidth] = useState(1300);

  const syncTopToBottom = () => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (topScrollRef.current && bottomScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const syncBottomToTop = () => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  useEffect(() => {
    if (bottomScrollRef.current) {
      setTableScrollWidth(bottomScrollRef.current.scrollWidth);
    }
  }, [rows, appliedFilters, inResultSearch, pageSize, currentPage]);

  const load = () => {
    setLoading(true);
    pharmacyApi
      .listMedicines(appliedFilters.search || undefined)
      .then((data) => {
        setRows(data);
      })
      .catch(() => toast.error('Failed to load medicines catalogue.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [appliedFilters.search]);

  useEffect(() => {
    pharmacyApi.listUnits().then(setUnitCatalog).catch(() => toast.error('Failed to load unit catalog.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Distinct categories and units from data
  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.category) set.add(r.category);
    });
    return Array.from(set).sort();
  }, [rows]);

  const units = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((r) => {
      if (r.unit) set.add(r.unit);
    });
    return Array.from(set).sort();
  }, [rows]);

  // Handle Apply Filter button click (First Red Box)
  const handleApplyFilter = () => {
    setAppliedFilters({
      search: searchInput.trim(),
      category: categoryInput,
      stockStatus: stockStatusInput,
      unit: unitInput,
    });
    setCurrentPage(1);
    toast.info('Filters applied to formulary list.');
  };

  // Handle Reset Filter button click
  const handleResetFilter = () => {
    setSearchInput('');
    setCategoryInput('ALL');
    setStockStatusInput('ALL');
    setUnitInput('ALL');
    setInResultSearch('');
    setAppliedFilters({
      search: '',
      category: 'ALL',
      stockStatus: 'ALL',
      unit: 'ALL',
    });
    setCurrentPage(1);
    toast.success('Filters cleared.');
  };

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
      tone: 'warning',
    },
    {
      label: 'Out of Stock Items',
      value: outOfStockCount,
      icon: AlertCircle,
      subtitle: 'Urgent procurement needed',
      tone: 'danger',
    },
  ];

  // Filtered & Sorted dataset
  const finalFilteredRows = useMemo(() => {
    return rows
      .filter((m) => {
        // Category filter
        if (appliedFilters.category !== 'ALL' && m.category !== appliedFilters.category) return false;
        // Stock status filter
        if (appliedFilters.stockStatus === 'OUT' && !m.isOutOfStock) return false;
        if (appliedFilters.stockStatus === 'LOW' && (!m.isLowStock || m.isOutOfStock)) return false;
        if (appliedFilters.stockStatus === 'OK' && (m.isOutOfStock || m.isLowStock)) return false;
        // Unit filter
        if (appliedFilters.unit !== 'ALL' && m.unit !== appliedFilters.unit) return false;
        // In-results search
        if (inResultSearch.trim()) {
          const q = inResultSearch.toLowerCase();
          const matches =
            m.name.toLowerCase().includes(q) ||
            m.code.toLowerCase().includes(q) ||
            (m.category && m.category.toLowerCase().includes(q)) ||
            m.unit.toLowerCase().includes(q);
          if (!matches) return false;
        }
        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'code') cmp = a.code.localeCompare(b.code);
        else if (sortField === 'name') cmp = a.name.localeCompare(b.name);
        else if (sortField === 'category') cmp = (a.category || '').localeCompare(b.category || '');
        else if (sortField === 'unit') cmp = a.unit.localeCompare(b.unit);
        else if (sortField === 'saleRate') cmp = Number(a.saleRate) - Number(b.saleRate);
        else if (sortField === 'currentStock') cmp = Number(a.currentStock) - Number(b.currentStock);
        else if (sortField === 'reorderLevel') cmp = Number(a.reorderLevel) - Number(b.reorderLevel);
        else if (sortField === 'stockValue') {
          const valA = Number(a.currentStock) * Number(a.saleRate);
          const valB = Number(b.currentStock) * Number(b.saleRate);
          cmp = valA - valB;
        } else if (sortField === 'status') {
          const rankA = a.isOutOfStock ? 2 : a.isLowStock ? 1 : 0;
          const rankB = b.isOutOfStock ? 2 : b.isLowStock ? 1 : 0;
          cmp = rankA - rankB;
        }
        return sortOrder === 'asc' ? cmp : -cmp;
      });
  }, [rows, appliedFilters, inResultSearch, sortField, sortOrder]);

  // Aggregate Totals for table footer (Matching Reference 2)
  const totalStockUnits = finalFilteredRows.reduce((sum, r) => sum + Number(r.currentStock || 0), 0);
  const totalStockValuation = finalFilteredRows.reduce(
    (sum, r) => sum + Number(r.currentStock || 0) * Number(r.saleRate || 0),
    0
  );
  const averageRate =
    finalFilteredRows.length > 0
      ? finalFilteredRows.reduce((sum, r) => sum + Number(r.saleRate || 0), 0) / finalFilteredRows.length
      : 0;

  // Pagination slice
  const totalPages = Math.max(1, Math.ceil(finalFilteredRows.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);
  const paginatedRows = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return finalFilteredRows.slice(start, start + pageSize);
  }, [finalFilteredRows, validPage, pageSize]);

  // Toggle sort order
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // View Batches Modal handler
  const handleOpenBatches = async (med: MedicineRow) => {
    setSelectedMedicine(med);
    setShowBatchesModal(true);
    setLoadingBatches(true);
    try {
      const batches = await pharmacyApi.getMedicineBatches(med.id);
      setMedicineBatches(batches || []);
    } catch {
      toast.error('Failed to load batches for this medicine.');
      setMedicineBatches([]);
    } finally {
      setLoadingBatches(false);
    }
  };

  // Edit Medicine Modal handler
  const handleOpenEdit = async (med: MedicineRow) => {
    setSelectedMedicine(med);
    setForm({
      code: med.code,
      barcode: med.barcode || '',
      name: med.name,
      genericName: med.genericName || '',
      strength: med.strength || '',
      dosageForm: med.dosageForm || '',
      category: med.category || '',
      batchManaged: med.batchManaged,
      reorderLevel: String(med.reorderLevel),
      saleRate: String(med.saleRate),
      taxPercent: String(med.taxPercent),
    });
    setPackaging(emptyPackaging);
    setShowEditModal(true);
    setLoadingPackaging(true);
    try {
      const { baseUnitId, levels } = await pharmacyApi.getMedicinePackaging(med.id);
      const baseLevel = levels.find((l) => l.level === 0);
      const extraLevels = levels.filter((l) => l.level > 0);
      const purchaseLevel = levels.find((l) => l.isPurchaseUnit);
      // Reverse the stored flat conversions back into the "1 Box = 10 Strip" relative chain the builder edits.
      const relativeLevels = flatToRelativeLevels(extraLevels.map((l) => ({ unitId: l.unitId, conversionToBase: Number(l.conversionToBase) })));
      const saleByUnitId = new Map(extraLevels.map((l) => [l.unitId, l.isSaleUnit]));
      setPackaging({
        baseUnitId,
        defaultPurchaseUnitId: purchaseLevel?.unitId ?? baseUnitId,
        baseIsSaleUnit: baseLevel?.isSaleUnit ?? true,
        levels: relativeLevels.map((l) => ({ ...l, isSaleUnit: saleByUnitId.get(l.unitId) ?? true })),
      });
    } catch {
      toast.error('Failed to load packaging details for this medicine.');
    } finally {
      setLoadingPackaging(false);
    }
  };

  // Validates the packaging-levels builder state before either save (medicine-packaging-plan).
  const validatePackaging = (): string | null => {
    if (!packaging.baseUnitId) return 'Base Stock Unit is required.';
    if (!packaging.defaultPurchaseUnitId) return 'Default Purchase Unit is required.';
    const seen = new Set<string>();
    for (const lvl of packaging.levels) {
      if (!lvl.unitId) return 'Every packaging level needs a unit selected.';
      if (seen.has(lvl.unitId)) return 'The same unit cannot appear twice in the packaging breakdown.';
      seen.add(lvl.unitId);
      if (!lvl.relativeQty || Number(lvl.relativeQty) <= 0) return 'Each packaging level\'s quantity must be greater than 0.';
    }
    if (!packaging.baseIsSaleUnit && !packaging.levels.some((l) => l.isSaleUnit)) return 'At least one unit must be marked sellable.';
    return null;
  };

  const packagingPayload = () => {
    const flat = computeFlatConversions(packaging.levels);
    return {
      baseUnitId: packaging.baseUnitId,
      baseIsPurchaseUnit: packaging.defaultPurchaseUnitId === packaging.baseUnitId,
      baseIsSaleUnit: packaging.baseIsSaleUnit,
      packagingLevels: packaging.levels.map((l) => ({
        unitId: l.unitId,
        conversionToBase: flat.get(l.unitId) ?? 0,
        isPurchaseUnit: l.unitId === packaging.defaultPurchaseUnitId,
        isSaleUnit: l.isSaleUnit,
      })),
    };
  };

  // Medicine Code auto-generate — backend-safe sequence (MED-0001…), still editable by an authorized user per the Medicine Master's explicit override exception.
  const handleAutoGenerateCode = () => {
    setLoadingNextCode(true);
    pharmacyApi
      .getNextMedicineCode()
      .then((code) => setForm((f) => ({ ...f, code })))
      .catch(() => toast.error('Failed to fetch next medicine code.'))
      .finally(() => setLoadingNextCode(false));
  };

  // Save new medicine
  const handleSaveNew = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.code.trim() || !form.name.trim()) {
      toast.error('Code and Name are required.');
      return;
    }
    const packagingError = validatePackaging();
    if (packagingError) {
      toast.error(packagingError);
      return;
    }
    setSaving(true);
    try {
      await pharmacyApi.createMedicine({
        code: form.code.trim(),
        barcode: form.barcode.trim() || undefined,
        name: form.name.trim(),
        genericName: form.genericName.trim() || undefined,
        strength: form.strength.trim() || undefined,
        dosageForm: form.dosageForm.trim() || undefined,
        category: form.category.trim() || undefined,
        batchManaged: form.batchManaged,
        reorderLevel: Number(form.reorderLevel) || 0,
        saleRate: form.saleRate.trim() ? Number(form.saleRate) : 0,
        taxPercent: Number(form.taxPercent) || 0,
        ...packagingPayload(),
      });
      toast.success(`Medicine "${form.name}" added to formulary.`);
      setShowAddModal(false);
      setForm(emptyForm);
      setPackaging(emptyPackaging);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to create medicine.');
    } finally {
      setSaving(false);
    }
  };

  // Update existing medicine
  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMedicine) return;
    if (!form.name.trim()) {
      toast.error('Name is required.');
      return;
    }
    const packagingError = validatePackaging();
    if (packagingError) {
      toast.error(packagingError);
      return;
    }
    setSaving(true);
    try {
      await pharmacyApi.updateMedicine(selectedMedicine.id, {
        name: form.name.trim(),
        barcode: form.barcode.trim() || undefined,
        genericName: form.genericName.trim() || undefined,
        strength: form.strength.trim() || undefined,
        dosageForm: form.dosageForm.trim() || undefined,
        category: form.category.trim() || undefined,
        batchManaged: form.batchManaged,
        reorderLevel: Number(form.reorderLevel) || 0,
        saleRate: form.saleRate.trim() ? Number(form.saleRate) : 0,
        taxPercent: Number(form.taxPercent) || 0,
        ...packagingPayload(),
      });
      toast.success(`Medicine "${form.name}" updated successfully.`);
      setShowEditModal(false);
      load();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to update medicine.');
    } finally {
      setSaving(false);
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (finalFilteredRows.length === 0) {
      toast.warning('No records to export.');
      return;
    }
    const headers = ['#', 'Item Code', 'Medicine Name', 'Category', 'Unit', 'Sale Rate (PKR)', 'Current Stock', 'Reorder Level', 'Stock Value (PKR)', 'Status'];
    const csvRows = [
      headers.join(','),
      ...finalFilteredRows.map((m, idx) => [
        idx + 1,
        `"${m.code}"`,
        `"${m.name.replace(/"/g, '""')}"`,
        `"${(m.category || '').replace(/"/g, '""')}"`,
        `"${m.unit}"`,
        m.saleRate,
        m.currentStock,
        m.reorderLevel,
        Number(m.currentStock) * Number(m.saleRate),
        `"${m.isOutOfStock ? 'OUT OF STOCK' : m.isLowStock ? 'LOW STOCK' : 'IN STOCK'}"`,
      ].join(',')),
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `medicine_inventory_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Inventory exported to CSV successfully.');
  };

  // Export to Excel (.xls HTML table)
  const handleExportExcel = () => {
    if (finalFilteredRows.length === 0) {
      toast.warning('No records to export.');
      return;
    }
    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/></head>
      <body>
        <h2>Medicine Stock & Formulary Register</h2>
        <table border="1">
          <tr style="background:#0e5944;color:#ffffff;font-weight:bold;">
            <th>#</th><th>Item Code</th><th>Medicine Name</th><th>Category</th><th>Unit</th><th>Sale Rate (PKR)</th><th>Current Stock</th><th>Reorder Level</th><th>Stock Value (PKR)</th><th>Status</th>
          </tr>
          ${finalFilteredRows.map((m, idx) => `
            <tr>
              <td>${idx + 1}</td>
              <td>${m.code}</td>
              <td>${m.name}</td>
              <td>${m.category || ''}</td>
              <td>${m.unit}</td>
              <td>${m.saleRate}</td>
              <td>${m.currentStock}</td>
              <td>${m.reorderLevel}</td>
              <td>${Number(m.currentStock) * Number(m.saleRate)}</td>
              <td>${m.isOutOfStock ? 'OUT OF STOCK' : m.isLowStock ? 'LOW STOCK' : 'IN STOCK'}</td>
            </tr>
          `).join('')}
          <tr style="background:#f1f5f9;font-weight:bold;">
            <td>TOTAL</td>
            <td>${finalFilteredRows.length} Items</td>
            <td colspan="4"></td>
            <td>${totalStockUnits}</td>
            <td></td>
            <td>${totalStockValuation}</td>
            <td></td>
          </tr>
        </table>
      </body>
      </html>
    `;
    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `medicine_inventory_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Inventory exported to Excel successfully.');
  };

  // Export to PDF / Print
  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-6 sm:p-8 space-y-6 max-w-[1700px] mx-auto">
      {/* ═════════════════════════════════════════════════════════════════════
          1. PAGE HEADER (Matches Portal Theme)
          ═════════════════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Medicine Stock &amp; Formulary
            </h1>
            <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200/80">
              Inventory Master
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time medicine balances, FEFO batch tracking, retail prices, and reorder warnings.
          </p>
        </div>

        {canEdit && (
          <button
            type="button"
            onClick={() => {
              setForm(emptyForm);
              setPackaging(emptyPackaging);
              setShowAddModal(true);
              handleAutoGenerateCode();
            }}
            className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-[#0e7d5a] hover:bg-[#0c6b50] rounded-xl shadow-xs transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add New Medicine
          </button>
        )}
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          2. KPI CARDS (With Colored Top Borders matching Reference)
          ═════════════════════════════════════════════════════════════════════ */}
      <PharmacyKpiHeader items={kpis} />

      {/* ═════════════════════════════════════════════════════════════════════
          3. FIRST RED BOX: FILTER & SEARCH CONTROL TOOLBAR
          ═════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white p-3 rounded-xl border border-slate-300/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[300px]">
          {/* Main search input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleApplyFilter()}
              placeholder="Search medicine name, item code, barcode…"
              className="w-full h-8.5 pl-8.5 pr-3 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] focus:border-[#0e7d5a] transition-colors"
            />
          </div>

          {/* Category Dropdown */}
          <div className="w-40">
            <select
              value={categoryInput}
              onChange={(e) => setCategoryInput(e.target.value)}
              className="w-full h-8.5 px-2.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] cursor-pointer"
            >
              <option value="ALL">All Categories</option>
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          {/* Stock Status Dropdown */}
          <div className="w-34">
            <select
              value={stockStatusInput}
              onChange={(e) => setStockStatusInput(e.target.value)}
              className="w-full h-8.5 px-2.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] cursor-pointer"
            >
              <option value="ALL">All Statuses</option>
              <option value="OK">In Stock Only</option>
              <option value="LOW">Low Stock</option>
              <option value="OUT">Out of Stock</option>
            </select>
          </div>

          {/* Dosage Form / Unit Dropdown */}
          <div className="w-32">
            <select
              value={unitInput}
              onChange={(e) => setUnitInput(e.target.value)}
              className="w-full h-8.5 px-2.5 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] cursor-pointer"
            >
              <option value="ALL">All Units</option>
              {units.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* ── First Red Box Action Buttons: Filter & Reset ── */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleApplyFilter}
            className="px-3.5 py-1.5 bg-[#0e7d5a] hover:bg-[#0c6b50] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap"
          >
            <Filter className="h-3.5 w-3.5" /> Filter
          </button>
          <button
            type="button"
            onClick={handleResetFilter}
            className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
            title="Reset Filters"
          >
            <RotateCcw className="h-3.5 w-3.5 text-slate-500" /> Reset
          </button>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          4. SECOND RED BOX: TABLE CONTAINER (COMPACT, LANDSCAPE SINGLE-LINE)
          ═════════════════════════════════════════════════════════════════════ */}
      <div className="bg-white rounded-2xl border border-slate-300/80 shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Dark Emerald Header Strip with Export Actions (Reference 2) */}
        <div className="bg-[#0e5944] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-300" />
            <span className="font-bold text-xs sm:text-sm tracking-tight text-white whitespace-nowrap">Medicine Formulary Register</span>
            <span className="text-[10px] font-semibold bg-emerald-700/60 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap">
              Active Formulary
            </span>
          </div>

          {/* Export Action Buttons matching Reference 2 */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              title="Download Excel Worksheet"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              title="Download CSV"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              title="Export as PDF via Print"
            >
              <FileText className="h-3.5 w-3.5" /> PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              title="Print Table"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
          </div>
        </div>

        {/* Search In Results Bar */}
        <div className="px-3.5 py-2 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="relative w-60 sm:w-68">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={inResultSearch}
              onChange={(e) => {
                setInResultSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search in results…"
              className="w-full h-7.5 pl-8 pr-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
            />
          </div>

          <div className="flex items-center gap-3 text-slate-500 font-medium text-xs">
            <span className="whitespace-nowrap">
              Showing <strong className="text-slate-800">{paginatedRows.length}</strong> of{' '}
              <strong className="text-slate-800">{finalFilteredRows.length}</strong> records
            </span>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-md px-2 py-0.5 text-xs text-slate-700 focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── TOP HORIZONTAL SCROLLER (Synchronized with bottom table) ── */}
        <div
          ref={topScrollRef}
          onScroll={syncTopToBottom}
          className="overflow-x-auto overflow-y-hidden h-2 bg-slate-100 border-b border-slate-200 scrollbar-thin"
        >
          <div style={{ width: `${tableScrollWidth}px`, height: '1px' }} />
        </div>

        {/* ── MAIN TABLE CONTAINER (Bottom Horizontal Scroller) ── */}
        <div
          ref={bottomScrollRef}
          onScroll={syncBottomToTop}
          className="overflow-x-auto max-h-[calc(100vh-370px)] scrollbar-thin"
        >
          <table className="w-full min-w-[1500px] border-collapse text-left text-xs">
            <thead className="bg-[#f8fafc] text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200 uppercase tracking-wider select-none text-xs">
              <tr>
                <th className="py-3 px-3.5 text-center w-14 border-r border-slate-200 whitespace-nowrap">#</th>

                {/* ITEM CODE */}
                <th
                  onClick={() => handleSort('code')}
                  className="py-3 px-4 border-r border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap w-36"
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span>ITEM CODE</span>
                    {sortField === 'code' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-[#0e7d5a]" /> : <ArrowDown className="h-3 w-3 text-[#0e7d5a]" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* MEDICINE NAME & CATEGORY */}
                <th
                  onClick={() => handleSort('name')}
                  className="py-3 px-4 border-r border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap min-w-[320px]"
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span>MEDICINE NAME &amp; CATEGORY</span>
                    {sortField === 'name' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-[#0e7d5a]" /> : <ArrowDown className="h-3 w-3 text-[#0e7d5a]" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* UNIT / PACKAGING */}
                <th
                  onClick={() => handleSort('unit')}
                  className="py-3 px-4 border-r border-slate-200 cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap w-40"
                >
                  <div className="flex items-center gap-1.5 whitespace-nowrap">
                    <span>UNIT / PACKAGING</span>
                    {sortField === 'unit' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-[#0e7d5a]" /> : <ArrowDown className="h-3 w-3 text-[#0e7d5a]" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* SALE RATE (PKR) */}
                <th
                  onClick={() => handleSort('saleRate')}
                  className="py-3 px-4 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap w-40"
                >
                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                    <span>SALE RATE (PKR)</span>
                    {sortField === 'saleRate' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-[#0e7d5a]" /> : <ArrowDown className="h-3 w-3 text-[#0e7d5a]" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* CURRENT STOCK */}
                <th
                  onClick={() => handleSort('currentStock')}
                  className="py-3 px-4 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap w-40"
                >
                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                    <span>CURRENT STOCK</span>
                    {sortField === 'currentStock' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-[#0e7d5a]" /> : <ArrowDown className="h-3 w-3 text-[#0e7d5a]" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* REORDER LEVEL */}
                <th
                  onClick={() => handleSort('reorderLevel')}
                  className="py-3 px-4 border-r border-slate-200 text-center cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap w-36"
                >
                  <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                    <span>REORDER LEVEL</span>
                    {sortField === 'reorderLevel' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-[#0e7d5a]" /> : <ArrowDown className="h-3 w-3 text-[#0e7d5a]" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* STOCK VALUE */}
                <th
                  onClick={() => handleSort('stockValue')}
                  className="py-3 px-4 border-r border-slate-200 text-right cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap w-44"
                >
                  <div className="flex items-center justify-end gap-1.5 whitespace-nowrap">
                    <span>EST. VALUE (PKR)</span>
                    {sortField === 'stockValue' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-[#0e7d5a]" /> : <ArrowDown className="h-3 w-3 text-[#0e7d5a]" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* STATUS */}
                <th
                  onClick={() => handleSort('status')}
                  className="py-3 px-4 border-r border-slate-200 text-center cursor-pointer hover:bg-slate-100 transition-colors whitespace-nowrap w-36"
                >
                  <div className="flex items-center justify-center gap-1.5 whitespace-nowrap">
                    <span>STATUS</span>
                    {sortField === 'status' ? (
                      sortOrder === 'asc' ? <ArrowUp className="h-3 w-3 text-[#0e7d5a]" /> : <ArrowDown className="h-3 w-3 text-[#0e7d5a]" />
                    ) : (
                      <ArrowUpDown className="h-3 w-3 text-slate-400" />
                    )}
                  </div>
                </th>

                {/* ACTIONS */}
                <th className="py-3 px-3.5 text-center w-28 whitespace-nowrap">ACTIONS</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <Loader2 className="h-5 w-5 animate-spin text-[#0e7d5a]" />
                      <span className="text-xs">Loading real inventory data…</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedRows.length === 0 ? (
                <tr>
                  <td colSpan={10} className="py-12 text-center text-slate-400">
                    <div className="flex flex-col items-center justify-center gap-1.5">
                      <AlertCircle className="h-6 w-6 text-slate-300" />
                      <span className="font-semibold text-slate-700 text-xs">No Medicines Found</span>
                      <span className="text-xs">No records matched your search or filter criteria.</span>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedRows.map((m, idx) => {
                  const globalIdx = (validPage - 1) * pageSize + idx + 1;
                  const stockNum = Number(m.currentStock || 0);
                  const saleRateNum = Number(m.saleRate || 0);
                  const valueNum = stockNum * saleRateNum;

                  return (
                    <tr
                      key={m.id}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {/* Index */}
                      <td className="py-3.5 px-3.5 text-center text-slate-500 font-semibold border-r border-slate-100 whitespace-nowrap">
                        {globalIdx}
                      </td>

                      {/* Code - Clean black text without pill or background */}
                      <td className="py-3.5 px-4 border-r border-slate-100 whitespace-nowrap">
                        <span className="font-bold text-slate-900 text-xs tracking-wider whitespace-nowrap">
                          {m.code}
                        </span>
                      </td>

                      {/* Name & Category - Clean single-line landscape */}
                      <td className="py-3.5 px-4 border-r border-slate-100 whitespace-nowrap">
                        <div className="flex items-center gap-2 whitespace-nowrap">
                          <Pill className="h-4 w-4 text-[#0e7d5a] shrink-0" />
                          <span className="font-bold text-slate-900 text-xs group-hover:text-[#0e7d5a] transition-colors whitespace-nowrap">
                            {m.name}
                          </span>
                          {m.category && (
                            <span className="text-xs text-slate-500 font-normal whitespace-nowrap">
                              • {m.category}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Unit / Packaging - Clean text */}
                      <td className="py-3.5 px-4 border-r border-slate-100 whitespace-nowrap text-slate-800 font-medium text-xs">
                        {m.unit}
                      </td>

                      {/* Sale Rate - Solid black text */}
                      <td className="py-3.5 px-4 text-right border-r border-slate-100 font-bold text-slate-900 text-xs whitespace-nowrap">
                        {formatPKR(saleRateNum)}
                      </td>

                      {/* Current Stock - Clean bold black text */}
                      <td className="py-3.5 px-4 text-right border-r border-slate-100 whitespace-nowrap">
                        <span
                          className={`font-bold text-xs whitespace-nowrap ${
                            m.isOutOfStock ? 'text-rose-600' : 'text-slate-900'
                          }`}
                        >
                          {formatNumber(stockNum)} {m.unit}
                        </span>
                      </td>

                      {/* Reorder Level */}
                      <td className="py-3.5 px-4 text-center border-r border-slate-100 text-slate-700 font-medium text-xs whitespace-nowrap">
                        {formatNumber(m.reorderLevel)} {m.unit}
                      </td>

                      {/* Stock Value - Solid black text */}
                      <td className="py-3.5 px-4 text-right border-r border-slate-100 font-bold text-slate-900 text-xs whitespace-nowrap">
                        {formatPKR(valueNum)}
                      </td>

                      {/* Status - Clean dot indicator without loud background pill */}
                      <td className="py-3.5 px-4 text-center border-r border-slate-100 whitespace-nowrap">
                        {m.isOutOfStock ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-rose-700 whitespace-nowrap">
                            <span className="h-2 w-2 rounded-full bg-rose-600 shrink-0" /> Out of Stock
                          </span>
                        ) : m.isLowStock ? (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-amber-700 whitespace-nowrap">
                            <span className="h-2 w-2 rounded-full bg-amber-600 shrink-0" /> Low Stock
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0e7d5a] whitespace-nowrap">
                            <span className="h-2 w-2 rounded-full bg-[#0e7d5a] shrink-0" /> In Stock
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-3.5 text-center whitespace-nowrap">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenBatches(m)}
                            className="p-1.5 rounded-md text-slate-500 hover:text-emerald-700 hover:bg-emerald-50 transition-colors cursor-pointer"
                            title="View Active Batches & FEFO Expiry"
                          >
                            <Layers className="h-4 w-4" />
                          </button>
                          {canEdit && (
                            <button
                              type="button"
                              onClick={() => handleOpenEdit(m)}
                              className="p-1.5 rounded-md text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition-colors cursor-pointer"
                              title="Edit Medicine Details"
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>

            {/* ── TOTAL SUMMARY ROW (Generous, Clear, Professional ERP Footer) ── */}
            {finalFilteredRows.length > 0 && (
              <tfoot className="bg-[#f8fafc] font-bold border-t-2 border-b border-slate-300 text-slate-900 text-xs">
                <tr>
                  <td className="py-4 px-3.5 text-center border-r border-slate-200 whitespace-nowrap">
                    <span className="bg-slate-800 text-white text-[10.5px] font-black px-2.5 py-1 rounded tracking-wider uppercase inline-block">
                      TOTAL
                    </span>
                  </td>
                  <td className="py-4 px-4 border-r border-slate-200 font-bold text-slate-900 whitespace-nowrap">
                    {finalFilteredRows.length} Items
                  </td>
                  <td className="py-4 px-4 border-r border-slate-200 text-slate-600 font-medium whitespace-nowrap">
                    Formulary summary
                  </td>
                  <td className="py-4 px-4 border-r border-slate-200 text-slate-400 font-normal whitespace-nowrap">
                    —
                  </td>
                  <td className="py-4 px-4 text-right border-r border-slate-200 font-bold text-slate-900 whitespace-nowrap">
                    Avg: {formatPKR(averageRate)}
                  </td>
                  <td className="py-4 px-4 text-right border-r border-slate-200 font-extrabold text-slate-900 whitespace-nowrap">
                    {formatNumber(totalStockUnits)} Units
                  </td>
                  <td className="py-4 px-4 text-center border-r border-slate-200 text-slate-400 font-normal whitespace-nowrap">
                    —
                  </td>
                  <td className="py-4 px-4 text-right border-r border-slate-200 font-black text-slate-900 whitespace-nowrap text-[13px]">
                    {formatPKR(totalStockValuation)}
                  </td>
                  <td className="py-4 px-4 text-center border-r border-slate-200 text-slate-700 font-semibold whitespace-nowrap">
                    {normalStockCount} Available
                  </td>
                  <td className="py-4 px-4 text-center text-slate-400 font-normal whitespace-nowrap">
                    —
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>

        {/* ── PAGINATION CONTROLS ── */}
        <div className="px-3.5 py-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-500">
          <div className="whitespace-nowrap">
            Showing <strong className="text-slate-800">{paginatedRows.length > 0 ? (validPage - 1) * pageSize + 1 : 0}</strong> to{' '}
            <strong className="text-slate-800">{(validPage - 1) * pageSize + paginatedRows.length}</strong> of{' '}
            <strong className="text-slate-800">{finalFilteredRows.length}</strong> entries
          </div>

          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <button
              type="button"
              disabled={validPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={validPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-[#0e7d5a] rounded-md border border-emerald-200/80">
              Page {validPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={validPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={validPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* ═════════════════════════════════════════════════════════════════════
          5. BATCHES MODAL (View Live Batches & FEFO Expiry)
          ═════════════════════════════════════════════════════════════════════ */}
      {showBatchesModal && selectedMedicine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 bg-[#0e5944] text-white">
              <div className="flex items-center gap-2.5">
                <Layers className="h-5 w-5 text-emerald-300" />
                <div>
                  <h3 className="text-sm font-bold text-white">{selectedMedicine.name}</h3>
                  <p className="text-[11px] text-emerald-200">
                    Code: {selectedMedicine.code} | Unit: {selectedMedicine.unit} | Total Stock: {selectedMedicine.currentStock}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBatchesModal(false)}
                className="text-white/70 hover:text-white transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700">Active FEFO Batches</h4>
                <span className="text-xs text-slate-500 font-medium">
                  {medicineBatches.length} batch records in database
                </span>
              </div>

              {loadingBatches ? (
                <div className="py-12 flex flex-col items-center justify-center text-slate-400 gap-2">
                  <Loader2 className="h-6 w-6 animate-spin text-[#0e7d5a]" />
                  <span className="text-xs">Loading batches…</span>
                </div>
              ) : medicineBatches.length === 0 ? (
                <div className="py-10 text-center bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                  <Package className="h-8 w-8 text-slate-300 mx-auto" />
                  <p className="text-xs font-semibold text-slate-700">No active batches for this medicine</p>
                  <p className="text-[11px] text-slate-400">Stock can be received via Purchase Order or Opening Stock.</p>
                </div>
              ) : (
                <div className="overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3">Batch #</th>
                        <th className="py-2.5 px-3">Expiry Date</th>
                        <th className="py-2.5 px-3 text-right">Available Qty</th>
                        <th className="py-2.5 px-3 text-right">Purchase Rate</th>
                        <th className="py-2.5 px-3 text-right">Sale Rate</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {medicineBatches.map((b) => (
                        <tr key={b.id} className="hover:bg-slate-50">
                          <td className="py-2.5 px-3 font-mono font-bold text-slate-800">{b.batchNumber}</td>
                          <td className="py-2.5 px-3 font-mono text-slate-600">
                            {b.expiryDate ? new Date(b.expiryDate).toLocaleDateString() : 'N/A'}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-800">
                            {formatNumber(b.currentQuantity ?? b.quantity)} {selectedMedicine.unit}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono text-slate-600">
                            {formatPKR(b.purchaseRate ?? 0)}
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                            {formatPKR(b.saleRate ?? selectedMedicine.saleRate)}
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {b.isExpired ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 border border-rose-200">
                                Expired
                              </span>
                            ) : b.isNearExpiry ? (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                                Near Expiry
                              </span>
                            ) : (
                              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Active
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="button"
                  onClick={() => setShowBatchesModal(false)}
                  className="px-4 py-2 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl text-xs transition-colors cursor-pointer"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          6. ADD MEDICINE MODAL
          ═════════════════════════════════════════════════════════════════════ */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#08775A] flex items-center justify-center">
                  <Pill className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Add Medicine to Formulary</h3>
                  <p className="text-[11px] text-slate-400">Register new item in pharmacy catalog</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveNew} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Medicine Code *</label>
                <div className="flex items-center gap-1.5">
                  <input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="e.g. MED-010"
                    className="flex-1 h-9 px-3 bg-white border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                  <button
                    type="button"
                    onClick={handleAutoGenerateCode}
                    className="h-9 px-3 shrink-0 text-[11px] font-semibold text-[#0e7d5a] border border-dashed border-[#0e7d5a]/50 hover:bg-emerald-50 rounded-xl transition-colors cursor-pointer whitespace-nowrap"
                  >
                    Auto-generate
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Medicine Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Augmentin"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl font-semibold focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Strength</label>
                  <input
                    value={form.strength}
                    onChange={(e) => setForm({ ...form, strength: e.target.value })}
                    placeholder="e.g. 625mg"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Generic Name</label>
                  <input
                    value={form.genericName}
                    onChange={(e) => setForm({ ...form, genericName: e.target.value })}
                    placeholder="e.g. Amoxicillin + Clavulanate"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dosage Form</label>
                  <input
                    list="dosage-form-options"
                    value={form.dosageForm}
                    onChange={(e) => setForm({ ...form, dosageForm: e.target.value })}
                    placeholder="e.g. Tablet"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                  <datalist id="dosage-form-options">
                    {DOSAGE_FORM_OPTIONS.map((d) => <option key={d} value={d} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Therapeutic Category</label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    placeholder="e.g. Antibiotics, Analgesics, Cardiac"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Barcode (Optional)</label>
                  <input
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    placeholder="Scan or enter barcode"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-[#0e7d5a]" /> Packaging &amp; Units</h4>
                <MedicinePackagingFields
                  units={unitCatalog}
                  onUnitCreated={(u) => setUnitCatalog((prev) => [...prev, u])}
                  baseUnitId={packaging.baseUnitId}
                  onBaseUnitIdChange={(id) => setPackaging({ ...packaging, baseUnitId: id })}
                  baseIsSaleUnit={packaging.baseIsSaleUnit}
                  onBaseIsSaleUnitChange={(s) => setPackaging({ ...packaging, baseIsSaleUnit: s })}
                  defaultPurchaseUnitId={packaging.defaultPurchaseUnitId}
                  onDefaultPurchaseUnitIdChange={(id) => setPackaging({ ...packaging, defaultPurchaseUnitId: id })}
                  levels={packaging.levels}
                  onLevelsChange={(levels) => setPackaging({ ...packaging, levels })}
                />
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Default Sale Price (Optional)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.saleRate}
                    onChange={(e) => setForm({ ...form, saleRate: e.target.value })}
                    placeholder="0.00"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl font-bold font-mono focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tax / GST %</label>
                  <input
                    type="number"
                    min={0}
                    value={form.taxPercent}
                    onChange={(e) => setForm({ ...form, taxPercent: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Reorder Alert Qty {packaging.baseUnitId && <span className="font-normal text-slate-400">({unitCatalog.find((u) => u.id === packaging.baseUnitId)?.name || '...'})</span>}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.reorderLevel}
                    onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                  {packaging.baseUnitId && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      = {formatNumber(Number(form.reorderLevel) || 0)} {unitCatalog.find((u) => u.id === packaging.baseUnitId)?.name || ''}
                    </p>
                  )}
                </div>
              </div>

              <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer select-none pt-1">
                <input
                  type="checkbox"
                  checked={form.batchManaged}
                  onChange={(e) => setForm({ ...form, batchManaged: e.target.checked })}
                  className="rounded text-emerald-600 focus:ring-emerald-500"
                />
                <span>Track batch numbers &amp; expiry dates (FEFO)</span>
              </label>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 font-bold text-white bg-[#0e7d5a] hover:bg-[#0c6b50] rounded-xl shadow-xs disabled:opacity-60 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  Save Medicine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ═════════════════════════════════════════════════════════════════════
          7. EDIT MEDICINE MODAL
          ═════════════════════════════════════════════════════════════════════ */}
      {showEditModal && selectedMedicine && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-50 text-[#08775A] flex items-center justify-center">
                  <Pencil className="h-4 w-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900">Edit Medicine: {selectedMedicine.code}</h3>
                  <p className="text-[11px] text-slate-400">{selectedMedicine.name}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowEditModal(false)}
                className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg p-1.5 transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSaveEdit} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Medicine Code</label>
                <input
                  disabled
                  value={selectedMedicine.code}
                  className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded-xl font-mono text-slate-500 cursor-not-allowed"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Medicine Name *</label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl font-semibold focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Strength</label>
                  <input
                    value={form.strength}
                    onChange={(e) => setForm({ ...form, strength: e.target.value })}
                    placeholder="e.g. 625mg"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Generic Name</label>
                  <input
                    value={form.genericName}
                    onChange={(e) => setForm({ ...form, genericName: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Dosage Form</label>
                  <input
                    list="dosage-form-options-edit"
                    value={form.dosageForm}
                    onChange={(e) => setForm({ ...form, dosageForm: e.target.value })}
                    placeholder="e.g. Tablet"
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                  <datalist id="dosage-form-options-edit">
                    {DOSAGE_FORM_OPTIONS.map((d) => <option key={d} value={d} />)}
                  </datalist>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Therapeutic Category</label>
                  <input
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Barcode (Optional)</label>
                  <input
                    value={form.barcode}
                    onChange={(e) => setForm({ ...form, barcode: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </div>
              </div>

              <div className="border-t border-slate-100 pt-3">
                <h4 className="font-bold text-slate-800 mb-2 flex items-center gap-1.5"><Package className="h-3.5 w-3.5 text-[#0e7d5a]" /> Packaging &amp; Units</h4>
                {loadingPackaging ? (
                  <div className="flex items-center gap-2 text-slate-400 py-3"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading packaging…</div>
                ) : (
                  <MedicinePackagingFields
                    units={unitCatalog}
                    onUnitCreated={(u) => setUnitCatalog((prev) => [...prev, u])}
                    baseUnitId={packaging.baseUnitId}
                    onBaseUnitIdChange={(id) => setPackaging({ ...packaging, baseUnitId: id })}
                    baseIsSaleUnit={packaging.baseIsSaleUnit}
                    onBaseIsSaleUnitChange={(s) => setPackaging({ ...packaging, baseIsSaleUnit: s })}
                    defaultPurchaseUnitId={packaging.defaultPurchaseUnitId}
                    onDefaultPurchaseUnitIdChange={(id) => setPackaging({ ...packaging, defaultPurchaseUnitId: id })}
                    levels={packaging.levels}
                    onLevelsChange={(levels) => setPackaging({ ...packaging, levels })}
                  />
                )}
              </div>

              <div className="grid grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Default Sale Price (Optional)</label>
                  <input
                    type="number"
                    min={0}
                    value={form.saleRate}
                    onChange={(e) => setForm({ ...form, saleRate: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl font-bold font-mono focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Tax / GST %</label>
                  <input
                    type="number"
                    min={0}
                    value={form.taxPercent}
                    onChange={(e) => setForm({ ...form, taxPercent: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Reorder Alert Qty {packaging.baseUnitId && <span className="font-normal text-slate-400">({unitCatalog.find((u) => u.id === packaging.baseUnitId)?.name || '...'})</span>}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={form.reorderLevel}
                    onChange={(e) => setForm({ ...form, reorderLevel: e.target.value })}
                    className="w-full h-9 px-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
                  />
                  {packaging.baseUnitId && (
                    <p className="text-[10px] text-slate-400 mt-1">
                      = {formatNumber(Number(form.reorderLevel) || 0)} {unitCatalog.find((u) => u.id === packaging.baseUnitId)?.name || ''}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 font-semibold text-slate-600 border border-slate-200 rounded-xl hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-4 py-2 font-bold text-white bg-[#0e7d5a] hover:bg-[#0c6b50] rounded-xl shadow-xs disabled:opacity-60 transition-colors flex items-center gap-1.5 cursor-pointer"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Pencil className="h-4 w-4" />}
                  Update Medicine
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
