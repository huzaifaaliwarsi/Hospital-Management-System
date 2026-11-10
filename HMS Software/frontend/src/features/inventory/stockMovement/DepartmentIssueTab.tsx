import React, { useEffect, useState } from 'react';
import { Plus, Trash2, Lock } from 'lucide-react';
import { DataTable } from '../../../components/tables/DataTable';
import { TableColumn } from '../../../types';
import { Modal } from '../../../components/common/Modal';
import { TextInput, NumberInput, Select } from '../../../components/forms/FormControls';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { inventoryApiService, BackendStockItem } from '../../../services/inventoryApiService';
import { inventoryReportsApiService } from '../../../services/inventoryReportsApiService';
import { setupApiService, BackendDepartment } from '../../../services/setupApiService';
import { useToast } from '../../../context/ToastContext';
import { toErrorMessage } from '../../../utils/apiErrors';
import { formatDateTimeDDMMYYYY, formatShortRef } from '../../../utils/formatters';

interface IssueLine {
  stockItemId: string;
  quantity: string;
}

export const DepartmentIssueTab: React.FC = () => {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [departments, setDepartments] = useState<BackendDepartment[]>([]);
  const [items, setItems] = useState<BackendStockItem[]>([]);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [departmentId, setDepartmentId] = useState('');
  const [receivedByName, setReceivedByName] = useState('');
  const [lines, setLines] = useState<IssueLine[]>([{ stockItemId: '', quantity: '' }]);
  const [saving, setSaving] = useState(false);

  const load = () => {
    setLoading(true);
    setError(null);
    inventoryReportsApiService
      .getDepartmentIssueReturn()
      .then((res) => setRows(res.rows))
      .catch((e) => setError(toErrorMessage(e)))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);
  useEffect(() => {
    setupApiService.getDepartments().then(setDepartments).catch(() => {});
    inventoryApiService.getStockItems().then(setItems).catch(() => {});
  }, []);

  const columns: TableColumn<any>[] = [
    {
      key: 'voucherNo',
      header: 'Voucher No.',
      render: (r) => (
        <span className="font-mono font-bold text-xs text-blue-800 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
          {formatShortRef(r.voucherNo, r.id, 'ISS')}
        </span>
      ),
    },
    { key: 'department', header: 'Department', render: (r) => <span className="font-semibold text-slate-800">{r.department}</span> },
    {
      key: 'lines',
      header: 'Issued Items & Qty',
      render: (r) => (
        <div className="space-y-1 py-0.5">
          {r.lines?.map((l: any, idx: number) => (
            <div key={idx} className="text-xs text-slate-800 flex items-center gap-1.5 flex-wrap">
              <span className="font-medium text-slate-900">{l.item || l.stockItem?.name || 'Item'}</span>
              <span className="text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold border border-blue-200">
                {l.issuedQty ?? l.quantity} {l.unit || l.stockItem?.unit || ''}
              </span>
            </div>
          ))}
        </div>
      ),
    },
    { key: 'issuedAt', header: 'Date', render: (r) => formatDateTimeDDMMYYYY(r.issuedAt) },
    { key: 'receivedByName', header: 'Received By', render: (r) => r.receivedByName || '—' },
    { key: 'issuedBy', header: 'Issued By' },
    { key: 'status', header: 'Status', align: 'center', render: (r) => <StatusBadge status={r.status} size="sm" /> },
  ];

  const openForm = () => {
    setDepartmentId('');
    setReceivedByName('');
    setLines([{ stockItemId: '', quantity: '' }]);
    setIsFormOpen(true);
  };

  const stockOf = (id: string) => items.find((i) => i.id === id);

  const handleSave = async () => {
    if (!departmentId) return toast.error('Select a department.', 'Missing Field');
    const validLines = lines.filter((l) => l.stockItemId && Number(l.quantity) > 0);
    if (validLines.length === 0) return toast.error('Add at least one item to issue.', 'Missing Lines');

    for (const l of validLines) {
      const it = stockOf(l.stockItemId);
      if (it && Number(l.quantity) > Number(it.currentStock)) {
        return toast.error(
          `Cannot issue ${l.quantity} of ${it.name}. Only ${it.currentStock} ${it.unit} available on-hand.`,
          'Insufficient Stock'
        );
      }
    }

    setSaving(true);
    try {
      await inventoryApiService.issueToDepartment({
        departmentId,
        receivedByName: receivedByName.trim() || undefined,
        lines: validLines.map((l) => ({ stockItemId: l.stockItemId, quantity: Number(l.quantity) })),
      });
      toast.success('Stock issued to department.', 'Department Issue Posted');
      setIsFormOpen(false);
      load();
    } catch (e) {
      toast.error(toErrorMessage(e), 'Issue Failed');
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
        title="Department Issues (Record Log)"
        description="Audit record of all stock items issued to hospital departments against requisitions."
        isLoading={loading}
        isError={!!error}
        errorMessage={error || undefined}
        onRefresh={load}
        onAddNew={openForm}
        addNewLabel="+ Issue Stock"
        enableSelection={false}
        enableImport={false}
        dateFilterEnabled={false}
      />

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Issue Stock to Department"
        maxWidth="2xl"
        footer={
          <>
            <button type="button" onClick={() => setIsFormOpen(false)} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#129b70] text-white hover:bg-[#0e7d5a] disabled:opacity-50">
              {saving ? 'Issuing…' : 'Issue Stock'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Issue Voucher No.
                </label>
                <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-200">
                  <Lock className="h-2.5 w-2.5" /> Auto-Generated
                </span>
              </div>
              <input
                type="text"
                value={`ISS-${String(((rows.length + 1) % 100) || 1).padStart(2, '0')}`}
                readOnly
                disabled
                className="w-full px-2.5 py-2 bg-slate-100 border border-slate-300 rounded text-xs font-mono font-bold text-slate-700 cursor-not-allowed select-none"
              />
            </div>
            <Select
              label="Department"
              required
              value={departmentId}
              onChange={(e) => setDepartmentId(e.target.value)}
              options={departments.map((d) => ({ value: d.id, label: d.name }))}
            />
            <TextInput label="Received By (name)" value={receivedByName} onChange={(e) => setReceivedByName(e.target.value)} />
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-700 uppercase">Item Grid</span>
              <button
                type="button"
                onClick={() => setLines((ls) => [...ls, { stockItemId: '', quantity: '' }])}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#0e7d5a] hover:underline"
              >
                <Plus className="h-3.5 w-3.5" /> Add Line
              </button>
            </div>
            {lines.map((line, idx) => {
              const item = stockOf(line.stockItemId);
              return (
                <div key={idx} className="grid grid-cols-12 gap-2 items-end p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="col-span-6">
                    <Select
                      label={idx === 0 ? 'Item' : undefined}
                      value={line.stockItemId}
                      onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, stockItemId: e.target.value } : l)))}
                      options={items.map((it) => ({ value: it.id, label: `${it.code} — ${it.name}` }))}
                    />
                  </div>
                  <div className="col-span-3 text-xs text-slate-500 pb-2">
                    {item ? `Available: ${item.currentStock} ${item.unit}` : ''}
                  </div>
                  <div className="col-span-2">
                    <NumberInput
                      label={idx === 0 ? 'Issue Qty' : undefined}
                      value={line.quantity}
                      onChange={(e) => setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)))}
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
              );
            })}
          </div>
        </div>
      </Modal>
    </div>
  );
};
