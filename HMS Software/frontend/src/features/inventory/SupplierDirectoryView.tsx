import React, { useEffect, useState, useMemo } from 'react';
import { Building2, CreditCard, ExternalLink, CheckCircle2, AlertCircle, Phone, MapPin, User, FileText, ArrowRight, Lock, Trash2, AlertTriangle } from 'lucide-react';
import { DataTable } from '../../components/tables/DataTable';
import { TableColumn } from '../../types';
import { Modal } from '../../components/common/Modal';
import { Drawer } from '../../components/common/Drawer';
import { StatusBadge } from '../../components/common/StatusBadge';
import { TextInput, NumberInput, Select } from '../../components/forms/FormControls';
import { useRouter } from '../../context/RouterContext';
import { inventoryApiService, BackendSupplier } from '../../services/inventoryApiService';
import { useToast } from '../../context/ToastContext';
import { toErrorMessage } from '../../utils/apiErrors';
import { formatPKR } from '../../utils/formatters';

const PAYMENT_TERMS_OPTIONS = [
  'Net 15 Days',
  'Net 30 Days',
  'Net 45 Days',
  'Net 60 Days',
  'Immediate Cash',
  'Advance Payment',
  'Monthly Account Statement',
];

/**
 * Supplier Directory (inventory.md §5.1, §9 step 12).
 * Features:
 * - Top KPI summary cards for vendor base, active counts, and current payables.
 * - Standardized Payment Terms dropdowns.
 * - Multi-action row items: Open Ledger, Pay Supplier, View Detail, Edit.
 * - Real-time filtering by search, payment terms, and active/inactive status.
 */
export const SupplierDirectoryView: React.FC = () => {
  const { navigate } = useRouter();
  const toast = useToast();

  const [suppliers, setSuppliers] = useState<BackendSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [search, setSearch] = useState('');
  const [selectedTerms, setSelectedTerms] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');

  // Add / Edit Modal
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editing, setEditing] = useState<BackendSupplier | null>(null);
  const [form, setForm] = useState({
    name: '',
    contact: '',
    phone: '',
    address: '',
    terms: PAYMENT_TERMS_OPTIONS[1],
    customTerms: '',
  });
  const [saving, setSaving] = useState(false);

  // Detail Drawer
  const [detailSupplier, setDetailSupplier] = useState<BackendSupplier | null>(null);

  // Quick Pay Modal
  const [paySupplier, setPaySupplier] = useState<BackendSupplier | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'PETTY_CASH' | 'MANAGEMENT_DIRECT' | 'ONLINE'>('PETTY_CASH');
  const [payReference, setPayReference] = useState('');
  const [paying, setPaying] = useState(false);

  // Delete Supplier Confirmation Modal
  const [deleteTarget, setDeleteTarget] = useState<BackendSupplier | null>(null);
  const [deleting, setDeleting] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    inventoryApiService
      .getSuppliers(search || undefined)
      .then(setSuppliers)
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, [search]);

  // Distinct terms from suppliers list
  const allTerms = useMemo(() => {
    const list = suppliers.map((s) => s.terms).filter(Boolean) as string[];
    const set = new Set([...PAYMENT_TERMS_OPTIONS, ...list]);
    return Array.from(set).sort();
  }, [suppliers]);

  // Client filtering
  const filteredSuppliers = useMemo(() => {
    return suppliers.filter((s) => {
      if (selectedTerms !== 'ALL' && s.terms !== selectedTerms) return false;
      if (selectedStatus === 'ACTIVE' && !s.isActive) return false;
      if (selectedStatus === 'INACTIVE' && s.isActive) return false;
      return true;
    });
  }, [suppliers, selectedTerms, selectedStatus]);

  // Summary Metrics
  const totalSuppliers = suppliers.length;
  const activeSuppliers = suppliers.filter((s) => s.isActive).length;
  const totalDue = suppliers.reduce((sum, s) => sum + Math.max(0, Number(s.outstandingBalance ?? 0)), 0);
  const suppliersWithDue = suppliers.filter((s) => Number(s.outstandingBalance ?? 0) > 0).length;

  const columns: TableColumn<BackendSupplier>[] = [
    {
      key: 'code',
      header: 'Supplier Code',
      width: '120px',
      render: (s) => (
        <span className="font-mono font-bold text-xs text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
          {`SUP-${s.id.slice(0, 6).toUpperCase()}`}
        </span>
      ),
    },
    {
      key: 'name',
      header: 'Supplier Name',
      render: (s) => (
        <span
          className="font-semibold text-slate-900 whitespace-nowrap"
          title={s.address ? `Address: ${s.address}` : undefined}
        >
          {s.name}
        </span>
      ),
    },
    {
      key: 'contact',
      header: 'Contact Person',
      render: (s) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700">
          <User className="h-3 w-3 text-slate-400" />
          {s.contact || '—'}
        </span>
      ),
    },
    {
      key: 'phone',
      header: 'Phone / Mobile',
      render: (s) => (
        <span className="inline-flex items-center gap-1.5 text-xs text-slate-700 font-mono">
          <Phone className="h-3 w-3 text-slate-400" />
          {s.phone || '—'}
        </span>
      ),
    },
    {
      key: 'terms',
      header: 'Payment Terms',
      render: (s) => (
        <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700">
          {s.terms || 'Net 30 Days'}
        </span>
      ),
    },
    {
      key: 'outstandingBalance',
      header: 'Current Due (Payable)',
      align: 'right',
      render: (s) => (
        <div className="flex items-center justify-end gap-2">
          <span
            className={`font-mono font-bold ${
              Number(s.outstandingBalance) > 0 ? 'text-rose-700' : 'text-slate-600'
            }`}
          >
            {formatPKR(s.outstandingBalance)}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setPaySupplier(s);
              setPayAmount(Number(s.outstandingBalance) > 0 ? String(s.outstandingBalance) : '');
              setPayMethod('PETTY_CASH');
              const nextPay = (suppliers.length + 1) % 100 || 1;
              setPayReference(`PAY-${String(nextPay).padStart(2, '0')}`);
            }}
            title="Record Supplier Payment"
            className="p-1.5 rounded text-slate-500 hover:text-[#0e7d5a] hover:bg-[#effaf5] transition-colors"
          >
            <CreditCard className="h-4 w-4" />
          </button>
        </div>
      ),
    },
    {
      key: 'isActive',
      header: 'Status',
      align: 'center',
      render: (s) => <StatusBadge status={s.isActive ? 'Active' : 'Inactive'} size="sm" />,
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'center',
      width: '130px',
      sortable: false,
      render: (s) => (
        <div className="flex items-center justify-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => navigate('/inventory/supplier_ledger')}
            className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold text-[#0e7d5a] hover:bg-[#effaf5] transition-colors"
            title="Open Supplier Ledger"
          >
            <span>Ledger</span>
            <ArrowRight className="h-3 w-3" />
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(s)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
            title="Delete Supplier"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      ),
    },
  ];

  const openAddForm = () => {
    setEditing(null);
    setForm({
      name: '',
      contact: '',
      phone: '',
      address: '',
      terms: PAYMENT_TERMS_OPTIONS[1],
      customTerms: '',
    });
    setIsFormOpen(true);
  };

  const openEditForm = (s: BackendSupplier) => {
    setEditing(s);
    const isStd = PAYMENT_TERMS_OPTIONS.includes(s.terms || '');
    setForm({
      name: s.name,
      contact: s.contact || '',
      phone: s.phone || '',
      address: s.address || '',
      terms: isStd ? s.terms || PAYMENT_TERMS_OPTIONS[1] : '__OTHER__',
      customTerms: isStd ? '' : s.terms || '',
    });
    setIsFormOpen(true);
  };

  const handleSave = async () => {
    const finalTerms = form.terms === '__OTHER__' ? form.customTerms.trim() : form.terms;
    if (!form.name.trim()) return toast.error('Supplier name is required.', 'Missing Field');

    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        contact: form.contact.trim() || undefined,
        phone: form.phone.trim() || undefined,
        address: form.address.trim() || undefined,
        terms: finalTerms || undefined,
      };

      if (editing) {
        await inventoryApiService.updateSupplier(editing.id, payload);
        toast.success(`Supplier "${form.name}" updated successfully.`, 'Supplier Updated');
      } else {
        await inventoryApiService.createSupplier(payload);
        toast.success(`Supplier "${form.name}" added to vendor directory.`, 'Supplier Added');
      }
      setIsFormOpen(false);
      load();
    } catch (e) {
      toast.error(toErrorMessage(e), editing ? 'Update Failed' : 'Create Failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (s: BackendSupplier) => {
    try {
      await inventoryApiService.updateSupplier(s.id, { isActive: !s.isActive });
      toast.success(`${s.name} marked as ${s.isActive ? 'Inactive' : 'Active'}.`, 'Status Changed');
      load();
    } catch (e) {
      toast.error(toErrorMessage(e), 'Status Change Failed');
    }
  };

  const handlePay = async () => {
    if (!paySupplier) return;
    if (!(Number(payAmount) > 0)) return toast.error('Enter an amount greater than zero.', 'Missing Amount');

    setPaying(true);
    try {
      await inventoryApiService.paySupplier(paySupplier.id, {
        amount: Number(payAmount),
        paymentMethod: payMethod,
        reference: payReference.trim() || undefined,
      });
      toast.success(`Payment of ${formatPKR(payAmount)} recorded for ${paySupplier.name}.`, 'Payment Successful');
      setPaySupplier(null);
      load();
    } catch (e) {
      toast.error(toErrorMessage(e), 'Payment Failed');
    } finally {
      setPaying(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await inventoryApiService.deleteSupplier(deleteTarget.id);
      toast.success(`Supplier "${deleteTarget.name}" deleted successfully.`, 'Supplier Deleted');
      setDeleteTarget(null);
      if (detailSupplier?.id === deleteTarget.id) setDetailSupplier(null);
      load();
    } catch (e) {
      toast.error(toErrorMessage(e), 'Delete Failed');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-50 text-blue-700">
            <Building2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Total Vendors</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{totalSuppliers}</div>
            <div className="text-[10px] text-slate-400">Registered suppliers</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-50 text-emerald-700">
            <CheckCircle2 className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-tight">Active Suppliers</div>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{activeSuppliers}</div>
            <div className="text-[10px] text-slate-400">Approved for procurement</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-rose-50 text-rose-700">
            <AlertCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-rose-800 uppercase tracking-tight">Total Payable</div>
            <div className="text-xl font-bold text-rose-800 mt-0.5 font-mono">{formatPKR(totalDue)}</div>
            <div className="text-[10px] text-rose-600">Pending credit balance</div>
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-lg border border-slate-200 shadow-xs flex items-center gap-3">
          <div className="p-2 rounded-lg bg-amber-50 text-amber-700">
            <CreditCard className="h-5 w-5" />
          </div>
          <div>
            <div className="text-[10px] font-bold text-amber-800 uppercase tracking-tight">Suppliers With Dues</div>
            <div className="text-xl font-bold text-amber-800 mt-0.5">{suppliersWithDue}</div>
            <div className="text-[10px] text-amber-600">Awaiting payment settlement</div>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <DataTable
        data={filteredSuppliers}
        columns={columns}
        keyExtractor={(s) => s.id}
        title="Supplier Directory"
        description="Master vendor registry and current payable balances. Pay suppliers or review full purchase ledgers."
        isLoading={loading}
        isError={!!error}
        errorMessage={error || undefined}
        onRefresh={load}
        onAddNew={openAddForm}
        addNewLabel="+ Add Supplier"
        onView={(s) => setDetailSupplier(s)}
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
              placeholder="Search vendor name, phone..."
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-800 w-52 focus:outline-none focus:border-[#129b70]"
            />

            <select
              value={selectedTerms}
              onChange={(e) => setSelectedTerms(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-[#129b70]"
            >
              <option value="ALL">All Payment Terms</option>
              {allTerms.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            <select
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
              className="px-2.5 py-1.5 bg-white border border-slate-300 rounded text-xs text-slate-700 focus:outline-none focus:border-[#129b70]"
            >
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Inactive Only</option>
            </select>
          </div>
        }
      />

      {/* Add / Edit Supplier Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editing ? `Edit Supplier — ${editing.name}` : 'Register New Supplier'}
        subtitle="Commercial vendor details, contact particulars, and standard purchase payment terms."
        maxWidth="lg"
        footer={
          <div className="flex items-center justify-between w-full">
            <div>
              {editing && (
                <button
                  type="button"
                  onClick={() => toggleActive(editing)}
                  className={`text-xs font-semibold hover:underline ${
                    editing.isActive ? 'text-rose-700' : 'text-emerald-700'
                  }`}
                >
                  {editing.isActive ? 'Deactivate this vendor' : 'Activate this vendor'}
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
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create Supplier'}
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-3.5">
          <TextInput
            label="Supplier / Company Name"
            required
            placeholder="e.g. Shaheen Pharmaceuticals Ltd."
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="Contact Person"
              placeholder="e.g. Muhammad Imran (Sales Exec)"
              value={form.contact}
              onChange={(e) => setForm((f) => ({ ...f, contact: e.target.value }))}
            />
            <TextInput
              label="Phone / Mobile Number"
              placeholder="e.g. 0300-1234567"
              value={form.phone}
              onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Payment Terms</label>
            <select
              value={form.terms}
              onChange={(e) => setForm((f) => ({ ...f, terms: e.target.value }))}
              className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-[#129b70]"
            >
              {PAYMENT_TERMS_OPTIONS.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
              <option value="__OTHER__">+ Custom Terms...</option>
            </select>
            {form.terms === '__OTHER__' && (
              <input
                type="text"
                placeholder="Enter custom terms..."
                value={form.customTerms}
                onChange={(e) => setForm((f) => ({ ...f, customTerms: e.target.value }))}
                className="w-full mt-1.5 px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded text-xs text-slate-800"
              />
            )}
          </div>

          <TextInput
            label="Physical Address / Warehouse City"
            placeholder="e.g. Suite 402, Circular Road, Lahore"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Pay Supplier Modal */}
      <Modal
        isOpen={!!paySupplier}
        onClose={() => setPaySupplier(null)}
        title={`Record Payment — ${paySupplier?.name ?? ''}`}
        subtitle="Disburse funds against supplier payable balance. Deducts physical cash if Petty Cash is chosen."
        maxWidth="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setPaySupplier(null)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handlePay}
              disabled={paying}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#129b70] text-white hover:bg-[#0e7d5a] disabled:opacity-50"
            >
              {paying ? 'Recording…' : 'Record Payment'}
            </button>
          </>
        }
      >
        <div className="space-y-3.5">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Outstanding Payable Balance</div>
            <div className="text-lg font-bold text-rose-700 font-mono mt-0.5">
              {formatPKR(paySupplier?.outstandingBalance ?? 0)}
            </div>
          </div>

          <NumberInput
            label="Payment Amount (PKR)"
            required
            placeholder="0.00"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
          />

          <Select
            label="Disbursement Method"
            required
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value as any)}
            options={[
              { value: 'PETTY_CASH', label: 'Petty Cash (Deducts your physical cash)' },
              { value: 'MANAGEMENT_DIRECT', label: 'Management Direct Bank Transfer' },
              { value: 'ONLINE', label: 'Online / Corporate Cheque' },
            ]}
          />

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                Payment Voucher No. (Auto-Generated)
              </label>
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <Lock className="h-2.5 w-2.5" /> Auto-Generated
              </span>
            </div>
            <input
              type="text"
              value={payReference}
              readOnly
              disabled
              className="w-full px-2.5 py-2 bg-slate-100 border border-slate-300 rounded text-xs font-mono font-bold text-slate-700 cursor-not-allowed select-none"
            />
          </div>
        </div>
      </Modal>

      {/* Supplier Profile Drawer */}
      <Drawer
        isOpen={!!detailSupplier}
        onClose={() => setDetailSupplier(null)}
        title={detailSupplier?.name ?? ''}
        subtitle="Vendor Master Profile & Commercial Terms"
      >
        <div className="space-y-4 text-xs">
          <div className="bg-slate-50 p-3.5 rounded-lg border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Status</span>
              <StatusBadge status={detailSupplier?.isActive ? 'Active' : 'Inactive'} size="sm" />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Current Outstanding Due</span>
              <span className="font-mono font-bold text-rose-700">
                {formatPKR(detailSupplier?.outstandingBalance ?? 0)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500">Standard Payment Terms</span>
              <span className="font-semibold text-slate-800">{detailSupplier?.terms || 'Net 30 Days'}</span>
            </div>
          </div>

          <div className="space-y-2.5">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Contact Information</div>
            <div className="p-3 bg-white border border-slate-200 rounded-lg space-y-2">
              <div className="flex items-start gap-2">
                <User className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Contact Person</div>
                  <div className="font-medium text-slate-800">{detailSupplier?.contact || '—'}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Phone className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Phone / Mobile</div>
                  <div className="font-medium text-slate-800 font-mono">{detailSupplier?.phone || '—'}</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-slate-400 mt-0.5" />
                <div>
                  <div className="text-[10px] text-slate-400 uppercase">Address</div>
                  <div className="font-medium text-slate-800">{detailSupplier?.address || '—'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-2 flex flex-col gap-2">
            <button
              type="button"
              onClick={() => {
                const s = detailSupplier;
                setDetailSupplier(null);
                navigate('/inventory/supplier_ledger');
              }}
              className="w-full py-2 px-3 bg-[#129b70] hover:bg-[#0e7d5a] text-white font-semibold rounded-lg flex items-center justify-center gap-1.5 transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span>Open Detailed Ledger</span>
            </button>
            <button
              type="button"
              onClick={() => {
                const s = detailSupplier;
                setDetailSupplier(null);
                if (s) openEditForm(s);
              }}
              className="w-full py-2 px-3 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg text-center transition-colors"
            >
              Edit Master Particulars
            </button>
            <button
              type="button"
              onClick={() => {
                const s = detailSupplier;
                setDetailSupplier(null);
                if (s) setDeleteTarget(s);
              }}
              className="w-full py-2 px-3 bg-white border border-rose-200 hover:bg-rose-50 text-rose-700 font-semibold rounded-lg text-center transition-colors flex items-center justify-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete Vendor Account</span>
            </button>
          </div>
        </div>
      </Drawer>

      {/* Delete Supplier Confirmation Modal */}
      <Modal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Delete Supplier Profile"
        subtitle="This action will permanently delete this supplier account."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setDeleteTarget(null)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteSupplier}
              disabled={deleting}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{deleting ? 'Deleting…' : 'Delete Supplier'}</span>
            </button>
          </div>
        }
      >
        <div className="space-y-3 text-xs text-slate-600">
          <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-800">
            <AlertTriangle className="h-5 w-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <p className="font-semibold text-rose-900">Are you sure you want to proceed?</p>
              <p className="mt-0.5 text-rose-700 text-[11px]">
                Deleting <strong>{deleteTarget?.name}</strong> will purge all purchase orders,
                financial ledger vouchers, and accounts payable balances linked to this supplier.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
