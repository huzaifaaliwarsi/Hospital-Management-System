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
const CREDIT_TERM_OPTIONS = [
  { value: '0', label: 'Immediate / COD (0 Days)' },
  { value: '5', label: 'Net 5 Days' },
  { value: '7', label: 'Net 7 Days (1 Week)' },
  { value: '10', label: 'Net 10 Days' },
  { value: '15', label: 'Net 15 Days (Bi-weekly)' },
  { value: '21', label: 'Net 21 Days (3 Weeks)' },
  { value: '30', label: 'Net 30 Days (1 Month)' },
  { value: '45', label: 'Net 45 Days' },
  { value: '60', label: 'Net 60 Days (2 Months)' },
  { value: '90', label: 'Net 90 Days (3 Months)' },
  { value: 'custom', label: 'Custom Days…' },
];

export const AddVendorModal: React.FC<Props> = ({ open, onClose, onCreated }) => {
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [nextVendorCode, setNextVendorCode] = useState('');
  const [loadingNextCode, setLoadingNextCode] = useState(false);
  const [isCustomTerms, setIsCustomTerms] = useState(false);
  const toast = useToast();

  useEffect(() => {
    if (!open) return;
    setForm(emptyForm);
    setIsCustomTerms(false);
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
              <div className="flex items-center justify-between mb-1">
                <label className="font-semibold text-slate-700">Credit Terms</label>
                {isCustomTerms && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomTerms(false);
                      setForm({ ...form, paymentTermsDays: '30' });
                    }}
                    className="text-[10.5px] text-[#0e7d5a] hover:underline cursor-pointer"
                  >
                    Select preset
                  </button>
                )}
              </div>
              {!isCustomTerms ? (
                <select
                  value={
                    CREDIT_TERM_OPTIONS.some((o) => o.value === form.paymentTermsDays && o.value !== 'custom')
                      ? form.paymentTermsDays
                      : 'custom'
                  }
                  onChange={(e) => {
                    if (e.target.value === 'custom') {
                      setIsCustomTerms(true);
                    } else {
                      setForm({ ...form, paymentTermsDays: e.target.value });
                    }
                  }}
                  className="w-full h-9 px-2.5 bg-white border border-slate-200 rounded-lg font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#08775A] cursor-pointer text-xs"
                >
                  {CREDIT_TERM_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="flex items-center gap-1.5">
                  <input
                    type="number"
                    min={0}
                    autoFocus
                    placeholder="Days (e.g. 5)"
                    value={form.paymentTermsDays}
                    onChange={(e) => setForm({ ...form, paymentTermsDays: e.target.value })}
                    className="flex-1 h-9 px-2.5 bg-white border border-[#08775A] rounded-lg font-bold text-slate-900 focus:outline-none text-xs"
                  />
                  <span className="text-xs font-semibold text-slate-500 shrink-0">Days</span>
                </div>
              )}
              <p className="text-[10px] text-slate-400 mt-1">Payment due after invoice date</p>
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
