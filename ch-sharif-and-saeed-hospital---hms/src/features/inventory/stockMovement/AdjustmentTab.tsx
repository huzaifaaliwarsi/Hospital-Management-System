import React, { useEffect, useState } from 'react';
import { DataTable } from '../../../components/tables/DataTable';
import { TableColumn } from '../../../types';
import { Modal } from '../../../components/common/Modal';
import { TextInput, NumberInput, Select } from '../../../components/forms/FormControls';
import { inventoryApiService, BackendStockItem, BackendSupplier } from '../../../services/inventoryApiService';
import { useToast } from '../../../context/ToastContext';
import { toErrorMessage } from '../../../utils/apiErrors';
import { formatDateTimeDDMMYYYY, formatShortRef } from '../../../utils/formatters';

type AdjustmentType = 'DAMAGE' | 'EXPIRY' | 'COUNT_CORRECTION' | 'LOSS' | 'SURPLUS' | 'QUARANTINE';

// Mirrors inventory.service.ts's FIXED_ADJUSTMENT_DIRECTION — only
// COUNT_CORRECTION genuinely needs the user's own choice.
const FIXED_DIRECTION: Partial<Record<AdjustmentType, 'INCREASE' | 'DECREASE'>> = {
  DAMAGE: 'DECREASE',
  EXPIRY: 'DECREASE',
  LOSS: 'DECREASE',
  QUARANTINE: 'DECREASE',
  SURPLUS: 'INCREASE',
};

export const AdjustmentTab: React.FC = () => {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<BackendStockItem[]>([]);
  const [suppliers, setSuppliers] = useState<BackendSupplier[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [stockItemId, setStockItemId] = useState('');
  const [batchNo, setBatchNo] = useState('');
  const [type, setType] = useState<AdjustmentType>('DAMAGE');
  const [direction, setDirection] = useState<'INCREASE' | 'DECREASE'>('DECREASE');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [linkToSupplier, setLinkToSupplier] = useState(false);
  const [supplierId, setSupplierId] = useState('');
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    inventoryApiService
      .listAdjustments()
      .then(setRows)
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    inventoryApiService.getStockItems().then(setItems).catch(() => {});
    inventoryApiService.getSuppliers().then(setSuppliers).catch(() => {});
  }, []);

  const columns: TableColumn<any>[] = [
    {
      key: 'voucherNo',
      header: 'Voucher No.',
      render: (r) => (
        <span className="font-mono font-bold text-xs text-purple-800 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
          {formatShortRef(r.voucherNo, r.id, 'ADJ')}
        </span>
      ),
    },
    {
      key: 'stockItem',
      header: 'Item',
      render: (r) => (
        <div>
          <span className="font-semibold text-slate-800 text-xs">{r.stockItem?.name || '—'}</span>
          {r.batchNo && (
            <span className="ml-1.5 font-mono text-[10px] text-slate-500 bg-slate-100 px-1 py-0.2 rounded border border-slate-200">
              {formatShortRef(r.batchNo, '', 'BN')}
            </span>
          )}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Type',
      render: (r) => {
        const typeStyles: Record<string, string> = {
          DAMAGE: 'bg-rose-50 text-rose-700 border-rose-200',
          EXPIRY: 'bg-amber-50 text-amber-700 border-amber-200',
          LOSS: 'bg-red-50 text-red-700 border-red-200',
          SURPLUS: 'bg-emerald-50 text-emerald-700 border-emerald-200',
          COUNT_CORRECTION: 'bg-blue-50 text-blue-700 border-blue-200',
          QUARANTINE: 'bg-purple-50 text-purple-700 border-purple-200',
        };
        const cls = typeStyles[r.type] || 'bg-slate-50 text-slate-700 border-slate-200';
        return (
          <span className={`px-2 py-0.5 rounded text-[11px] font-semibold border ${cls}`}>
            {r.type}
          </span>
        );
      },
    },
    {
      key: 'quantity',
      header: 'Qty Adjusted',
      align: 'right',
      render: (r) => (
        <span className="font-mono font-semibold text-slate-900 text-xs">
          {r.direction === 'DECREASE' ? '-' : '+'}{r.quantity} {r.stockItem?.unit ?? ''}
        </span>
      ),
    },
    { key: 'reason', header: 'Reason' },
    { key: 'createdAt', header: 'Date', render: (r) => formatDateTimeDDMMYYYY(r.createdAt) },
    { key: 'createdBy', header: 'By', render: (r) => r.createdByUser?.displayName || r.createdByUser?.username || '—' },
  ];

  const openForm = () => {
    setStockItemId('');
    setBatchNo('');
    setType('DAMAGE');
    setDirection('DECREASE');
    setQuantity('');
    setReason('');
    setLinkToSupplier(false);
    setSupplierId('');
    setIsFormOpen(true);
  };

  const handleTypeChange = (next: AdjustmentType) => {
    setType(next);
    const fixed = FIXED_DIRECTION[next];
    if (fixed) setDirection(fixed);
  };

  const handleSave = async () => {
    if (!stockItemId) return toast.error('Select an item.', 'Missing Field');
    if (!(Number(quantity) > 0)) return toast.error('Enter a quantity greater than zero.', 'Missing Field');
    if (!reason.trim()) return toast.error('A reason is required.', 'Missing Reason');
    if (linkToSupplier && !supplierId) return toast.error('Select a supplier to link this adjustment to their ledger.', 'Missing Field');

    setSaving(true);
    try {
      await inventoryApiService.createAdjustment({
        stockItemId,
        batchNo: batchNo.trim() || undefined,
        type,
        direction,
        quantity: Number(quantity),
        reason: reason.trim(),
        supplierId: linkToSupplier ? supplierId : undefined,
      });
      toast.success('Adjustment posted.', 'Adjustment Posted');
      setIsFormOpen(false);
      load();
    } catch (e) {
      toast.error(toErrorMessage(e), 'Adjustment Failed');
    } finally {
      setSaving(false);
    }
  };

  const directionLocked = !!FIXED_DIRECTION[type];

  return (
    <div className="space-y-3">
      <DataTable
        data={rows}
        columns={columns}
        keyExtractor={(r) => r.id}
        title="Stock Adjustments (Record Log)"
        description="Audit record of all inventory adjustments (damage, expiry, loss, surplus, count correction)."
        isLoading={loading}
        isError={!!error}
        errorMessage={error || undefined}
        onRefresh={load}
        onAddNew={openForm}
        addNewLabel="+ New Adjustment"
        enableSelection={false}
        enableImport={false}
        dateFilterEnabled={false}
      />

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="New Adjustment"
        footer={
          <>
            <button type="button" onClick={() => setIsFormOpen(false)} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#129b70] text-white hover:bg-[#0e7d5a] disabled:opacity-50">
              {saving ? 'Posting…' : 'Post Adjustment'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            label="Item"
            required
            value={stockItemId}
            onChange={(e) => setStockItemId(e.target.value)}
            options={items.map((it) => ({ value: it.id, label: `${it.code} — ${it.name} (Available: ${it.currentStock} ${it.unit})` }))}
          />
          <TextInput label="Batch No. (optional)" value={batchNo} onChange={(e) => setBatchNo(e.target.value)} />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Adjustment Type"
              required
              value={type}
              onChange={(e) => handleTypeChange(e.target.value as AdjustmentType)}
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
              value={direction}
              onChange={(e) => setDirection(e.target.value as any)}
              disabled={directionLocked}
              hint={directionLocked ? `${type} is always a stock ${FIXED_DIRECTION[type] === 'INCREASE' ? 'increase' : 'decrease'}.` : undefined}
              options={[
                { value: 'DECREASE', label: 'Decrease Stock' },
                { value: 'INCREASE', label: 'Increase Stock' },
              ]}
            />
          </div>
          <NumberInput label="Quantity" required value={quantity} onChange={(e) => setQuantity(e.target.value)} />
          <TextInput label="Reason" required value={reason} onChange={(e) => setReason(e.target.value)} />

          <div className="pt-1 border-t border-slate-100">
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 mt-2">
              <input type="checkbox" checked={linkToSupplier} onChange={(e) => setLinkToSupplier(e.target.checked)} />
              This item was bought from a vendor — also post this adjustment to their Supplier Ledger
            </label>
            {linkToSupplier && (
              <div className="mt-2">
                <Select
                  label="Supplier"
                  required
                  value={supplierId}
                  onChange={(e) => setSupplierId(e.target.value)}
                  options={suppliers.map((s) => ({ value: s.id, label: s.name }))}
                  hint="Valued off this supplier's most recent purchase rate for the item; increases/decreases what's owed to them."
                />
              </div>
            )}
          </div>
        </div>
      </Modal>
    </div>
  );
};
