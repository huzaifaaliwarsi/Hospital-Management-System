import React, { useState, useEffect } from 'react';
import { Printer, X, RefreshCw } from 'lucide-react';
import { formatAmount } from '../../utils/formatters';
import { getHospitalProfile } from '../../services/hospitalProfileService';
import { HospitalProfile } from '../../types/hospital';
import { InvoiceDetail, PaymentReceiptRow } from '../../services/invoiceService';

export interface ThermalReceiptData {
  receiptNumber: string;
  invoiceNumber: string;
  dateTime: string;
  encounterType: 'OPD' | 'EMERGENCY' | 'OBSERVATION' | 'CUSTOM' | string;
  tokenNumber?: string | null;
  mrNumber?: string;
  patientName: string;
  patientAge?: number | string | null;
  patientGender?: string | null;
  patientWeight?: number | string | null;
  doctorName?: string | null;
  serviceName?: string;
  fees: number;
  others: number;
  total: number;
  receivedNow: number;
  paid: number;
  outstanding: number;
  advanceCredit?: number;
  paymentMethod?: string;
  collectedBy?: string | null;
  patientPhone?: string | null;
  isReprint?: boolean;
}

/**
 * Formats date and time cleanly: e.g. "10-Oct-2026, 07:18 PM"
 */
export function formatReceiptDateTime(raw?: string | null): string {
  if (!raw) return '';
  const d = new Date(raw);
  if (isNaN(d.getTime())) return String(raw);

  const day = String(d.getDate()).padStart(2, '0');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const month = monthNames[d.getMonth()];
  const year = d.getFullYear();

  let hours = d.getHours();
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12;
  const strHours = String(hours).padStart(2, '0');

  return `${day}-${month}-${year}, ${strHours}:${minutes} ${ampm}`;
}

/**
 * Builds canonical ThermalReceiptData with 5-6 core fields:
 * Queue No, Invoice No, Date, Doctor, Patient, Fees, Others, Total, Paid, Outstanding.
 *
 * "Fees" captures all doctor consultation + core encounter intake services.
 * "Others" captures only separate additional procedures / medications / tests (0 if none).
 */
export function buildThermalReceiptData(
  invoice: InvoiceDetail,
  receipt?: PaymentReceiptRow | null,
  options?: {
    receivedNow?: number;
    paymentMethod?: string;
    collectedBy?: string;
    isReprint?: boolean;
    patientWeight?: number | string | null;
    patientAge?: number | string | null;
    patientGender?: string | null;
  }
): ThermalReceiptData {
  const encType = invoice.encounterType || 'OPD';
  const isIpd = invoice.sourceType === 'ADMISSION' || (encType as any) === 'ADMISSION' || (encType as any) === 'IPD';

  // Calculate core Consultation / Encounter Fees vs Others (additional procedures/labs/medicines)
  let fees = 0;
  let others = 0;

  if (!invoice.lines || invoice.lines.length === 0) {
    fees = Number(invoice.total || 0);
    others = 0;
  } else {
    for (const line of invoice.lines) {
      const lineAmt = Number(line.lineNet || line.lineGross || 0);
      const desc = (line.serviceName || (line as any).descriptionSnapshot || '').toLowerCase();
      const bSource = ((line as any).billingSource || '').toUpperCase();

      // Core visit charges: Doctor Visit / Consultation fee OR primary encounter intake service
      const isCoreEncounterCharge =
        bSource === 'DOCTOR_CHARGE' ||
        desc.includes('visit') ||
        desc.includes('consultation') ||
        desc.includes('consult') ||
        desc.includes('observation') ||
        desc.includes('emergency') ||
        desc.includes('triage') ||
        desc.includes('opd');

      if (isCoreEncounterCharge) {
        fees += lineAmt;
      } else {
        others += lineAmt;
      }
    }

    // Fallback: If no line matched core pattern (custom service name), first line is fees, remainder is others
    if (fees === 0 && invoice.lines.length > 0) {
      fees = Number(invoice.lines[0].lineNet || invoice.lines[0].lineGross || 0);
      others = Math.max(0, Number(invoice.total || 0) - fees);
    }
  }

  const netPayable = invoice.payerType === 'Corporate / Panel' ? Number(invoice.patientShare || 0) : Number(invoice.total || 0);

  // Identifiers
  const receiptNumber = receipt?.receiptNumber || (invoice.receipts?.[invoice.receipts.length - 1]?.receiptNumber) || 'RCP-PENDING';
  const invoiceNumber = invoice.invoiceNumber || '—';

  // Clean date & time
  const rawDate = receipt?.collectedAt || invoice.createdAt || new Date().toISOString();
  const dateTime = formatReceiptDateTime(rawDate);

  const receivedNow = options?.receivedNow != null
    ? options.receivedNow
    : receipt
    ? Number(receipt.amount || 0)
    : Number(invoice.paidTotal || 0);

  const paymentMethod = options?.paymentMethod || receipt?.method || 'CASH';
  const collectedBy = options?.collectedBy || receipt?.collectedByName || 'Cashier';

  // Outstanding calculation logic:
  let rawOutstanding = 0;
  if (invoice.status === 'PAID') {
    rawOutstanding = 0;
  } else if (options?.receivedNow != null && options.receivedNow > 0) {
    if (invoice.balanceDue != null && invoice.balanceDue <= 0) {
      rawOutstanding = 0;
    } else if (invoice.balanceDue != null) {
      rawOutstanding = Math.max(0, Number(invoice.balanceDue) - options.receivedNow);
    } else {
      const basePaid = Number(invoice.paidTotal || 0);
      const effectivePaid = basePaid < netPayable ? basePaid + options.receivedNow : basePaid;
      rawOutstanding = Math.max(0, netPayable - effectivePaid);
    }
  } else if (typeof invoice.balanceDue === 'number') {
    rawOutstanding = Math.max(0, invoice.balanceDue);
  } else {
    const currentPaid = Number(invoice.paidTotal || 0);
    rawOutstanding = Math.max(0, netPayable - currentPaid);
  }

  // Clean Doctor Name: add Dr. prefix if not present
  let docName = invoice.doctorName ? invoice.doctorName.trim() : 'Consultant';
  if (docName && docName !== 'Consultant' && !/^dr\.?/i.test(docName)) {
    docName = `Dr. ${docName}`;
  }

  const primaryLine = invoice.lines?.[0];
  const serviceName = primaryLine?.serviceName || (encType === 'OBSERVATION' ? 'Observation' : encType === 'EMERGENCY' ? 'Emergency' : 'OPD');

  return {
    receiptNumber,
    invoiceNumber,
    dateTime,
    encounterType: encType,
    // Strictly omit Token Number for IPD / Admission
    tokenNumber: isIpd ? null : (invoice.queueNumber || null),
    mrNumber: invoice.patientMr || '—',
    patientName: invoice.patientName || 'Patient',
    patientAge: options?.patientAge ?? invoice.patientAge ?? null,
    patientGender: options?.patientGender ?? invoice.patientGender ?? null,
    patientWeight: options?.patientWeight ?? (invoice as any).patientWeight ?? (invoice as any).weightKg ?? (invoice as any).admissionRecord?.weightKg ?? (() => {
      const allNotes = String((invoice as any).notes || (invoice as any).admissionRecord?.notes || '');
      const m = allNotes.match(/weight[:\s]+([0-9]+(?:\.[0-9]+)?(?:\s*kg)?)/i);
      return m ? m[1] : null;
    })(),
    doctorName: docName,
    serviceName,
    fees,
    others,
    total: netPayable,
    receivedNow,
    paid: receivedNow,
    outstanding: rawOutstanding,
    advanceCredit: 0,
    paymentMethod,
    collectedBy,
    patientPhone: invoice.patientPhone || null,
    isReprint: options?.isReprint || false,
  };
}

/**
 * Generates compact 80mm thermal receipt HTML with authentic POS monospace typography.
 */
/**
 * Generates compact 80mm thermal receipt HTML with authentic POS monospace dot-matrix typography.
 * Strictly monochrome black & white without colorful ink (just like real thermal POS printers).
 */
export function generateThermalReceiptHtml(
  data: ThermalReceiptData,
  profile?: HospitalProfile
): string {
  const hp = profile || getHospitalProfile();
  const hospitalName = hp.name || 'CH SHARIF AND SAEED HOSPITAL';

  const isIpd = data.encounterType === 'ADMISSION' || (data.encounterType as string) === 'IPD';
  const showToken = !isIpd && !!data.tokenNumber;

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>Receipt - ${data.invoiceNumber || data.receiptNumber}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Share+Tech+Mono&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
  <style>
    @page {
      size: auto;
      margin: 0mm;
    }
    @media print {
      html, body {
        width: 76mm !important;
        max-width: 76mm !important;
        margin: 0 !important;
        padding: 0 !important;
        background: #fff !important;
        color: #000 !important;
        overflow: hidden !important;
        height: auto !important;
      }
      .no-print { display: none !important; }
      * {
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      color: #000 !important;
    }
    body {
      font-family: 'Share Tech Mono', 'Space Mono', 'Consolas', 'Courier New', monospace;
      width: 72mm;
      max-width: 74mm;
      margin: 0 auto;
      padding: 2mm 1mm 3mm 1mm;
      color: #000;
      background: #fff;
      font-size: 11px;
      line-height: 1.3;
      letter-spacing: 0.2px;
      -webkit-font-smoothing: antialiased;
      height: auto;
      overflow: hidden;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .text-left { text-align: left; }
    .medium { font-weight: 600; }
    .bold { font-weight: 700; }
    .uppercase { text-transform: uppercase; }

    .header {
      text-align: center;
      margin-bottom: 4px;
    }
    .hospital-title {
      font-size: 13.5px;
      font-weight: 700;
      letter-spacing: 0.5px;
      text-transform: uppercase;
      line-height: 1.25;
      color: #000;
      margin-bottom: 2px;
    }
    .doc-type {
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 1px;
      color: #000;
      margin-top: 2px;
      text-transform: uppercase;
    }
    .reprint-badge {
      display: inline-block;
      font-size: 9px;
      font-weight: 700;
      border: 1px dashed #000;
      color: #000;
      padding: 1px 5px;
      margin-top: 3px;
    }

    .divider {
      border-top: 1px dashed #000;
      margin: 4px 0;
      width: 100%;
    }

    .token-box {
      border: 1.5px solid #000;
      padding: 4px 6px;
      margin: 5px 0;
      text-align: center;
      background: #fff;
    }
    .token-title {
      font-size: 9.5px;
      font-weight: 600;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #000;
    }
    .token-num {
      font-size: 22px;
      font-weight: 700;
      letter-spacing: 1.5px;
      color: #000;
      margin-top: 1px;
    }

    .info-table, .charges-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 11.5px;
    }
    .info-table td {
      padding: 1.5px 0;
      vertical-align: top;
      word-break: break-word;
      color: #000;
      font-weight: 600;
    }
    .label {
      width: 35%;
      font-weight: 600;
      color: #000;
    }
    .val {
      width: 65%;
      font-weight: 600;
      color: #000;
      text-align: right;
    }
    .val-patient {
      width: 65%;
      font-weight: 700;
      color: #000;
      text-align: right;
    }

    .charges-table td {
      padding: 1.5px 0;
      font-weight: 600;
      color: #000;
      word-break: break-word;
    }
    .total-val {
      font-weight: 700;
      color: #000;
    }
    .paid-val {
      font-weight: 700;
      color: #000;
    }
    .out-val {
      font-weight: 700;
      color: #000;
    }

    .footer {
      text-align: center;
      font-size: 11px;
      color: #000;
      margin-top: 6px;
      line-height: 1.3;
    }
    .footer-msg {
      font-weight: 600;
      font-size: 11px;
      color: #000;
    }
    .tear-line {
      margin-top: 8px;
      border-top: 1px dashed #000;
      text-align: center;
      font-size: 9px;
      font-weight: 600;
      color: #000;
      padding-top: 3px;
      letter-spacing: 1px;
    }
    .section-title {
      font-size: 9.5px;
      font-weight: 700;
      letter-spacing: 0.8px;
      text-transform: uppercase;
      color: #000;
      margin-top: 3px;
      margin-bottom: 2px;
      border-bottom: 1px dotted #000;
      padding-bottom: 1px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="hospital-title">${hospitalName}</div>
    <div class="doc-type">PAYMENT RECEIPT</div>
    ${data.isReprint ? '<div class="reprint-badge">*** REPRINT / DUPLICATE ***</div>' : ''}
  </div>

  <div class="divider"></div>

  ${showToken ? `
  <div class="token-box">
    <div class="token-title">Queue / Token Number</div>
    <div class="token-num">${data.tokenNumber}</div>
  </div>
  <div class="divider"></div>
  ` : ''}

  <!-- SECTION 1: PATIENT INFORMATION -->
  <div class="section-title">PATIENT INFORMATION</div>
  <table class="info-table">
    <tr>
      <td class="label">Patient:</td>
      <td class="val-patient">${data.patientName}</td>
    </tr>
    <tr>
      <td class="label">MR No:</td>
      <td class="val">${data.mrNumber || '—'}</td>
    </tr>
    ${(data.patientAge || data.patientGender) ? `
    <tr>
      <td class="label">Age / Sex:</td>
      <td class="val">${[data.patientAge ? `${data.patientAge} Y` : '', data.patientGender].filter(Boolean).join(' / ')}</td>
    </tr>` : ''}
    <tr>
      <td class="label">Weight:</td>
      <td class="val">${data.patientWeight ? (String(data.patientWeight).toLowerCase().includes('kg') ? data.patientWeight : `${data.patientWeight} kg`) : '—'}</td>
    </tr>
    <tr>
      <td class="label">Doctor:</td>
      <td class="val">${data.doctorName || 'Consultant'}</td>
    </tr>
  </table>

  <div class="divider"></div>

  <!-- SECTION 2: INVOICE & PAYMENT -->
  <div class="section-title">INVOICE &amp; PAYMENT</div>
  <table class="info-table">
    <tr>
      <td class="label">Invoice No:</td>
      <td class="val">${data.invoiceNumber}</td>
    </tr>
    <tr>
      <td class="label">Date:</td>
      <td class="val">${data.dateTime}</td>
    </tr>
    <tr>
      <td class="label">Pay Mode:</td>
      <td class="val">${data.paymentMethod || 'CASH'}</td>
    </tr>
    <tr>
      <td class="label">Encounter:</td>
      <td class="val">${data.encounterType}</td>
    </tr>
  </table>

  <div class="divider"></div>

  <table class="charges-table">
    <tr>
      <td class="text-left">Fees</td>
      <td class="text-right">${formatAmount(data.fees)}</td>
    </tr>
    <tr>
      <td class="text-left">Others</td>
      <td class="text-right">${formatAmount(data.others)}</td>
    </tr>
    <tr>
      <td colspan="2"><div class="divider"></div></td>
    </tr>
    <tr>
      <td class="text-left total-val">TOTAL</td>
      <td class="text-right total-val">${formatAmount(data.total)}</td>
    </tr>
    <tr>
      <td class="text-left paid-val">PAID</td>
      <td class="text-right paid-val">${formatAmount(data.paid ?? data.receivedNow)}</td>
    </tr>
    <tr>
      <td class="text-left out-val">OUTSTANDING</td>
      <td class="text-right out-val">${formatAmount(data.outstanding)}</td>
    </tr>
  </table>

  <div class="divider"></div>

  <div class="footer">
    <div class="footer-msg">Thank You</div>
  </div>

  <div class="tear-line">---------------- TEAR HERE ----------------</div>

  <script>
    // In case opened in a new tab or window directly
    if (window.name !== 'thermal-print-iframe') {
      window.onload = function() {
        setTimeout(function() {
          window.focus();
          window.print();
        }, 150);
      };
    }
  </script>
</body>
</html>`;
}

/**
 * Prints thermal receipt via an isolated hidden iframe.
 * Never blocked by popup blockers and ONLY prints the pure receipt (no modals, no buttons, no UI chrome).
 */
export function printThermalReceiptViaIframe(
  data: ThermalReceiptData,
  profile?: HospitalProfile
): void {
  const html = generateThermalReceiptHtml(data, profile);
  const existing = document.getElementById('thermal-print-iframe');
  if (existing) {
    existing.remove();
  }

  const iframe = document.createElement('iframe');
  iframe.id = 'thermal-print-iframe';
  iframe.name = 'thermal-print-iframe';
  iframe.style.position = 'fixed';
  iframe.style.right = '0';
  iframe.style.bottom = '0';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  iframe.style.visibility = 'hidden';
  document.body.appendChild(iframe);

  const doc = iframe.contentWindow?.document || iframe.contentDocument;
  if (!doc) {
    window.print();
    return;
  }

  let printed = false;
  const doPrint = () => {
    if (printed) return;
    printed = true;
    try {
      iframe.contentWindow?.focus();
      iframe.contentWindow?.print();
    } catch (e) {
      console.error('Thermal print error:', e);
    }
  };

  iframe.onload = () => {
    setTimeout(doPrint, 150);
  };

  doc.open();
  doc.write(html);
  doc.close();

  // Safety fallback if iframe.onload does not fire in some browsers
  setTimeout(doPrint, 350);
}

/**
 * Triggers direct 80mm thermal receipt printing via isolated iframe.
 */
export function printThermalReceipt(
  data: ThermalReceiptData,
  profile?: HospitalProfile
): { success: boolean } {
  printThermalReceiptViaIframe(data, profile);
  return { success: true };
}

export interface ThermalPaymentReceiptProps {
  encounterType?: 'OPD' | 'EMERGENCY' | 'OBSERVATION' | string;
  receipt: ThermalReceiptData;
  onPrint?: () => void;
  onClose?: () => void;
  className?: string;
}

/**
 * Authentic 80mm Thermal Receipt Preview component:
 * - 100% Monochrome Black & White (No colorful ink)
 * - POS Thermal Printer Font ('Share Tech Mono' / 'bitMatrix-A4')
 * - Bold enough to be clearly legible and authentic.
 */
export const ThermalPaymentReceipt: React.FC<ThermalPaymentReceiptProps> = ({
  encounterType,
  receipt,
  onPrint,
  onClose,
  className = '',
}) => {
  const hp = getHospitalProfile();
  const activeEncounterType = encounterType || receipt.encounterType || 'OPD';
  const isIpd = activeEncounterType === 'ADMISSION' || (activeEncounterType as string) === 'IPD';
  const showToken = !isIpd && !!receipt.tokenNumber;

  const [isPrinting, setIsPrinting] = useState(false);

  const handleTriggerPrint = () => {
    setIsPrinting(true);
    try {
      if (onPrint) {
        onPrint();
      } else {
        printThermalReceipt(receipt, hp);
      }
    } finally {
      setTimeout(() => setIsPrinting(false), 500);
    }
  };

  return (
    <div className={`bg-slate-100 p-3.5 rounded-xl flex flex-col items-center border border-slate-200 ${className}`}>
      {/* 80mm Monochrome Visual Receipt Paper Container */}
      <div
        id="thermal-receipt-container"
        className="bg-white text-black border border-slate-300 shadow-[0_4px_16px_rgba(0,0,0,0.12)] rounded-xs p-4 w-[285px] max-w-[295px] select-none relative"
        style={{
          fontFamily: "'Share Tech Mono', 'Space Mono', 'Consolas', 'Courier New', monospace",
          color: '#000000',
        }}
      >
        {/* Header */}
        <div className="text-center pb-1">
          <div className="font-bold text-[13px] tracking-wide text-black uppercase leading-tight">
            {hp.name || 'CH SHARIF AND SAEED HOSPITAL'}
          </div>
          <div className="font-bold text-[10.5px] text-black uppercase tracking-wider mt-1 border-t border-b border-dashed border-black py-0.5">
            Payment Receipt
          </div>
          {receipt.isReprint && (
            <div className="inline-block border border-dashed border-black text-black px-1.5 py-0.5 text-[9px] font-bold uppercase mt-1">
              *** Reprint / Duplicate ***
            </div>
          )}
        </div>

        {/* Token Number Box (OPD / ER / Observation only) - Prominent & Bold */}
        {showToken && (
          <div className="border-2 border-black bg-white p-2 my-2.5 text-center">
            <div className="text-[10px] font-bold uppercase tracking-wider text-black">
              Queue / Token Number
            </div>
            <div className="text-2xl font-bold tracking-widest text-black mt-0.5">
              {receipt.tokenNumber}
            </div>
          </div>
        )}

        {/* SECTION 1: PATIENT INFORMATION */}
        <div className="border-t border-dashed border-black pt-2 pb-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-black border-b border-dotted border-black pb-0.5 mb-1.5">
            Patient Information
          </div>
          <div className="space-y-1 text-[11.5px] font-semibold text-black">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-black">Patient:</span>
              <span className="font-bold text-black text-right max-w-[170px] truncate" title={receipt.patientName}>
                {receipt.patientName}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-black">MR No:</span>
              <span className="font-bold text-black">{receipt.mrNumber || '—'}</span>
            </div>
            {(receipt.patientAge || receipt.patientGender) && (
              <div className="flex justify-between items-center">
                <span className="font-semibold text-black">Age / Sex:</span>
                <span className="font-semibold text-black">
                  {[receipt.patientAge ? `${receipt.patientAge} Y` : '', receipt.patientGender].filter(Boolean).join(' / ')}
                </span>
              </div>
            )}
            <div className="flex justify-between items-center">
              <span className="font-semibold text-black">Weight:</span>
              <span className="font-bold text-black font-mono">
                {receipt.patientWeight ? (String(receipt.patientWeight).toLowerCase().includes('kg') ? receipt.patientWeight : `${receipt.patientWeight} kg`) : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-black">Doctor:</span>
              <span className="font-bold text-black text-right max-w-[170px] truncate" title={receipt.doctorName || 'Consultant'}>
                {receipt.doctorName || 'Consultant'}
              </span>
            </div>
          </div>
        </div>

        {/* SECTION 2: INVOICE & PAYMENT */}
        <div className="border-t border-dashed border-black pt-2 pb-1.5">
          <div className="text-[10px] font-bold uppercase tracking-wider text-black border-b border-dotted border-black pb-0.5 mb-1.5">
            Invoice &amp; Payment
          </div>
          <div className="space-y-1 text-[11.5px] font-semibold text-black">
            <div className="flex justify-between items-center">
              <span className="font-semibold text-black">Invoice No:</span>
              <span className="font-bold text-black">{receipt.invoiceNumber || receipt.receiptNumber}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-black">Date:</span>
              <span className="font-semibold text-black">{receipt.dateTime}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-black">Pay Mode:</span>
              <span className="font-bold text-black">{receipt.paymentMethod || 'CASH'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="font-semibold text-black">Encounter:</span>
              <span className="font-semibold text-black">{receipt.encounterType}</span>
            </div>
          </div>
        </div>

        {/* Charges Table - 100% Monochrome Black (No colors) */}
        <div className="border-t border-dashed border-black pt-2 pb-2 text-[11.5px] font-semibold text-black">
          <div className="flex justify-between py-0.5">
            <span className="font-semibold text-black">Fees</span>
            <span className="font-bold text-black tabular-nums">{formatAmount(receipt.fees)}</span>
          </div>
          <div className="flex justify-between py-0.5">
            <span className="font-semibold text-black">Others</span>
            <span className="font-bold text-black tabular-nums">{formatAmount(receipt.others)}</span>
          </div>

          <div className="border-t border-dashed border-black pt-1.5 mt-1 space-y-1">
            <div className="flex justify-between text-[12px] font-bold text-black">
              <span>TOTAL</span>
              <span className="tabular-nums">{formatAmount(receipt.total)}</span>
            </div>
            <div className="flex justify-between text-[12px] font-bold text-black">
              <span>PAID</span>
              <span className="tabular-nums">{formatAmount(receipt.paid ?? receipt.receivedNow)}</span>
            </div>
            <div className="flex justify-between text-[12px] font-bold text-black">
              <span>OUTSTANDING</span>
              <span className="tabular-nums">{formatAmount(receipt.outstanding)}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-dashed border-black pt-2 text-center text-[10.5px] text-black leading-tight">
          <div className="font-bold text-[11px] text-black">Thank You</div>
          <div className="text-[9px] font-semibold text-black mt-2 border-t border-dashed border-black pt-1 tracking-wider">
            ---------------- TEAR HERE ----------------
          </div>
        </div>
      </div>

      {/* Print isolation styles when printed from parent window */}
      <style>{`
        @media print {
          body * {
            visibility: hidden !important;
          }
          #thermal-receipt-container, #thermal-receipt-container * {
            visibility: visible !important;
          }
          #thermal-receipt-container {
            position: fixed !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            padding: 2mm 1mm 3mm 1mm !important;
            box-shadow: none !important;
            border: none !important;
            width: 74mm !important;
            max-width: 76mm !important;
          }
        }
      `}</style>

      {/* Action Buttons Toolbar */}
      <div className="mt-3 flex items-center gap-2 print:hidden">
        <button
          type="button"
          onClick={handleTriggerPrint}
          disabled={isPrinting}
          className="inline-flex items-center gap-1.5 px-4 py-2 bg-slate-900 hover:bg-black disabled:opacity-60 text-white text-xs font-semibold rounded-lg shadow-sm transition-colors cursor-pointer"
        >
          {isPrinting ? (
            <RefreshCw className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Printer className="h-3.5 w-3.5" />
          )}
          <span>{isPrinting ? 'Printing…' : 'Print 80mm Receipt'}</span>
        </button>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="inline-flex items-center gap-1 px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            <X className="h-3.5 w-3.5" />
            <span>Close</span>
          </button>
        )}
      </div>
    </div>
  );
};

export interface ThermalReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  receipt: ThermalReceiptData | null;
}

/**
 * Modal wrapper for displaying and printing the 80mm thermal receipt.
 * Clean, high-contrast backdrop (z-[70]) without cheap stacked blur distortion.
 */
export const ThermalReceiptModal: React.FC<ThermalReceiptModalProps> = ({
  isOpen,
  onClose,
  receipt,
}) => {
  if (!isOpen || !receipt) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-slate-950/75 animate-in fade-in duration-150 print:p-0 print:bg-transparent print:static">
      <div className="relative bg-white rounded-2xl shadow-2xl border border-slate-200/90 max-w-sm w-full p-4 overflow-y-auto max-h-[95vh] print:p-0 print:border-none print:shadow-none print:max-w-none print:w-auto">
        <div className="flex items-center justify-between pb-2.5 border-b border-slate-100 mb-2.5 print:hidden">
          <div className="text-xs font-semibold text-slate-700 uppercase tracking-wider font-sans">
            80mm Thermal Receipt Preview
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <ThermalPaymentReceipt
          receipt={receipt}
          encounterType={receipt.encounterType}
          onClose={onClose}
        />
      </div>
    </div>
  );
};
