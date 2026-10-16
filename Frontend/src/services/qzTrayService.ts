import qz from 'qz-tray';
import { ThermalReceiptData } from '../components/common/ThermalPaymentReceipt';
import { HospitalProfile } from '../types/hospital';
import { getHospitalProfile } from './hospitalProfileService';

const PREFERRED_PRINTER_KEY = 'hms_preferred_thermal_printer';

export interface QzStatus {
  connected: boolean;
  activePrinter: string | null;
  printers: string[];
  error?: string | null;
}

/**
 * Checks if QZ Tray websocket connection is currently active.
 */
export function isQzConnected(): boolean {
  try {
    return qz.websocket?.isActive() || false;
  } catch {
    return false;
  }
}

/**
 * Connects to the local QZ Tray desktop client via WebSocket (localhost:8182).
 */
export async function connectQzTray(): Promise<boolean> {
  try {
    if (isQzConnected()) {
      return true;
    }
    await qz.websocket.connect({
      retries: 1,
      delay: 0.5,
    });
    return true;
  } catch (err: any) {
    console.warn('QZ Tray connection failed (desktop app might not be running):', err?.message || err);
    return false;
  }
}

/**
 * Retrieves the list of installed printers from the local PC via QZ Tray.
 */
export async function getQzPrinters(): Promise<string[]> {
  try {
    const connected = await connectQzTray();
    if (!connected) return [];
    const list = await qz.printers.find();
    return Array.isArray(list) ? list : [list];
  } catch (err) {
    console.warn('Could not fetch printers via QZ Tray:', err);
    return [];
  }
}

/**
 * Gets preferred thermal printer from localStorage, or detects default printer.
 */
export async function getPreferredThermalPrinter(): Promise<string | null> {
  const saved = localStorage.getItem(PREFERRED_PRINTER_KEY);
  if (saved) return saved;

  try {
    const connected = await connectQzTray();
    if (!connected) return null;

    // Check if there is an 80mm / POS printer
    const all = await qz.printers.find();
    const printers: string[] = Array.isArray(all) ? all : [all];

    const posPrinter = printers.find(p =>
      /pos|thermal|receipt|xp-|xp80|rp80|rongta|epson|black\s*copper|blackcopper|80mm/i.test(p)
    );

    if (posPrinter) return posPrinter;

    // Fallback to system default
    const def = await qz.printers.getDefault();
    return def || null;
  } catch {
    return null;
  }
}

/**
 * Saves user-selected thermal printer name.
 */
export function setPreferredThermalPrinter(printerName: string) {
  if (printerName) {
    localStorage.setItem(PREFERRED_PRINTER_KEY, printerName);
  } else {
    localStorage.removeItem(PREFERRED_PRINTER_KEY);
  }
}

/**
 * Formats canonical ESC/POS commands for 80mm thermal paper (42/48 columns).
 * Includes auto-cutter command (\x1D\x56\x00) and zero blank-roll paper feed!
 */
export function buildEscPosReceiptCommands(
  data: ThermalReceiptData,
  profile?: HospitalProfile
): string {
  const hp = profile || getHospitalProfile();
  const hospitalName = hp.name || 'CH SHARIF AND SAEED HOSPITAL';

  // ESC/POS Command Constants:
  const ESC = '\x1B';
  const GS = '\x1D';
  const INIT = `${ESC}@`;                  // Initialize printer
  const ALIGN_CENTER = `${ESC}a\x01`;      // Center alignment
  const ALIGN_LEFT = `${ESC}a\x00`;        // Left alignment
  const ALIGN_RIGHT = `${ESC}a\x02`;       // Right alignment
  const BOLD_ON = `${ESC}E\x01`;           // Bold font ON
  const BOLD_OFF = `${ESC}E\x00`;          // Bold font OFF
  const DOUBLE_HEIGHT = `${ESC}!\x10`;     // Double height
  const NORMAL_FONT = `${ESC}!\x00`;       // Normal font
  const LINE_FEED = '\x0A';
  const CUT_PAPER = `${GS}V\x41\x03`;      // Feed 3 lines & partial cut (no blank roll!)

  const LINE_SEPARATOR = '------------------------------------------\n'; // 42 cols

  const padRow = (left: string, right: string, maxLen = 42) => {
    const spaces = Math.max(1, maxLen - left.length - right.length);
    return left + ' '.repeat(spaces) + right + '\n';
  };

  let out = '';
  out += INIT;
  out += ALIGN_CENTER;

  // Hospital Name & Title
  out += BOLD_ON + hospitalName + '\n' + BOLD_OFF;
  out += 'PAYMENT RECEIPT\n';
  if (data.isReprint) {
    out += '*** REPRINT / DUPLICATE ***\n';
  }
  out += LINE_SEPARATOR;

  // Queue / Token Number (if available)
  if (data.tokenNumber && data.encounterType !== 'ADMISSION' && data.encounterType !== 'IPD') {
    out += 'QUEUE / TOKEN NUMBER\n';
    out += DOUBLE_HEIGHT + BOLD_ON + `[ ${data.tokenNumber} ]` + '\n' + NORMAL_FONT + BOLD_OFF;
    out += LINE_SEPARATOR;
  }

  // Section 1: Patient Information (First)
  out += ALIGN_LEFT;
  out += BOLD_ON + 'PATIENT INFORMATION\n' + BOLD_OFF;
  out += padRow('Patient:', data.patientName);
  out += padRow('MR No:', data.mrNumber || '—');
  if (data.patientAge || data.patientGender) {
    const ageSex = [data.patientAge ? `${data.patientAge} Y` : '', data.patientGender].filter(Boolean).join(' / ');
    out += padRow('Age / Sex:', ageSex);
  }
  const weightStr = data.patientWeight ? (String(data.patientWeight).toLowerCase().includes('kg') ? String(data.patientWeight) : `${data.patientWeight} kg`) : '—';
  out += padRow('Weight:', weightStr);
  out += padRow('Doctor:', data.doctorName || 'Consultant');
  if (data.admissionNumber) {
    out += padRow('Admission:', data.admissionNumber);
  }
  if (data.bedInfo) {
    out += padRow('Ward / Bed:', data.bedInfo);
  }
  out += LINE_SEPARATOR;

  // Section 2: Invoice & Payment (Second)
  out += BOLD_ON + 'INVOICE & PAYMENT\n' + BOLD_OFF;
  out += padRow('Invoice No:', data.invoiceNumber || data.receiptNumber);
  out += padRow('Date:', data.dateTime);
  out += padRow('Pay Mode:', data.paymentMethod || 'CASH');
  out += padRow('Encounter:', data.encounterType);
  out += LINE_SEPARATOR;

  // Section 3: Services & Charges (Dynamic Encounter Ledger)
  out += BOLD_ON + 'SERVICES & CHARGES\n' + BOLD_OFF;
  out += 'SERVICE                       QTY   AMOUNT\n';
  out += LINE_SEPARATOR;

  if (data.lines && data.lines.length > 0) {
    for (const item of data.lines) {
      const srvName = item.serviceName.length > 26 ? item.serviceName.slice(0, 24) + '..' : item.serviceName;
      const qtyStr = String(item.quantity);
      const amtStr = (item.netAmount || 0).toLocaleString();
      const leftPart = srvName.padEnd(27, ' ');
      const qtyPart = qtyStr.padStart(4, ' ');
      const amtPart = amtStr.padStart(11, ' ');
      out += leftPart + qtyPart + amtPart + '\n';
      if (item.quantity > 1) {
        out += `  (${item.quantity} x @ ${(item.unitRate || 0).toLocaleString()})\n`;
      }
      if (item.discountAmount && item.discountAmount > 0) {
        out += `  (Disc: -${item.discountAmount.toLocaleString()})\n`;
      }
    }
  } else {
    out += padRow(data.serviceName || 'Consultation / Encounter Fee', (data.total || 0).toLocaleString());
  }
  out += LINE_SEPARATOR;

  // Financial summary & Settlement
  if (data.totalDiscount && data.totalDiscount > 0) {
    out += padRow('Subtotal:', `PKR ${(data.subtotal || data.total + data.totalDiscount).toLocaleString()}`);
    out += padRow('Discount:', `-PKR ${data.totalDiscount.toLocaleString()}`);
  }
  out += BOLD_ON;
  out += padRow('NET TOTAL:', `PKR ${(data.netTotal || data.total || 0).toLocaleString()}`);
  out += BOLD_OFF;
  if (data.previouslyPaid && data.previouslyPaid > 0) {
    out += padRow('Previously Paid:', `PKR ${data.previouslyPaid.toLocaleString()}`);
  }
  out += BOLD_ON;
  out += padRow('RECEIVED NOW:', `PKR ${(data.receivedNow || 0).toLocaleString()}`);
  out += BOLD_OFF;
  if (data.paid > data.receivedNow) {
    out += padRow('Total Paid:', `PKR ${data.paid.toLocaleString()}`);
  }
  out += BOLD_ON;
  out += padRow('OUTSTANDING:', `PKR ${(data.outstanding || 0).toLocaleString()}`);
  if (data.advanceCredit && data.advanceCredit > 0) {
    out += padRow('EXCESS / ADVANCE:', `PKR ${data.advanceCredit.toLocaleString()}`);
  }
  out += BOLD_OFF;
  out += LINE_SEPARATOR;

  // Footer
  out += ALIGN_CENTER;
  out += 'Thank You\n';
  out += 'Powered by Isysware Software Solutions\n';
  out += LINE_FEED;

  // Cut paper immediately after content (prevents endless blank roll feed)
  out += CUT_PAPER;

  return out;
}

/**
 * Prints thermal receipt directly using QZ Tray with auto-cut and zero extra blank paper.
 * Returns true if successful, false if QZ Tray is offline.
 */
export async function printViaQzTray(
  data: ThermalReceiptData,
  profile?: HospitalProfile,
  targetPrinter?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const isConnected = await connectQzTray();
    if (!isConnected) {
      return {
        success: false,
        message: 'QZ Tray is not running on this PC. Fallback to standard browser print.',
      };
    }

    const printerName = targetPrinter || (await getPreferredThermalPrinter());
    if (!printerName) {
      return {
        success: false,
        message: 'No thermal printer detected in QZ Tray. Fallback to browser print.',
      };
    }

    // Configure printer (raw format)
    const config = qz.configs.create(printerName, {
      encoding: 'UTF-8',
    });

    const rawEscPos = buildEscPosReceiptCommands(data, profile);

    const printData = [
      {
        type: 'raw',
        format: 'command',
        flavor: 'plain',
        data: rawEscPos,
      },
    ];

    await qz.print(config, printData);

    return {
      success: true,
      message: `Receipt printed directly to ${printerName} with auto-cut!`,
    };
  } catch (err: any) {
    console.error('QZ Tray direct print error:', err);
    return {
      success: false,
      message: err?.message || 'QZ Tray printing error',
    };
  }
}
