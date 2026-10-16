import React, { useEffect, useState } from 'react';
import {
  CreditCard,
  Printer,
  Lock,
  Plus,
  Trash2,
  Building2,
  Phone,
  User,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  FileSpreadsheet,
  ArrowDownLeft,
  ArrowUpRight,
  Receipt,
  Search,
} from 'lucide-react';
import { TextInput, NumberInput, Select } from '../../components/forms/FormControls';
import { LoadingState, ErrorState, EmptyState } from '../../components/common/StateViews';
import { Modal } from '../../components/common/Modal';
import { useRouter } from '../../context/RouterContext';
import { useToast } from '../../context/ToastContext';
import { inventoryApiService, BackendSupplier, BackendStockItem } from '../../services/inventoryApiService';
import { toErrorMessage } from '../../utils/apiErrors';
import { formatPKR, formatDateTimeDDMMYYYY, formatShortRef } from '../../utils/formatters';

// Clean table tokens - hospital reporting table grid
const TH = 'py-2.5 px-3.5 border-r border-slate-300 last:border-r-0 whitespace-nowrap text-[11px] font-bold text-slate-800 uppercase tracking-wider bg-[#f1f5f9] select-none sticky top-0 z-10';
const TD = 'py-2.5 px-3.5 border-r border-slate-200 last:border-r-0 whitespace-nowrap text-slate-800 text-xs font-medium';
const TD_NUM = 'py-2.5 px-3 text-center border-r border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50/60 whitespace-nowrap w-12';

export const SupplierLedgerView: React.FC = () => {
  const { navigate } = useRouter();
  const toast = useToast();

  const [suppliers, setSuppliers] = useState<BackendSupplier[]>([]);
  const [supplierId, setSupplierId] = useState('');
  const [ledger, setLedger] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState('');
  const [search, setSearch] = useState('');

  // Inline Pay Supplier Modal
  const [isPayModalOpen, setIsPayModalOpen] = useState(false);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'PETTY_CASH' | 'MANAGEMENT_DIRECT' | 'ONLINE'>('PETTY_CASH');
  const [payReference, setPayReference] = useState('');
  const [paying, setPaying] = useState(false);

  // Quick Add Supplier Modal
  const [isAddSupplierOpen, setIsAddSupplierOpen] = useState(false);
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierContact, setNewSupplierContact] = useState('');
  const [newSupplierTerms, setNewSupplierTerms] = useState('Net 30 Days');
  const [savingSupplier, setSavingSupplier] = useState(false);

  // Delete Supplier Confirmation Modal
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [deletingSupplier, setDeletingSupplier] = useState(false);

  // Add Approved Adjustment Modal (inventory.md §5 — posts to this supplier's ledger too)
  const [isAdjModalOpen, setIsAdjModalOpen] = useState(false);
  const [stockItems, setStockItems] = useState<BackendStockItem[]>([]);
  const [adjStockItemId, setAdjStockItemId] = useState('');
  const [adjBatchNo, setAdjBatchNo] = useState('');
  const [adjType, setAdjType] = useState<'DAMAGE' | 'EXPIRY' | 'COUNT_CORRECTION' | 'LOSS' | 'SURPLUS' | 'QUARANTINE'>('DAMAGE');
  const [adjDirection, setAdjDirection] = useState<'INCREASE' | 'DECREASE'>('DECREASE');
  const [adjQuantity, setAdjQuantity] = useState('');
  const [adjReason, setAdjReason] = useState('');
  const [savingAdj, setSavingAdj] = useState(false);
  const ADJ_FIXED_DIRECTION: Record<string, 'INCREASE' | 'DECREASE'> = {
    DAMAGE: 'DECREASE',
    EXPIRY: 'DECREASE',
    LOSS: 'DECREASE',
    QUARANTINE: 'DECREASE',
    SURPLUS: 'INCREASE',
  };

  const loadSuppliers = async (autoSelectId?: string) => {
    try {
      const res = await inventoryApiService.getSuppliers();
      setSuppliers(res);
      if (autoSelectId) {
        setSupplierId(autoSelectId);
      } else if (res.length > 0 && !supplierId) {
        setSupplierId(res[0].id);
      } else if (res.length === 0) {
        setSupplierId('');
        setLedger(null);
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    loadSuppliers();
    inventoryApiService.getStockItems().then(setStockItems).catch(() => {});
  }, []);

  const load = (id: string) => {
    if (!id) {
      setLedger(null);
      return;
    }
    setLoading(true);
    setError(null);
    inventoryApiService
      .getSupplierLedger(id)
      .then(setLedger)
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load(supplierId);
  }, [supplierId]);

  const openPayModal = (suggestedAmount?: number) => {
    const netDue = Number(ledger?.totalOutstanding ?? 0);
    // A per-bill "Pay" shortcut used to suggest that bill's full original
    // amount even after it (or part of it) was already paid off — clicking
    // it again just kept posting fresh PAYMENT rows past what was actually
    // owed. Cap the suggestion to what's genuinely still due.
    if (netDue <= 0) {
      toast.error(`${ledger?.supplier?.name ?? 'This supplier'}'s account is already fully settled — nothing left to pay.`, 'Nothing Due');
      return;
    }
    const due = Math.min(suggestedAmount ?? netDue, netDue);
    setPayAmount(due > 0 ? String(due) : '');
    const nextPay = ((ledger?.entries?.length || 0) + 1) % 100 || 1;
    setPayReference(`PAY-${String(nextPay).padStart(2, '0')}`);
    setIsPayModalOpen(true);
  };

  const handlePaySupplier = async () => {
    if (!supplierId || !ledger?.supplier) return;
    const amt = Number(payAmount);
    const netDue = Number(ledger?.totalOutstanding ?? 0);
    if (!amt || amt <= 0) {
      toast.error('Please enter an amount greater than zero.', 'Invalid Amount');
      return;
    }
    if (amt > netDue) {
      toast.error(`Amount exceeds the outstanding balance of ${formatPKR(netDue)}.`, 'Amount Too High');
      return;
    }

    setPaying(true);
    try {
      await inventoryApiService.paySupplier(supplierId, {
        amount: amt,
        paymentMethod: payMethod,
        reference: payReference || undefined,
      });
      toast.success(
        `Disbursed ${formatPKR(amt)} to ${ledger.supplier.name}. Recorded in ledger.`,
        'Payment Recorded'
      );
      setIsPayModalOpen(false);
      load(supplierId);
    } catch (e) {
      toast.error(toErrorMessage(e), 'Payment Failed');
    } finally {
      setPaying(false);
    }
  };

  const handleCreateSupplier = async () => {
    if (!newSupplierName.trim()) {
      toast.error('Supplier name is required.', 'Missing Field');
      return;
    }
    setSavingSupplier(true);
    try {
      const created = await inventoryApiService.createSupplier({
        name: newSupplierName.trim(),
        contact: newSupplierContact.trim() || undefined,
        phone: newSupplierPhone.trim() || undefined,
        terms: newSupplierTerms,
      });
      setIsAddSupplierOpen(false);
      setNewSupplierName('');
      setNewSupplierPhone('');
      setNewSupplierContact('');
      toast.success(`Supplier "${created.name}" created successfully.`, 'Supplier Added');
      loadSuppliers(created.id);
    } catch (e) {
      toast.error(toErrorMessage(e), 'Create Failed');
    } finally {
      setSavingSupplier(false);
    }
  };

  const openAdjModal = () => {
    setAdjStockItemId('');
    setAdjBatchNo('');
    setAdjType('DAMAGE');
    setAdjDirection('DECREASE');
    setAdjQuantity('');
    setAdjReason('');
    setIsAdjModalOpen(true);
  };

  const handleAdjTypeChange = (next: typeof adjType) => {
    setAdjType(next);
    const fixed = ADJ_FIXED_DIRECTION[next];
    if (fixed) setAdjDirection(fixed);
  };

  const handleCreateAdjustment = async () => {
    if (!supplierId) return;
    if (!adjStockItemId) return toast.error('Select an item.', 'Missing Field');
    if (!(Number(adjQuantity) > 0)) return toast.error('Enter a quantity greater than zero.', 'Missing Field');
    if (!adjReason.trim()) return toast.error('A reason is required.', 'Missing Reason');

    setSavingAdj(true);
    try {
      await inventoryApiService.createAdjustment({
        stockItemId: adjStockItemId,
        batchNo: adjBatchNo.trim() || undefined,
        type: adjType,
        direction: adjDirection,
        quantity: Number(adjQuantity),
        reason: adjReason.trim(),
        supplierId,
      });
      toast.success(`Adjustment posted and reflected in ${ledger?.supplier?.name}'s ledger.`, 'Adjustment Posted');
      setIsAdjModalOpen(false);
      load(supplierId);
    } catch (e) {
      toast.error(toErrorMessage(e), 'Adjustment Failed');
    } finally {
      setSavingAdj(false);
    }
  };

  const handleDeleteSupplier = async () => {
    if (!supplierId || !ledger?.supplier) return;
    setDeletingSupplier(true);
    try {
      await inventoryApiService.deleteSupplier(supplierId);
      toast.success(`Supplier "${ledger.supplier.name}" has been deleted.`, 'Supplier Deleted');
      setIsDeleteModalOpen(false);
      setSupplierId('');
      setLedger(null);
      loadSuppliers();
    } catch (e) {
      toast.error(toErrorMessage(e), 'Delete Failed');
    } finally {
      setDeletingSupplier(false);
    }
  };

  const entries: any[] = ledger?.ledgerEntries ?? [];
  const chronological = [...entries].reverse();
  let running = 0;
  const withRunningBalance = chronological.map((e) => {
    // ADJUSTMENT amounts are stored pre-signed (inventory.md §5's "± Adjustments"),
    // so they add straight in like PURCHASE_CREDIT rather than being negated.
    const signed =
      e.entryType === 'PURCHASE_CREDIT' || e.entryType === 'ADJUSTMENT' ? Number(e.amount) : -Number(e.amount);
    running += signed;
    return { ...e, runningBalance: running };
  });

  const displayRows = [...withRunningBalance]
    .reverse()
    .filter((e) => !typeFilter || e.entryType === typeFilter)
    .filter((e) => {
      if (!search.trim()) return true;
      const s = search.toLowerCase();
      const ref = (e.invoiceReference || e.id || '').toLowerCase();
      const desc = formatParticulars(e).toLowerCase();
      return ref.includes(s) || desc.includes(s);
    });

  const totalPurchases =
    entries.filter((e) => e.entryType === 'PURCHASE_CREDIT').reduce((s, e) => s + Number(e.amount), 0) +
    entries.filter((e) => e.entryType === 'ADJUSTMENT' && Number(e.amount) >= 0).reduce((s, e) => s + Number(e.amount), 0);
  const totalPayments = entries
    .filter((e) => e.entryType === 'PAYMENT')
    .reduce((s, e) => s + Number(e.amount), 0);
  const totalCredits =
    entries.filter((e) => e.entryType === 'RETURN' || e.entryType === 'CREDIT_NOTE').reduce((s, e) => s + Number(e.amount), 0) +
    entries.filter((e) => e.entryType === 'ADJUSTMENT' && Number(e.amount) < 0).reduce((s, e) => s + Math.abs(Number(e.amount)), 0);
  const netDue = Number(ledger?.totalOutstanding ?? 0);

  function formatParticulars(e: any) {
    if (e.entryType === 'PURCHASE_CREDIT') {
      if (Array.isArray(e.items) && e.items.length > 0) {
        if (e.items.length === 1) {
          const it = e.items[0];
          return `Stock Inward — ${it.itemName} (${it.quantity} ${it.unit} @ PKR ${it.rate})`;
        }
        const itemNames = e.items.map((i: any) => i.itemName).slice(0, 2).join(', ');
        const extra = e.items.length > 2 ? ` +${e.items.length - 2} more` : '';
        return `Stock Inward — ${e.items.length} items (${itemNames}${extra})`;
      }
      return 'Stock Inward / Goods Received Note';
    }
    if (e.entryType === 'PAYMENT') {
      return `Vendor Disbursement Payment`;
    }
    if (e.entryType === 'RETURN') {
      return 'Purchase Return / Goods Returned to Vendor';
    }
    if (e.entryType === 'ADJUSTMENT') {
      return `Approved Adjustment (${Number(e.amount) >= 0 ? 'increases' : 'decreases'} payable)`;
    }
    return e.entryType;
  }

  return (
    <div className="space-y-4 max-w-7xl mx-auto">
      {/* Modern Filter & Selector Bar (Soft border, no heavy black lines) */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/70 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1 min-w-[300px]">
          <div className="w-72">
            <select
              value={supplierId}
              onChange={(e) => {
                if (e.target.value === '__NEW__') {
                  setIsAddSupplierOpen(true);
                } else {
                  setSupplierId(e.target.value);
                }
              }}
              className="w-full px-3 py-2 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#08775A] focus:border-[#08775A] transition-colors"
            >
              <option value="">Select Supplier Account...</option>
              {suppliers.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} {s.terms ? `(${s.terms})` : ''}
                </option>
              ))}
              <option value="__NEW__" className="font-bold text-[#08775A]">
                + Add New Supplier...
              </option>
            </select>
          </div>

          <div className="w-48">
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="w-full px-3 py-2 bg-slate-50 hover:bg-white border border-slate-200 rounded-lg text-xs text-slate-700 focus:outline-none focus:ring-1 focus:ring-[#08775A] focus:border-[#08775A] transition-colors"
            >
              <option value="">All Transactions</option>
              <option value="PURCHASE_CREDIT">Purchases / Bills (Cr)</option>
              <option value="PAYMENT">Payments (Dr)</option>
              <option value="RETURN">Returns (Debit Notes)</option>
              <option value="ADJUSTMENT">Adjustments</option>
            </select>
          </div>

          <button
            type="button"
            onClick={() => load(supplierId)}
            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
            title="Refresh Ledger"
          >
            <RotateCcw className="h-4 w-4" />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setIsAddSupplierOpen(true)}
            className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs inline-flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Add Supplier</span>
          </button>

          {supplierId && (
            <button
              type="button"
              onClick={openAdjModal}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 shadow-2xs inline-flex items-center gap-1.5 transition-colors"
            >
              <AlertTriangle className="h-3.5 w-3.5" />
              <span>Add Approved Adjustment</span>
            </button>
          )}

          {supplierId && (
            <button
              type="button"
              onClick={() => openPayModal()}
              disabled={netDue <= 0}
              title={netDue <= 0 ? 'Account is already fully settled — nothing due to pay.' : undefined}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#08775A] hover:bg-[#065f46] text-white inline-flex items-center gap-1.5 shadow-xs transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-[#08775A]"
            >
              <CreditCard className="h-3.5 w-3.5" />
              <span>Record Payment</span>
            </button>
          )}
        </div>
      </div>

      {!supplierId ? (
        <EmptyState
          title="No Supplier Selected"
          description="Choose a supplier from the account selector above to inspect their live statement and running balance."
        />
      ) : loading ? (
        <LoadingState type="skeleton-table" />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load(supplierId)} />
      ) : ledger ? (
        <>
          {/* Distinctive Dark Green Theme Banner (Matching SuperAdmin Reporting Theme) */}
          <div className="bg-gradient-to-r from-[#0a4636] to-[#08775A] text-white p-5 rounded-xl shadow-xs flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-xl bg-white/15 text-white flex items-center justify-center shadow-inner shrink-0">
                <Building2 className="h-6 w-6" />
              </div>
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <h1 className="text-lg font-bold text-white tracking-wide">{ledger.supplier.name}</h1>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-white/15 text-emerald-100 border border-white/20">
                    {ledger.supplier.terms || 'Net 30 Days'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-white/10 text-white/90">
                    Vendor Statement
                  </span>
                </div>
                <div className="text-xs text-emerald-100/90 mt-1 flex items-center gap-3 flex-wrap">
                  <span className="inline-flex items-center gap-1">
                    <User className="h-3 w-3 text-emerald-200" />
                    <span>{ledger.supplier.contact || 'No contact person'}</span>
                  </span>
                  <span>•</span>
                  <span className="inline-flex items-center gap-1 font-mono">
                    <Phone className="h-3 w-3 text-emerald-200" />
                    <span>{ledger.supplier.phone || 'No phone recorded'}</span>
                  </span>
                </div>
              </div>
            </div>

            {/* Glowing Financial Balance Box */}
            <div className="flex items-center gap-3">
              <div className="bg-white/10 backdrop-blur-xs border border-white/20 px-4 py-2.5 rounded-xl text-right min-w-[200px]">
                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">
                  {netDue > 0 ? 'Total Payable Due' : 'Account Settled'}
                </div>
                <div className="text-2xl font-black font-mono text-white mt-0.5">
                  {formatPKR(Math.abs(netDue))}
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="p-2.5 rounded-lg bg-white/15 hover:bg-white/25 text-white border border-white/20 transition-colors"
                  title="Print Statement"
                >
                  <Printer className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setIsDeleteModalOpen(true)}
                  className="p-2.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-100 border border-rose-300/30 transition-colors"
                  title="Delete Supplier Profile"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Table Container - Only the Table gets Clean Borders */}
          <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden flex flex-col">
            <div className="px-4 py-3 bg-[#f1f5f9] border-b border-slate-300 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Receipt className="h-4 w-4 text-[#08775A]" />
                <h2 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
                  Statement of Account & Ledger Entries
                </h2>
              </div>

              <div className="relative w-64">
                <Search className="h-3.5 w-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Filter by ref, items, or description..."
                  className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-slate-200 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                />
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b border-slate-300 bg-[#f1f5f9]">
                    <th className={TD_NUM}>#</th>
                    <th className={`${TH} w-32`}>Date & Time</th>
                    <th className={`${TH} w-32`}>Voucher / Ref</th>
                    <th className={`${TH} min-w-[280px]`}>Particulars / Description</th>
                    <th className={`${TH} w-24 text-center`}>Type</th>
                    <th className={`${TH} w-28 text-right`}>Bill (Cr)</th>
                    <th className={`${TH} w-28 text-right`}>Paid (Dr)</th>
                    <th className={`${TH} w-32 text-right`}>Running Balance</th>
                    <th className={`${TH} w-20 text-center`}>Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-700">
                  {displayRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-8 text-center text-slate-400">
                        No transactions recorded for this supplier.
                      </td>
                    </tr>
                  ) : (
                    displayRows.map((e, index) => {
                      const isPurchase = e.entryType === 'PURCHASE_CREDIT';
                      const isPayment = e.entryType === 'PAYMENT';
                      const isReturn = e.entryType === 'RETURN' || e.entryType === 'CREDIT_NOTE';
                      const isAdjustment = e.entryType === 'ADJUSTMENT';
                      const adjIncreasesPayable = isAdjustment && Number(e.amount) >= 0;

                      return (
                        <tr key={e.id} className="hover:bg-slate-50/90 transition-colors group border-b border-slate-200">
                          <td className={TD_NUM}>{index + 1}</td>
                          <td className={TD}>
                            <span className="font-mono text-slate-700">
                              {formatDateTimeDDMMYYYY(e.createdAt)}
                            </span>
                          </td>
                          <td className={TD}>
                            <span className="font-mono font-bold text-slate-800">
                              {formatShortRef(e.invoiceReference || e.referenceId, e.id, 'REF')}
                            </span>
                          </td>
                          <td className={TD}>
                            <span className="font-medium text-slate-900 whitespace-nowrap">
                              {formatParticulars(e)} {e.actor?.username && <span className="text-[11px] text-slate-400 font-normal">({e.actor.username})</span>}
                            </span>
                          </td>
                          <td className={`${TD} text-center`}>
                            <span
                              className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                isPurchase
                                  ? 'bg-amber-50 text-amber-900 border border-amber-200'
                                  : isPayment
                                  ? 'bg-blue-50 text-blue-900 border border-blue-200'
                                  : isAdjustment
                                  ? 'bg-purple-50 text-purple-900 border border-purple-200'
                                  : 'bg-rose-50 text-rose-900 border border-rose-200'
                              }`}
                            >
                              {isPurchase ? 'Bill' : isPayment ? 'Payment' : isAdjustment ? 'Adjustment' : 'Return'}
                            </span>
                          </td>
                          <td className={`${TD} text-right font-mono font-bold text-slate-900`}>
                            {isPurchase || (isAdjustment && adjIncreasesPayable) ? formatPKR(Math.abs(Number(e.amount))) : '—'}
                          </td>
                          <td className={`${TD} text-right font-mono font-bold text-emerald-700`}>
                            {isPayment || isReturn || (isAdjustment && !adjIncreasesPayable) ? formatPKR(Math.abs(Number(e.amount))) : '—'}
                          </td>
                          <td className={`${TD} text-right font-mono font-bold text-slate-900`}>
                            {formatPKR(Math.abs(Number(e.runningBalance)))}
                            <span className="text-[10px] text-slate-400 font-normal ml-1">
                              {Number(e.runningBalance) >= 0 ? 'Cr' : 'Dr'}
                            </span>
                          </td>
                          <td className={`${TD} text-center`}>
                            {isPurchase && netDue > 0 && (
                              <button
                                type="button"
                                onClick={() => openPayModal(Number(e.amount))}
                                className="px-2.5 py-1 text-[11px] font-semibold rounded bg-[#effaf5] text-[#0e7d5a] hover:bg-[#d8f4ea] border border-[#a2dfcb] transition-colors"
                              >
                                Pay
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
                {displayRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-50 border-t-2 border-slate-200 font-bold text-slate-900 text-xs">
                      <td colSpan={5} className="py-3 px-4 text-right uppercase tracking-wider">
                        Totals & Closing Position:
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-slate-900 border-r border-slate-200">
                        {formatPKR(totalPurchases)}
                      </td>
                      <td className="py-3 px-3.5 text-right font-mono text-emerald-700 border-r border-slate-200">
                        {formatPKR(totalPayments + totalCredits)}
                      </td>
                      <td className={`py-3 px-3.5 text-right font-mono text-sm ${netDue > 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                        {formatPKR(Math.abs(netDue))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </>
      ) : null}

      {/* Disburse Payment to Supplier Modal */}
      <Modal
        isOpen={isPayModalOpen}
        onClose={() => setIsPayModalOpen(false)}
        title="Disburse Payment to Supplier"
        subtitle={`Record vendor disbursement for ${ledger?.supplier?.name ?? 'supplier'}.`}
        footer={
          <div className="flex items-center justify-between w-full">
            <span className="text-xs text-slate-500">
              Current Due:{' '}
              <strong className="text-rose-700 font-mono">
                {formatPKR(Number(ledger?.totalOutstanding ?? 0))}
              </strong>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setIsPayModalOpen(false)}
                className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handlePaySupplier}
                disabled={paying || !Number(payAmount) || Number(payAmount) > netDue}
                className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#08775A] hover:bg-[#065f46] text-white disabled:opacity-50 inline-flex items-center gap-1.5 shadow-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                <span>{paying ? 'Recording…' : 'Confirm Disbursement'}</span>
              </button>
            </div>
          </div>
        }
      >
        <div className="space-y-3.5">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-700">Vendor</span>
              <span className="text-xs font-bold text-slate-900">{ledger?.supplier?.name}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className="text-xs text-slate-500">Payment Terms</span>
              <span className="text-xs text-slate-700 font-medium">
                {ledger?.supplier?.terms || 'Net 30 Days'}
              </span>
            </div>
          </div>

          <NumberInput
            label="Payment Amount (PKR)"
            required
            placeholder="e.g. 50000"
            value={payAmount}
            onChange={(e) => setPayAmount(e.target.value)}
            min={0.01}
            max={netDue}
            hint={`Cannot exceed the outstanding balance of ${formatPKR(netDue)}.`}
          />

          <Select
            label="Disbursement Method"
            required
            value={payMethod}
            onChange={(e) => setPayMethod(e.target.value as any)}
            options={[
              { value: 'PETTY_CASH', label: 'Petty Cash (Immediate Cash)' },
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
            <p className="text-[10px] text-slate-500 mt-1">
              Consecutive disbursement voucher stamped in general financial audit log.
            </p>
          </div>
        </div>
      </Modal>

      {/* Add Approved Adjustment Modal (inventory.md §5) */}
      <Modal
        isOpen={isAdjModalOpen}
        onClose={() => setIsAdjModalOpen(false)}
        title="Add Approved Adjustment"
        subtitle={`Posts a stock adjustment that also updates ${ledger?.supplier?.name ?? 'this supplier'}'s ledger.`}
        footer={
          <>
            <button type="button" onClick={() => setIsAdjModalOpen(false)} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={handleCreateAdjustment} disabled={savingAdj} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#129b70] text-white hover:bg-[#0e7d5a] disabled:opacity-50">
              {savingAdj ? 'Posting…' : 'Post Adjustment'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            label="Item"
            required
            value={adjStockItemId}
            onChange={(e) => setAdjStockItemId(e.target.value)}
            options={stockItems.map((it) => ({ value: it.id, label: `${it.code} — ${it.name} (Available: ${it.currentStock} ${it.unit})` }))}
          />
          <TextInput label="Batch No. (optional)" value={adjBatchNo} onChange={(e) => setAdjBatchNo(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Adjustment Type"
              required
              value={adjType}
              onChange={(e) => handleAdjTypeChange(e.target.value as typeof adjType)}
              options={[
                { value: 'DAMAGE', label: 'Damage' },
                { value: 'EXPIRY', label: 'Expiry' },
                { value: 'LOSS', label: 'Loss' },
                { value: 'SURPLUS', label: 'Surplus' },
                { value: 'QUARANTINE', label: 'Quarantine' },
                { value: 'COUNT_CORRECTION', label: 'Count Correction' },
              ]}
            />
            <Select
              label="Direction"
              required
              value={adjDirection}
              onChange={(e) => setAdjDirection(e.target.value as any)}
              disabled={!!ADJ_FIXED_DIRECTION[adjType]}
              hint={ADJ_FIXED_DIRECTION[adjType] ? `${adjType} is always a stock ${ADJ_FIXED_DIRECTION[adjType] === 'INCREASE' ? 'increase' : 'decrease'}.` : undefined}
              options={[
                { value: 'DECREASE', label: 'Decrease Stock' },
                { value: 'INCREASE', label: 'Increase Stock' },
              ]}
            />
          </div>
          <NumberInput label="Quantity" required value={adjQuantity} onChange={(e) => setAdjQuantity(e.target.value)} />
          <TextInput label="Reason" required value={adjReason} onChange={(e) => setAdjReason(e.target.value)} />
          <p className="text-[11px] text-slate-500 bg-slate-50 border border-slate-200 rounded-lg p-2.5">
            Valued off {ledger?.supplier?.name ?? 'this supplier'}'s most recent purchase rate for the item. A stock decrease reduces what's owed to them; a stock increase adds to it.
          </p>
        </div>
      </Modal>

      {/* Quick Add Supplier Modal */}
      <Modal
        isOpen={isAddSupplierOpen}
        onClose={() => setIsAddSupplierOpen(false)}
        title="Add New Supplier"
        subtitle="Register vendor master profile immediately without leaving the page."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsAddSupplierOpen(false)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreateSupplier}
              disabled={savingSupplier}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#08775A] hover:bg-[#065f46] text-white disabled:opacity-50"
            >
              {savingSupplier ? 'Saving…' : 'Create & Select'}
            </button>
          </div>
        }
      >
        <div className="space-y-3">
          <TextInput
            label="Supplier / Vendor Name"
            required
            placeholder="e.g. Al-Madina Medical Supplies"
            value={newSupplierName}
            onChange={(e) => setNewSupplierName(e.target.value)}
          />
          <div className="grid grid-cols-2 gap-3">
            <TextInput
              label="Contact Person"
              placeholder="e.g. Tariq Mehmood"
              value={newSupplierContact}
              onChange={(e) => setNewSupplierContact(e.target.value)}
            />
            <TextInput
              label="Phone / Mobile"
              placeholder="e.g. 0300-1234567"
              value={newSupplierPhone}
              onChange={(e) => setNewSupplierPhone(e.target.value)}
            />
          </div>
          <Select
            label="Default Payment Terms"
            value={newSupplierTerms}
            onChange={(e) => setNewSupplierTerms(e.target.value)}
            options={[
              { value: 'Net 15 Days', label: 'Net 15 Days' },
              { value: 'Net 30 Days', label: 'Net 30 Days' },
              { value: 'Net 45 Days', label: 'Net 45 Days' },
              { value: 'Net 60 Days', label: 'Net 60 Days' },
              { value: 'Immediate Cash', label: 'Immediate Cash' },
              { value: 'Advance Payment', label: 'Advance Payment' },
            ]}
          />
        </div>
      </Modal>

      {/* Delete Supplier Confirmation Modal */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Delete Supplier Profile"
        subtitle="This action will permanently delete this supplier account."
        footer={
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsDeleteModalOpen(false)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleDeleteSupplier}
              disabled={deletingSupplier}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 inline-flex items-center gap-1.5"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>{deletingSupplier ? 'Deleting…' : 'Permanently Delete'}</span>
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
                Deleting <strong>{ledger?.supplier?.name}</strong> will purge all purchase orders,
                ledger vouchers, and financial entries linked to this supplier.
              </p>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};
