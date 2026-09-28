import React, { useEffect, useState, useMemo } from 'react';
import { Package, AlertTriangle, AlertCircle, CheckCircle2, Layers, MapPin, Eye, Edit2, SlidersHorizontal, Plus, Lock, Building2, CreditCard, Trash2 } from 'lucide-react';
import { DataTable } from '../../components/tables/DataTable';
import { TableColumn } from '../../types';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { StatusBadge } from '../../components/common/StatusBadge';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { TextInput, NumberInput, Select } from '../../components/forms/FormControls';
import { inventoryApiService, BackendStockItem, BackendSupplier } from '../../services/inventoryApiService';
import { useToast } from '../../context/ToastContext';
import { toErrorMessage } from '../../utils/apiErrors';
import { formatPKR } from '../../utils/formatters';

export const DEFAULT_STOCK_CATEGORIES = [
  'Medical Supplies & Disposables',
  'Surgical Instruments & OT',
  'Linens & Patient Bedding',
  'Cleaning & Sanitation',
  'Office & Stationery',
  'Diagnostic & Lab Consumables',
  'Dental Supplies',
  'General Hospital Store',
  'Maintenance & Electrical',
  'Uniforms & Protective Wear',
  'Dietary & Kitchen Supplies',
];

export const DEFAULT_STOCK_UNITS = [
  'Pcs',
  'Box',
  'Pack',
  'Roll',
  'Set',
  'Bottle',
  'Vial',
  'Ampoule',
  'Strip',
  'Kg',
  'Liter',
  'Pair',
  'Meter',
  'Dozens',
];

export const STORE_LOCATIONS = [
  'Main General Store',
  'Emergency Store',
  'Operation Theater (OT) Store',
  'ICU Supply Room',
  'Inpatient Wards Store',
  'Central Warehouse',
  'Biomedical Store',
];

/**
 * Stock Overview (inventory.md §4.1, §9 step 11).
 * Features:
 * - Master fields only (name, code, category, unit, location, reorder level) — quantity moves only through Stock Movement.
 * - Dynamic Category and Unit dropdowns with custom input capability.
 * - Location tracking and filtering.
 * - Category & Unit management drawer.
 * - Multi-metric KPI cards & multi-filter toolbar.
 */
export const StockOverviewView: React.FC = () => {
  const toast = useToast();

  const [items, setItems] = useState<BackendStockItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedLocation, setSelectedLocation] = useState<string>('ALL');

  // Form State
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<BackendStockItem | null>(null);
  const [form, setForm] = useState({
    code: '',
    name: '',
    category: DEFAULT_STOCK_CATEGORIES[0],
    customCategory: '',
    unit: DEFAULT_STOCK_UNITS[0],
    customUnit: '',
    location: STORE_LOCATIONS[0],
    customLocation: '',
    reorderLevel: '10',
    supplierId: '',
    initialQuantity: '',
    unitCost: '',
  });
  const [saving, setSaving] = useState(false);

  // Suppliers for inline vendor assignment & quick creation
  const [suppliers, setSuppliers] = useState<BackendSupplier[]>([]);
  useEffect(() => {
    inventoryApiService.getSuppliers().then(setSuppliers).catch(() => {});
  }, []);

  // Quick Add Supplier Modal
  const [isQuickSupplierOpen, setIsQuickSupplierOpen] = useState(false);
  const [quickSupplierForm, setQuickSupplierForm] = useState({
    name: '',
    contact: '',
    phone: '',
    terms: 'Net 30 Days',
  });
  const [savingQuickSupplier, setSavingQuickSupplier] = useState(false);

  // Quick Pay Modal (if initial stock was credited to supplier)
  const [quickPayData, setQuickPayData] = useState<{
    supplierId: string;
    supplierName: string;
    amount: number;
  } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'PETTY_CASH' | 'MANAGEMENT_DIRECT' | 'ONLINE'>('PETTY_CASH');
  const [paying, setPaying] = useState(false);

  // Manage Categories Drawer
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [customCategories, setCustomCategories] = useState<string[]>([]);

  // Item Ledger History Drawer
  const [historyItem, setHistoryItem] = useState<BackendStockItem | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<any | null>(null);

  // Delete Item Confirmation Modal
  const [deleteItem, setDeleteItem] = useState<BackendStockItem | null>(null);
  const [deletingItem, setDeletingItem] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    inventoryApiService
      .getStockItems(search || undefined)
      .then(setItems)
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [search]);

  // Derived Category Lists
  const allCategories = useMemo(() => {
    const fromItems = items.map((i) => i.category).filter(Boolean) as string[];
    const set = new Set([...DEFAULT_STOCK_CATEGORIES, ...customCategories, ...fromItems]);
    return Array.from(set).sort();
  }, [items, customCategories]);

  const allLocations = useMemo(() => {
    const fromItems = items.map((i) => i.location).filter(Boolean) as string[];
    const set = new Set([...STORE_LOCATIONS, ...fromItems]);
    return Array.from(set).sort();
  }, [items]);

  const stockStatus = (item: BackendStockItem): 'Out of Stock' | 'Low Stock' | 'In Stock' => {
    const qty = Number(item.currentStock ?? 0);
    if (qty <= 0) return 'Out of Stock';
    if (item.isLowStock) return 'Low Stock';
    return 'In Stock';
  };

  // Client-side filtering for Category, Status, Location
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      if (selectedCategory !== 'ALL' && item.category !== selectedCategory) return false;
      if (selectedLocation !== 'ALL' && item.location !== selectedLocation) return false;
      if (selectedStatus !== 'ALL') {
        const st = stockStatus(item);
        if (selectedStatus === 'IN_STOCK' && st !== 'In Stock') return false;
        if (selectedStatus === 'LOW_STOCK' && st !== 'Low Stock') return false;
        if (selectedStatus === 'OUT_OF_STOCK' && st !== 'Out of Stock') return false;
      }
      return true;
    });
  }, [items, selectedCategory, selectedStatus, selectedLocation]);

  // Summary Metrics
  const totalItems = items.length;
  const totalQty = items.reduce((s, i) => s + Number(i.currentStock ?? 0), 0);
  const lowStockCount = items.filter((i) => i.isLowStock && Number(i.currentStock ?? 0) > 0).length;
  const outOfStockCount = items.filter((i) => Number(i.currentStock ?? 0) <= 0).length;
  const activeCount = items.filter((i) => i.isActive).length;

  const columns: TableColumn<BackendStockItem>[] = [
    { key: 'code', header: 'Item Code', width: '120px' },
    { key: 'name', header: 'Item Name' },
    {
      key: 'category',
      header: 'Category',
      render: (i) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
          {i.category || 'General'}
        </span>
      ),
    },
    { key: 'unit', header: 'Unit', width: '80px' },
    {
      key: 'location',
      header: 'Location / Rack',
      render: (i) => (
        <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">
          <MapPin className="h-3 w-3 text-slate-400" />
          {i.location || 'Main Store'}
        </span>
      ),
    },
    {
      key: 'currentStock',
      header: 'Available Qty',
      align: 'right',
      render: (i) => (
        <span className="font-mono font-bold text-slate-900">
          {i.currentStock} <span className="text-[11px] font-normal text-slate-500">{i.unit}</span>
        </span>
      ),
    },
    {
      key: 'reorderLevel',
      header: 'Reorder Level',
      align: 'right',
      render: (i) => <span className="font-mono text-slate-600">{i.reorderLevel}</span>,
    },
    {
      key: 'status',
      header: 'Stock Status',
      align: 'center',
      sortable: false,
      render: (i) => <StatusBadge status={stockStatus(i)} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      width: '120px',
      sortable: false,
      render: (i) => (
        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => openEditForm(i)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition-colors"
            title="Edit Item Details"
          >
            <Edit2 className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => openHistory(i)}
            className="p-1.5 rounded-lg text-slate-500 hover:text-[#129b70] hover:bg-emerald-50 transition-colors"
            title="Stock Movement Ledger"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteItem(i)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Delete Item"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const openAddForm = () => {
    setEditingItem(null);
    const maxNum = items.reduce((max, it) => {
      const m = it.code?.match(/ITM-?(\d+)/i);
      if (m && m[1]) {
        const n = parseInt(m[1], 10);
        if (n < 100) return Math.max(max, n);
      }
      return max;
    }, 0);
    const nextNum = (maxNum + 1) % 100 || 1;
    const generatedCode = `ITM-${String(nextNum).padStart(2, '0')}`;
    setForm({
      code: generatedCode,
      name: '',
      category: DEFAULT_STOCK_CATEGORIES[0],
      customCategory: '',
      unit: DEFAULT_STOCK_UNITS[0],
      customUnit: '',
      location: STORE_LOCATIONS[0],
      customLocation: '',
      reorderLevel: '10',
      supplierId: '',
      initialQuantity: '',
      unitCost: '',
    });
    setIsFormOpen(true);
  };

  const openEditForm = (item: BackendStockItem) => {
    setEditingItem(item);
    const isStandardCat = DEFAULT_STOCK_CATEGORIES.includes(item.category || '');
    const isStandardUnit = DEFAULT_STOCK_UNITS.includes(item.unit);
    const isStandardLoc = STORE_LOCATIONS.includes(item.location || '');

    setForm({
      code: item.code,
      name: item.name,
      category: isStandardCat ? item.category || DEFAULT_STOCK_CATEGORIES[0] : '__OTHER__',
      customCategory: isStandardCat ? '' : item.category || '',
      unit: isStandardUnit ? item.unit : '__OTHER__',
      customUnit: isStandardUnit ? '' : item.unit,
      location: isStandardLoc ? item.location || STORE_LOCATIONS[0] : '__OTHER__',
      customLocation: isStandardLoc ? '' : item.location || '',
      reorderLevel: String(item.reorderLevel ?? 0),
      supplierId: '',
      initialQuantity: '',
      unitCost: '',
    });
    setIsFormOpen(true);
  };

  const openHistory = (item: BackendStockItem) => {
    setHistoryItem(item);
    setHistoryLoading(true);
    setHistoryError(null);
    setHistoryData(null);
    inventoryApiService
      .getItemLedger(item.id)
      .then(setHistoryData)
      .catch((e) => setHistoryError(toErrorMessage(e)))
      .finally(() => setHistoryLoading(false));
  };

  const handleSave = async () => {
    const finalCategory = form.category === '__OTHER__' ? form.customCategory.trim() : form.category;
    const finalUnit = form.unit === '__OTHER__' ? form.customUnit.trim() : form.unit;
    const finalLocation = form.location === '__OTHER__' ? form.customLocation.trim() : form.location;

    if (!form.name.trim() || !finalUnit || (!editingItem && !form.code.trim())) {
      toast.error('Item code, name, and unit are required fields.', 'Validation Error');
      return;
    }

    setSaving(true);
    try {
      if (editingItem) {
        await inventoryApiService.updateStockItem(editingItem.id, {
          name: form.name.trim(),
          category: finalCategory || undefined,
          unit: finalUnit,
          location: finalLocation || undefined,
          reorderLevel: Number(form.reorderLevel) || 0,
        });
        toast.success(`"${form.name}" has been updated.`, 'Item Updated');
      } else {
        const initialQty = Number(form.initialQuantity) || 0;
        const rate = Number(form.unitCost) || 0;

        await inventoryApiService.createStockItem({
          code: form.code.trim().toUpperCase(),
          name: form.name.trim(),
          category: finalCategory || undefined,
          unit: finalUnit,
          location: finalLocation || undefined,
          reorderLevel: Number(form.reorderLevel) || 0,
          supplierId: form.supplierId || undefined,
          initialQuantity: initialQty > 0 ? initialQty : undefined,
          unitCost: rate > 0 ? rate : undefined,
        });

        toast.success(`"${form.name}" added to catalog.`, 'Item Added');

        if (initialQty > 0 && form.supplierId) {
          const supp = suppliers.find((s) => s.id === form.supplierId);
          if (supp) {
            const totalDue = initialQty * rate;
            setQuickPayData({
              supplierId: supp.id,
              supplierName: supp.name,
              amount: totalDue,
            });
            setPayAmount(String(totalDue));
          }
        }
      }
      setIsFormOpen(false);
      load();
    } catch (e) {
      toast.error(toErrorMessage(e), editingItem ? 'Update Failed' : 'Create Failed');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveQuickSupplier = async () => {
    if (!quickSupplierForm.name.trim()) {
      toast.error('Supplier name is required.', 'Missing Field');
      return;
    }
    setSavingQuickSupplier(true);
    try {
      const created = await inventoryApiService.createSupplier({
        name: quickSupplierForm.name.trim(),
        contact: quickSupplierForm.contact.trim() || undefined,
        phone: quickSupplierForm.phone.trim() || undefined,
        terms: quickSupplierForm.terms,
      });
      setSuppliers((prev) => [...prev, created]);
      setForm((f) => ({ ...f, supplierId: created.id }));
      setIsQuickSupplierOpen(false);
      setQuickSupplierForm({ name: '', contact: '', phone: '', terms: 'Net 30 Days' });
      toast.success(`Supplier "${created.name}" added and selected.`, 'Supplier Added');
    } catch (e) {
      toast.error(toErrorMessage(e), 'Failed to Add Supplier');
    } finally {
      setSavingQuickSupplier(false);
    }
  };

  const handleQuickPay = async () => {
    if (!quickPayData) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid payment amount.', 'Invalid Amount');
      return;
    }
    setPaying(true);
    try {
      const nextNum = (items.length + 1) % 100 || 1;
      const ref = `PAY-${String(nextNum).padStart(2, '0')}`;
      await inventoryApiService.paySupplier(quickPayData.supplierId, {
        amount: amt,
        paymentMethod: payMethod,
        reference: ref,
      });
      toast.success(
        `Disbursed ${formatPKR(amt)} to ${quickPayData.supplierName}. Recorded in ledger.`,
        'Payment Recorded'
      );
      setQuickPayData(null);
    } catch (e) {
      toast.error(toErrorMessage(e), 'Payment Failed');
    } finally {
      setPaying(false);
    }
  };

  const toggleActive = async (item: BackendStockItem) => {
    try {
      await inventoryApiService.updateStockItem(item.id, { isActive: !item.isActive });
      toast.success(`${item.name} is now ${item.isActive ? 'Inactive' : 'Active'}.`, 'Status Updated');
      load();
    } catch (e) {
      toast.error(toErrorMessage(e), 'Status Update Failed');
    }
  };

  const handleDeleteItem = async () => {
    if (!deleteItem) return;
    setDeletingItem(true);
    try {
      await inventoryApiService.deleteStockItem(deleteItem.id);
      toast.success(`"${deleteItem.name}" (${deleteItem.code}) has been deleted.`, 'Item Deleted');
      setDeleteItem(null);
      load();
    } catch (e) {
      toast.error(toErrorMessage(e), 'Delete Failed');
    } finally {
      setDeletingItem(false);
    }
  };

  const handleAddCategory = () => {
    if (!newCategoryName.trim()) return;
    const cat = newCategoryName.trim();
    if (!customCategories.includes(cat) && !DEFAULT_STOCK_CATEGORIES.includes(cat)) {
      setCustomCategories((prev) => [...prev, cat]);
      toast.success(`Category "${cat}" added.`, 'Category Saved');
    }
    setNewCategoryName('');
  };

  return (
    <div className="space-y-4">
      {/* KPI Cards Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
            <Package className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Total Catalog</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{totalItems}</div>
            <div className="text-[10px] text-slate-400">Registered items</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Total Qty</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{totalQty}</div>
            <div className="text-[10px] text-slate-400">Total units on hand</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">Low Stock</div>
            <div className="text-xl font-bold text-amber-800 mt-0.5">{lowStockCount}</div>
            <div className="text-[10px] text-amber-600">At or below reorder level</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-rose-800 uppercase tracking-tight">Out of Stock</div>
            <div className="text-xl font-bold text-rose-800 mt-0.5">{outOfStockCount}</div>
            <div className="text-[10px] text-rose-600">Zero inventory remaining</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-slate-100 text-slate-700">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Active Items</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{activeCount}</div>
            <div className="text-[10px] text-slate-400">Catalog status active</div>
          </div>
        </div>
      </div>

      {/* Main Stock Table */}
      <DataTable
        data={filteredItems}
        columns={columns}
        keyExtractor={(i) => i.id}
        title="Stock Overview"
        description="Master item catalog and current running balance — stock quantity changes only through Stock Movement transactions."
        isLoading={loading}
        isError={!!error}
        errorMessage={error || undefined}
        onRefresh={load}
        onAddNew={openAddForm}
        addNewLabel="+ Add Item"
        onView={openHistory}
        onEdit={openEditForm}
        enableSelection={false}
        enableImport={false}
        dateFilterEnabled={false}
        customFilterComponent={
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search code or name..."
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800 w-48 focus:outline-none focus:border-[#129b70]"
            />

            {/* Category Filter Dropdown */}
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-[#129b70]"
            >
              <option value="ALL">All Categories</option>
              {allCategories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* Stock Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-[#129b70]"
            >
              <option value="ALL">All Statuses</option>
              <option value="IN_STOCK">In Stock</option>
              <option value="LOW_STOCK">Low Stock</option>
              <option value="OUT_OF_STOCK">Out of Stock</option>
            </select>

            {/* Location Filter */}
            <select
              value={selectedLocation}
              onChange={(e) => setSelectedLocation(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-[#129b70]"
            >
              <option value="ALL">All Locations</option>
              {allLocations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>

            {/* Manage Categories Action Button */}
            <button
              type="button"
              onClick={() => setIsCategoriesOpen(true)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs font-semibold text-slate-700 hover:bg-slate-50 flex items-center gap-1 transition-colors"
              title="Manage Categories"
            >
              <SlidersHorizontal className="h-3.5 w-3.5 text-slate-500" />
              <span>Categories</span>
            </button>
          </div>
        }
      />

      {/* Add / Edit Item Master Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingItem ? `Edit Item — ${editingItem.code}` : 'Add Master Stock Item'}
        subtitle="Item master details only — stock quantity moves exclusively via Goods Receipt (GRN) or Stock Movement."
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {editingItem && (
                <button
                  type="button"
                  onClick={() => toggleActive(editingItem)}
                  className={`text-xs font-semibold hover:underline ${
                    editingItem.isActive ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {editingItem.isActive ? 'Deactivate this item' : 'Activate this item'}
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setIsFormOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#129b70] text-white hover:bg-[#0e7d5a] disabled:opacity-50"
              >
                {saving ? 'Saving…' : editingItem ? 'Save Changes' : 'Create Item'}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-3.5">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Item Code (System Auto-Generated)
                </label>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Lock className="h-2.5 w-2.5" /> Auto-Generated
                </span>
              </div>
              <div className="relative">
                <input
                  type="text"
                  value={form.code}
                  readOnly
                  disabled
                  className="w-full px-2.5 py-2 bg-slate-100 border border-slate-300 rounded text-xs font-mono font-bold text-slate-700 cursor-not-allowed select-none"
                />
              </div>
              <p className="text-[10px] text-slate-500 mt-1">
                Sequential SKU allocated automatically by central hospital catalog engine.
              </p>
            </div>
            <TextInput
              label="Item Name"
              required
              placeholder="e.g. Surgical Gloves (Latex Size 7)"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
              <select
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-[#129b70]"
              >
                {allCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
                <option value="__OTHER__">+ Add Custom Category...</option>
              </select>
              {form.category === '__OTHER__' && (
                <input
                  type="text"
                  placeholder="Enter new category name..."
                  value={form.customCategory}
                  onChange={(e) => setForm((f) => ({ ...f, customCategory: e.target.value }))}
                  className="w-full mt-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800"
                />
              )}
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Standard Unit</label>
              <select
                value={form.unit}
                onChange={(e) => setForm((f) => ({ ...f, unit: e.target.value }))}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-[#129b70]"
              >
                {DEFAULT_STOCK_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
                <option value="__OTHER__">+ Custom Unit...</option>
              </select>
              {form.unit === '__OTHER__' && (
                <input
                  type="text"
                  placeholder="e.g. Kit, Drum, Strip"
                  value={form.customUnit}
                  onChange={(e) => setForm((f) => ({ ...f, customUnit: e.target.value }))}
                  className="w-full mt-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Storage Location / Rack</label>
              <select
                value={form.location}
                onChange={(e) => setForm((f) => ({ ...f, location: e.target.value }))}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-[#129b70]"
              >
                {allLocations.map((loc) => (
                  <option key={loc} value={loc}>
                    {loc}
                  </option>
                ))}
                <option value="__OTHER__">+ Custom Location...</option>
              </select>
              {form.location === '__OTHER__' && (
                <input
                  type="text"
                  placeholder="e.g. Rack A-12, Bin 3"
                  value={form.customLocation}
                  onChange={(e) => setForm((f) => ({ ...f, customLocation: e.target.value }))}
                  className="w-full mt-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800"
                />
              )}
            </div>

            <NumberInput
              label="Reorder Alert Level"
              placeholder="e.g. 20"
              value={form.reorderLevel}
              onChange={(e) => setForm((f) => ({ ...f, reorderLevel: e.target.value }))}
              hint="Flags warning when stock drops to or below this quantity."
            />
          </div>

          {/* Supplier & Initial Stock Section (New Items Only) */}
          {!editingItem && (
            <div className="p-3 bg-emerald-50/50 border border-emerald-200/80 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-slate-800">
                  <Building2 className="h-3.5 w-3.5 text-[#129b70]" />
                  <span>Supplier & Initial Receiving (Optional)</span>
                </div>
                <button
                  type="button"
                  onClick={() => setIsQuickSupplierOpen(true)}
                  className="text-[11px] font-bold text-[#129b70] hover:underline"
                >
                  + Add New Supplier
                </button>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Source Supplier
                </label>
                <select
                  value={form.supplierId}
                  onChange={(e) => {
                    if (e.target.value === '__NEW__') {
                      setIsQuickSupplierOpen(true);
                    } else {
                      setForm((f) => ({ ...f, supplierId: e.target.value }));
                    }
                  }}
                  className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-[#129b70]"
                >
                  <option value="">None / Sourced Later</option>
                  {suppliers.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name} {s.terms ? `(${s.terms})` : ''}
                    </option>
                  ))}
                  <option value="__NEW__" className="font-bold text-[#129b70]">
                    + Add New Supplier...
                  </option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <NumberInput
                  label="Initial Received Quantity"
                  placeholder="e.g. 50 (leave empty if 0)"
                  value={form.initialQuantity}
                  onChange={(e) => setForm((f) => ({ ...f, initialQuantity: e.target.value }))}
                  hint="Automatically posts initial stock in"
                />
                <NumberInput
                  label="Purchase Unit Cost (PKR)"
                  placeholder="e.g. 850"
                  value={form.unitCost}
                  onChange={(e) => setForm((f) => ({ ...f, unitCost: e.target.value }))}
                  hint="Unit rate credited to supplier ledger"
                />
              </div>

              {Number(form.initialQuantity) > 0 && Number(form.unitCost) > 0 && (
                <div className="flex items-center justify-between px-2.5 py-1.5 bg-white rounded border border-emerald-200 text-xs">
                  <span className="text-slate-600 font-medium">Initial Purchase Total:</span>
                  <span className="font-mono font-bold text-emerald-800">
                    {formatPKR(Number(form.initialQuantity) * Number(form.unitCost))}
                  </span>
                </div>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Manage Categories Drawer */}
      <Drawer
        isOpen={isCategoriesOpen}
        onClose={() => setIsCategoriesOpen(false)}
        title="Manage Inventory Categories"
        subtitle="Catalog classification taxonomy for hospital medical, surgical and general store items."
      >
        <div className="space-y-4">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <label className="block text-xs font-semibold text-slate-800 mb-1.5">Add New Category</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                placeholder="e.g. Radiography Consumables"
                className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-[#129b70]"
              />
              <button
                type="button"
                onClick={handleAddCategory}
                className="px-3 py-1.5 bg-[#129b70] text-white text-xs font-semibold rounded hover:bg-[#0e7d5a] flex items-center gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Active Categories</div>
            <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden bg-white">
              {allCategories.map((c) => {
                const count = items.filter((i) => i.category === c).length;
                return (
                  <div key={c} className="p-2.5 flex items-center justify-between text-xs hover:bg-slate-50">
                    <span className="font-medium text-slate-800">{c}</span>
                    <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600">
                      {count} items
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </Drawer>

      {/* Stock History Drawer */}
      <Drawer
        isOpen={!!historyItem}
        onClose={() => setHistoryItem(null)}
        title={`Stock History — ${historyItem?.name ?? ''}`}
        subtitle={`Item Code: ${historyItem?.code ?? ''} • ${historyItem?.category || 'General Store'}`}
      >
        {historyLoading ? (
          <LoadingState type="skeleton-table" rows={6} />
        ) : historyError ? (
          <ErrorState message={historyError} />
        ) : !historyData?.movements?.length ? (
          <EmptyState title="No stock movement records" description="No transactions have posted against this item yet." />
        ) : (
          <div className="space-y-3 text-xs">
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">Current On-Hand Balance</div>
                <div className="text-base font-bold text-slate-900 mt-0.5">
                  {historyData.currentStock} {historyItem?.unit}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-500 uppercase font-bold text-right">Location</div>
                <div className="text-xs font-semibold text-slate-700 mt-0.5 text-right">
                  {historyItem?.location || 'Main Store'}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Movement Ledger</div>
              {historyData.movements.map((m: any) => (
                <div key={m.id} className="p-2.5 rounded border border-slate-200 flex items-center justify-between bg-white">
                  <div>
                    <div className="font-semibold text-slate-900">{m.movementType}</div>
                    <div className="text-slate-400 text-[10px]">
                      {new Date(m.createdAt).toLocaleString()} • Actor: {m.actor?.username || 'System'}
                    </div>
                  </div>
                  <div
                    className={`font-mono font-bold text-sm ${
                      Number(m.quantityDelta) >= 0 ? 'text-emerald-700' : 'text-rose-700'
                    }`}
                  >
                    {Number(m.quantityDelta) >= 0 ? '+' : ''}
                    {m.quantityDelta} {historyItem?.unit}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Drawer>

      {/* Quick Add Supplier Modal */}
      <Modal
        isOpen={isQuickSupplierOpen}
        onClose={() => setIsQuickSupplierOpen(false)}
        title="Add New Supplier"
        subtitle="Onboard supplier immediately without leaving this form."
        maxWidth="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setIsQuickSupplierOpen(false)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveQuickSupplier}
              disabled={savingQuickSupplier}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#129b70] text-white hover:bg-[#0e7d5a] disabled:opacity-50"
            >
              {savingQuickSupplier ? 'Saving…' : 'Save Supplier'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <TextInput
            label="Supplier / Company Name"
            required
            placeholder="e.g. Premier Medical Supplies"
            value={quickSupplierForm.name}
            onChange={(e) => setQuickSupplierForm((f) => ({ ...f, name: e.target.value }))}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="Contact Person"
              placeholder="e.g. Kashif Ali"
              value={quickSupplierForm.contact}
              onChange={(e) => setQuickSupplierForm((f) => ({ ...f, contact: e.target.value }))}
            />
            <TextInput
              label="Phone Number"
              placeholder="e.g. 0300-1234567"
              value={quickSupplierForm.phone}
              onChange={(e) => setQuickSupplierForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>
          <Select
            label="Payment Terms"
            value={quickSupplierForm.terms}
            onChange={(e) => setQuickSupplierForm((f) => ({ ...f, terms: e.target.value }))}
            options={[
              { value: 'Net 30 Days', label: 'Net 30 Days' },
              { value: 'Net 15 Days', label: 'Net 15 Days' },
              { value: 'Immediate Cash', label: 'Immediate Cash / COD' },
              { value: 'Advance Payment', label: 'Advance Payment' },
            ]}
          />
        </div>
      </Modal>

      {/* Quick Pay Modal (appears after stocking in if operator wants to pay now) */}
      <Modal
        isOpen={!!quickPayData}
        onClose={() => setQuickPayData(null)}
        title={`Stock Received — Pay ${quickPayData?.supplierName ?? 'Supplier'}?`}
        subtitle="Stock has been received and credited to the supplier ledger. Would you like to record payment now?"
        maxWidth="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setQuickPayData(null)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Pay Later (Keep as Due)
            </button>
            <button
              type="button"
              onClick={handleQuickPay}
              disabled={paying}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#129b70] text-white hover:bg-[#0e7d5a] disabled:opacity-50"
            >
              {paying ? 'Recording…' : 'Record Payment Now'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Payable Total Generated</div>
            <div className="text-lg font-bold text-rose-700 font-mono mt-0.5">
              {formatPKR(quickPayData?.amount ?? 0)}
            </div>
          </div>
          <NumberInput
            label="Payment Amount (PKR)"
            required
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
          />
          <Select
            label="Payment Method"
            required
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value as any)}
            options={[
              { value: 'PETTY_CASH', label: 'Petty Cash (Deducts physical cash)' },
              { value: 'MANAGEMENT_DIRECT', label: 'Management Direct Bank Transfer' },
              { value: 'ONLINE', label: 'Online / Bank' },
            ]}
          />
        </div>
      </Modal>

      {/* Delete Item Confirmation Modal */}
      <Modal
        isOpen={!!deleteItem}
        onClose={() => setDeleteItem(null)}
        title="Delete Stock Item"
        subtitle="This action will delete the item from the central hospital catalog."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteItem(null)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteItem}
              disabled={deletingItem}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{deletingItem ? 'Deleting…' : 'Delete Item'}</span>
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs text-slate-600">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-800">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-900">Are you sure you want to delete this item?</p>
              <p className="mt-0.5 text-rose-700 text-[11px]">
                Deleting <strong>{deleteItem?.name}</strong> (Code: <code>{deleteItem?.code}</code>) will
                remove it from the catalog along with its historical movement records.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
