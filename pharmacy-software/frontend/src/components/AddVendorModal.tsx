import React, { useEffect, useState } from 'react';
import { Building2, Loader2, Plus, X } from 'lucide-react';
import { pharmacyApi } from '../services/pharmacyApi';
import { useToast } from '../context/ToastContext';

const emptyForm = { name: '', contactPerson: '', phone: '', paymentTermsDays: '0' };

interface Props {
  open: boolean;
  onClose: () => void;
  /** Called with the newly created vendor row after a successful save. */
  onCreated: (vendor: any) => void;
}

/**
 * The "Add New Pharmacy Vendor" form — extracted from VendorsPage so it can
 * also be opened from inside the New Purchase form ("+ Add New Vendor")
 * without duplicating the form. Same fields, same validation, same API call
 * as before the extraction.
 */
export const AddVendorModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [nextVendorCode, setNextVendorCode] = useState('');
  const [loadingNextCode, setLoadingNextCode] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm);
    setLoadingNextCode(true);
    pharmacyApi
      .getNextVendorCode()
      .then(setNextVendorCode)
      .catch(() => setNextVendorCode(''))
      .finally(() => setLoadingNextCode(false));
  }, [open]);

  if (!open) return null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Vendor Name is required.');
      return;
    }
    setSaving(true);
    try {
      // No `code` in the payload — Vendor Code is always decided server-side (never client-supplied).
      const vendor = await pharmacyApi.createVendor({
        ...form,
        paymentTermsDays: Number(form.paymentTermsDays) || 0,
      });
      toast.success(`Vendor "${form.name}" created successfully.`);
      onCreated(vendor);
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to create vendor.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-2xl border border-slate-200 overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 bg-white border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Building2 className="h-4 w-4 text-[#0e7d5a]" />
            Add New Pharmacy Vendor
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>
        <form onSubmit={handleSave} className="p-5 space-y-3.5 text-xs">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Vendor Code</label>
              <input
                disabled
                value={loadingNextCode ? 'Generating…' : nextVendorCode}
                className="w-full h-9 px-3 bg-slate-100 border border-slate-200 rounded-lg font-mono text-slate-500 cursor-not-allowed"
              />
              <p className="text-[10px] text-slate-400 mt-1">Auto-generated, read-only.</p>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Credit Terms (Days)</label>
              <input
                type="number"
                min={0}
                value={form.paymentTermsDays}
                onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#08775A]"
              />
            </div>
          </div>

          <div>
            <label className="block font-semibold text-slate-700 mb-1">Vendor Name *</label>
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Getz Pharma Distribution"
              className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg font-semibold focus:outline-none focus:ring-1 focus:ring-[#08775A]"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Contact Person</label>
              <input
                value={form.contactPerson}
                onChange={(e) => setForm({ ...form, contactPerson: e.target.value })}
                placeholder="e.g. Tariq Mehmood"
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#08775A]"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">Phone / Mobile</label>
              <input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="0300-1234567"
                className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg font-mono focus:outline-none focus:ring-1 focus:ring-[#08775A]"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 font-semibold text-slate-600 border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 font-bold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs disabled:opacity-60 transition-colors flex items-center gap-1.5"
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Save Vendor
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
