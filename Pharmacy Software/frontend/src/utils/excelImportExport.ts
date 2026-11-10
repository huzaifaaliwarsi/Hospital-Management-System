import * as XLSX from 'xlsx';
import { BulkImportItem, MedicineRow } from '../services/pharmacyApi';

export const STANDARD_EXCEL_HEADERS = [
  'Medicine Name *',
  'Strength',
  'Generic Name',
  'Dosage Form',
  'Therapeutic Category',
  'Base Stock Unit *',
  'Inner Pack Unit',
  'Base Units / Inner Pack',
  'Default Purchase Unit *',
  'Base Units / Purchase Unit',
  'Default Sale Price (PKR)',
  'Tax / GST %',
  'Reorder Alert Qty',
  'Barcode',
  'Track Batch & Expiry (Yes/No)',
  'Opening Stock Qty (Tadad)',
  'Batch Number',
  'Expiry Date (YYYY-MM-DD)',
  'Purchase / Cost Rate (PKR)',
];

export const SAMPLE_TEMPLATE_ROWS = [
  {
    'Medicine Name *': 'Panadol Extra',
    'Strength': '500mg/65mg',
    'Generic Name': 'Paracetamol + Caffeine',
    'Dosage Form': 'Tablet',
    'Therapeutic Category': 'Analgesics / Antipyretics',
    'Base Stock Unit *': 'Tablet',
    'Inner Pack Unit': 'Strip',
    'Base Units / Inner Pack': 10,
    'Default Purchase Unit *': 'Box',
    'Base Units / Purchase Unit': 100,
    'Default Sale Price (PKR)': 450,
    'Tax / GST %': 0,
    'Reorder Alert Qty': 50,
    'Barcode': '896400010001',
    'Track Batch & Expiry (Yes/No)': 'Yes',
    'Opening Stock Qty (Tadad)': 5,
    'Batch Number': 'PAN-2026A',
    'Expiry Date (YYYY-MM-DD)': '2027-12-31',
    'Purchase / Cost Rate (PKR)': 360,
  },
  {
    'Medicine Name *': 'Amoxil Syrup',
    'Strength': '125mg/5ml',
    'Generic Name': 'Amoxicillin Trihydrate',
    'Dosage Form': 'Syrup',
    'Therapeutic Category': 'Antibiotics',
    'Base Stock Unit *': 'Bottle',
    'Inner Pack Unit': '',
    'Base Units / Inner Pack': '',
    'Default Purchase Unit *': 'Box',
    'Base Units / Purchase Unit': 24,
    'Default Sale Price (PKR)': 4440,
    'Tax / GST %': 0,
    'Reorder Alert Qty': 10,
    'Barcode': '896400020002',
    'Track Batch & Expiry (Yes/No)': 'Yes',
    'Opening Stock Qty (Tadad)': 2,
    'Batch Number': 'AMX-2026B',
    'Expiry Date (YYYY-MM-DD)': '2027-08-31',
    'Purchase / Cost Rate (PKR)': 3552,
  },
  {
    'Medicine Name *': 'Surgical Face Mask',
    'Strength': '3 Ply',
    'Generic Name': 'Non-Woven Protective Mask',
    'Dosage Form': 'Disposables',
    'Therapeutic Category': 'Surgical & Disposables',
    'Base Stock Unit *': 'Piece',
    'Inner Pack Unit': '',
    'Base Units / Inner Pack': '',
    'Default Purchase Unit *': 'Box',
    'Base Units / Purchase Unit': 50,
    'Default Sale Price (PKR)': 750,
    'Tax / GST %': 0,
    'Reorder Alert Qty': 100,
    'Barcode': '896400030003',
    'Track Batch & Expiry (Yes/No)': 'No',
    'Opening Stock Qty (Tadad)': 5,
    'Batch Number': '',
    'Expiry Date (YYYY-MM-DD)': '',
    'Purchase / Cost Rate (PKR)': 500,
  },
];

export const INSTRUCTIONS_ROWS = [
  { 'Column Name': 'Medicine Name *', 'Mandatory': 'YES', 'Description': 'Brand or commercial name of the medicine (e.g. Panadol, Augmentin).' },
  { 'Column Name': 'Strength', 'Mandatory': 'NO', 'Description': 'Active potency/strength (e.g. 500mg, 1gm, 250mg/5ml).' },
  { 'Column Name': 'Generic Name', 'Mandatory': 'NO', 'Description': 'Clinical active chemical formulation (e.g. Paracetamol, Ciprofloxacin).' },
  { 'Column Name': 'Dosage Form', 'Mandatory': 'NO', 'Description': 'Form of medicine: Tablet, Capsule, Syrup, Injection, Cream, Drops, etc.' },
  { 'Column Name': 'Therapeutic Category', 'Mandatory': 'NO', 'Description': 'Medical category (e.g. Antibiotics, Analgesic). Auto-created if new.' },
  { 'Column Name': 'Base Stock Unit *', 'Mandatory': 'YES', 'Description': 'Smallest indivisible unit (e.g. Tablet, Capsule, ml, Piece, Bottle). All stock is tracked in this unit.' },
  { 'Column Name': 'Inner Pack Unit', 'Mandatory': 'NO', 'Description': 'Intermediate packaging (e.g. Strip, Blister). Leave blank for syrups/liquids.' },
  { 'Column Name': 'Base Units / Inner Pack', 'Mandatory': 'CONDITIONAL', 'Description': 'How many base units in 1 Inner Pack (e.g. 10 Tablets in 1 Strip).' },
  { 'Column Name': 'Default Purchase Unit *', 'Mandatory': 'YES', 'Description': 'Unit you buy from distributor (e.g. Box, Carton, or Base Stock Unit).' },
  { 'Column Name': 'Base Units / Purchase Unit', 'Mandatory': 'CONDITIONAL', 'Description': 'Total base units in 1 Purchase Unit (e.g. 100 Tablets in 1 Box, or 1 if buying singles).' },
  { 'Column Name': 'Default Sale Price (PKR)', 'Mandatory': 'NO', 'Description': 'Retail Price (MRP) per Purchase Unit (Box/Pack). System auto-derives per-tablet rate: Box Price / Base Units per Box.' },
  { 'Column Name': 'Tax / GST %', 'Mandatory': 'NO', 'Description': 'Sales tax percentage (e.g. 0, 17, 18). Default is 0.' },
  { 'Column Name': 'Reorder Alert Qty', 'Mandatory': 'NO', 'Description': 'Low stock warning threshold in Base Units (e.g. 50 Tablets). Default is 0.' },
  { 'Column Name': 'Barcode', 'Mandatory': 'NO', 'Description': 'EAN/UPC barcode number for quick POS barcode scanner lookup.' },
  { 'Column Name': 'Track Batch & Expiry (Yes/No)', 'Mandatory': 'NO', 'Description': 'Yes = FEFO batch & expiry tracked. No = Bulk non-batch tracking. Default is Yes.' },
  { 'Column Name': 'Opening Stock Qty (Tadad)', 'Mandatory': 'NO', 'Description': 'Opening Stock on shelf in Purchase Units (Boxes/Packs). E.g. 5 Boxes. System auto-converts to total Base Units (5 x 100 = 500 Tablets).' },
  { 'Column Name': 'Batch Number', 'Mandatory': 'CONDITIONAL', 'Description': 'Batch/Lot number for opening stock. Required if Opening Qty > 0 and Track Batch = Yes.' },
  { 'Column Name': 'Expiry Date (YYYY-MM-DD)', 'Mandatory': 'CONDITIONAL', 'Description': 'Expiry date (e.g. 2027-12-31). Required if Opening Qty > 0 and Track Batch = Yes.' },
  { 'Column Name': 'Purchase / Cost Rate (PKR)', 'Mandatory': 'NO', 'Description': 'Distributor Trade Price (TP) per Purchase Unit (Box/Pack). System auto-derives per-tablet cost: Box Cost / Base Units per Box.' },
];

/**
 * Generates and triggers download of the standard Excel template (.xlsx)
 */
export function downloadSampleTemplate(): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Template Data
  const wsTemplate = XLSX.utils.json_to_sheet(SAMPLE_TEMPLATE_ROWS, { header: STANDARD_EXCEL_HEADERS });
  wsTemplate['!cols'] = [
    { wch: 24 }, // Medicine Name
    { wch: 14 }, // Strength
    { wch: 24 }, // Generic Name
    { wch: 14 }, // Dosage Form
    { wch: 22 }, // Therapeutic Category
    { wch: 16 }, // Base Stock Unit
    { wch: 16 }, // Inner Pack Unit
    { wch: 22 }, // Base Units / Inner Pack
    { wch: 20 }, // Default Purchase Unit
    { wch: 24 }, // Base Units / Purchase Unit
    { wch: 22 }, // Default Sale Price
    { wch: 12 }, // Tax / GST %
    { wch: 16 }, // Reorder Alert Qty
    { wch: 18 }, // Barcode
    { wch: 26 }, // Track Batch & Expiry
    { wch: 24 }, // Opening Stock Qty
    { wch: 18 }, // Batch Number
    { wch: 22 }, // Expiry Date
    { wch: 24 }, // Purchase / Cost Rate
  ];

  XLSX.utils.book_append_sheet(wb, wsTemplate, 'Medicines Upload');

  // Sheet 2: Field Instructions & Guide
  const wsInstructions = XLSX.utils.json_to_sheet(INSTRUCTIONS_ROWS);
  wsInstructions['!cols'] = [{ wch: 26 }, { wch: 14 }, { wch: 70 }];
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  XLSX.writeFile(wb, `pharmacy_bulk_import_template_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

/**
 * Normalize and extract text value safely
 */
function cleanStr(val: any): string {
  if (val === undefined || val === null) return '';
  return String(val).trim();
}

/**
 * Find value by fuzzy header matching
 */
function findValue(row: Record<string, any>, candidateKeys: string[]): any {
  for (const cand of candidateKeys) {
    const candNorm = cand.toLowerCase().replace(/[^a-z0-9]/g, '');
    for (const [k, v] of Object.entries(row)) {
      const kNorm = k.toLowerCase().replace(/[^a-z0-9]/g, '');
      if (kNorm === candNorm || kNorm.includes(candNorm)) {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          return v;
        }
      }
    }
  }
  return undefined;
}

/**
 * Format date value from Excel into YYYY-MM-DD
 */
function parseExcelDate(val: any): string | null {
  if (!val) return null;
  if (typeof val === 'number') {
    // Excel date serial number
    const date = new Date(Math.round((val - 25569) * 86400 * 1000));
    return isNaN(date.getTime()) ? null : date.toISOString().slice(0, 10);
  }
  const str = String(val).trim();
  const d = new Date(str);
  if (!isNaN(d.getTime())) {
    return d.toISOString().slice(0, 10);
  }
  return str;
}

export interface ParseResult {
  sheetName: string;
  validItems: BulkImportItem[];
  invalidRows: Array<{ rowNumber: number; data: any; reason: string }>;
  totalRows: number;
}

/**
 * Parse uploaded .xlsx / .xls / .csv file
 */
export async function parseExcelFile(file: File): Promise<ParseResult> {
  const data = await file.arrayBuffer();
  const workbook = XLSX.read(data, { type: 'array' });
  if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
    throw new Error('Workbook contains no sheets.');
  }

  // Intelligently find the sheet containing medicine columns (e.g. 'Bulk Upload', 'Medicines Upload', or any sheet with 'Medicine Name' / 'Base Stock Unit')
  let targetSheetName = workbook.SheetNames.find((name) => {
    const ws = workbook.Sheets[name];
    if (!ws) return false;
    const headerRow: any[] = XLSX.utils.sheet_to_json(ws, { header: 1 })[0] || [];
    return headerRow.some((col: any) => typeof col === 'string' && (
      col.toLowerCase().includes('medicine name') || col.toLowerCase().includes('base stock unit')
    ));
  });

  if (!targetSheetName) {
    targetSheetName = workbook.SheetNames.find((name) =>
      /bulk|upload|medicine|formulary|stock|item/i.test(name)
    ) || workbook.SheetNames[0];
  }

  const sheet = workbook.Sheets[targetSheetName];
  if (!sheet) {
    throw new Error('Sheet could not be read.');
  }

  const rawRows: Record<string, any>[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
  const validItems: BulkImportItem[] = [];
  const invalidRows: Array<{ rowNumber: number; data: any; reason: string }> = [];

  rawRows.forEach((row, idx) => {
    const rowNumber = idx + 2; // Row 1 is header
    const name = cleanStr(findValue(row, ['Medicine Name *', 'Medicine Name', 'Medicine', 'Name', 'Item Name']));
    const baseUnit = cleanStr(findValue(row, ['Base Stock Unit *', 'Base Stock Unit', 'Base Unit', 'Unit']));

    if (!name) {
      invalidRows.push({ rowNumber, data: row, reason: 'Missing mandatory Medicine Name' });
      return;
    }
    if (!baseUnit) {
      invalidRows.push({ rowNumber, data: row, reason: `Missing Base Stock Unit for "${name}"` });
      return;
    }

    const strength = cleanStr(findValue(row, ['Strength', 'Potency']));
    const genericName = cleanStr(findValue(row, ['Generic Name', 'Generic', 'Formula']));
    const dosageForm = cleanStr(findValue(row, ['Dosage Form', 'Dosage', 'Form', 'Type']));
    const category = cleanStr(findValue(row, ['Therapeutic Category', 'Category', 'Class']));

    const innerPackUnit = cleanStr(findValue(row, ['Inner Pack Unit', 'Inner Unit', 'Strip']));
    const baseUnitsPerInnerPack = Number(findValue(row, ['Base Units / Inner Pack', 'Units Per Inner', 'Strip Qty'])) || null;

    const defaultPurchaseUnit = cleanStr(findValue(row, ['Default Purchase Unit *', 'Default Purchase Unit', 'Purchase Unit', 'Outer Unit'])) || baseUnit;
    const baseUnitsPerPurchaseUnit = Number(findValue(row, ['Base Units / Purchase Unit', 'Units Per Purchase', 'Pack Size'])) || null;

    const defaultSalePrice = Number(findValue(row, ['Default Sale Price (PKR)', 'Default Sale Price', 'Sale Price', 'Sale Rate', 'MRP', 'Retail Price'])) || 0;
    const taxPercent = Number(findValue(row, ['Tax / GST %', 'Tax %', 'GST %', 'Tax', 'GST'])) || 0;
    const reorderAlertQty = Number(findValue(row, ['Reorder Alert Qty', 'Reorder Level', 'Min Stock', 'Alert Qty'])) || 0;
    const barcode = cleanStr(findValue(row, ['Barcode', 'Barcode No', 'UPC', 'EAN']));

    const trackRaw = cleanStr(findValue(row, ['Track Batch & Expiry (Yes/No)', 'Track Batch', 'Batch Managed']));
    const trackBatchExpiry = !['no', 'n', '0', 'false'].includes(trackRaw.toLowerCase());

    const openingStockQty = Number(findValue(row, ['Opening Stock Qty (Tadad)', 'Opening Stock Qty', 'Opening Stock', 'Current Stock', 'Stock Qty', 'Qty'])) || 0;
    const batchNumber = cleanStr(findValue(row, ['Batch Number', 'Batch No', 'Batch']));
    const expiryDateRaw = findValue(row, ['Expiry Date (YYYY-MM-DD)', 'Expiry Date', 'Expiry', 'Exp Date']);
    const expiryDate = parseExcelDate(expiryDateRaw);
    const purchaseCostRate = Number(findValue(row, ['Purchase / Cost Rate (PKR)', 'Purchase Cost Rate', 'Cost Rate', 'Purchase Rate', 'Cost Price'])) || null;

    validItems.push({
      name,
      strength: strength || null,
      genericName: genericName || null,
      dosageForm: dosageForm || null,
      category: category || null,
      baseUnit,
      innerPackUnit: innerPackUnit || null,
      baseUnitsPerInnerPack: baseUnitsPerInnerPack && baseUnitsPerInnerPack > 1 ? baseUnitsPerInnerPack : null,
      defaultPurchaseUnit: defaultPurchaseUnit || baseUnit,
      baseUnitsPerPurchaseUnit: baseUnitsPerPurchaseUnit && baseUnitsPerPurchaseUnit > 1 ? baseUnitsPerPurchaseUnit : null,
      defaultSalePrice,
      taxPercent,
      reorderAlertQty,
      barcode: barcode || null,
      trackBatchExpiry,
      openingStockQty,
      batchNumber: batchNumber || null,
      expiryDate,
      purchaseCostRate,
    });
  });

  return {
    sheetName: targetSheetName,
    validItems,
    invalidRows,
    totalRows: rawRows.length,
  };
}

/**
 * Export full inventory rows into structured 19-column Excel workbook
 */
export function exportMedicinesFullExcel(medicines: MedicineRow[]): void {
  const exportData = medicines.map((m) => {
    return {
      'Medicine Name *': m.name,
      'Strength': m.strength || '',
      'Generic Name': m.genericName || '',
      'Dosage Form': m.dosageForm || '',
      'Therapeutic Category': m.category || '',
      'Base Stock Unit *': m.unit || '',
      'Inner Pack Unit': '',
      'Base Units / Inner Pack': '',
      'Default Purchase Unit *': m.unit || '',
      'Base Units / Purchase Unit': 1,
      'Default Sale Price (PKR)': Number(m.saleRate) || 0,
      'Tax / GST %': Number((m as any).taxPercent || 0),
      'Reorder Alert Qty': Number(m.reorderLevel) || 0,
      'Barcode': m.barcode || '',
      'Track Batch & Expiry (Yes/No)': m.batchManaged ? 'Yes' : 'No',
      'Opening Stock Qty (Tadad)': Number(m.currentStock) || 0,
      'Batch Number': '',
      'Expiry Date (YYYY-MM-DD)': '',
      'Purchase / Cost Rate (PKR)': Number((m as any).purchaseRate || 0),
    };
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(exportData, { header: STANDARD_EXCEL_HEADERS });
  ws['!cols'] = [
    { wch: 24 },
    { wch: 14 },
    { wch: 24 },
    { wch: 14 },
    { wch: 22 },
    { wch: 16 },
    { wch: 16 },
    { wch: 22 },
    { wch: 20 },
    { wch: 24 },
    { wch: 22 },
    { wch: 12 },
    { wch: 16 },
    { wch: 18 },
    { wch: 26 },
    { wch: 24 },
    { wch: 18 },
    { wch: 22 },
    { wch: 24 },
  ];
  XLSX.utils.book_append_sheet(wb, ws, 'Medicine Formulary');
  XLSX.writeFile(wb, `pharmacy_formulary_export_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

