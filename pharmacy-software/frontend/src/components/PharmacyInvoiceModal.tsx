import React, { useState } from 'react';
import {
  X,
  Printer,
  Receipt,
  FileText,
  CreditCard,
  Undo2,
  CheckCircle2,
  AlertCircle,
  Building2,
  Calendar,
  Clock,
  User,
  Plus,
  Loader2,
} from 'lucide-react';
import { formatPKR, formatNumber, formatDateTime } from '../utils/format';
import { pharmacyApi } from '../services/pharmacyApi';
import apiClient from '../services/apiClient';
import { useToast } from '../context/ToastContext';

interface PharmacyInvoiceModalProps {
  invoice: any;
  onClose: () => void;
  onUpdated?: (updatedInvoice: any) => void;
}

export const PharmacyInvoiceModal: React.FC<PharmacyInvoiceModalProps> = ({
  invoice: initialInvoice,
  onClose,
  onUpdated,
}) => {
  const toast = useToast();
  const [invoice, setInvoice] = useState(initialInvoice);
  const [viewMode, setViewMode] = useState<'thermal' | 'tax_invoice'>('thermal');

  // Payment states
  const [showAddPayment, setShowAddPayment] = useState(false);
  const [payAmount, setPayAmount] = useState(
    Number(invoice.outstanding) > 0 ? String(invoice.outstanding) : ''
  );
  const [payMethod, setPayMethod] = useState<'CASH' | 'CARD' | 'ONLINE'>('CASH');
  const [paying, setPaying] = useState(false);

  // Return states
  const [showReturn, setShowReturn] = useState(false);
  const [returnLines, setReturnLines] = useState<Record<string, { qty: string; restock: boolean }>>({});
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'CARD' | 'ONLINE'>('CASH');
  const [returnReason, setReturnReason] = useState('');
  const [returning, setReturning] = useState(false);

  const handlePrint = () => {
    window.print();
  };

  const handleAddPayment = async () => {
    const amount = Number(payAmount);
    if (!amount || amount <= 0) {
      toast.error('Enter a valid payment amount.');
      return;
    }
    setPaying(true);
    try {
      const res = await apiClient.post(`/pharmacy/invoices/${invoice.id}/payments`, {
        amount,
        method: payMethod,
      });
      toast.success('Payment recorded successfully.');
      setInvoice(res.data.data);
      if (onUpdated) onUpdated(res.data.data);
      setShowAddPayment(false);
      setPayAmount('');
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to record payment.');
    } finally {
      setPaying(false);
    }
  };

  const handleReturn = async () => {
    const lines = Object.entries(returnLines)
      .filter(([, v]) => Number(v.qty) > 0)
      .map(([invoiceLineId, v]) => ({
        invoiceLineId,
        quantity: Number(v.qty),
        restock: v.restock,
      }));
    if (lines.length === 0) {
      toast.error('Enter a return quantity for at least one medicine.');
      return;
    }
    if (!returnReason.trim()) {
      toast.error('Return reason is required.');
      return;
    }
    setReturning(true);
    try {
      const res = await pharmacyApi.salesReturn({
        invoiceId: invoice.id,
        lines,
        reason: returnReason,
        refundMethod,
      });
      toast.success(`Return processed — Refund of ${formatPKR(res.refundTotal)} issued.`);
      setShowReturn(false);
      setReturnLines({});
      setReturnReason('');
      // Reload fresh invoice details
      const fresh = await pharmacyApi.getInvoiceById(invoice.id);
      setInvoice(fresh);
      if (onUpdated) onUpdated(fresh);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || 'Failed to process sales return.');
    } finally {
      setReturning(false);
    }
  };

  const statusColor =
    invoice.status === 'PAID'
      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
      : invoice.status === 'PARTIALLY_PAID'
      ? 'bg-amber-50 text-amber-700 border-amber-200'
      : 'bg-rose-50 text-rose-700 border-rose-200';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-900/60 backdrop-blur-xs overflow-y-auto print:p-0 print:bg-white print:static">
      <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl border border-slate-200 flex flex-col max-h-[92vh] overflow-hidden print:max-h-none print:shadow-none print:border-none print:w-full print:max-w-none">
        {/* Top Control Bar (Hidden when printing) */}
        <div className="px-5 py-3.5 bg-slate-900 text-white flex items-center justify-between gap-3 shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <Receipt className="h-4.5 w-4.5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm font-bold tracking-tight text-white">
                  {invoice.invoiceNumber}
                </span>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${statusColor}`}>
                  {invoice.status.replace('_', ' ')}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                CH Sharif & Saeed Hospital — Pharmacy Cash & Sales Desk
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="bg-slate-800 p-0.5 rounded-lg flex items-center border border-slate-700">
              <button
                type="button"
                onClick={() => setViewMode('thermal')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ${
                  viewMode === 'thermal'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Receipt className="h-3.5 w-3.5" /> Thermal (80mm)
              </button>
              <button
                type="button"
                onClick={() => setViewMode('tax_invoice')}
                className={`px-2.5 py-1 text-xs font-semibold rounded-md flex items-center gap-1.5 transition-colors ${
                  viewMode === 'tax_invoice'
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <FileText className="h-3.5 w-3.5" /> A4 Invoice
              </button>
            </div>

            {/* Print Button */}
            <button
              type="button"
              onClick={handlePrint}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg shadow-xs flex items-center gap-1.5 transition-colors"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>

            {/* Close Button */}
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        {/* Action Toolbar (Return & Add Payment options) */}
        <div className="px-5 py-2.5 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0 print:hidden text-xs">
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Channel:</span>
            <span className="font-semibold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
              {invoice.channel === 'HMS_LINKED' ? 'Inpatient / HMS Dispense' : 'Retail Walk-In POS'}
            </span>
            {invoice.customerName && (
              <span className="text-slate-600">
                Customer: <strong className="text-slate-900">{invoice.customerName}</strong>
              </span>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowReturn((prev) => !prev);
                setShowAddPayment(false);
              }}
              className={`px-2.5 py-1 rounded-md font-semibold border flex items-center gap-1 transition-colors ${
                showReturn
                  ? 'bg-rose-50 text-rose-700 border-rose-300'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
              }`}
            >
              <Undo2 className="h-3.5 w-3.5" /> {showReturn ? 'Cancel Return' : 'Sales Return'}
            </button>

            {Number(invoice.outstanding) > 0 && (
              <button
                type="button"
                onClick={() => {
                  setShowAddPayment((prev) => !prev);
                  setShowReturn(false);
                }}
                className={`px-2.5 py-1 rounded-md font-semibold border flex items-center gap-1 transition-colors ${
                  showAddPayment
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                    : 'bg-[#08775A] text-white border-[#08775A] hover:bg-[#065f46]'
                }`}
              >
                <CreditCard className="h-3.5 w-3.5" /> {showAddPayment ? 'Close' : 'Record Payment'}
              </button>
            )}
          </div>
        </div>

        {/* Scrollable Modal Content */}
        <div className="flex-1 overflow-y-auto p-5 sm:p-6 bg-slate-100/60 flex justify-center print:p-0 print:bg-white print:overflow-visible">
          {/* Printable Invoice Container */}
          <div
            id="pharmacy-printable-invoice"
            className={`bg-white shadow-sm border border-slate-200 print:shadow-none print:border-none w-full transition-all ${
              viewMode === 'thermal'
                ? 'max-w-[380px] p-5 font-mono text-[12px] text-slate-900 leading-tight'
                : 'max-w-2xl p-7 text-xs text-slate-800'
            }`}
          >
            {/* ═════════════════════════════════════════════════════════════
                THERMAL SLIP VIEW (80mm standard receipt)
                ═════════════════════════════════════════════════════════════ */}
            {viewMode === 'thermal' ? (
              <div className="space-y-3">
                {/* Hospital Header */}
                <div className="text-center space-y-1">
                  <div className="font-extrabold text-[15px] tracking-wide uppercase text-slate-950">
                    CH SHARIF &amp; SAEED HOSPITAL
                  </div>
                  <div className="font-bold text-[12px] tracking-wider text-emerald-800 uppercase">
                    CENTRAL PHARMACY &amp; DISPENSARY
                  </div>
                  <div className="text-[10px] text-slate-600">
                    Main Boulevard, Near Jail Road · 24/7 Service
                  </div>
                  <div className="text-[10px] text-slate-600">
                    UAN: +92 42 111-467-748 · DL #: DL-2026-CHSS
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-400 my-2" />

                {/* Receipt Metadata */}
                <div className="text-[11px] space-y-0.5">
                  <div className="flex justify-between">
                    <span className="text-slate-600">INVOICE #:</span>
                    <span className="font-bold text-slate-950">{invoice.invoiceNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">DATE &amp; TIME:</span>
                    <span className="font-semibold text-slate-800">{formatDateTime(invoice.createdAt)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">CUSTOMER:</span>
                    <span className="font-semibold text-slate-900">{invoice.customerName || 'Walk-In Customer'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">DISPENSED BY:</span>
                    <span className="font-semibold text-slate-800">
                      {invoice.dispensedByUser?.fullName || invoice.dispensedByUser?.username || 'Staff Pharmacist'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-600">CHANNEL:</span>
                    <span className="font-semibold text-slate-800">
                      {invoice.channel === 'HMS_LINKED' ? 'HMS Inpatient' : 'Retail POS'}
                    </span>
                  </div>
                </div>

                <div className="border-t border-dashed border-slate-400 my-2" />

                {/* Table Header */}
                <div className="grid grid-cols-12 text-[10px] font-bold text-slate-700 uppercase pb-1 border-b border-slate-300">
                  <div className="col-span-6 text-left">ITEM / MEDICINE</div>
                  <div className="col-span-2 text-center">QTY</div>
                  <div className="col-span-2 text-right">RATE</div>
                  <div className="col-span-2 text-right">NET</div>
                </div>

                {/* Table Lines */}
                <div className="space-y-1.5 py-1 text-[11px]">
                  {invoice.lines?.map((line: any, idx: number) => {
                    const medicineName = line.medicine?.name || 'Medicine Item';
                    const batchNo = line.batch?.batchNumber;
                    const qty = Number(line.quantity || 0);
                    const rate = Number(line.rateSnapshot || 0);
                    const net = Number(line.lineNet || 0);

                    return (
                      <div key={line.id || idx} className="space-y-0.5">
                        <div className="grid grid-cols-12 items-baseline">
                          <div className="col-span-6 font-semibold text-slate-950 truncate pr-1">
                            {medicineName}
                          </div>
                          <div className="col-span-2 text-center tabular-nums">{qty}</div>
                          <div className="col-span-2 text-right tabular-nums text-slate-700">{formatNumber(rate)}</div>
                          <div className="col-span-2 text-right font-bold tabular-nums text-slate-950">
                            {formatNumber(net)}
                          </div>
                        </div>
                        {batchNo && (
                          <div className="text-[9px] text-slate-500 pl-1">
                            Batch: {batchNo} {line.batch?.expiryDate ? `· Exp: ${new Date(line.batch.expiryDate).toLocaleDateString('en-GB')}` : ''}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-dashed border-slate-400 my-2" />

                {/* Financial Summary */}
                <div className="space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-slate-600">Subtotal:</span>
                    <span className="tabular-nums font-semibold">{formatPKR(invoice.subtotal)}</span>
                  </div>
                  {Number(invoice.discountTotal) > 0 && (
                    <div className="flex justify-between text-emerald-800">
                      <span>Discount:</span>
                      <span className="tabular-nums font-semibold">- {formatPKR(invoice.discountTotal)}</span>
                    </div>
                  )}
                  {Number(invoice.taxTotal) > 0 && (
                    <div className="flex justify-between text-slate-600">
                      <span>Tax / GST:</span>
                      <span className="tabular-nums font-semibold">+ {formatPKR(invoice.taxTotal)}</span>
                    </div>
                  )}
                  <div className="border-t border-slate-300 pt-1 flex justify-between font-extrabold text-[13px] text-slate-950">
                    <span>NET PAYABLE:</span>
                    <span className="tabular-nums">{formatPKR(invoice.total)}</span>
                  </div>
                  <div className="flex justify-between font-semibold text-emerald-800">
                    <span>Amount Paid:</span>
                    <span className="tabular-nums">{formatPKR(invoice.paidTotal)}</span>
                  </div>
                  {Number(invoice.outstanding) > 0 ? (
                    <div className="flex justify-between font-bold text-rose-700">
                      <span>BALANCE DUE:</span>
                      <span className="tabular-nums">{formatPKR(invoice.outstanding)}</span>
                    </div>
                  ) : (
                    <div className="flex justify-between font-bold text-emerald-700">
                      <span>BALANCE DUE:</span>
                      <span className="tabular-nums">PKR 0 (CLEARED)</span>
                    </div>
                  )}
                </div>

                {/* Payments Section */}
                {invoice.payments?.length > 0 && (
                  <div className="border-t border-dashed border-slate-400 pt-1.5 space-y-0.5 text-[10px]">
                    <div className="font-bold text-slate-700 uppercase">Payment Modes:</div>
                    {invoice.payments.map((p: any) => (
                      <div key={p.id} className="flex justify-between text-slate-700">
                        <span>
                          {p.method} {p.collectedByUser?.fullName ? `(${p.collectedByUser.fullName})` : ''}
                        </span>
                        <span className="tabular-nums font-semibold">{formatPKR(p.amount)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="border-t border-dashed border-slate-400 my-2" />

                {/* Footer & Return Policy */}
                <div className="text-center space-y-1 text-[10px] text-slate-600">
                  <div className="font-bold uppercase tracking-wider text-slate-800">
                    *** THANK YOU FOR VISITING ***
                  </div>
                  <p className="leading-snug">
                    Medicines once sold can only be returned within 3 days with this original receipt.
                    Fridge &amp; cold-chain items are strictly non-returnable.
                  </p>
                  <div className="pt-2 font-mono text-[9px] tracking-widest text-slate-400">
                    ||||| | ||||| || |||||| | ||||| ||||
                  </div>
                </div>
              </div>
            ) : (
              /* ═════════════════════════════════════════════════════════════
                 STANDARD TAX INVOICE VIEW (A4 Medical Bill)
                 ═════════════════════════════════════════════════════════════ */
              <div className="space-y-6">
                {/* Header Banner */}
                <div className="flex items-start justify-between pb-4 border-b-2 border-emerald-800">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-emerald-700 text-white flex items-center justify-center font-bold text-base">
                        CH
                      </div>
                      <h1 className="text-lg font-black tracking-tight text-slate-900 uppercase">
                        CH Sharif &amp; Saeed Hospital
                      </h1>
                    </div>
                    <p className="text-xs font-semibold text-emerald-800 uppercase tracking-wide">
                      Central Pharmacy &amp; Retail Dispensary
                    </p>
                    <p className="text-[11px] text-slate-500">
                      Main Boulevard, Near Jail Road · 24/7 Pharmacy Care
                    </p>
                    <p className="text-[11px] text-slate-500">
                      UAN: +92 42 111-467-748 · Drug License: DL-2026-CHSS · NTN: 8291048-2
                    </p>
                  </div>

                  <div className="text-right space-y-1">
                    <div className="inline-block px-3 py-1 rounded bg-slate-900 text-white font-mono text-xs font-bold uppercase tracking-wider">
                      PHARMACY INVOICE
                    </div>
                    <div className="font-mono text-sm font-bold text-slate-950">
                      {invoice.invoiceNumber}
                    </div>
                    <div className="text-[11px] text-slate-500">
                      Dated: {formatDateTime(invoice.createdAt)}
                    </div>
                    <div className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border ${statusColor}`}>
                      {invoice.status.replace('_', ' ')}
                    </div>
                  </div>
                </div>

                {/* Patient / Customer & Dispenser Info Cards */}
                <div className="grid grid-cols-2 gap-4 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <div className="space-y-1">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Patient / Customer Details
                    </div>
                    <div className="font-bold text-sm text-slate-900">
                      {invoice.customerName || 'Walk-In Customer'}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Channel: <span className="font-semibold text-slate-800">{invoice.channel === 'HMS_LINKED' ? 'Inpatient / Admission' : 'Retail Walk-in'}</span>
                    </div>
                    {invoice.medicineRequestId && (
                      <div className="text-[11px] text-slate-600">
                        HMS Request Ref: <span className="font-mono">{invoice.medicineRequestId.slice(0, 8).toUpperCase()}</span>
                      </div>
                    )}
                  </div>

                  <div className="space-y-1 text-right sm:text-left">
                    <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                      Dispensing Attribution
                    </div>
                    <div className="font-bold text-sm text-slate-900">
                      {invoice.dispensedByUser?.fullName || invoice.dispensedByUser?.username || 'Staff Pharmacist'}
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Role: <span className="font-semibold text-slate-800">{invoice.dispensedByUser?.role || 'Pharmacist'}</span>
                    </div>
                    <div className="text-[11px] text-slate-600">
                      Station: Central Pharmacy POS-1
                    </div>
                  </div>
                </div>

                {/* Medicine Items Grid */}
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left">
                    <thead className="bg-[#f1f5f9] text-[11px] font-bold text-slate-800 uppercase tracking-wide border-b border-slate-200">
                      <tr>
                        <th className="py-2.5 px-3 text-center w-10">#</th>
                        <th className="py-2.5 px-3">Medicine Description</th>
                        <th className="py-2.5 px-3">Batch &amp; Expiry</th>
                        <th className="py-2.5 px-3 text-center">Qty</th>
                        <th className="py-2.5 px-3 text-right">Unit Rate</th>
                        <th className="py-2.5 px-3 text-right">Discount</th>
                        <th className="py-2.5 px-3 text-right">Net Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {invoice.lines?.map((line: any, idx: number) => {
                        const medName = line.medicine?.name || 'Medicine Item';
                        const medCode = line.medicine?.code || '';
                        const batchNo = line.batch?.batchNumber || '—';
                        const expDate = line.batch?.expiryDate
                          ? new Date(line.batch.expiryDate).toLocaleDateString('en-GB')
                          : '—';
                        const qty = Number(line.quantity || 0);
                        const rate = Number(line.rateSnapshot || 0);
                        const disc = Number(line.discountAmount || 0);
                        const net = Number(line.lineNet || 0);

                        return (
                          <tr key={line.id || idx} className="hover:bg-slate-50/60">
                            <td className="py-2 px-3 text-center text-slate-400 font-mono text-[11px]">
                              {idx + 1}
                            </td>
                            <td className="py-2 px-3">
                              <div className="font-bold text-slate-900">{medName}</div>
                              {medCode && (
                                <div className="text-[10px] text-slate-400 font-mono">{medCode}</div>
                              )}
                            </td>
                            <td className="py-2 px-3 text-[11px] text-slate-600">
                              <span className="font-mono font-medium">{batchNo}</span>
                              <div className="text-[10px] text-slate-400">Exp: {expDate}</div>
                            </td>
                            <td className="py-2 px-3 text-center font-bold tabular-nums">
                              {qty}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums text-slate-700">
                              {formatPKR(rate)}
                            </td>
                            <td className="py-2 px-3 text-right tabular-nums text-slate-500">
                              {disc > 0 ? formatPKR(disc) : '—'}
                            </td>
                            <td className="py-2 px-3 text-right font-bold tabular-nums text-slate-900">
                              {formatPKR(net)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Financial Summary & Signatures */}
                <div className="grid grid-cols-2 gap-6 pt-2 items-start">
                  <div className="space-y-3">
                    <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-[11px] text-slate-600 space-y-1">
                      <div className="font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                        Pharmacy Terms &amp; Return Conditions:
                      </div>
                      <p>1. Returns accepted within 3 days with this computer-generated bill.</p>
                      <p>2. Cut strips, syringes, ampoules, and cold chain items cannot be returned.</p>
                      <p>3. Keep all medicines out of reach of children and direct sunlight.</p>
                    </div>

                    <div className="pt-8 grid grid-cols-2 gap-4 text-center">
                      <div className="border-t border-slate-300 pt-1 text-[10px] text-slate-500">
                        Dispensed by Pharmacist
                      </div>
                      <div className="border-t border-slate-300 pt-1 text-[10px] text-slate-500">
                        Customer Signature
                      </div>
                    </div>
                  </div>

                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2">
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Gross Amount:</span>
                      <span className="font-semibold tabular-nums">{formatPKR(invoice.subtotal)}</span>
                    </div>
                    {Number(invoice.discountTotal) > 0 && (
                      <div className="flex justify-between text-xs text-emerald-700">
                        <span>Total Discounts:</span>
                        <span className="font-semibold tabular-nums">- {formatPKR(invoice.discountTotal)}</span>
                      </div>
                    )}
                    {Number(invoice.taxTotal) > 0 && (
                      <div className="flex justify-between text-xs text-slate-600">
                        <span>Applicable GST/Tax:</span>
                        <span className="font-semibold tabular-nums">+ {formatPKR(invoice.taxTotal)}</span>
                      </div>
                    )}
                    <div className="border-t border-slate-300 pt-2 flex justify-between text-sm font-bold text-slate-900">
                      <span>Total Net Payable:</span>
                      <span className="tabular-nums text-base text-emerald-800">{formatPKR(invoice.total)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-emerald-800 font-semibold">
                      <span>Total Paid:</span>
                      <span className="tabular-nums">{formatPKR(invoice.paidTotal)}</span>
                    </div>
                    <div className="border-t border-slate-200 pt-2 flex justify-between text-xs font-bold">
                      <span className={Number(invoice.outstanding) > 0 ? 'text-rose-700' : 'text-slate-700'}>
                        Outstanding Balance:
                      </span>
                      <span className={`tabular-nums ${Number(invoice.outstanding) > 0 ? 'text-rose-700 text-sm' : 'text-slate-800'}`}>
                        {formatPKR(invoice.outstanding)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* In-Modal Add Payment Section */}
        {showAddPayment && (
          <div className="p-4 bg-emerald-50 border-t border-emerald-200 shrink-0 print:hidden space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                <CreditCard className="h-4 w-4 text-emerald-700" />
                Record Settlement / Payment for {invoice.invoiceNumber}
              </span>
              <span className="text-xs text-emerald-800">
                Outstanding: <strong>{formatPKR(invoice.outstanding)}</strong>
              </span>
            </div>

            <div className="flex items-center gap-2">
              <select
                value={payMethod}
                onChange={(e) => setPayMethod(e.target.value as any)}
                className="h-9 px-3 text-xs bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800"
              >
                <option value="CASH">Cash Payment</option>
                <option value="CARD">Debit / Credit Card</option>
                <option value="ONLINE">Bank Transfer / Online</option>
              </select>

              <input
                type="number"
                min={0}
                max={Number(invoice.outstanding)}
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Amount (PKR)"
                className="flex-1 h-9 px-3 text-xs bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-900"
              />

              <button
                type="button"
                onClick={handleAddPayment}
                disabled={paying}
                className="h-9 px-5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-xs flex items-center gap-1.5 disabled:opacity-60 transition-colors"
              >
                {paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                Confirm Payment
              </button>
            </div>
          </div>
        )}

        {/* In-Modal Sales Return Section */}
        {showReturn && (
          <div className="p-4 bg-rose-50 border-t border-rose-200 shrink-0 print:hidden space-y-3 max-h-60 overflow-y-auto">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-rose-950 flex items-center gap-1.5">
                <Undo2 className="h-4 w-4 text-rose-700" />
                Process Sales Return &amp; Refund
              </span>
              <span className="text-xs text-rose-700">Select medicine quantities to return</span>
            </div>

            <div className="space-y-2">
              {invoice.lines?.map((line: any) => (
                <div
                  key={line.id}
                  className="flex items-center justify-between bg-white p-2 rounded-lg border border-rose-200 text-xs"
                >
                  <div className="min-w-0 flex-1 pr-2">
                    <span className="font-semibold text-slate-900">{line.medicine?.name}</span>
                    <span className="text-slate-500 ml-2">
                      (Billed: {Number(line.quantity)} @ PKR {Number(line.rateSnapshot)})
                    </span>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <input
                      type="number"
                      min={0}
                      max={Number(line.quantity)}
                      placeholder="Qty"
                      value={returnLines[line.id]?.qty ?? ''}
                      onChange={(e) =>
                        setReturnLines((prev) => ({
                          ...prev,
                          [line.id]: {
                            qty: e.target.value,
                            restock: prev[line.id]?.restock ?? true,
                          },
                        }))
                      }
                      className="w-20 h-7 px-2 text-xs border border-rose-300 rounded text-center font-bold"
                    />

                    <label className="flex items-center gap-1 text-[11px] text-slate-600 select-none cursor-pointer">
                      <input
                        type="checkbox"
                        checked={returnLines[line.id]?.restock ?? true}
                        onChange={(e) =>
                          setReturnLines((prev) => ({
                            ...prev,
                            [line.id]: {
                              qty: prev[line.id]?.qty ?? '',
                              restock: e.target.checked,
                            },
                          }))
                        }
                        className="rounded text-emerald-600 focus:ring-emerald-500"
                      />
                      <span>Restock</span>
                    </label>
                  </div>
                </div>
              ))}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="text"
                placeholder="Reason for return (required) *"
                value={returnReason}
                onChange={(e) => setReturnReason(e.target.value)}
                className="flex-1 h-8 px-2.5 text-xs bg-white border border-rose-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-rose-500"
              />

              <select
                value={refundMethod}
                onChange={(e) => setRefundMethod(e.target.value as any)}
                className="h-8 px-2.5 text-xs bg-white border border-rose-300 rounded-lg"
              >
                <option value="CASH">Refund Cash</option>
                <option value="CARD">Refund to Card</option>
                <option value="ONLINE">Refund Online</option>
              </select>

              <button
                type="button"
                onClick={handleReturn}
                disabled={returning}
                className="h-8 px-4 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs flex items-center gap-1 disabled:opacity-60 transition-colors shrink-0"
              >
                {returning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                Confirm Return &amp; Refund
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
