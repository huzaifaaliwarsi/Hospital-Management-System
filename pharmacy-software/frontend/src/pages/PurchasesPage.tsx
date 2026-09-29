import React, { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, Loader2 } from 'lucide-react';
import apiClient from '../services/apiClient';
import { pharmacyApi, MedicineRow } from '../services/pharmacyApi';
import { formatPKR } from '../utils/format';
import { useToast } from '../context/ToastContext';

interface Line {
  medicineId: string;
  batchNumber: string;
  expiryDate: string;
  quantity: string;
  unitCost: string;
  discountAmount: string;
  taxAmount: string;
}
const emptyLine = (): Line => ({ medicineId: '', batchNumber: '', expiryDate: '', quantity: '', unitCost: '', discountAmount: '0', taxAmount: '0' });

export const PurchasesPage: React.FC = () => {
  const [vendors, setVendors] = useState<any[]>([]);
  const [medicines, setMedicines] = useState<MedicineRow[]>([]);
  const [vendorId, setVendorId] = useState('');
  const [purchaseDate, setPurchaseDate] = useState(new Date().toISOString().slice(0, 10));
  const [vendorInvoiceNo, setVendorInvoiceNo] = useState('');
  const [paymentType, setPaymentType] = useState<'CASH' | 'CARD' | 'ONLINE' | ''>('');
  const [paidNow, setPaidNow] = useState('0');
  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const toast = useToast();

  useEffect(() => {
    apiClient.get('/vendors').then((r) => setVendors(r.data.data));
    pharmacyApi.listMedicines().then(setMedicines);
  }, []);

  const updateLine = (idx: number, patch: Partial<Line>) => setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  const addLine = () => setLines((prev) => [...prev, emptyLine()]);
  const removeLine = (idx: number) => setLines((prev) => prev.filter((_, i) => i !== idx));

  const total = useMemo(() => lines.reduce((s, l) => s + (Number(l.quantity) || 0) * (Number(l.unitCost) || 0) - (Number(l.discountAmount) || 0) + (Number(l.taxAmount) || 0), 0), [lines]);

  const handleSubmit = async () => {
    if (!vendorId) return toast.error('Select a vendor.');
    if (!purchaseDate) return toast.error('Purchase date is required.');
    const validLines = lines.filter((l) => l.medicineId && l.batchNumber && l.expiryDate && Number(l.quantity) > 0);
    if (validLines.length === 0) return toast.error('Add at least one valid line (medicine, batch, expiry, quantity).');

    setSaving(true);
    try {
      await apiClient.post('/vendors/purchases', {
        vendorId,
        purchaseDate,
        vendorInvoiceNo: vendorInvoiceNo || undefined,
        paymentType: paymentType || undefined,
        paidNow: Number(paidNow) || 0,
        post: true,
        lines: validLines.map((l) => ({
          medicineId: l.medicineId,
          batchNumber: l.batchNumber,
          expiryDate: l.expiryDate,
          quantity: Number(l.quantity),
          unitCost: Number(l.unitCost) || 0,
          discountAmount: Number(l.discountAmount) || 0,
          taxAmount: Number(l.taxAmount) || 0,
        })),
      });
      toast.success('Purchase posted — stock and vendor ledger updated.');
      setLines([emptyLine()]);
      setVendorInvoiceNo('');
      setPaidNow('0');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to post purchase.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-6 space-y-4">
      <div>
        <h2 className="text-lg font-bold text-[#111827]">Purchase / Stock In</h2>
        <p className="text-xs text-[#52665e]">pharmacy.md §10.1 — posts PURCHASE_IN stock + vendor ledger PURCHASE_CREDIT, optional immediate payment.</p>
      </div>

      <div className="bg-white rounded-xl border border-[#e2eae5] p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <Field label="Vendor *">
          <select value={vendorId} onChange={(e) => setVendorId(e.target.value)} className="input">
            <option value="">Select vendor…</option>
            {vendors.map((v) => <option key={v.id} value={v.id}>{v.name}</option>)}
          </select>
        </Field>
        <Field label="Purchase Date *"><input type="date" value={purchaseDate} onChange={(e) => setPurchaseDate(e.target.value)} className="input" /></Field>
        <Field label="Vendor Invoice No"><input value={vendorInvoiceNo} onChange={(e) => setVendorInvoiceNo(e.target.value)} className="input" /></Field>
        <Field label="Payment Type">
          <select value={paymentType} onChange={(e) => setPaymentType(e.target.value as any)} className="input">
            <option value="">—</option><option value="CASH">Cash</option><option value="CARD">Card</option><option value="ONLINE">Online</option>
          </select>
        </Field>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <table className="w-full text-xs border-collapse">
          <thead className="bg-[#f1f5f9] select-none border-b border-slate-300">
            <tr className="text-[11px] font-bold uppercase tracking-wider text-slate-800">
              <th className="py-2.5 px-3 text-left border-r border-slate-300">Medicine Item *</th>
              <th className="py-2.5 px-3 text-left border-r border-slate-300 w-32">Batch No *</th>
              <th className="py-2.5 px-3 text-left border-r border-slate-300 w-36">Expiry Date *</th>
              <th className="py-2.5 px-3 text-right border-r border-slate-300 w-24">Qty *</th>
              <th className="py-2.5 px-3 text-right border-r border-slate-300 w-28">Unit Cost</th>
              <th className="py-2.5 px-3 text-right border-r border-slate-300 w-24">Discount</th>
              <th className="py-2.5 px-3 text-right border-r border-slate-300 w-24">Tax</th>
              <th className="py-2.5 px-3 text-center w-12" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {lines.map((l, idx) => (
              <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-2 px-3 border-r border-slate-200">
                  <select
                    value={l.medicineId}
                    onChange={(e) => updateLine(idx, { medicineId: e.target.value })}
                    className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-md font-semibold text-slate-800 focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  >
                    <option value="">Select medicine from formulary…</option>
                    {medicines.map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name} ({m.code})
                      </option>
                    ))}
                  </select>
                </td>
                <td className="py-2 px-3 border-r border-slate-200">
                  <input
                    value={l.batchNumber}
                    onChange={(e) => updateLine(idx, { batchNumber: e.target.value })}
                    placeholder="Batch #"
                    className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-md font-mono focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />
                </td>
                <td className="py-2 px-3 border-r border-slate-200">
                  <input
                    type="date"
                    value={l.expiryDate}
                    onChange={(e) => updateLine(idx, { expiryDate: e.target.value })}
                    className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />
                </td>
                <td className="py-2 px-3 border-r border-slate-200">
                  <input
                    type="number"
                    min={1}
                    value={l.quantity}
                    onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                    placeholder="0"
                    className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-md text-right font-bold tabular-nums focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />
                </td>
                <td className="py-2 px-3 border-r border-slate-200">
                  <input
                    type="number"
                    min={0}
                    value={l.unitCost}
                    onChange={(e) => updateLine(idx, { unitCost: e.target.value })}
                    placeholder="0"
                    className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-md text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />
                </td>
                <td className="py-2 px-3 border-r border-slate-200">
                  <input
                    type="number"
                    min={0}
                    value={l.discountAmount}
                    onChange={(e) => updateLine(idx, { discountAmount: e.target.value })}
                    placeholder="0"
                    className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-md text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />
                </td>
                <td className="py-2 px-3 border-r border-slate-200">
                  <input
                    type="number"
                    min={0}
                    value={l.taxAmount}
                    onChange={(e) => updateLine(idx, { taxAmount: e.target.value })}
                    placeholder="0"
                    className="w-full h-8 px-2 text-xs bg-white border border-slate-200 rounded-md text-right tabular-nums focus:outline-none focus:ring-1 focus:ring-[#08775A]"
                  />
                </td>
                <td className="py-2 px-3 text-center">
                  {lines.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeLine(idx)}
                      className="text-rose-500 hover:text-rose-700 p-1"
                      title="Remove Line"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="p-3 bg-[#f8fafc] border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={addLine}
            className="text-xs font-bold text-[#08775A] hover:text-[#065f46] flex items-center gap-1.5 transition-colors"
          >
            <Plus className="h-4 w-4" /> Add Another Medicine Line
          </button>
          <span className="text-xs text-slate-500 font-medium">
            {lines.length} {lines.length === 1 ? 'line' : 'lines'} in inward consignment
          </span>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-[#e2eae5] p-4 flex flex-col sm:flex-row sm:items-end gap-3 justify-between">
        <div className="flex items-end gap-3">
          <div>
            <div className="text-[11px] font-semibold text-[#52665e]">Purchase Total</div>
            <div className="text-lg font-bold text-[#111827]">{formatPKR(total)}</div>
          </div>
          <Field label="Paid Now"><input type="number" value={paidNow} onChange={(e) => setPaidNow(e.target.value)} className="input w-40" /></Field>
        </div>
        <button onClick={handleSubmit} disabled={saving} className="h-10 px-6 text-sm font-bold text-white bg-[#129b70] hover:bg-[#0e7d5a] rounded-lg disabled:opacity-60 flex items-center gap-2">
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null} Post Purchase
        </button>
      </div>
      <style>{`.input,.input-sm { width: 100%; padding: 0 0.6rem; font-size: 0.8rem; background: white; border: 1px solid #e2eae5; border-radius: 0.4rem; } .input { height: 2.25rem; } .input-sm { height: 2rem; } .input:focus,.input-sm:focus { outline: none; box-shadow: 0 0 0 2px rgba(18,155,112,0.2); border-color: #129b70; }`}</style>
    </div>
  );
};

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <div>
    <label className="block text-[11px] font-semibold text-[#52665e] mb-1">{label}</label>
    {children}
  </div>
);
