import React, { useEffect, useState } from 'react';
import { DataTable } from '../../../components/tables/DataTable';
import { TableColumn } from '../../../types';
import { Modal } from '../../../components/common/Modal';
import { TextInput, NumberInput, Select } from '../../../components/forms/FormControls';
import { StatusBadge } from '../../../components/common/StatusBadge';
import { inventoryApiService } from '../../../services/inventoryApiService';
import { inventoryReportsApiService } from '../../../services/inventoryReportsApiService';
import { useToast } from '../../../context/ToastContext';
import { toErrorMessage } from '../../../utils/apiErrors';
import { formatDateTimeDDMMYYYY, formatShortRef } from '../../../utils/formatters';

interface ReturnLineState {
  lineId: string;
  item: string;
  unit: string;
  remaining: number;
  quantity: string;
  condition: 'USABLE' | 'DAMAGED' | 'EXPIRED';
}

export const DepartmentReturnTab: React.FC = () => {
  const toast = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [requisitionId, setRequisitionId] = useState('');
  const [returnedByName, setReturnedByName] = useState('');
  const [returnLines, setReturnLines] = useState<ReturnLineState[]>([]);
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

  const returnable = rows.filter((r) => r.status !== 'CLOSED');

  const columns: TableColumn<any>[] = [
    {
      key: 'voucherNo',
      header: 'Voucher No.',
      render: (r) => (
        <span className="font-mono font-bold text-xs text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
          {formatShortRef(r.voucherNo, r.id, 'RET')}
        </span>
      ),
    },
    { key: 'department', header: 'Department', render: (r) => <span className="font-semibold text-slate-800">{r.department}</span> },
    {
      key: 'returnedItems',
      header: 'Items & Return Status',
      render: (r) => (
        <div className="space-y-1 py-0.5">
          {r.lines?.map((l: any, idx: number) => {
            const ret = Number(l.returnedQty || 0);
            const iss = Number(l.issuedQty || 0);
            return (
              <div key={idx} className="text-xs text-slate-800 flex items-center gap-1.5 flex-wrap">
                <span className="font-medium text-slate-900">{l.item || 'Item'}</span>
                <span className={`px-1.5 py-0.5 rounded font-mono text-[11px] font-semibold border ${ret > 0 ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-600 border-slate-200'}`}>
                  {ret} returned of {iss} {l.unit || ''}
                </span>
              </div>
            );
          })}
        </div>
      ),
    },
    { key: 'issuedAt', header: 'Issued Date', render: (r) => formatDateTimeDDMMYYYY(r.issuedAt) },
    { key: 'issuedBy', header: 'Issued By' },
    { key: 'status', header: 'Status', align: 'center', render: (r) => <StatusBadge status={r.status} size="sm" /> },
  ];

  const openForm = (requisition?: any) => {
    setReturnedByName('');
    if (requisition) {
      selectRequisition(requisition.id, rows);
    } else {
      setRequisitionId('');
      setReturnLines([]);
    }
    setIsFormOpen(true);
  };

  const selectRequisition = (id: string, source: any[]) => {
    setRequisitionId(id);
    const req = source.find((r) => r.id === id);
    if (!req) {
      setReturnLines([]);
      return;
    }
    setReturnLines(
      req.lines
        .filter((l: any) => Number(l.netQty) > 0)
        .map((l: any) => ({
          lineId: l.id,
          item: l.item,
          unit: l.unit,
          remaining: Number(l.netQty),
          quantity: '',
          condition: 'USABLE' as const,
        })),
    );
  };

  const handleSave = async () => {
    if (!requisitionId) return toast.error('Select the original issue to return against.', 'Missing Field');
    const linesToSubmit = returnLines.filter((l) => Number(l.quantity) > 0);
    if (linesToSubmit.length === 0) return toast.error('Enter a return quantity for at least one item.', 'Missing Lines');

    setSaving(true);
    try {
      await inventoryApiService.receiveDepartmentReturn({
        departmentRequisitionId: requisitionId,
        returnedByName: returnedByName.trim() || undefined,
        lines: linesToSubmit.map((l) => ({ departmentRequisitionLineId: l.lineId, quantity: Number(l.quantity), condition: l.condition })),
      });
      toast.success('Department return received.', 'Return Received');
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
        title="Department Returns (Record Log)"
        description="Audit record of unused and returned stock received back from hospital departments."
        isLoading={loading}
        isError={!!error}
        errorMessage={error || undefined}
        onRefresh={load}
        onAddNew={() => openForm()}
        addNewLabel="+ Receive Return"
        onView={(r) => (r.status !== 'CLOSED' ? openForm(r) : toast.error('This requisition is already fully returned.', 'Nothing to Return'))}
        enableSelection={false}
        enableImport={false}
        dateFilterEnabled={false}
      />

      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title="Receive Department Return"
        maxWidth="2xl"
        footer={
          <>
            <button type="button" onClick={() => setIsFormOpen(false)} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
            <button type="button" onClick={handleSave} disabled={saving} className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#129b70] text-white hover:bg-[#0e7d5a] disabled:opacity-50">
              {saving ? 'Receiving…' : 'Receive Return'}
            </button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Original Issue"
              required
              value={requisitionId}
              onChange={(e) => selectRequisition(e.target.value, returnable)}
              options={returnable.map((r) => ({
                value: r.id,
                label: `${r.department} — ${formatDateTimeDDMMYYYY(r.issuedAt)}`,
              }))}
              placeholder="Select the original department issue..."
            />
            <TextInput label="Returned By (name)" value={returnedByName} onChange={(e) => setReturnedByName(e.target.value)} />
          </div>

          {returnLines.length > 0 && (
            <div className="space-y-2">
              <span className="text-xs font-bold text-slate-700 uppercase">Item Grid</span>
              {returnLines.map((line, idx) => (
                <div key={line.lineId} className="grid grid-cols-12 gap-2 items-end p-2 bg-slate-50 rounded-lg border border-slate-200">
                  <div className="col-span-4 text-xs font-semibold text-slate-800 pb-2">
                    {line.item}
                    <div className="text-[10px] text-slate-400 font-normal">Outstanding: {line.remaining} {line.unit}</div>
                  </div>
                  <div className="col-span-3">
                    <NumberInput
                      label={idx === 0 ? 'Return Qty' : undefined}
                      value={line.quantity}
                      onChange={(e) =>
                        setReturnLines((ls) => ls.map((l, i) => (i === idx ? { ...l, quantity: e.target.value } : l)))
                      }
                    />
                  </div>
                  <div className="col-span-5">
                    <Select
                      label={idx === 0 ? 'Condition' : undefined}
                      value={line.condition}
                      onChange={(e) =>
                        setReturnLines((ls) => ls.map((l, i) => (i === idx ? { ...l, condition: e.target.value as any } : l)))
                      }
                      options={[
                        { value: 'USABLE', label: 'Usable → back to Available Stock' },
                        { value: 'DAMAGED', label: 'Damaged → Quarantine' },
                        { value: 'EXPIRED', label: 'Expired → Quarantine' },
                      ]}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
};
