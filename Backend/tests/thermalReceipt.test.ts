import { describe, expect, it } from 'vitest';

export interface ThermalReceiptLineItem {
  lineId?: string;
  serviceId?: string;
  serviceCode?: string;
  serviceName: string;
  quantity: number;
  unitRate: number;
  grossAmount?: number;
  discountAmount?: number;
  discountReason?: string;
  taxAmount?: number;
  netAmount: number;
  sourceType?: string;
  performedByName?: string;
  billingUnit?: string;
}

export interface ThermalReceiptData {
  receiptNumber: string;
  invoiceNumber: string;
  dateTime: string;
  encounterType: 'OPD' | 'EMERGENCY' | 'OBSERVATION' | 'CUSTOM' | 'ADMISSION' | string;
  encounterRef?: string;
  tokenNumber?: string | null;
  mrNumber?: string;
  patientName: string;
  patientAge?: number | string | null;
  patientGender?: string | null;
  patientWeight?: number | string | null;
  admissionNumber?: string | null;
  bedInfo?: string | null;
  doctorName?: string | null;
  serviceName?: string;
  lines: ThermalReceiptLineItem[];
  subtotal: number;
  totalDiscount: number;
  totalTax: number;
  total: number;
  netTotal: number;
  receivedNow: number;
  previouslyPaid: number;
  paid: number;
  outstanding: number;
  advanceCredit: number;
  paymentMethod?: string;
  collectedBy?: string | null;
  patientPhone?: string | null;
  isReprint?: boolean;
  fees: number;
  others: number;
}

export function buildThermalReceiptData(
  invoice: any,
  receipt?: any,
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
  const isIpd = invoice.sourceType === 'ADMISSION' || (invoice.encounterType as any) === 'ADMISSION' || (invoice.encounterType as any) === 'IPD';
  const encType = isIpd ? 'ADMISSION' : (invoice.encounterType || 'OPD');

  const rawLines = Array.isArray(invoice.lines) ? invoice.lines : [];
  const lines: ThermalReceiptLineItem[] = rawLines
    .filter((l: any) => invoice.sourceType !== 'ADMISSION' || l.serviceCode !== 'ADM-ADVANCE')
    .map((l: any) => {
      const q = Number(l.quantity != null ? l.quantity : 1);
      const rate = Number(l.rate != null ? l.rate : (l.rateSnapshot != null ? l.rateSnapshot : 0));
      const disc = Number(l.discountAmount != null ? l.discountAmount : (l.discount != null ? l.discount : 0));
      const gross = Number(l.lineGross != null ? l.lineGross : (l.gross != null ? l.gross : rate * q));
      const net = Number(l.lineNet != null ? l.lineNet : (l.net != null ? l.net : Math.max(0, gross - disc)));

      return {
        lineId: l.id,
        serviceId: l.serviceRateId || l.serviceId || '',
        serviceCode: l.serviceCode || '',
        serviceName: l.serviceName || l.descriptionSnapshot || l.billingSource || 'Hospital Service',
        quantity: q,
        unitRate: rate,
        grossAmount: gross,
        discountAmount: disc,
        discountReason: l.discountReason || '',
        taxAmount: 0,
        netAmount: net,
        sourceType: l.billingSource || 'HOSPITAL_SERVICE',
        performedByName: l.performedByName || l.performedBy?.fullName || '',
        billingUnit: l.billingUnit || 'Items',
      };
    });

  let fees = 0;
  let others = 0;
  for (const line of lines) {
    const desc = line.serviceName.toLowerCase();
    const isCore =
      line.sourceType === 'DOCTOR_CHARGE' ||
      desc.includes('visit') ||
      desc.includes('consultation') ||
      desc.includes('consult') ||
      desc.includes('observation') ||
      desc.includes('emergency') ||
      desc.includes('triage') ||
      desc.includes('opd') ||
      desc.includes('admission');

    if (isCore) {
      fees += line.netAmount;
    } else {
      others += line.netAmount;
    }
  }
  if (fees === 0 && lines.length > 0) {
    fees = lines[0].netAmount;
    others = lines.slice(1).reduce((sum, l) => sum + l.netAmount, 0);
  }

  const subtotal = Number(invoice.subtotal != null ? invoice.subtotal : lines.reduce((s, l) => s + (l.grossAmount || l.netAmount), 0));
  const totalDiscount = Number(invoice.discountTotal != null ? invoice.discountTotal : lines.reduce((s, l) => s + (l.discountAmount || 0), 0));
  const netPayable = invoice.payerType === 'Corporate / Panel' ? Number(invoice.patientShare ?? 0) : Number(invoice.total ?? 0);
  const netTotal = Number(invoice.total != null ? invoice.total : netPayable);

  const receiptNumber = receipt?.receiptNumber || (invoice.receipts?.[invoice.receipts.length - 1]?.receiptNumber) || 'RCP-PENDING';
  const invoiceNumber = invoice.invoiceNumber || '—';
  const rawDate = receipt?.collectedAt || invoice.createdAt || '10-Oct-2026 07:00 PM';
  const dateTime = String(rawDate);

  const totalPaidOnInvoice = Number(invoice.paidTotal || 0);
  const receivedNow = options?.receivedNow != null
    ? options.receivedNow
    : receipt
    ? Number(receipt.amount || 0)
    : totalPaidOnInvoice;

  let previouslyPaid = 0;
  if (options?.receivedNow != null) {
    previouslyPaid = Math.max(0, totalPaidOnInvoice - options.receivedNow);
  } else if (receipt && invoice.receipts && invoice.receipts.length > 0) {
    const idx = invoice.receipts.findIndex((r: any) => r.receiptNumber === receipt.receiptNumber || r.id === receipt.id);
    if (idx > 0) {
      previouslyPaid = invoice.receipts
        .slice(0, idx)
        .filter((r: any) => !r.isReversed)
        .reduce((sum: number, r: any) => sum + Number(r.amount || 0), 0);
    } else {
      previouslyPaid = Math.max(0, totalPaidOnInvoice - receivedNow);
    }
  } else {
    previouslyPaid = Math.max(0, totalPaidOnInvoice - receivedNow);
  }

  let rawOutstanding = 0;
  if (invoice.status === 'PAID') {
    rawOutstanding = 0;
  } else if (options?.receivedNow != null && options.receivedNow > 0) {
    if (invoice.balanceDue != null && invoice.balanceDue <= 0) {
      rawOutstanding = 0;
    } else if (invoice.balanceDue != null) {
      rawOutstanding = Math.max(0, Number(invoice.balanceDue));
    } else {
      rawOutstanding = Math.max(0, netPayable - (previouslyPaid + receivedNow));
    }
  } else if (typeof invoice.balanceDue === 'number') {
    rawOutstanding = Math.max(0, invoice.balanceDue);
  } else {
    rawOutstanding = Math.max(0, netPayable - totalPaidOnInvoice);
  }

  const effectiveTotalPaid = previouslyPaid + receivedNow;
  const advanceCredit = effectiveTotalPaid > netPayable ? effectiveTotalPaid - netPayable : 0;

  const paymentMethod = options?.paymentMethod || receipt?.method || 'CASH';
  const collectedBy = options?.collectedBy || receipt?.collectedByName || 'Cashier';

  let docName = invoice.doctorName ? invoice.doctorName.trim() : (lines[0]?.performedByName || 'Consultant');
  if (docName && docName !== 'Consultant' && !/^dr\.?/i.test(docName)) {
    docName = `Dr. ${docName}`;
  }

  const primaryServiceName = lines[0]?.serviceName || (isIpd ? 'Inpatient Admission' : encType === 'OBSERVATION' ? 'Observation' : encType === 'EMERGENCY' ? 'Emergency' : 'OPD');

  return {
    receiptNumber,
    invoiceNumber,
    dateTime,
    encounterType: isIpd ? 'ADMISSION' : encType,
    encounterRef: invoice.sourceType,
    tokenNumber: isIpd ? null : (invoice.queueNumber || null),
    mrNumber: invoice.patientMr || '—',
    patientName: invoice.patientName || 'Patient',
    patientAge: options?.patientAge ?? invoice.patientAge ?? null,
    patientGender: options?.patientGender ?? invoice.patientGender ?? null,
    patientWeight: invoice.patientWeight ?? invoice.weightKg ?? null,
    admissionNumber: invoice.admissionNumber || null,
    bedInfo: invoice.bedInfo || null,
    doctorName: docName,
    serviceName: primaryServiceName,
    lines,
    fees,
    others,
    subtotal: subtotal > 0 ? subtotal : netTotal,
    totalDiscount,
    totalTax: 0,
    total: netPayable > 0 ? netPayable : netTotal,
    netTotal: netTotal > 0 ? netTotal : netPayable,
    receivedNow,
    previouslyPaid,
    paid: effectiveTotalPaid > 0 ? effectiveTotalPaid : receivedNow,
    outstanding: rawOutstanding,
    advanceCredit,
    paymentMethod,
    collectedBy,
    patientPhone: invoice.patientPhone || null,
    isReprint: options?.isReprint || false,
  };
}

describe('80mm Thermal Billing & Receipt System (Canonical Dynamic Service Lines)', () => {
  it('TEST 1: ER patient with 3 real services from database - all 3 appear in ledger and on thermal receipt', () => {
    const erInvoice = {
      id: 'inv-er-101',
      invoiceNumber: 'INV-ER-001',
      sourceType: 'WALK_IN',
      encounterType: 'EMERGENCY',
      queueNumber: 'ER-001',
      patientMr: 'MR-00045',
      patientName: 'Bilal Khan',
      doctorName: 'Dr. Zeeshan (ER Incharge)',
      total: 2700,
      paidTotal: 2700,
      lines: [
        { id: 'l1', serviceName: 'Emergency Consultation', quantity: 1, rateSnapshot: 1500, lineNet: 1500 },
        { id: 'l2', serviceName: 'Nebulization', quantity: 2, rateSnapshot: 250, lineNet: 500 },
        { id: 'l3', serviceName: 'Dressing Large', quantity: 1, rateSnapshot: 700, lineNet: 700 },
      ],
      receipts: [
        {
          receiptNumber: 'RCP-ER-001',
          amount: 2700,
          method: 'CASH',
          collectedByName: 'Cashier Ali',
          collectedAt: '16-Oct-2026, 03:30 PM',
        },
      ],
    };

    const receipt = buildThermalReceiptData(erInvoice, erInvoice.receipts[0]);

    expect(receipt.encounterType).toBe('EMERGENCY');
    expect(receipt.tokenNumber).toBe('ER-001');
    expect(receipt.doctorName).toBe('Dr. Zeeshan (ER Incharge)');
    expect(receipt.lines).toHaveLength(3);
    expect(receipt.lines[0].serviceName).toBe('Emergency Consultation');
    expect(receipt.lines[0].unitRate).toBe(1500);
    expect(receipt.lines[0].netAmount).toBe(1500);
    expect(receipt.lines[1].serviceName).toBe('Nebulization');
    expect(receipt.lines[1].quantity).toBe(2);
    expect(receipt.lines[1].netAmount).toBe(500);
    expect(receipt.lines[2].serviceName).toBe('Dressing Large');
    expect(receipt.lines[2].netAmount).toBe(700);
    expect(receipt.total).toBe(2700);
    expect(receipt.receivedNow).toBe(2700);
    expect(receipt.outstanding).toBe(0);
  });

  it('TEST 2: Add another service later (Minor Procedure) - ledger updates and thermal receipt shows it with 0 code changes', () => {
    // A new service "Minor Procedure" created by Super Admin in DB is added to the ledger
    const erInvoiceWithNewService = {
      id: 'inv-er-101',
      invoiceNumber: 'INV-ER-001',
      sourceType: 'WALK_IN',
      encounterType: 'EMERGENCY',
      queueNumber: 'ER-001',
      patientMr: 'MR-00045',
      patientName: 'Bilal Khan',
      doctorName: 'Dr. Zeeshan',
      total: 4700,
      paidTotal: 4700,
      lines: [
        { id: 'l1', serviceName: 'Emergency Consultation', quantity: 1, rateSnapshot: 1500, lineNet: 1500 },
        { id: 'l2', serviceName: 'Nebulization', quantity: 2, rateSnapshot: 250, lineNet: 500 },
        { id: 'l3', serviceName: 'Dressing Large', quantity: 1, rateSnapshot: 700, lineNet: 700 },
        { id: 'l4', serviceName: 'Minor Procedure', quantity: 1, rateSnapshot: 2000, lineNet: 2000 },
      ],
      receipts: [
        {
          receiptNumber: 'RCP-ER-002',
          amount: 4700,
          method: 'CASH',
          collectedByName: 'Cashier Ali',
        },
      ],
    };

    const receipt = buildThermalReceiptData(erInvoiceWithNewService, erInvoiceWithNewService.receipts[0]);

    expect(receipt.lines).toHaveLength(4);
    expect(receipt.lines[3].serviceName).toBe('Minor Procedure');
    expect(receipt.lines[3].unitRate).toBe(2000);
    expect(receipt.lines[3].netAmount).toBe(2000);
    expect(receipt.total).toBe(4700);
  });

  it('TEST 3: Observation patient with 10 services - all 10 appear in lines list dynamically', () => {
    const tenServices = Array.from({ length: 10 }, (_, i) => ({
      id: `l-obs-${i + 1}`,
      serviceName: `Observation Care Service ${i + 1}`,
      quantity: 1,
      rateSnapshot: 500,
      lineNet: 500,
    }));

    const obsInvoice = {
      id: 'inv-obs-10',
      invoiceNumber: 'INV-OBS-010',
      sourceType: 'WALK_IN',
      encounterType: 'OBSERVATION',
      queueNumber: 'OBS-005',
      patientMr: 'MR-00888',
      patientName: 'Zainab Bibi',
      doctorName: 'Dr. Sarah (Day Care)',
      total: 5000,
      paidTotal: 5000,
      lines: tenServices,
      receipts: [
        {
          receiptNumber: 'RCP-OBS-010',
          amount: 5000,
          method: 'CARD',
          collectedByName: 'Fatima',
        },
      ],
    };

    const receipt = buildThermalReceiptData(obsInvoice, obsInvoice.receipts[0]);

    expect(receipt.encounterType).toBe('OBSERVATION');
    expect(receipt.tokenNumber).toBe('OBS-005');
    expect(receipt.lines).toHaveLength(10);
    expect(receipt.lines[0].serviceName).toBe('Observation Care Service 1');
    expect(receipt.lines[9].serviceName).toBe('Observation Care Service 10');
    expect(receipt.total).toBe(5000);
  });

  it('TEST 4: Historical already-posted invoice line keeps original rate snapshot', () => {
    // If master rate changed to 2500, already posted rateSnapshot 1500 remains frozen
    const postedInvoice = {
      id: 'inv-historical',
      encounterType: 'EMERGENCY',
      queueNumber: 'ER-009',
      patientMr: 'MR-00100',
      patientName: 'Hamza',
      total: 1500,
      paidTotal: 1500,
      lines: [
        {
          id: 'l-hist',
          serviceName: 'Emergency Triage',
          quantity: 1,
          rateSnapshot: 1500, // frozen snapshot
          lineNet: 1500,
        },
      ],
    };

    const receipt = buildThermalReceiptData(postedInvoice);

    expect(receipt.lines[0].unitRate).toBe(1500);
    expect(receipt.lines[0].netAmount).toBe(1500);
    expect(receipt.total).toBe(1500);
  });

  it('TEST 5: Partial payment matches backend financial records (Net 5000, Prev 2000, Received 1500, Outstanding 1500)', () => {
    const partialInvoice = {
      id: 'inv-part-5000',
      encounterType: 'EMERGENCY',
      queueNumber: 'ER-012',
      patientMr: 'MR-00500',
      patientName: 'Usman Ghani',
      total: 5000,
      paidTotal: 3500, // 2000 previously + 1500 received now
      balanceDue: 1500,
      lines: [
        { id: 'l1', serviceName: 'Emergency Trauma Care', quantity: 1, rateSnapshot: 3500, lineNet: 3500 },
        { id: 'l2', serviceName: 'ECG 12-Lead', quantity: 1, rateSnapshot: 1500, lineNet: 1500 },
      ],
      receipts: [
        {
          id: 'rec-1',
          receiptNumber: 'RCP-500-A',
          amount: 2000,
          method: 'CASH',
        },
        {
          id: 'rec-2',
          receiptNumber: 'RCP-500-B',
          amount: 1500,
          method: 'CASH',
        },
      ],
    };

    const currentReceipt = partialInvoice.receipts[1];
    const receiptData = buildThermalReceiptData(partialInvoice, currentReceipt, {
      receivedNow: 1500,
    });

    expect(receiptData.total).toBe(5000);
    expect(receiptData.previouslyPaid).toBe(2000);
    expect(receiptData.receivedNow).toBe(1500);
    expect(receiptData.paid).toBe(3500);
    expect(receiptData.outstanding).toBe(1500);
    expect(receiptData.advanceCredit).toBe(0);
  });

  it('TEST 6: Reprint retains same original receipt number, token, and service lines without generating new transaction', () => {
    const invoice = {
      id: 'inv-reprint-1',
      invoiceNumber: 'INV-26-0999',
      encounterType: 'OPD',
      queueNumber: 'OPD-044',
      patientMr: 'MR-00125',
      patientName: 'Muhammad Ali',
      total: 1500,
      paidTotal: 1500,
      lines: [{ id: 'l1', serviceName: 'Consultation', quantity: 1, rateSnapshot: 1500, lineNet: 1500 }],
      receipts: [
        {
          receiptNumber: 'RCP-00125',
          amount: 1500,
          method: 'CASH',
        },
      ],
    };

    const reprint = buildThermalReceiptData(invoice, invoice.receipts[0], {
      isReprint: true,
    });

    expect(reprint.isReprint).toBe(true);
    expect(reprint.receiptNumber).toBe('RCP-00125');
    expect(reprint.tokenNumber).toBe('OPD-044');
    expect(reprint.lines[0].serviceName).toBe('Consultation');
    expect(reprint.lines[0].netAmount).toBe(1500);
    expect(reprint.total).toBe(1500);
    expect(reprint.receivedNow).toBe(1500);
  });
});
