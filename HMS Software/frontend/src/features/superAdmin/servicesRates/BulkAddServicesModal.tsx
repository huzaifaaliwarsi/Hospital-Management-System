import React, { useState, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Sparkles,
  Layers,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  Loader2,
  Wand2,
} from 'lucide-react';
import { Modal } from '../../../components/common/Modal';
import { Department } from '../../../types/department';
import {
  ServiceCategory,
  BillingUnit,
  ServiceFormValues,
} from '../../../types/serviceRates';
import {
  ServiceRatesService,
  VALID_SERVICE_CATEGORIES,
  VALID_BILLING_UNITS,
} from '../../../services/serviceRatesService';
import { useAuth } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';

interface BulkServiceRow {
  id: string;
  name: string;
  departmentId: string;
  category: ServiceCategory;
  standardRate: number | '';
  billingUnit: BillingUnit;
  panelEligible: boolean;
  discountAllowed: boolean;
}

interface BulkAddServicesModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  departments: Department[];
}

const createEmptyRow = (defaultDeptId = ''): BulkServiceRow => ({
  id: `row-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
  name: '',
  departmentId: defaultDeptId,
  category: 'Procedure',
  standardRate: '',
  billingUnit: 'Per Procedure',
  panelEligible: true,
  discountAllowed: true,
});

export const BulkAddServicesModal: React.FC<BulkAddServicesModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  departments,
}) => {
  const { currentUser } = useAuth();
  const { success: toastSuccess, error: toastError } = useToast();

  const activeDepartments = useMemo(
    () => departments.filter((d) => d.status === 'Active' && !d.pharmacyRelated),
    [departments]
  );

  const initialDeptId = activeDepartments[0]?.id || '';

  const [rows, setRows] = useState<BulkServiceRow[]>(() => [
    createEmptyRow(initialDeptId),
    createEmptyRow(initialDeptId),
    createEmptyRow(initialDeptId),
  ]);

  const [batchDept, setBatchDept] = useState<string>(initialDeptId);
  const [batchCategory, setBatchCategory] = useState<ServiceCategory>('Procedure');
  const [batchBillingUnit, setBatchBillingUnit] = useState<BillingUnit>('Per Procedure');
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleAddRow = () => {
    setRows((prev) => [...prev, createEmptyRow(batchDept || initialDeptId)]);
  };

  const handleAdd5Rows = () => {
    setRows((prev) => [
      ...prev,
      createEmptyRow(batchDept || initialDeptId),
      createEmptyRow(batchDept || initialDeptId),
      createEmptyRow(batchDept || initialDeptId),
      createEmptyRow(batchDept || initialDeptId),
      createEmptyRow(batchDept || initialDeptId),
    ]);
  };

  const handleDeleteRow = (id: string) => {
    if (rows.length <= 1) {
      setRows([createEmptyRow(batchDept || initialDeptId)]);
      return;
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };

  const handleUpdateRow = (id: string, field: keyof BulkServiceRow, value: any) => {
    setRows((prev) =>
      prev.map((r) => (r.id === id ? { ...r, [field]: value } : r))
    );
  };

  const handleApplyBatchDefaults = () => {
    setRows((prev) =>
      prev.map((r) => ({
        ...r,
        departmentId: batchDept || r.departmentId,
        category: batchCategory || r.category,
        billingUnit: batchBillingUnit || r.billingUnit,
      }))
    );
  };

  // Compute readiness
  const filledRows = rows.filter((r) => r.name.trim() !== '');
  const isValidToSubmit =
    filledRows.length > 0 &&
    filledRows.every(
      (r) =>
        r.name.trim().length > 0 &&
        r.departmentId &&
        r.standardRate !== '' &&
        Number(r.standardRate) >= 0
    );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const candidates = rows.filter(
      (r) => r.name.trim() !== '' || (r.standardRate !== '' && Number(r.standardRate) > 0)
    );

    if (candidates.length === 0) {
      setFormError('Please enter at least one service name and rate to add.');
      return;
    }

    const invalid = candidates.find(
      (r) =>
        !r.name.trim() ||
        !r.departmentId ||
        r.standardRate === '' ||
        Number(r.standardRate) < 0
    );

    if (invalid) {
      setFormError('Please make sure all filled rows have a Service Name, Department, and valid Standard Rate (>= 0).');
      return;
    }

    setIsSaving(true);
    try {
      const itemsToCreate: ServiceFormValues[] = candidates.map((r) => {
        const dept = activeDepartments.find((d) => d.id === r.departmentId);
        const isLabStream =
          r.category === 'Laboratory' ||
          r.category === 'Diagnostic' ||
          r.category === 'Radiology' ||
          (dept?.name || '').toLowerCase().includes('lab');

        return {
          code: '', // Left blank: backend auto-generates sequential unique code SRV-XXX
          name: r.name.trim(),
          description: '',
          departmentId: r.departmentId,
          category: r.category,
          standardRate: Number(r.standardRate),
          billingUnit: r.billingUnit,
          panelEligible: r.panelEligible,
          discountAllowed: r.discountAllowed,
          manualRateOverrideAllowed: false,
          status: 'Active',
          serviceStream: isLabStream ? 'LAB' : 'HOSPITAL',
          providerType: dept?.fulfillmentOwnership === 'Outsourced' ? 'OUTSOURCED' : 'INTERNAL',
        };
      });

      const res = await ServiceRatesService.bulkCreateServices(itemsToCreate, currentUser);
      toastSuccess(`Successfully added ${res.count} hospital services with auto-generated IDs!`);
      onSuccess();
      onClose();
    } catch (err: any) {
      setFormError(err?.response?.data?.error?.message || err?.message || 'Failed to bulk create services.');
      toastError(err?.message || 'Bulk creation failed.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      maxWidth="5xl"
      title={
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-[#08775A]/10 text-[#08775A] border border-[#08775A]/20 flex items-center justify-center font-bold text-sm shrink-0">
            <Layers className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-900 tracking-tight">
              Bulk Add Hospital Services
            </h2>
            <p className="text-xs text-slate-500 font-normal">
              Quickly create multiple billable services. Service Codes (<span className="font-mono font-semibold text-[#08775A]">SRV-XXX</span>) will be automatically assigned.
            </p>
          </div>
        </div>
      }
      footer={
        <div className="flex items-center justify-between w-full">
          <div className="text-xs text-slate-500">
            <strong className="text-slate-800 font-semibold">{filledRows.length}</strong>{' '}
            {filledRows.length === 1 ? 'service' : 'services'} ready to save
          </div>
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSaving}
              className="px-4 py-2 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 cursor-pointer disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={isSaving || !isValidToSubmit}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold rounded-lg bg-[#08775A] hover:bg-[#065f46] text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Creating Services…</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  <span>Create {filledRows.length > 0 ? filledRows.length : ''} Services</span>
                </>
              )}
            </button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        {formError && (
          <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-600" />
            <span>{formError}</span>
          </div>
        )}

        {/* Quick-Fill Batch Defaults Panel */}
        <div className="bg-slate-50/80 border border-slate-200/90 rounded-xl p-3.5 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Wand2 className="h-3.5 w-3.5 text-[#08775A]" />
              Quick-Fill Defaults (Apply to all rows)
            </span>
            <button
              type="button"
              onClick={handleApplyBatchDefaults}
              className="text-xs font-bold text-[#08775A] hover:text-[#065f46] hover:underline flex items-center gap-1 cursor-pointer"
            >
              Apply To All Rows
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Default Department
              </label>
              <select
                value={batchDept}
                onChange={(e) => setBatchDept(e.target.value)}
                className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
              >
                {activeDepartments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Default Category
              </label>
              <select
                value={batchCategory}
                onChange={(e) => setBatchCategory(e.target.value as ServiceCategory)}
                className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
              >
                {VALID_SERVICE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                Default Billing Unit
              </label>
              <select
                value={batchBillingUnit}
                onChange={(e) => setBatchBillingUnit(e.target.value as BillingUnit)}
                className="w-full h-8 px-2.5 text-xs rounded-lg border border-slate-300 bg-white text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
              >
                {VALID_BILLING_UNITS.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Multi-Row Service Grid */}
        <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
          <div className="overflow-x-auto max-h-[46vh] [scrollbar-width:thin]">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-slate-100/90 text-slate-700 font-bold uppercase text-[10px] tracking-wider sticky top-0 z-10 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 w-10 text-center">#</th>
                  <th className="py-2.5 px-3 w-28">Service Code</th>
                  <th className="py-2.5 px-3 min-w-[200px]">Service Name *</th>
                  <th className="py-2.5 px-3 min-w-[170px]">Department *</th>
                  <th className="py-2.5 px-3 w-36">Category</th>
                  <th className="py-2.5 px-3 w-32">Standard Rate (PKR) *</th>
                  <th className="py-2.5 px-3 w-36">Billing Unit</th>
                  <th className="py-2.5 px-3 w-16 text-center">Panel</th>
                  <th className="py-2.5 px-2 w-10 text-center"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.map((row, index) => {
                  const isMissingName = row.name.trim() === '' && row.standardRate !== '';
                  const isMissingRate = row.name.trim() !== '' && (row.standardRate === '' || Number(row.standardRate) < 0);

                  return (
                    <tr
                      key={row.id}
                      className={`hover:bg-slate-50/70 transition-colors ${
                        isMissingName || isMissingRate ? 'bg-amber-50/40' : ''
                      }`}
                    >
                      {/* Index */}
                      <td className="py-2 px-3 text-center text-slate-400 font-mono text-xs">
                        {index + 1}
                      </td>

                      {/* Service Code Auto Generated */}
                      <td className="py-2 px-3">
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[10.5px] font-mono font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          <Sparkles className="h-3 w-3 text-emerald-600 shrink-0" />
                          Auto ID
                        </span>
                      </td>

                      {/* Service Name */}
                      <td className="py-2 px-3">
                        <input
                          type="text"
                          value={row.name}
                          onChange={(e) => handleUpdateRow(row.id, 'name', e.target.value)}
                          placeholder="e.g. ECG 12-Lead"
                          className={`w-full h-8 px-2.5 rounded-lg border text-xs text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A] ${
                            isMissingName
                              ? 'border-amber-400 bg-amber-50/30'
                              : 'border-slate-300'
                          }`}
                        />
                      </td>

                      {/* Department */}
                      <td className="py-2 px-3">
                        <select
                          value={row.departmentId}
                          onChange={(e) => handleUpdateRow(row.id, 'departmentId', e.target.value)}
                          className="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                        >
                          {activeDepartments.map((d) => (
                            <option key={d.id} value={d.id}>
                              {d.name}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Category */}
                      <td className="py-2 px-3">
                        <select
                          value={row.category}
                          onChange={(e) =>
                            handleUpdateRow(row.id, 'category', e.target.value as ServiceCategory)
                          }
                          className="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                        >
                          {VALID_SERVICE_CATEGORIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Standard Rate */}
                      <td className="py-2 px-3">
                        <input
                          type="number"
                          min="0"
                          step="1"
                          value={row.standardRate}
                          onChange={(e) =>
                            handleUpdateRow(
                              row.id,
                              'standardRate',
                              e.target.value === '' ? '' : Math.max(0, Number(e.target.value))
                            )
                          }
                          placeholder="0"
                          className={`w-full h-8 px-2.5 rounded-lg border text-xs font-mono font-semibold text-slate-900 bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A] ${
                            isMissingRate
                              ? 'border-amber-400 bg-amber-50/30'
                              : 'border-slate-300'
                          }`}
                        />
                      </td>

                      {/* Billing Unit */}
                      <td className="py-2 px-3">
                        <select
                          value={row.billingUnit}
                          onChange={(e) =>
                            handleUpdateRow(row.id, 'billingUnit', e.target.value as BillingUnit)
                          }
                          className="w-full h-8 px-2 rounded-lg border border-slate-300 text-xs text-slate-800 bg-white focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                        >
                          {VALID_BILLING_UNITS.map((u) => (
                            <option key={u} value={u}>
                              {u}
                            </option>
                          ))}
                        </select>
                      </td>

                      {/* Panel Eligible */}
                      <td className="py-2 px-3 text-center">
                        <input
                          type="checkbox"
                          checked={row.panelEligible}
                          onChange={(e) =>
                            handleUpdateRow(row.id, 'panelEligible', e.target.checked)
                          }
                          className="h-4 w-4 text-[#08775A] focus:ring-[#08775A] rounded border-slate-300 cursor-pointer"
                          title="Eligible for Corporate Panels"
                        />
                      </td>

                      {/* Delete */}
                      <td className="py-2 px-2 text-center">
                        <button
                          type="button"
                          onClick={() => handleDeleteRow(row.id)}
                          className="p-1.5 text-slate-400 hover:text-rose-600 rounded-md hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Remove row"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Row Operations Toolbar */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleAddRow}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-[#08775A]/40 bg-[#effaf5] hover:bg-[#d6f2e8] text-[#08775A] font-bold shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add Row</span>
            </button>
            <button
              type="button"
              onClick={handleAdd5Rows}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-slate-700 font-semibold shadow-2xs transition-colors cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add 5 Rows</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-500">
            Total entries:{' '}
            <strong className="text-slate-800">{rows.length}</strong> | Valid to add:{' '}
            <strong className="text-emerald-700">{filledRows.length}</strong>
          </div>
        </div>
      </div>
    </Modal>
  );
};
