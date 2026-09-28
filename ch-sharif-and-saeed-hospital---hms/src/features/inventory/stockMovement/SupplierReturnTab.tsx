import React, { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { DataTable } from '../../../components/tables/DataTable';
import { TableColumn } from '../../../types';
import { Modal } from '../../../components/common/Modal';
import { TextInput, NumberInput, Select } from '../../../components/forms/FormControls';
import { inventoryApiService, BackendSupplier } from '../../../services/inventoryApiService';
import { inventoryReportsApiService } from '../../../services/inventoryReportsApiService';
import { useToast } from '../../../context/ToastContext';
import { toErrorMessage } from '../../../utils/apiErrors';
import { formatPKR, formatDateTimeDDMMYYYY, formatShortRef } from '../../../utils/formatters';

interface ReturnLine {
  stockItemId: string;
  quantity: string;
  rate: string;
}

export const SupplierReturnTab: React.FC = () => {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [suppliers, setSuppliers] = useState<BackendSupplier[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [purchaseOrderId, setPurchaseOrderId] = useState('');
  const [reason, setReason] = useState('');
  const [refundMethod, setRefundMethod] = useState<'SUPPLIER_CREDIT' | 'CASH_REFUND'>('SUPPLIER_CREDIT');
  const [lines, setLines] = useState<ReturnLine[]>([{ stockItemId: '', quantity: '', rate: '' }]);
  const [saving, setSaving] = useState(false);

  // Supplier Return history — read as Stock Movement filtered to SUPPLIER_RETURN entries.
  const load = () => {
    setLoading(true);
    setError(null);
    inventoryReportsApiService
      .getStockMovement({ movementType: 'SUPPLIER_RETURN' })
      .then((res) => setRows(res.rows))
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    inventoryApiService.getSuppliers().then(setSuppliers).catch(() => {});
  }, []);

  useEffect(() => {
    if (!supplierId) {
      setPurchaseOrders([]);
      setPurchaseOrderId('');
      return;
    }
    inventoryReportsApiService
      .getPurchases({ supplierId, preset: 'all' })
      .then((res) => setPurchaseOrders(res.rows))
      .catch(() => setPurchaseOrders([]));
  }, [supplierId]);

  const purchaseOrder = purchaseOrders.find((p) => p.id === purchaseOrderId);
  const availableItems: any[] = purchaseOrder ? purchaseOrder.lines : [];

  const columns: TableColumn<any>[] = [
    {
      key: 'voucherNo',
      header: 'Return Note No.',
      render: (r) => (
        <span className="font-mono font-bold text-xs text-rose-800 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
          {formatShortRef(r.voucherNo, r.id, 'SR')}
        </span>
      ),
    },
    {
      key: 'stockItem',
      header: 'Returned Item',
      render: (r) => (
        <div>
          <span className="font-semibold text-slate-800 text-xs">{r.stockItem?.name || '—'}</span>
          {r.stockItem?.code && (
            <span className="ml-1.5 font-mono text-[10px] text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
              {formatShortRef(r.stockItem.code, '', 'ITM')}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'quantityDelta',
      header: 'Qty Returned',
      align: 'right',
      render: (r) => (
        <span className="font-mono font-semibold text-rose-700 bg-rose-50 px-1.5 py-0.5 rounded border border-rose-100 text-xs">
          {Math.abs(Number(r.quantityDelta))} {r.stockItem?.unit ?? ''}
        </span>
      ),
    },
    { key: 'createdAt', header: 'Date', render: (r) => formatDateTimeDDMMYYYY(r.createdAt) },
    { key: 'actor', header: 'Processed By', render: (r) => r.actor?.username || '—' },
  ];

  const openForm = () => {
    setSupplierId('');
    setPurchaseOrderId('');
    setReason('');
    setRefundMethod('SUPPLIER_CREDIT');
    setLines([{ stockItemId: '', quantity: '', rate: '' }]);
    setIsFormOpen(true);
  };

  const total = lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.rate) || 0), 0);

  const handleSave = async () => {
    if (!supplierId || !purchaseOrderId) return toast.error('Select supplier and the original purchase.', 'Missing Field');
    if (!reason.trim()) return toast.error('A return reason is required.', 'Missing Reason');
    const validLines = lines.filter((l) => l.stockItemId && Number(l.quantity) > 0 && Number(l.rate) > 0);
    if (validLines.length === 0) return toast.error('Add at least one valid line item.', 'Missing Lines');

    setSaving(true);
    try {
      await inventoryApiService.returnToSupplier({
        supplierId,
        purchaseOrderId,
        reason: reason.trim(),
        refundMethod,
        lines: validLines.map((l) => ({ stockItemId: l.stockItemId, quantity: Number(l.quantity), rate: Number(l.rate) })),
      });
      toast.success('Stock returned to supplier.', 'Supplier Return Posted');
      setIsFormOpen(false);
      load();
    } catch (e) {
      toast.error(toErrorMessage(e), 'Return Failed');
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
        title="Supplier Returns (Record Log)"
        description="Audit log of all stock items returned to suppliers (defective, damaged or excess goods)."
        isLoading={loading}
        isError={!!error}
        errorMessage={error || undefined}
        onRefresh={load}
        onAddNew={openForm}
        addNewLabel="+ Return to Supplier"
        enableSelection={false}
        enableImport={false}
        dateFilterEnabled={false}
      />

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Return to Supplier"
        maxWidth="3xl"
        footer={
          <>
            <span className="mr-auto text-xs font-semibold text-slate-600">Return Total: {formatPKR(total)}</span>
            <button type="button" onClick={() => setIsFormOpen(false)} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#129b70] text-white hover:bg-[#0e7d5a] disabled:opacity-50">
              {saving ? 'Posting…' : 'Return to Supplier'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Supplier"
              required
              value={supplierId}
              onChange={(e) => setSupplierId(e.target.value)}
              options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
            />
            <Select
              label="Original Purchase"
              required
              value={purchaseOrderId}
              onChange={(e) => setPurchaseOrderId(e.target.value)}
              options={purchaseOrders.map((p) => ({
                value: p.id,
                label: `${p.invoiceReference || p.id.slice(0, 8)} — ${formatDateTimeDDMMYYYY(p.createdAt)}`,
              }))}
              placeholder={supplierId ? 'Select a purchase...' : 'Select a supplier first'}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TextInput label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} />
            <Select
              label="Refund Method"
              required
              value={refundMethod}
              onChange={(e) => setRefundMethod(e.target.value as any)}
              options={[
                { value: 'SUPPLIER_CREDIT', label: 'Adjust Supplier Balance/Credit' },
                { value: 'CASH_REFUND', label: 'Cash Refund to Me' },
              ]}
            />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase">Item Grid</span>
              <button
                type="button"
                onClick={() => setLines((ls) => [...ls, { stockItemId: '', quantity: '', rate: '' }])}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0e7d5a] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Add Line
              </button>
            </div>
            {lines.map((line, idx) => (
              <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 bg-slate-50 rounded-lg border border-slate-200">
                <div className="col-span-5">
                  <Select
                    label={idx === 0 ? 'Item' : undefined}
                    value={line.stockItemId}
                    onChange={(e) => {
                      const stockItemId = e.target.value;
                      const original = availableItems.find((it) => it.stockItemId === stockItemId);
                      setLines((ls) =>
                        ls.map((l, i) =>
                          i === idx ? { ...l, stockItemId, rate: original ? String(original.rate) : l.rate } : l,
                        ),
                      );
                    }}
                    options={availableItems.map((it) => ({
                      value: it.stockItemId,
                      label: `${it.stockItem?.code ?? ''} — ${it.stockItem?.name ?? it.stockItemId}`,
                    }))}
                    placeholder={purchaseOrderId ? 'Select item...' : 'Select a purchase first'}
                  />
                </div>
                <div className="col-span-3">
                  <NumberInput
                    label={idx === 0 ? 'Return Qty' : undefined}
                    value={line.quantity}
                    onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)))}
                  />
                </div>
                <div className="col-span-3">
                  <NumberInput
                    label={idx === 0 ? 'Rate' : undefined}
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
    </div>
  );
};
