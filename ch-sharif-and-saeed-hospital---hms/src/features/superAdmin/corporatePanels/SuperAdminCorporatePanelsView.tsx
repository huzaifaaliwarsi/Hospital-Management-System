import React, { useState, useEffect, useMemo } from 'react';
import {
  Building2,
  Plus,
  Search,
  Eye,
  Edit2,
  Power,
  Percent,
  Loader2,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  X,
  Trash2,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { formatPKR } from '../../../utils/formatters';
import {
  CorporatePanel,
  CorporatePanelFormValues,
  fetchCorporatePanels,
  createCorporatePanel,
  updateCorporatePanel,
  deleteCorporatePanel,
  toggleCorporatePanelStatus,
  replaceDiscountRules,
} from '../../../services/panelService';
import { ServiceRatesService } from '../../../services/serviceRatesService';
import { Modal } from '../../../components/common/Modal';
import { ConfirmModal } from '../../../components/common/ConfirmModal';
import { TextInput, NumberInput, Textarea, Select } from '../../../components/forms/FormControls';

const PANEL_CATEGORIES = ['Govt Health Insurance', 'Private Insurance', 'Armed Forces Welfare', 'Corporate Enterprise'];

const EMPTY_FORM: CorporatePanelFormValues = {
  code: '',
  organizationName: '',
  category: 'Corporate Enterprise',
  discountAgreement: '',
  contact: '',
  address: '',
  notes: '',
  creditLimit: 0,
  isActive: true,
};

export const SuperAdminCorporatePanelsView: React.FC = () => {
  const { currentUser } = useAuth();
  const [panels, setPanels] = useState<CorporatePanel[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Active' | 'Inactive'>('All');

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPanel, setEditingPanel] = useState<CorporatePanel | null>(null);
  const [formValues, setFormValues] = useState<CorporatePanelFormValues>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const [statusTarget, setStatusTarget] = useState<CorporatePanel | null>(null);
  const [discountPanel, setDiscountPanel] = useState<CorporatePanel | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<CorporatePanel | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4000);
  };

  const loadPanels = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await fetchCorporatePanels();
      setPanels(list);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load corporate panels from the server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadPanels();
  }, []);

  const filteredPanels = useMemo(() => {
    return panels.filter((p) => {
      if (searchTerm.trim()) {
        const q = searchTerm.trim().toLowerCase();
        if (!p.code.toLowerCase().includes(q) && !p.name.toLowerCase().includes(q)) return false;
      }
      if (statusFilter !== 'All' && p.status !== statusFilter) return false;
      return true;
    });
  }, [panels, searchTerm, statusFilter]);

  const kpis = useMemo(() => {
    const totalPanels = panels.length;
    const activePanels = panels.filter((p) => p.status === 'Active').length;
    const totalCreditLimit = panels.reduce((sum, p) => sum + p.creditLimit, 0);
    const totalActivePatients = panels.reduce((sum, p) => sum + p.activePatientsCount, 0);
    return { totalPanels, activePanels, totalCreditLimit, totalActivePatients };
  }, [panels]);

  const handleOpenAdd = () => {
    setEditingPanel(null);
    setFormValues(EMPTY_FORM);
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (panel: CorporatePanel) => {
    setEditingPanel(panel);
    setFormValues({
      code: panel.code,
      organizationName: panel.name,
      category: panel.category,
      discountAgreement: panel.discountAgreement,
      contact: panel.contact,
      address: panel.address,
      notes: panel.notes,
      creditLimit: panel.creditLimit,
      isActive: panel.status === 'Active',
    });
    setFormError(null);
    setIsFormOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formValues.organizationName.trim()) {
      setFormError('Organization / Panel name is required.');
      return;
    }
    setIsSaving(true);
    setFormError(null);
    try {
      if (editingPanel) {
        await updateCorporatePanel(editingPanel.id, formValues);
        showToast(`Panel "${formValues.organizationName}" updated successfully.`);
      } else {
        await createCorporatePanel(formValues);
        showToast(`Panel "${formValues.organizationName}" registered successfully.`);
      }
      setIsFormOpen(false);
      await loadPanels();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to save corporate panel.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleConfirmToggleStatus = async () => {
    if (!statusTarget) return;
    const nextActive = statusTarget.status !== 'Active';
    try {
      await toggleCorporatePanelStatus(statusTarget.id, nextActive);
      showToast(`Panel "${statusTarget.name}" is now ${nextActive ? 'Active' : 'Inactive'}.`);
      setStatusTarget(null);
      await loadPanels();
    } catch (err: any) {
      showToast(err?.message || 'Failed to update panel status.', 'error');
      setStatusTarget(null);
    }
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteCorporatePanel(deleteTarget.id);
      showToast(`Corporate panel "${deleteTarget.name}" deleted successfully.`);
      setDeleteTarget(null);
      await loadPanels();
    } catch (err: any) {
      const msg = err?.response?.data?.error?.message || err?.message || 'Failed to delete corporate panel.';
      showToast(msg, 'error');
    } finally {
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2 text-sm">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading corporate panels…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertTriangle className="h-8 w-8 text-rose-500" />
        <p className="text-sm text-rose-700 font-medium">{loadError}</p>
        <button
          type="button"
          onClick={loadPanels}
          className="px-4 py-2 bg-[#08775A] hover:bg-[#0e7d5a] text-white text-xs font-semibold rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-5 animate-in fade-in duration-150">
      {toast && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between shadow-xs ${
            toast.type === 'success' ? 'bg-[#effaf5] border-[#c2e7db] text-[#08775A]' : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {toast.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
            <span>{toast.message}</span>
          </div>
          <button onClick={() => setToast(null)} className="text-xs font-bold opacity-70 hover:opacity-100">
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900">Corporate Panels</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              Super Admin Control
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Manage corporate agreements, health insurance policies, credit ceilings, and service discount tariffs.
          </p>
        </div>
        <button
          type="button"
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-[#149E75] hover:bg-[#08775A] text-white rounded-lg text-xs font-semibold shadow-xs transition-colors shrink-0"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>Add Corporate Panel</span>
        </button>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500">Total Panels</span>
          <div className="text-2xl font-black text-slate-900 mt-0.5">{kpis.totalPanels}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500">Active Panels</span>
          <div className="text-2xl font-black text-emerald-700 mt-0.5">{kpis.activePanels}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500">Total Credit Ceiling</span>
          <div className="text-lg font-black text-slate-900 mt-0.5">{formatPKR(kpis.totalCreditLimit)}</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-[11px] font-medium text-slate-500">Active Panel Patients</span>
          <div className="text-2xl font-black text-slate-900 mt-0.5">{kpis.totalActivePatients}</div>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-xl border border-slate-200 p-3 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative flex-1 w-full">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder="Search panels by code or name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full text-xs pl-8.5 pr-3 py-2 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#149E75] bg-slate-50/50"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <span className="text-[11px] font-semibold text-slate-500">Filter:</span>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as any)}
            className="text-xs px-3 py-1.5 border border-slate-200 rounded-lg bg-white focus:outline-hidden focus:ring-2 focus:ring-[#149E75]"
          >
            <option value="All">All Statuses</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <th className="py-2.5 px-4">Panel Code</th>
                <th className="py-2.5 px-4">Organization / Panel Name</th>
                <th className="py-2.5 px-4">Category</th>
                <th className="py-2.5 px-4 text-right">Credit Ceiling</th>
                <th className="py-2.5 px-4 text-center">Active Patients</th>
                <th className="py-2.5 px-4 text-center">Discount Rules</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {filteredPanels.map((panel) => (
                <tr key={panel.id} className="hover:bg-slate-50/80">
                  <td className="py-2.5 px-4 font-mono font-bold text-slate-900">{panel.code}</td>
                  <td className="py-2.5 px-4 font-bold text-slate-900">{panel.name}</td>
                  <td className="py-2.5 px-4">
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
                      {panel.category}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right font-mono font-bold text-slate-900">{formatPKR(panel.creditLimit)}</td>
                  <td className="py-2.5 px-4 text-center font-semibold">{panel.activePatientsCount}</td>
                  <td className="py-2.5 px-4 text-center">
                    <button
                      type="button"
                      onClick={() => setDiscountPanel(panel)}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 hover:bg-[#effaf5] text-slate-700 hover:text-[#08775A] font-semibold text-[10px]"
                    >
                      <Percent className="h-3 w-3" />
                      {panel.discountRules.length} Rule{panel.discountRules.length === 1 ? '' : 's'}
                    </button>
                  </td>
                  <td className="py-2.5 px-4">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                        panel.status === 'Active' ? 'bg-emerald-50 text-emerald-800' : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {panel.status}
                    </span>
                  </td>
                  <td className="py-2.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(panel)}
                        className="p-1 hover:bg-slate-100 rounded text-slate-500 hover:text-[#08775A]"
                        title="Edit Panel"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setStatusTarget(panel)}
                        className={`p-1 rounded transition-colors ${
                          panel.status === 'Active' ? 'text-slate-400 hover:bg-amber-50 hover:text-amber-700' : 'text-[#08775A] hover:bg-emerald-50'
                        }`}
                        title={panel.status === 'Active' ? 'Deactivate Panel' : 'Activate Panel'}
                      >
                        <Power className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(panel)}
                        className="p-1 hover:bg-rose-50 rounded text-slate-400 hover:text-rose-600 transition-colors"
                        title="Delete Panel"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}

              {filteredPanels.length === 0 && (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-slate-500">
                    <Building2 className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                    <span className="font-semibold text-xs text-slate-700 block">No corporate panels match your search criteria.</span>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit Modal */}
      <Modal
        isOpen={isFormOpen}
        onClose={() => setIsFormOpen(false)}
        title={editingPanel ? 'Edit Corporate Panel' : 'Register Corporate Panel'}
        maxWidth="md"
        closeOnBackdropClick={false}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {formError && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">{formError}</div>
          )}
          <TextInput
            label="Panel Code"
            placeholder="e.g. PNL-SLI (optional — leave blank to auto-generate)"
            value={formValues.code}
            onChange={(e) => setFormValues({ ...formValues, code: e.target.value })}
          />
          <TextInput
            label="Organization / Panel Name"
            value={formValues.organizationName}
            onChange={(e) => setFormValues({ ...formValues, organizationName: e.target.value })}
            required
          />
          <Select
            label="Category"
            value={formValues.category}
            onChange={(e) => setFormValues({ ...formValues, category: e.target.value })}
            options={PANEL_CATEGORIES.map((c) => ({ label: c, value: c }))}
          />
          <TextInput
            label="Discount Agreement Summary"
            placeholder="e.g. 15% Institutional Concession"
            value={formValues.discountAgreement}
            onChange={(e) => setFormValues({ ...formValues, discountAgreement: e.target.value })}
          />
          <TextInput
            label="Focal Person / Contact"
            value={formValues.contact}
            onChange={(e) => setFormValues({ ...formValues, contact: e.target.value })}
          />
          <Textarea
            label="Address"
            value={formValues.address}
            onChange={(e) => setFormValues({ ...formValues, address: e.target.value })}
            rows={2}
          />
          <NumberInput
            label="Credit Limit (PKR)"
            value={formValues.creditLimit}
            onChange={(e) => setFormValues({ ...formValues, creditLimit: Number(e.target.value) || 0 })}
            min={0}
          />
          <Textarea
            label="Notes"
            value={formValues.notes}
            onChange={(e) => setFormValues({ ...formValues, notes: e.target.value })}
            rows={2}
          />
          <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setIsFormOpen(false)}
              className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center gap-2 px-5 py-2 bg-[#149E75] hover:bg-[#08775A] disabled:opacity-60 text-white rounded-lg text-xs font-semibold"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
              {isSaving ? 'Saving…' : editingPanel ? 'Save Changes' : 'Register Panel'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Status Toggle Confirm */}
      <ConfirmModal
        isOpen={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        onConfirm={handleConfirmToggleStatus}
        title={statusTarget?.status === 'Active' ? 'Deactivate Corporate Panel' : 'Activate Corporate Panel'}
        message={
          statusTarget
            ? `Are you sure you want to ${statusTarget.status === 'Active' ? 'deactivate' : 'activate'} "${statusTarget.name}"?`
            : ''
        }
        confirmLabel={statusTarget?.status === 'Active' ? 'Deactivate' : 'Activate'}
        variant={statusTarget?.status === 'Active' ? 'danger' : 'primary'}
      />

      {/* Delete Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleConfirmDelete}
        title="Delete Corporate Panel"
        message={
          deleteTarget
            ? `Are you sure you want to permanently delete "${deleteTarget.name}" (${deleteTarget.code})? This will also remove its configured discount rules. This action cannot be undone.`
            : ''
        }
        confirmLabel="Delete Panel"
        variant="danger"
        isLoading={isDeleting}
      />

      {/* Discount Rules Modal */}
      {discountPanel && (
        <DiscountRulesModal
          panel={discountPanel}
          onClose={() => setDiscountPanel(null)}
          onSaved={async () => {
            setDiscountPanel(null);
            await loadPanels();
          }}
        />
      )}
    </div>
  );
};

interface DiscountRulesModalProps {
  panel: CorporatePanel;
  onClose: () => void;
  onSaved: () => void;
}

const DiscountRulesModal: React.FC<DiscountRulesModalProps> = ({ panel, onClose, onSaved }) => {
  const services = ServiceRatesService.getServices();
  const [rows, setRows] = useState(
    panel.discountRules.map((r) => ({ ...r, key: r.id }))
  );
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const addRow = () => {
    setRows([
      ...rows,
      {
        key: `new-${Date.now()}`,
        id: '',
        serviceRateId: services[0]?.id || '',
        discountPercent: 0,
        coveragePercent: undefined,
        preauthorizationRequired: false,
        capAmount: undefined,
        effectiveFrom: new Date().toISOString().slice(0, 10),
        effectiveTo: undefined,
      },
    ]);
  };

  const removeRow = (key: string) => setRows(rows.filter((r) => r.key !== key));

  const handleSave = async () => {
    if (rows.some((r) => !r.serviceRateId)) {
      setError('Every discount rule row needs a selected service.');
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await replaceDiscountRules(
        panel.id,
        rows.map((r) => ({
          serviceRateId: r.serviceRateId,
          discountPercent: r.discountPercent,
          coveragePercent: r.coveragePercent,
          preauthorizationRequired: r.preauthorizationRequired,
          capAmount: r.capAmount,
          effectiveFrom: r.effectiveFrom,
          effectiveTo: r.effectiveTo,
        }))
      );
      onSaved();
    } catch (err: any) {
      setError(err?.message || 'Failed to save discount rules.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={onClose} title={`Discount Rules — ${panel.name}`} maxWidth="lg" closeOnBackdropClick={false}>
      <div className="space-y-3">
        {error && <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium">{error}</div>}
        {services.length === 0 && (
          <div className="p-2.5 rounded-lg bg-amber-50 border border-amber-200 text-xs text-amber-800">
            No services found — configure Services &amp; Rates first before adding discount rules.
          </div>
        )}
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {rows.map((row) => (
            <div key={row.key} className="space-y-1.5 bg-slate-50 p-2 rounded-lg border border-slate-200">
              <div className="grid grid-cols-12 gap-2 items-center">
                <select
                  className="col-span-5 text-xs px-2 py-1.5 border border-slate-200 rounded-lg bg-white"
                  value={row.serviceRateId}
                  onChange={(e) => setRows(rows.map((r) => (r.key === row.key ? { ...r, serviceRateId: e.target.value } : r)))}
                >
                  <option value="">Select a service…</option>
                  {services.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.code} — {s.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min={0}
                  max={100}
                  className="col-span-2 text-xs px-2 py-1.5 border border-slate-200 rounded-lg"
                  value={row.discountPercent}
                  onChange={(e) => setRows(rows.map((r) => (r.key === row.key ? { ...r, discountPercent: Number(e.target.value) || 0 } : r)))}
                  placeholder="%"
                />
                <input
                  lang="en-GB" type="date"
                  className="col-span-2 text-xs px-2 py-1.5 border border-slate-200 rounded-lg"
                  value={row.effectiveFrom}
                  onChange={(e) => setRows(rows.map((r) => (r.key === row.key ? { ...r, effectiveFrom: e.target.value } : r)))}
                />
                <input
                  lang="en-GB" type="date"
                  className="col-span-2 text-xs px-2 py-1.5 border border-slate-200 rounded-lg"
                  value={row.effectiveTo || ''}
                  onChange={(e) => setRows(rows.map((r) => (r.key === row.key ? { ...r, effectiveTo: e.target.value || undefined } : r)))}
                />
                <button type="button" onClick={() => removeRow(row.key)} className="col-span-1 p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg flex justify-center">
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* v7.2 Panel Management enhancements (HMS_V7.2_NEW_REQUIREMENTS.md §2.5) */}
              <div className="grid grid-cols-12 gap-2 items-center pl-0.5">
                <div className="col-span-4 flex items-center gap-1">
                  <input
                    type="number"
                    min={0}
                    max={100}
                    placeholder="Coverage %"
                    className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded-lg bg-white"
                    value={row.coveragePercent ?? ''}
                    onChange={(e) =>
                      setRows(
                        rows.map((r) =>
                          r.key === row.key ? { ...r, coveragePercent: e.target.value === '' ? undefined : Number(e.target.value) } : r
                        )
                      )
                    }
                    title="Panel Coverage % — the covered portion; the complement is the patient's co-pay share"
                  />
                </div>
                <div className="col-span-4">
                  <input
                    type="number"
                    min={0}
                    placeholder="Cap Amount (PKR)"
                    className="w-full text-[11px] px-2 py-1 border border-slate-200 rounded-lg bg-white"
                    value={row.capAmount ?? ''}
                    onChange={(e) =>
                      setRows(rows.map((r) => (r.key === row.key ? { ...r, capAmount: e.target.value === '' ? undefined : Number(e.target.value) } : r)))
                    }
                  />
                </div>
                <label className="col-span-4 flex items-center gap-1.5 text-[11px] text-slate-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={!!row.preauthorizationRequired}
                    onChange={(e) => setRows(rows.map((r) => (r.key === row.key ? { ...r, preauthorizationRequired: e.target.checked } : r)))}
                    className="rounded text-[#08775A] focus:ring-[#08775A]"
                  />
                  Preauthorization Required
                </label>
              </div>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addRow}
          disabled={services.length === 0}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#08775A] hover:underline disabled:opacity-50 disabled:no-underline"
        >
          <Plus className="h-3.5 w-3.5" /> Add Discount Rule
        </button>

        <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
          <button type="button" onClick={onClose} className="px-4 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold">
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={isSaving}
            className="inline-flex items-center gap-2 px-5 py-2 bg-[#149E75] hover:bg-[#08775A] disabled:opacity-60 text-white rounded-lg text-xs font-semibold"
          >
            {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            {isSaving ? 'Saving…' : 'Save Discount Rules'}
          </button>
        </div>
      </div>
    </Modal>
  );
};
