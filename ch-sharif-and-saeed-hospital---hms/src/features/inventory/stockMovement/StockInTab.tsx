import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Lock, CreditCard, SlidersHorizontal, Undo2, Share2 } from 'lucide-react';
import { DataTable } from '../../../components/tables/DataTable';
import { TableColumn } from '../../../types';
import { Modal } from '../../../components/common/Modal';
import { TextInput, NumberInput, Select } from '../../../components/forms/FormControls';
import { inventoryApiService, BackendSupplier, BackendStockItem } from '../../../services/inventoryApiService';
import { inventoryReportsApiService } from '../../../services/inventoryReportsApiService';
import { setupApiService, BackendDepartment } from '../../../services/setupApiService';
import { useToast } from '../../../context/ToastContext';
import { toErrorMessage } from '../../../utils/apiErrors';
import { formatPKR, formatDateTimeDDMMYYYY, formatShortRef } from '../../../utils/formatters';

interface PurchaseLine {
  stockItemId: string;
  quantity: string;
  rate: string;
  batchNo: string;
  expiryDate: string;
}

const emptyLine = (): PurchaseLine => ({ stockItemId: '', quantity: '', rate: '', batchNo: '', expiryDate: '' });

export const StockInTab: React.FC = () => {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [suppliers, setSuppliers] = useState<BackendSupplier[]>([]);
  const [items, setItems] = useState<BackendStockItem[]>([]);
  const [departments, setDepartments] = useState<BackendDepartment[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [invoiceReference, setInvoiceReference] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'PETTY_CASH' | 'MANAGEMENT_DIRECT' | 'ONLINE' | 'CREDIT'>('CREDIT');
  const [lines, setLines] = useState<PurchaseLine[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);

  // Quick Add Supplier Modal
  const [isQuickSupplierOpen, setIsQuickSupplierOpen] = useState(false);
  const [quickSupplierForm, setQuickSupplierForm] = useState({
    name: '',
    contact: '',
    phone: '',
    terms: 'Net 30 Days',
  });
  const [savingQuickSupplier, setSavingQuickSupplier] = useState(false);

  // Quick Pay Modal
  const [quickPayTarget, setQuickPayTarget] = useState<{
    supplierId: string;
    supplierName: string;
    amount: number;
  } | null>(null);
  const [payAmount, setPayAmount] = useState('');
  const [payMethod, setPayMethod] = useState<'PETTY_CASH' | 'MANAGEMENT_DIRECT' | 'ONLINE'>('PETTY_CASH');
  const [paying, setPaying] = useState(false);

  // Quick Adjust Modal (Adj+)
  const [quickAdjustTarget, setQuickAdjustTarget] = useState<any | null>(null);
  const [adjustItemId, setAdjustItemId] = useState('');
  const [adjustBatchNo, setAdjustBatchNo] = useState('');
  const [adjustType, setAdjustType] = useState<'DAMAGE' | 'EXPIRY' | 'COUNT_CORRECTION' | 'LOSS' | 'SURPLUS' | 'QUARANTINE'>('DAMAGE');
  const [adjustDirection, setAdjustDirection] = useState<'INCREASE' | 'DECREASE'>('DECREASE');
  const [adjustQuantity, setAdjustQuantity] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [savingAdjust, setSavingAdjust] = useState(false);

  // Quick Return Modal (Return)
  const [quickReturnTarget, setQuickReturnTarget] = useState<any | null>(null);
  const [returnItemId, setReturnItemId] = useState('');
  const [returnQuantity, setReturnQuantity] = useState('');
  const [returnRate, setReturnRate] = useState('');
  const [returnReason, setReturnReason] = useState('Damaged / Defective goods');
  const [returnRefundMethod, setReturnRefundMethod] = useState<'SUPPLIER_CREDIT' | 'CASH_REFUND'>('SUPPLIER_CREDIT');
  const [savingReturn, setSavingReturn] = useState(false);

  // Quick Issue Modal (Issue)
  const [quickIssueTarget, setQuickIssueTarget] = useState<any | null>(null);
  const [issueItemId, setIssueItemId] = useState('');
  const [issueDepartmentId, setIssueDepartmentId] = useState('');
  const [issueQuantity, setIssueQuantity] = useState('');
  const [issueReceivedByName, setIssueReceivedByName] = useState('');
  const [savingIssue, setSavingIssue] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    inventoryReportsApiService
      .getPurchases()
      .then((res) => setRows(res.rows))
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    inventoryApiService.getSuppliers().then(setSuppliers).catch(() => {});
    inventoryApiService.getStockItems().then(setItems).catch(() => {});
    setupApiService.getDepartments().then(setDepartments).catch(() => {});
  }, []);

  const openQuickAdjust = (purchase: any) => {
    setQuickAdjustTarget(purchase);
    const firstLine = purchase.lines?.[0];
    setAdjustItemId(firstLine?.stockItemId || items[0]?.id || '');
    setAdjustBatchNo(firstLine?.batchNo || '');
    setAdjustType('DAMAGE');
    setAdjustDirection('DECREASE');
    setAdjustQuantity('');
    setAdjustReason('');
  };

  const openQuickReturn = (purchase: any) => {
    setQuickReturnTarget(purchase);
    const firstLine = purchase.lines?.[0];
    setReturnItemId(firstLine?.stockItemId || '');
    setReturnQuantity(firstLine ? String(firstLine.quantity) : '');
    setReturnRate(firstLine ? String(firstLine.rate) : '');
    setReturnReason('Damaged / Defective goods');
    setReturnRefundMethod('SUPPLIER_CREDIT');
  };

  const openQuickIssue = (purchase: any) => {
    setQuickIssueTarget(purchase);
    const firstLine = purchase.lines?.[0];
    setIssueItemId(firstLine?.stockItemId || items[0]?.id || '');
    setIssueDepartmentId(departments[0]?.id || '');
    setIssueQuantity('');
    setIssueReceivedByName('');
  };

  const columns: TableColumn<any>[] = [
    {
      key: 'invoiceReference',
      header: 'GRN / Ref',
      render: (r) => (
        <span className="font-mono font-bold text-xs text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
          {formatShortRef(r.invoiceReference, r.id, 'GRN')}
        </span>
      ),
    },
    { key: 'supplier', header: 'Supplier', render: (r) => r.supplier?.name || '—' },
    {
      key: 'items',
      header: 'Items & Batch',
      render: (r) => {
        if (!r.lines || r.lines.length === 0) return <span className="text-slate-400 text-xs">—</span>;
        return (
          <div className="space-y-1 py-0.5">
            {r.lines.map((l: any, idx: number) => (
              <div key={idx} className="text-xs text-slate-800 flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-slate-900">{l.stockItem?.name || 'Item'}</span>
                <span className="text-slate-500 font-mono text-[11px]">× {l.quantity} {l.stockItem?.unit || ''}</span>
                {l.batchNo && (
                  <span className="font-mono text-[10px] bg-slate-100 text-slate-600 px-1 py-0.2 rounded border border-slate-200">
                    {formatShortRef(l.batchNo, '', 'BN')}
                  </span>
                )}
              </div>
            ))}
          </div>
        );
      },
    },
    { key: 'createdAt', header: 'Date', render: (r) => formatDateTimeDDMMYYYY(r.createdAt) },
    { key: 'paymentMethod', header: 'Payment' },
    { key: 'totalAmount', header: 'Total', align: 'right', render: (r) => formatPKR(r.totalAmount) },
    {
      key: 'due',
      header: 'Due',
      align: 'right',
      render: (r) => formatPKR(r.paymentMethod === 'CREDIT' ? r.totalAmount : 0),
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (r) => {
        const due = r.paymentMethod === 'CREDIT' ? Number(r.totalAmount) : 0;
        return (
          <div className="flex items-center justify-end gap-1.5 flex-nowrap" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              title="Stock Adjustment (Damage, Expiry, Correction)"
              onClick={() => openQuickAdjust(r)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-purple-50 text-purple-700 hover:bg-purple-100 border border-purple-200 transition-colors shadow-2xs cursor-pointer"
            >
              <SlidersHorizontal className="h-3 w-3" />
              <span>Adj+</span>
            </button>

            <button
              type="button"
              title="Supplier Return (Defective, Damaged, Excess)"
              onClick={() => openQuickReturn(r)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200 transition-colors shadow-2xs cursor-pointer"
            >
              <Undo2 className="h-3 w-3" />
              <span>Return</span>
            </button>

            <button
              type="button"
              title="Issue to Department"
              onClick={() => openQuickIssue(r)}
              className="inline-flex items-center gap-1 px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 transition-colors shadow-2xs cursor-pointer"
            >
              <Share2 className="h-3 w-3" />
              <span>Issue</span>
            </button>

            {due > 0 ? (
              <button
                type="button"
                title="Pay Supplier Outstanding"
                onClick={() => {
                  setQuickPayTarget({
                    supplierId: r.supplierId,
                    supplierName: r.supplier?.name || 'Supplier',
                    amount: due,
                  });
                  setPayAmount(String(due));
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded text-xs font-semibold bg-[#129b70] text-white hover:bg-[#0e7d5a] shadow-2xs transition-colors cursor-pointer"
              >
                <CreditCard className="h-3 w-3" />
                <span>Pay</span>
              </button>
            ) : (
              <span className="inline-flex items-center px-2 py-1 rounded text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200">
                Settled
              </span>
            )}
          </div>
        );
      },
    },
  ];

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
      setSupplierId(created.id);
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
    if (!quickPayTarget) return;
    const amt = Number(payAmount);
    if (!amt || amt <= 0) {
      toast.error('Enter a valid payment amount.', 'Invalid Amount');
      return;
    }
    setPaying(true);
    try {
      const nextPay = (rows.length + 1) % 100 || 1;
      const ref = `PAY-${String(nextPay).padStart(2, '0')}`;
      await inventoryApiService.paySupplier(quickPayTarget.supplierId, {
        amount: amt,
        paymentMethod: payMethod,
        reference: ref,
      });
      toast.success(
        `Payment of ${formatPKR(amt)} recorded against ${quickPayTarget.supplierName}.`,
        'Payment Recorded'
      );
      setQuickPayTarget(null);
      load();
    } catch (e) {
      toast.error(toErrorMessage(e), 'Payment Failed');
    } finally {
      setPaying(false);
    }
  };

  const handleSaveAdjust = async () => {
    if (!adjustItemId) return toast.error('Select an item to adjust.', 'Missing Item');
    const qty = Number(adjustQuantity);
    if (!qty || qty <= 0) return toast.error('Enter a valid adjustment quantity.', 'Invalid Quantity');
    if (!adjustReason.trim()) return toast.error('Enter a reason for the adjustment.', 'Missing Reason');

    setSavingAdjust(true);
    try {
      const res = await inventoryApiService.createAdjustment({
        stockItemId: adjustItemId,
        batchNo: adjustBatchNo.trim() || undefined,
        type: adjustType,
        direction: adjustDirection,
        quantity: qty,
        reason: adjustReason.trim(),
      });
      const voucherRef = formatShortRef(res.voucherNo || '', res.id, 'ADJ');
      toast.success(`Stock adjusted (${voucherRef}) successfully.`, 'Adjustment Saved');
      setQuickAdjustTarget(null);
      load();
      inventoryApiService.getStockItems().then(setItems).catch(() => {});
    } catch (e) {
      toast.error(toErrorMessage(e), 'Adjustment Failed');
    } finally {
      setSavingAdjust(false);
    }
  };

  const handleSaveReturn = async () => {
    if (!quickReturnTarget) return;
    if (!returnItemId) return toast.error('Select an item to return.', 'Missing Item');
    const qty = Number(returnQuantity);
    if (!qty || qty <= 0) return toast.error('Enter a valid return quantity.', 'Invalid Quantity');
    const rate = Number(returnRate) || 0;

    setSavingReturn(true);
    try {
      const res = await inventoryApiService.returnToSupplier({
        supplierId: quickReturnTarget.supplierId,
        purchaseOrderId: quickReturnTarget.id,
        reason: returnReason,
        refundMethod: returnRefundMethod,
        lines: [{ stockItemId: returnItemId, quantity: qty, rate }],
      });
      const voucherRef = formatShortRef(res.voucherNo || '', res.id, 'SR');
      toast.success(`Return to supplier (${voucherRef}) processed successfully.`, 'Return Processed');
      setQuickReturnTarget(null);
      load();
      inventoryApiService.getStockItems().then(setItems).catch(() => {});
    } catch (e) {
      toast.error(toErrorMessage(e), 'Return Failed');
    } finally {
      setSavingReturn(false);
    }
  };

  const handleSaveIssue = async () => {
    if (!issueItemId) return toast.error('Select an item to issue.', 'Missing Item');
    if (!issueDepartmentId) return toast.error('Select a target department.', 'Missing Department');
    const qty = Number(issueQuantity);
    if (!qty || qty <= 0) return toast.error('Enter a valid quantity to issue.', 'Invalid Quantity');

    const it = items.find((i) => i.id === issueItemId);
    if (it && qty > Number(it.currentStock)) {
      return toast.error(
        `Cannot issue ${qty} units. Only ${it.currentStock} ${it.unit} available on hand.`,
        'Insufficient Stock'
      );
    }

    setSavingIssue(true);
    try {
      const res = await inventoryApiService.issueToDepartment({
        departmentId: issueDepartmentId,
        receivedByName: issueReceivedByName.trim() || undefined,
        lines: [{ stockItemId: issueItemId, quantity: qty }],
      });
      const voucherRef = formatShortRef(res.voucherNo || '', res.id, 'ISS');
      toast.success(`Stock issued to department (${voucherRef}) successfully.`, 'Issue Posted');
      setQuickIssueTarget(null);
      load();
      inventoryApiService.getStockItems().then(setItems).catch(() => {});
    } catch (e) {
      toast.error(toErrorMessage(e), 'Issue Failed');
    } finally {
      setSavingIssue(false);
    }
  };

  const openForm = () => {
    setSupplierId('');
    const nextNum = (rows.length + 1) % 100 || 1;
    const autoGrn = `GRN-${String(nextNum).padStart(2, '0')}`;
    const autoBatch = `BN-${String(nextNum).padStart(2, '0')}`;
    setInvoiceReference(autoGrn);
    setPaymentMethod('CREDIT');
    setLines([{ stockItemId: '', quantity: '', rate: '', batchNo: autoBatch, expiryDate: '' }]);
    setIsFormOpen(true);
  };

  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0);

  const handleSave = async () => {
    if (!supplierId) return toast.error('Select a supplier.', 'Missing Field');
    const validLines = lines.filter((l) => l.stockItemId && Number(l.quantity) > 0 && Number(l.rate) > 0);
    if (validLines.length === 0) return toast.error('Add at least one valid line item.', 'Missing Lines');

    setSaving(true);
    try {
      await inventoryApiService.createPurchase({
        supplierId,
        invoiceReference: invoiceReference.trim() || undefined,
        paymentMethod,
        lines: validLines.map((l) => ({
          stockItemId: l.stockItemId,
          quantity: Number(l.quantity),
          rate: Number(l.rate),
          batchNo: l.batchNo.trim() || undefined,
          expiryDate: l.expiryDate || undefined,
        })),
      });
      toast.success('Stock In posted and GRN recorded.', 'Stock In Posted');
      setIsFormOpen(false);
      load();
    } catch (e) {
      toast.error(toErrorMessage(e), 'Stock In Failed');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-3">
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.id}
        title="Stock In / Purchase"
        description="Goods received from suppliers — cash, bank, online or credit purchase."
        isLoading={loading}
        isError={!!error}
        errorMessage={error || undefined}
        onRefresh={load}
        onAddNew={openForm}
        addNewLabel="+ New Stock In"
        enableSelection={false}
        enableImport={false}
        dateFilterEnabled={false}
      />

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="New Stock In"
        maxWidth="3xl"
        footer={
          <>
            <span className="mr-auto text-xs font-semibold text-slate-600">Purchase Total: {formatPKR(total)}</span>
            <button type="button" onClick={() => setIsFormOpen(false)} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#129b70] text-white hover:bg-[#0e7d5a] disabled:opacity-50">
              {saving ? 'Posting…' : 'Post Stock In'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Supplier <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => setIsQuickSupplierOpen(true)}
                  className="text-[11px] font-bold text-[#129b70] hover:underline"
                >
                  + New Supplier
                </button>
              </div>
              <select
                value={supplierId}
                onChange={(e) => {
                  if (e.target.value === '__NEW__') {
                    setIsQuickSupplierOpen(true);
                  } else {
                    setSupplierId(e.target.value);
                  }
                }}
                className="w-full px-2.5 py-2 bg-white border border-slate-300 rounded text-xs text-slate-800 focus:outline-none focus:border-[#129b70]"
              >
                <option value="">Select Supplier...</option>
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
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  GRN / Voucher No.
                </label>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                  <Lock className="h-2.5 w-2.5" /> Auto-Generated
                </span>
              </div>
              <input
                type="text"
                value={invoiceReference}
                readOnly
                disabled
                className="w-full px-2.5 py-2 bg-slate-100 border border-slate-300 rounded text-xs font-mono font-bold text-slate-700 cursor-not-allowed select-none"
              />
            </div>
            <Select
              label="Payment Type"
              required
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as any)}
              options={[
                { value: 'CREDIT', label: 'Credit (Supplier Payable)' },
                { value: 'PETTY_CASH', label: 'Petty Cash' },
                { value: 'MANAGEMENT_DIRECT', label: 'Management Direct' },
                { value: 'ONLINE', label: 'Online / Bank' },
              ]}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase">Item Grid</span>
              <button
                type="button"
                onClick={() => setLines((ls) => [...ls, emptyLine()])}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0e7d5a] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Add Line
              </button>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 bg-slate-50 rounded-lg border border-slate-200">
                <div className="col-span-3">
                  <Select
                    label={idx === 0 ? 'Item' : undefined}
                    value={line.stockItemId}
                    onChange={(e) =>
                      setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, stockItemId: e.target.value } : l)))
                    }
                    options={items.map((it) => ({ value: it.id, label: `${it.code} — ${it.name}` }))}
                  />
                </div>
                <div className="col-span-2">
                  <TextInput
                    label={idx === 0 ? 'Batch' : undefined}
                    value={line.batchNo}
                    onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, batchNo: e.target.value } : l)))}
                  />
                </div>
                <div className="col-span-2">
                  <TextInput
                    label={idx === 0 ? 'Expiry' : undefined}
                    type="date"
                    value={line.expiryDate}
                    onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, expiryDate: e.target.value } : l)))}
                  />
                </div>
                <div className="col-span-2">
                  <NumberInput
                    label={idx === 0 ? 'Qty' : undefined}
                    value={line.quantity}
                    onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)))}
                  />
                </div>
                <div className="col-span-2">
                  <NumberInput
                    label={idx === 0 ? 'Unit Cost' : undefined}
                    value={line.rate}
                    onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, rate: e.target.value } : l)))}
                  />
                </div>
                <div className="col-span-1 flex justify-end">
                  {lines.length > 1 && (
                    <button type="button" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))} className="p-1.5 text-rose-600 hover:bg-rose-50 rounded">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>

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

      {/* Quick Pay Modal */}
      <Modal
        isOpen={!!quickPayTarget}
        onClose={() => setQuickPayTarget(null)}
        title={`Record Payment — ${quickPayTarget?.supplierName ?? 'Supplier'}`}
        subtitle="Disburse funds against supplier payable balance. Deducts physical cash if Petty Cash is selected."
        maxWidth="md"
        footer={
          <>
            <button
              type="button"
              onClick={() => setQuickPayTarget(null)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleQuickPay}
              disabled={paying}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-[#129b70] text-white hover:bg-[#0e7d5a] disabled:opacity-50"
            >
              {paying ? 'Recording…' : 'Record Payment'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div className="text-[10px] text-slate-500 uppercase font-bold">Outstanding Invoice Due</div>
            <div className="text-lg font-bold text-rose-700 font-mono mt-0.5">
              {formatPKR(quickPayTarget?.amount ?? 0)}
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
      {/* Quick Adjust Modal (Adj+) */}
      <Modal
        isOpen={!!quickAdjustTarget}
        onClose={() => setQuickAdjustTarget(null)}
        title={`Adjust Stock — ${quickAdjustTarget?.invoiceReference ? formatShortRef(quickAdjustTarget.invoiceReference, quickAdjustTarget.id, 'GRN') : 'Purchase'}`}
        subtitle="Log damage, expiry, count correction, or surplus directly against stock items."
        maxWidth="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setQuickAdjustTarget(null)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveAdjust}
              disabled={savingAdjust}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-purple-700 text-white hover:bg-purple-800 disabled:opacity-50 cursor-pointer"
            >
              {savingAdjust ? 'Adjusting…' : 'Save Adjustment'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <Select
            label="Select Item to Adjust"
            required
            value={adjustItemId}
            onChange={(e) => {
              const id = e.target.value;
              setAdjustItemId(id);
              const foundLine = quickAdjustTarget?.lines?.find((l: any) => l.stockItemId === id);
              if (foundLine?.batchNo) setAdjustBatchNo(foundLine.batchNo);
            }}
            options={(quickAdjustTarget?.lines || []).map((l: any) => ({
              value: l.stockItemId,
              label: `${l.stockItem?.name || 'Item'} (Purchased: ${l.quantity} ${l.stockItem?.unit || ''})`,
            }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Adjustment Type"
              required
              value={adjustType}
              onChange={(e) => {
                const t = e.target.value as any;
                setAdjustType(t);
                if (t === 'SURPLUS') setAdjustDirection('INCREASE');
                else if (t === 'DAMAGE' || t === 'EXPIRY' || t === 'LOSS' || t === 'QUARANTINE') setAdjustDirection('DECREASE');
              }}
              options={[
                { value: 'DAMAGE', label: 'Damage (Broken / Spoiled)' },
                { value: 'EXPIRY', label: 'Expiry (Past shelf life)' },
                { value: 'LOSS', label: 'Loss / Pilferage' },
                { value: 'SURPLUS', label: 'Surplus (Found extra)' },
                { value: 'COUNT_CORRECTION', label: 'Count Correction' },
                { value: 'QUARANTINE', label: 'Quarantine' },
              ]}
            />
            <TextInput
              label="Batch Number"
              value={adjustBatchNo}
              onChange={(e) => setAdjustBatchNo(e.target.value)}
              placeholder="e.g. BN-01"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Quantity"
              required
              value={adjustQuantity}
              onChange={(e) => setAdjustQuantity(e.target.value)}
              placeholder="Units to adjust"
            />
            <Select
              label="Direction"
              value={adjustDirection}
              disabled={adjustType !== 'COUNT_CORRECTION'}
              onChange={(e) => setAdjustDirection(e.target.value as any)}
              options={[
                { value: 'DECREASE', label: 'Decrease (Deduct from stock)' },
                { value: 'INCREASE', label: 'Increase (Add to stock)' },
              ]}
            />
          </div>

          <TextInput
            label="Reason / Notes"
            required
            placeholder="e.g. Damaged during unboxing, Ampoule leakage"
            value={adjustReason}
            onChange={(e) => setAdjustReason(e.target.value)}
          />
        </div>
      </Modal>

      {/* Quick Supplier Return Modal (Return) */}
      <Modal
        isOpen={!!quickReturnTarget}
        onClose={() => setQuickReturnTarget(null)}
        title={`Return to Supplier — ${quickReturnTarget?.supplier?.name ?? 'Supplier'}`}
        subtitle={`GRN Ref: ${quickReturnTarget?.invoiceReference ? formatShortRef(quickReturnTarget.invoiceReference, quickReturnTarget.id, 'GRN') : '—'}`}
        maxWidth="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setQuickReturnTarget(null)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveReturn}
              disabled={savingReturn}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 disabled:opacity-50 cursor-pointer"
            >
              {savingReturn ? 'Returning…' : 'Confirm Return'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <Select
            label="Select Item to Return"
            required
            value={returnItemId}
            onChange={(e) => {
              const id = e.target.value;
              setReturnItemId(id);
              const foundLine = quickReturnTarget?.lines?.find((l: any) => l.stockItemId === id);
              if (foundLine) {
                setReturnQuantity(String(foundLine.quantity));
                setReturnRate(String(foundLine.rate));
              }
            }}
            options={(quickReturnTarget?.lines || []).map((l: any) => ({
              value: l.stockItemId,
              label: `${l.stockItem?.name || 'Item'} (Purchased: ${l.quantity} ${l.stockItem?.unit || ''} @ ${formatPKR(l.rate)})`,
            }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Return Quantity"
              required
              value={returnQuantity}
              onChange={(e) => setReturnQuantity(e.target.value)}
              placeholder="e.g. 5"
            />
            <NumberInput
              label="Unit Rate (PKR)"
              required
              value={returnRate}
              onChange={(e) => setReturnRate(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Return Reason"
              required
              value={returnReason}
              onChange={(e) => setReturnReason(e.target.value)}
              options={[
                { value: 'Damaged / Defective goods', label: 'Damaged / Defective goods' },
                { value: 'Wrong item delivered', label: 'Wrong item delivered' },
                { value: 'Near expiry / Expired item', label: 'Near expiry / Expired item' },
                { value: 'Excess stock / Cancelled requirement', label: 'Excess stock / Cancelled' },
              ]}
            />
            <Select
              label="Refund Method"
              required
              value={returnRefundMethod}
              onChange={(e) => setReturnRefundMethod(e.target.value as any)}
              options={[
                { value: 'SUPPLIER_CREDIT', label: 'Supplier Credit (Deduct from payable)' },
                { value: 'CASH_REFUND', label: 'Cash Refund (Immediate physical cash)' },
              ]}
            />
          </div>
        </div>
      </Modal>

      {/* Quick Issue to Department Modal (Issue) */}
      <Modal
        isOpen={!!quickIssueTarget}
        onClose={() => setQuickIssueTarget(null)}
        title="Issue Stock to Department"
        subtitle="Disburse purchased stock to hospital department against requisition."
        maxWidth="lg"
        footer={
          <>
            <button
              type="button"
              onClick={() => setQuickIssueTarget(null)}
              className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSaveIssue}
              disabled={savingIssue}
              className="px-4 py-1.5 text-xs font-semibold rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 cursor-pointer"
            >
              {savingIssue ? 'Issuing…' : 'Issue Stock'}
            </button>
          </>
        }
      >
        <div className="space-y-3 text-xs">
          <Select
            label="Select Item to Issue"
            required
            value={issueItemId}
            onChange={(e) => setIssueItemId(e.target.value)}
            options={(quickIssueTarget?.lines || []).map((l: any) => {
              const liveItem = items.find((i) => i.id === l.stockItemId);
              return {
                value: l.stockItemId,
                label: `${l.stockItem?.name || 'Item'} (On-Hand: ${liveItem?.currentStock ?? l.quantity} ${l.stockItem?.unit || ''})`,
              };
            })}
          />

          <Select
            label="Target Department"
            required
            value={issueDepartmentId}
            onChange={(e) => setIssueDepartmentId(e.target.value)}
            options={departments.map((d) => ({
              value: d.id,
              label: `${d.name} (${d.code || d.type})`,
            }))}
          />

          <div className="grid grid-cols-2 gap-3">
            <NumberInput
              label="Quantity to Issue"
              required
              value={issueQuantity}
              onChange={(e) => setIssueQuantity(e.target.value)}
              placeholder="e.g. 10"
            />
            <TextInput
              label="Received By (Staff / Nurse Name)"
              placeholder="e.g. Nurse Sara / Staff Ahmed"
              value={issueReceivedByName}
              onChange={(e) => setIssueReceivedByName(e.target.value)}
            />
          </div>
        </div>
      </Modal>
    </div>
  );
};
