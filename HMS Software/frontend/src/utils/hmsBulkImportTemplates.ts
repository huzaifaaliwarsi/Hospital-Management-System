import * as XLSX from 'xlsx-js-style';

/**
 * Professional Navy Blue Header Style matching Pharmacy & Hospital Executive styling
 */
export const NAVY_HEADER_STYLE = {
  fill: {
    fgColor: { rgb: '0E3A5D' }, // Deep Hospital Navy Blue
  },
  font: {
    name: 'Segoe UI',
    sz: 10.5,
    bold: true,
    color: { rgb: 'FFFFFF' },
  },
  alignment: {
    horizontal: 'center',
    vertical: 'center',
    wrapText: true,
  },
  border: {
    top: { style: 'thin', color: { rgb: '1E4A73' } },
    bottom: { style: 'medium', color: { rgb: '08253D' } },
    left: { style: 'thin', color: { rgb: '1E4A73' } },
    right: { style: 'thin', color: { rgb: '1E4A73' } },
  },
};

export const INSTRUCTIONS_HEADER_STYLE = {
  fill: {
    fgColor: { rgb: '08775A' }, // Deep Hospital Emerald Green
  },
  font: {
    name: 'Segoe UI',
    sz: 10.5,
    bold: true,
    color: { rgb: 'FFFFFF' },
  },
  alignment: {
    horizontal: 'center',
    vertical: 'center',
    wrapText: true,
  },
  border: {
    top: { style: 'thin', color: { rgb: '0F9973' } },
    bottom: { style: 'medium', color: { rgb: '06533F' } },
    left: { style: 'thin', color: { rgb: '0F9973' } },
    right: { style: 'thin', color: { rgb: '0F9973' } },
  },
};

export const MANDATORY_CELL_STYLE = {
  fill: { fgColor: { rgb: 'FEE2E2' } }, // Soft light red
  font: { name: 'Segoe UI', sz: 9.5, bold: true, color: { rgb: '991B1B' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};

export const OPTIONAL_CELL_STYLE = {
  fill: { fgColor: { rgb: 'F1F5F9' } }, // Soft slate
  font: { name: 'Segoe UI', sz: 9.5, color: { rgb: '475569' } },
  alignment: { horizontal: 'center', vertical: 'center' },
};

/**
 * Apply cell styles to sheet header and rows
 */
export function applyTableStyles(
  ws: XLSX.WorkSheet,
  headers: string[],
  colWidths: { wch: number }[],
  isInstructions = false
): void {
  ws['!cols'] = colWidths;
  ws['!rows'] = [{ hpt: 28 }]; // comfortable header height

  const headerStyle = isInstructions ? INSTRUCTIONS_HEADER_STYLE : NAVY_HEADER_STYLE;

  // Style Header Row (row 0, index 1 in cell addressing)
  headers.forEach((_, colIdx) => {
    const cellAddress = XLSX.utils.encode_cell({ r: 0, c: colIdx });
    if (!ws[cellAddress]) return;
    ws[cellAddress].s = headerStyle;
  });

  // If instructions, style the Requirement column
  if (isInstructions) {
    const range = XLSX.utils.decode_range(ws['!ref'] || 'A1:D1');
    for (let r = 1; r <= range.e.r; r++) {
      const reqCellAddr = XLSX.utils.encode_cell({ r, c: 1 }); // Column B is Requirement
      const cell = ws[reqCellAddr];
      if (cell) {
        const val = String(cell.v || '').toUpperCase();
        if (val.includes('MANDATORY') || val.includes('YES') || val.includes('REQUIRED')) {
          cell.s = MANDATORY_CELL_STYLE;
        } else {
          cell.s = OPTIONAL_CELL_STYLE;
        }
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. SERVICES & RATES TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

export const SERVICES_HEADERS = [
  'Service Name *',
  'Department *',
  'Category *',
  'Standard Rate (PKR) *',
  'Billing Unit *',
  'Service Code',
  'Description',
  'Panel Eligible (Yes/No)',
  'Discount Allowed (Yes/No)',
  'Manual Rate Override (Yes/No)',
  'Status (Active/Inactive)',
];

export const SERVICES_SAMPLE_ROWS = [
  {
    'Service Name *': 'Specialist Consultation (Cardiology)',
    'Department *': 'Cardiology',
    'Category *': 'Consultation',
    'Standard Rate (PKR) *': 2500,
    'Billing Unit *': 'Per Consultation',
    'Service Code': '',
    'Description': 'Comprehensive outpatient cardiology consultation and clinical evaluation',
    'Panel Eligible (Yes/No)': 'Yes',
    'Discount Allowed (Yes/No)': 'Yes',
    'Manual Rate Override (Yes/No)': 'No',
    'Status (Active/Inactive)': 'Active',
  },
  {
    'Service Name *': 'Complete Blood Count (CBC) with Platelets',
    'Department *': 'Pathology / Laboratory',
    'Category *': 'Laboratory',
    'Standard Rate (PKR) *': 950,
    'Billing Unit *': 'Per Test',
    'Service Code': '',
    'Description': 'Full automated 5-part differential hematology workup',
    'Panel Eligible (Yes/No)': 'Yes',
    'Discount Allowed (Yes/No)': 'Yes',
    'Manual Rate Override (Yes/No)': 'No',
    'Status (Active/Inactive)': 'Active',
  },
  {
    'Service Name *': 'Chest X-Ray PA View Digital',
    'Department *': 'Radiology & Imaging',
    'Category *': 'Radiology',
    'Standard Rate (PKR) *': 1600,
    'Billing Unit *': 'Per Procedure',
    'Service Code': '',
    'Description': 'Digital thoracic radiograph with radiologist reporting',
    'Panel Eligible (Yes/No)': 'Yes',
    'Discount Allowed (Yes/No)': 'No',
    'Manual Rate Override (Yes/No)': 'No',
    'Status (Active/Inactive)': 'Active',
  },
  {
    'Service Name *': 'Normal Vaginal Delivery (NVD) Package',
    'Department *': 'Obstetrics & Gynecology',
    'Category *': 'Surgery',
    'Standard Rate (PKR) *': 35000,
    'Billing Unit *': 'Per Procedure',
    'Service Code': '',
    'Description': 'Standard uncomplicated delivery including labor room and nursing care',
    'Panel Eligible (Yes/No)': 'Yes',
    'Discount Allowed (Yes/No)': 'Yes',
    'Manual Rate Override (Yes/No)': 'No',
    'Status (Active/Inactive)': 'Active',
  },
  {
    'Service Name *': 'Intensive Care Unit (ICU) Bed Charge',
    'Department *': 'Intensive Care Unit (ICU)',
    'Category *': 'Room & Bed',
    'Standard Rate (PKR) *': 15000,
    'Billing Unit *': 'Per Day',
    'Service Code': '',
    'Description': '24-hour critical care monitoring, ventilator line and intensive nursing',
    'Panel Eligible (Yes/No)': 'Yes',
    'Discount Allowed (Yes/No)': 'No',
    'Manual Rate Override (Yes/No)': 'No',
    'Status (Active/Inactive)': 'Active',
  },
];

export const SERVICES_INSTRUCTIONS = [
  {
    'Column Name': 'Service Name *',
    'Requirement': 'MANDATORY',
    'Allowed Values / Examples': 'e.g., Specialist Consultation, CBC Test, Normal Delivery',
    'Description': 'The clinical or commercial name of the medical service as it should appear on invoices and reports.',
  },
  {
    'Column Name': 'Department *',
    'Requirement': 'MANDATORY',
    'Allowed Values / Examples': 'Department Name (e.g., Cardiology, Pathology) OR Code (e.g., DEP-CARD)',
    'Description': 'The hospital department providing this service. Can be either the Department Name or Department Code.',
  },
  {
    'Column Name': 'Category *',
    'Requirement': 'MANDATORY',
    'Allowed Values / Examples': 'Consultation, Laboratory, Radiology, Procedure, Surgery, Nursing, Room & Bed, Emergency, Dental, Dialysis, Physiotherapy, Blood Bank, Dietary, Miscellaneous',
    'Description': 'Central classification of the service for reporting and billing grouping.',
  },
  {
    'Column Name': 'Standard Rate (PKR) *',
    'Requirement': 'MANDATORY',
    'Allowed Values / Examples': 'Numeric value >= 0 (e.g., 2500, 950, 0)',
    'Description': 'Base standard charge in PKR. Free services can be entered as 0.',
  },
  {
    'Column Name': 'Billing Unit *',
    'Requirement': 'MANDATORY',
    'Allowed Values / Examples': 'Per Consultation, Per Procedure, Per Test, Per Day, Per Hour, Per Item, Per Session, Fixed, One-Time',
    'Description': 'Unit of measurement used when generating bills and counting consumption.',
  },
  {
    'Column Name': 'Service Code',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'e.g., SRV-CARD-001 or LEAVE BLANK',
    'Description': 'Unique alphanumeric service code. If left blank, the system will automatically generate a clean sequential code (e.g., SRV-001). No database UUIDs required!',
  },
  {
    'Column Name': 'Description',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Free text clinical description',
    'Description': 'Internal notes or clinical details describing what the service covers.',
  },
  {
    'Column Name': 'Panel Eligible (Yes/No)',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Yes / No (Default: Yes)',
    'Description': 'Whether this service can be claimed under corporate insurance / panel agreements.',
  },
  {
    'Column Name': 'Discount Allowed (Yes/No)',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Yes / No (Default: Yes)',
    'Description': 'Whether cashier or billing staff may apply discounts to this service.',
  },
  {
    'Column Name': 'Manual Rate Override (Yes/No)',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Yes / No (Default: No)',
    'Description': 'Whether cashier can manually change the rate during invoice generation.',
  },
  {
    'Column Name': 'Status (Active/Inactive)',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Active / Inactive (Default: Active)',
    'Description': 'Only Active services are visible on Front Desk billing and booking screens.',
  },
];

export function downloadServicesBulkTemplate(): void {
  const wb = XLSX.utils.book_new();

  // Sheet 1: Services Upload
  const wsServices = XLSX.utils.json_to_sheet(SERVICES_SAMPLE_ROWS, { header: SERVICES_HEADERS });
  applyTableStyles(wsServices, SERVICES_HEADERS, [
    { wch: 38 }, // Service Name
    { wch: 28 }, // Department
    { wch: 18 }, // Category
    { wch: 22 }, // Standard Rate
    { wch: 20 }, // Billing Unit
    { wch: 16 }, // Service Code
    { wch: 50 }, // Description
    { wch: 24 }, // Panel Eligible
    { wch: 24 }, // Discount Allowed
    { wch: 28 }, // Manual Rate Override
    { wch: 22 }, // Status
  ]);
  XLSX.utils.book_append_sheet(wb, wsServices, 'Services Upload');

  // Sheet 2: Instructions
  const wsInstructions = XLSX.utils.json_to_sheet(SERVICES_INSTRUCTIONS);
  applyTableStyles(
    wsInstructions,
    ['Column Name', 'Requirement', 'Allowed Values / Examples', 'Description'],
    [{ wch: 28 }, { wch: 16 }, { wch: 48 }, { wch: 75 }],
    true
  );
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  XLSX.writeFile(wb, `hospital_services_bulk_template_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. DEPARTMENTS TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

export const DEPARTMENTS_HEADERS = [
  'Department Name *',
  'Department Type *',
  'Department Code',
  'Description',
  'Head Doctor / Incharge',
  'Contact Extension',
  'Location / Floor',
  'OPD Enabled (Yes/No)',
  'Observation Enabled (Yes/No)',
  'Emergency Enabled (Yes/No)',
  'Admission Enabled (Yes/No)',
  'Pharmacy Related (Yes/No)',
  'Status (Active/Inactive)',
];

export const DEPARTMENTS_SAMPLE_ROWS = [
  {
    'Department Name *': 'Cardiology & Vascular Medicine',
    'Department Type *': 'Clinical',
    'Department Code': '',
    'Description': 'Heart disease, hypertension, diagnostics and outpatient consultations',
    'Head Doctor / Incharge': 'Prof. Dr. Tariq Saeed',
    'Contact Extension': 'Ext. 201',
    'Location / Floor': 'Ground Floor, East Wing',
    'OPD Enabled (Yes/No)': 'Yes',
    'Observation Enabled (Yes/No)': 'Yes',
    'Emergency Enabled (Yes/No)': 'Yes',
    'Admission Enabled (Yes/No)': 'Yes',
    'Pharmacy Related (Yes/No)': 'No',
    'Status (Active/Inactive)': 'Active',
  },
  {
    'Department Name *': 'General Surgery & Laparoscopy',
    'Department Type *': 'Surgical',
    'Department Code': '',
    'Description': 'Elective and emergency abdominal, minimally invasive and trauma surgeries',
    'Head Doctor / Incharge': '',
    'Contact Extension': 'Ext. 305',
    'Location / Floor': '2nd Floor, Surgical Block',
    'OPD Enabled (Yes/No)': 'Yes',
    'Observation Enabled (Yes/No)': 'Yes',
    'Emergency Enabled (Yes/No)': 'Yes',
    'Admission Enabled (Yes/No)': 'Yes',
    'Pharmacy Related (Yes/No)': 'No',
    'Status (Active/Inactive)': 'Active',
  },
  {
    'Department Name *': 'Pathology & Diagnostic Laboratory',
    'Department Type *': 'Diagnostic',
    'Department Code': '',
    'Description': '24/7 Hematology, biochemistry, microbiology and molecular pathology',
    'Head Doctor / Incharge': '',
    'Contact Extension': 'Ext. 104',
    'Location / Floor': 'Basement Level 1',
    'OPD Enabled (Yes/No)': 'Yes',
    'Observation Enabled (Yes/No)': 'No',
    'Emergency Enabled (Yes/No)': 'Yes',
    'Admission Enabled (Yes/No)': 'No',
    'Pharmacy Related (Yes/No)': 'No',
    'Status (Active/Inactive)': 'Active',
  },
  {
    'Department Name *': 'Accident & Emergency (ER)',
    'Department Type *': 'Emergency',
    'Department Code': '',
    'Description': '24/7 Resuscitation, trauma management and emergency triage',
    'Head Doctor / Incharge': '',
    'Contact Extension': 'Ext. 112',
    'Location / Floor': 'Ground Floor, ER Ramp',
    'OPD Enabled (Yes/No)': 'No',
    'Observation Enabled (Yes/No)': 'Yes',
    'Emergency Enabled (Yes/No)': 'Yes',
    'Admission Enabled (Yes/No)': 'Yes',
    'Pharmacy Related (Yes/No)': 'No',
    'Status (Active/Inactive)': 'Active',
  },
  {
    'Department Name *': 'Hospital Central Pharmacy',
    'Department Type *': 'Pharmacy',
    'Department Code': '',
    'Description': 'Inpatient and outpatient pharmaceutical dispensing and drug distribution',
    'Head Doctor / Incharge': '',
    'Contact Extension': 'Ext. 102',
    'Location / Floor': 'Ground Floor, Main Atrium',
    'OPD Enabled (Yes/No)': 'Yes',
    'Observation Enabled (Yes/No)': 'No',
    'Emergency Enabled (Yes/No)': 'Yes',
    'Admission Enabled (Yes/No)': 'Yes',
    'Pharmacy Related (Yes/No)': 'Yes',
    'Status (Active/Inactive)': 'Active',
  },
];

export const DEPARTMENTS_INSTRUCTIONS = [
  {
    'Column Name': 'Department Name *',
    'Requirement': 'MANDATORY',
    'Allowed Values / Examples': 'e.g., Cardiology, General Surgery, Pathology, Pediatrics',
    'Description': 'Official name of the hospital clinical, diagnostic, or administrative department.',
  },
  {
    'Column Name': 'Department Type *',
    'Requirement': 'MANDATORY',
    'Allowed Values / Examples': 'Clinical, Surgical, Diagnostic, Emergency, Pharmacy, Administrative, Support Service, Other',
    'Description': 'Departmental operational classification.',
  },
  {
    'Column Name': 'Department Code',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'e.g., DEP-CARD or LEAVE BLANK',
    'Description': 'Unique department code. If left blank, the system automatically assigns a clean code (e.g., DEP-001). No database UUIDs required!',
  },
  {
    'Column Name': 'Description',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Brief overview of clinical scope and operations',
    'Description': 'Internal notes or details regarding departmental functions.',
  },
  {
    'Column Name': 'Head Doctor / Incharge',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Doctor name (e.g. Prof. Dr. Tariq Saeed) or staff code (e.g. DOC-001)',
    'Description': 'Clinical lead or department head.',
  },
  {
    'Column Name': 'Contact Extension',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'e.g., Ext. 201, 042-35800000',
    'Description': 'Internal intercom or hospital telephone extension.',
  },
  {
    'Column Name': 'Location / Floor',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'e.g., Ground Floor, 1st Floor Block A, Basement',
    'Description': 'Physical location within the hospital complex.',
  },
  {
    'Column Name': 'OPD Enabled (Yes/No)',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Yes / No (Default: Yes)',
    'Description': 'Allows outpatient appointments and consultations under this department.',
  },
  {
    'Column Name': 'Observation Enabled (Yes/No)',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Yes / No (Default: No)',
    'Description': 'Allows patient day-stay observation visits.',
  },
  {
    'Column Name': 'Emergency Enabled (Yes/No)',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Yes / No (Default: No)',
    'Description': 'Enables emergency triage and rapid admissions.',
  },
  {
    'Column Name': 'Admission Enabled (Yes/No)',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Yes / No (Default: Yes)',
    'Description': 'Allows inpatient bed admissions and surgeries under this department.',
  },
  {
    'Column Name': 'Pharmacy Related (Yes/No)',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Yes / No (Default: No)',
    'Description': 'Mark Yes for pharmaceutical stores or dispensing units.',
  },
  {
    'Column Name': 'Status (Active/Inactive)',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Active / Inactive (Default: Active)',
    'Description': 'Active departments are fully usable across the system.',
  },
];

export function downloadDepartmentsBulkTemplate(): void {
  const wb = XLSX.utils.book_new();

  const wsDepts = XLSX.utils.json_to_sheet(DEPARTMENTS_SAMPLE_ROWS, { header: DEPARTMENTS_HEADERS });
  applyTableStyles(wsDepts, DEPARTMENTS_HEADERS, [
    { wch: 34 }, // Dept Name
    { wch: 20 }, // Dept Type
    { wch: 18 }, // Dept Code
    { wch: 45 }, // Description
    { wch: 26 }, // Head Doctor
    { wch: 18 }, // Extension
    { wch: 26 }, // Location
    { wch: 22 }, // OPD
    { wch: 26 }, // Observation
    { wch: 24 }, // Emergency
    { wch: 24 }, // Admission
    { wch: 24 }, // Pharmacy
    { wch: 22 }, // Status
  ]);
  XLSX.utils.book_append_sheet(wb, wsDepts, 'Departments Upload');

  const wsInstructions = XLSX.utils.json_to_sheet(DEPARTMENTS_INSTRUCTIONS);
  applyTableStyles(
    wsInstructions,
    ['Column Name', 'Requirement', 'Allowed Values / Examples', 'Description'],
    [{ wch: 28 }, { wch: 16 }, { wch: 48 }, { wch: 75 }],
    true
  );
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  XLSX.writeFile(wb, `hospital_departments_bulk_template_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. WARDS TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

export const WARDS_HEADERS = [
  'Ward Name *',
  'Department *',
  'Ward Type *',
  'Ward Code',
  'Gender Policy',
  'Floor',
  'Location / Wing',
  'Description',
  'Status (Active/Inactive)',
];

export const WARDS_SAMPLE_ROWS = [
  {
    'Ward Name *': 'General Medical Ward (Male)',
    'Department *': 'General Medicine',
    'Ward Type *': 'General',
    'Ward Code': '',
    'Gender Policy': 'Male',
    'Floor': '1st Floor',
    'Location / Wing': 'East Wing Block A',
    'Description': 'Inpatient internal medicine ward for adult male admissions',
    'Status (Active/Inactive)': 'Active',
  },
  {
    'Ward Name *': 'Post-Operative Surgical Ward (Female)',
    'Department *': 'General Surgery',
    'Ward Type *': 'General',
    'Ward Code': '',
    'Gender Policy': 'Female',
    'Floor': '2nd Floor',
    'Location / Wing': 'West Wing Block B',
    'Description': 'Intermediate post-surgical nursing recovery ward',
    'Status (Active/Inactive)': 'Active',
  },
  {
    'Ward Name *': 'Pediatric Inpatient Ward',
    'Department *': 'Pediatrics',
    'Ward Type *': 'General',
    'Ward Code': '',
    'Gender Policy': 'Pediatric',
    'Floor': '1st Floor',
    'Location / Wing': 'North Wing Children Hospital',
    'Description': 'Child health inpatient care with dedicated nursing and play area',
    'Status (Active/Inactive)': 'Active',
  },
  {
    'Ward Name *': 'Intensive Care Unit (ICU)',
    'Department *': 'Cardiology & Vascular Medicine',
    'Ward Type *': 'Other',
    'Ward Code': '',
    'Gender Policy': 'Mixed',
    'Floor': '3rd Floor',
    'Location / Wing': 'Critical Care Wing',
    'Description': 'Critical care with central telemetry and mechanical ventilation',
    'Status (Active/Inactive)': 'Active',
  },
];

export const WARDS_INSTRUCTIONS = [
  {
    'Column Name': 'Ward Name *',
    'Requirement': 'MANDATORY',
    'Allowed Values / Examples': 'e.g., General Medical Ward, Surgical Recovery, ICU',
    'Description': 'Human-readable name of the inpatient care ward.',
  },
  {
    'Column Name': 'Department *',
    'Requirement': 'MANDATORY',
    'Allowed Values / Examples': 'Department Name (e.g. General Medicine) OR Department Code (e.g. DEP-GMED)',
    'Description': 'Parent clinical department governing this ward.',
  },
  {
    'Column Name': 'Ward Type *',
    'Requirement': 'MANDATORY',
    'Allowed Values / Examples': 'General, Private, Semi-Private, Other',
    'Description': 'Ward tier classification.',
  },
  {
    'Column Name': 'Ward Code',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'e.g., WRD-MED-01 or LEAVE BLANK',
    'Description': 'Unique ward code. If left blank, system auto-generates WRD-001 automatically. No database UUIDs required!',
  },
  {
    'Column Name': 'Gender Policy',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Mixed, Male, Female, Pediatric, Not Applicable (Default: Mixed)',
    'Description': 'Enforces admission safety rules for patient gender separation.',
  },
  {
    'Column Name': 'Floor',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'e.g., 1st Floor, 2nd Floor, Ground Floor',
    'Description': 'Floor location for nursing staff orientation.',
  },
  {
    'Column Name': 'Location / Wing',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'e.g., East Wing, Block A, Surgical Tower',
    'Description': 'Specific building or wing information.',
  },
  {
    'Column Name': 'Description',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Free text ward details',
    'Description': 'Internal operational notes about ward facilities.',
  },
  {
    'Column Name': 'Status (Active/Inactive)',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Active / Inactive (Default: Active)',
    'Description': 'Active wards are available for bed allocation.',
  },
];

export function downloadWardsBulkTemplate(): void {
  const wb = XLSX.utils.book_new();

  const wsWards = XLSX.utils.json_to_sheet(WARDS_SAMPLE_ROWS, { header: WARDS_HEADERS });
  applyTableStyles(wsWards, WARDS_HEADERS, [
    { wch: 34 }, // Ward Name
    { wch: 28 }, // Department
    { wch: 18 }, // Ward Type
    { wch: 16 }, // Ward Code
    { wch: 18 }, // Gender Policy
    { wch: 16 }, // Floor
    { wch: 28 }, // Location
    { wch: 45 }, // Description
    { wch: 22 }, // Status
  ]);
  XLSX.utils.book_append_sheet(wb, wsWards, 'Wards Upload');

  const wsInstructions = XLSX.utils.json_to_sheet(WARDS_INSTRUCTIONS);
  applyTableStyles(
    wsInstructions,
    ['Column Name', 'Requirement', 'Allowed Values / Examples', 'Description'],
    [{ wch: 28 }, { wch: 16 }, { wch: 48 }, { wch: 75 }],
    true
  );
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  XLSX.writeFile(wb, `hospital_wards_bulk_template_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. ROOMS TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

export const ROOMS_HEADERS = [
  'Room Number *',
  'Ward *',
  'Room Type *',
  'Daily Room Rate (PKR) *',
  'Room Name',
  'Capacity',
  'Room Code',
  'Floor',
  'Status (Active/Inactive)',
];

export const ROOMS_SAMPLE_ROWS = [
  {
    'Room Number *': '101',
    'Ward *': 'General Medical Ward (Male)',
    'Room Type *': 'General',
    'Daily Room Rate (PKR) *': 2000,
    'Room Name': 'Male Medical Hall 1',
    'Capacity': 4,
    'Room Code': '',
    'Floor': '1st Floor',
    'Status (Active/Inactive)': 'Active',
  },
  {
    'Room Number *': '201',
    'Ward *': 'Post-Operative Surgical Ward (Female)',
    'Room Type *': 'Semi-Private',
    'Daily Room Rate (PKR) *': 4500,
    'Room Name': 'Twin Sharing Room 201',
    'Capacity': 2,
    'Room Code': '',
    'Floor': '2nd Floor',
    'Status (Active/Inactive)': 'Active',
  },
  {
    'Room Number *': '301',
    'Ward *': 'Post-Operative Surgical Ward (Female)',
    'Room Type *': 'Private',
    'Daily Room Rate (PKR) *': 8500,
    'Room Name': 'Executive VIP Suite 301',
    'Capacity': 1,
    'Room Code': '',
    'Floor': '3rd Floor',
    'Status (Active/Inactive)': 'Active',
  },
  {
    'Room Number *': 'ICU-1',
    'Ward *': 'Intensive Care Unit (ICU)',
    'Room Type *': 'General',
    'Daily Room Rate (PKR) *': 15000,
    'Room Name': 'ICU Critical Cubicle 1',
    'Capacity': 1,
    'Room Code': '',
    'Floor': '3rd Floor',
    'Status (Active/Inactive)': 'Active',
  },
];

export const ROOMS_INSTRUCTIONS = [
  {
    'Column Name': 'Room Number *',
    'Requirement': 'MANDATORY',
    'Allowed Values / Examples': 'e.g., 101, 102-A, 201, ICU-1',
    'Description': 'Physical room number or code as labeled on the door.',
  },
  {
    'Column Name': 'Ward *',
    'Requirement': 'MANDATORY',
    'Allowed Values / Examples': 'Ward Name (e.g. General Medical Ward) OR Ward Code (e.g. WRD-MED-01)',
    'Description': 'Parent ward where this room is located. Matched forgivingly by name or code.',
  },
  {
    'Column Name': 'Room Type *',
    'Requirement': 'MANDATORY',
    'Allowed Values / Examples': 'General, Semi-Private, Private',
    'Description': 'Room category governing pricing and patient privacy.',
  },
  {
    'Column Name': 'Daily Room Rate (PKR) *',
    'Requirement': 'MANDATORY',
    'Allowed Values / Examples': 'Numeric rate >= 0 (e.g. 2000, 4500, 8500)',
    'Description': 'Daily accommodation billing charge in PKR.',
  },
  {
    'Column Name': 'Room Name',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'e.g., Male Medical Hall 1, Executive Suite',
    'Description': 'Friendly descriptive title for the room.',
  },
  {
    'Column Name': 'Capacity',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Number of beds (Default: 2)',
    'Description': 'Maximum number of patient beds in this room.',
  },
  {
    'Column Name': 'Room Code',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'e.g., RM-101 or LEAVE BLANK',
    'Description': 'Unique room code. If left blank, system auto-generates RM-001. No database UUIDs required!',
  },
  {
    'Column Name': 'Floor',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'e.g., 1st Floor, 2nd Floor (defaults to ward floor if empty)',
    'Description': 'Physical floor location.',
  },
  {
    'Column Name': 'Status (Active/Inactive)',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Active / Inactive (Default: Active)',
    'Description': 'Active rooms are available for bed assignments.',
  },
];

export function downloadRoomsBulkTemplate(): void {
  const wb = XLSX.utils.book_new();

  const wsRooms = XLSX.utils.json_to_sheet(ROOMS_SAMPLE_ROWS, { header: ROOMS_HEADERS });
  applyTableStyles(wsRooms, ROOMS_HEADERS, [
    { wch: 18 }, // Room Number
    { wch: 32 }, // Ward
    { wch: 18 }, // Room Type
    { wch: 24 }, // Daily Rate
    { wch: 28 }, // Room Name
    { wch: 14 }, // Capacity
    { wch: 16 }, // Room Code
    { wch: 16 }, // Floor
    { wch: 22 }, // Status
  ]);
  XLSX.utils.book_append_sheet(wb, wsRooms, 'Rooms Upload');

  const wsInstructions = XLSX.utils.json_to_sheet(ROOMS_INSTRUCTIONS);
  applyTableStyles(
    wsInstructions,
    ['Column Name', 'Requirement', 'Allowed Values / Examples', 'Description'],
    [{ wch: 28 }, { wch: 16 }, { wch: 48 }, { wch: 75 }],
    true
  );
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  XLSX.writeFile(wb, `hospital_rooms_bulk_template_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. BEDS TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

export const BEDS_HEADERS = [
  'Bed Number *',
  'Room *',
  'Bed Type',
  'Bed Code',
  'Daily Rate (PKR)',
  'Operational Status (Active/Out of Service)',
];

export const BEDS_SAMPLE_ROWS = [
  {
    'Bed Number *': 'Bed 101-A',
    'Room *': '101',
    'Bed Type': 'Standard',
    'Bed Code': '',
    'Daily Rate (PKR)': 2000,
    'Operational Status (Active/Out of Service)': 'Active',
  },
  {
    'Bed Number *': 'Bed 101-B',
    'Room *': '101',
    'Bed Type': 'Standard',
    'Bed Code': '',
    'Daily Rate (PKR)': 2000,
    'Operational Status (Active/Out of Service)': 'Active',
  },
  {
    'Bed Number *': 'Bed 201-A',
    'Room *': '201',
    'Bed Type': 'Semi-Private',
    'Bed Code': '',
    'Daily Rate (PKR)': 4500,
    'Operational Status (Active/Out of Service)': 'Active',
  },
  {
    'Bed Number *': 'Bed 301-VIP',
    'Room *': '301',
    'Bed Type': 'Private',
    'Bed Code': '',
    'Daily Rate (PKR)': 8500,
    'Operational Status (Active/Out of Service)': 'Active',
  },
  {
    'Bed Number *': 'ICU-BED-01',
    'Room *': 'ICU-1',
    'Bed Type': 'ICU',
    'Bed Code': '',
    'Daily Rate (PKR)': 15000,
    'Operational Status (Active/Out of Service)': 'Active',
  },
];

export const BEDS_INSTRUCTIONS = [
  {
    'Column Name': 'Bed Number *',
    'Requirement': 'MANDATORY',
    'Allowed Values / Examples': 'e.g., Bed 101-A, Bed 1, ICU-BED-01',
    'Description': 'Unique identifier physically labeled on the bed or patient bay.',
  },
  {
    'Column Name': 'Room *',
    'Requirement': 'MANDATORY',
    'Allowed Values / Examples': 'Room Number (e.g. 101, 201) OR Room Code (e.g. RM-SURG-301)',
    'Description': 'Parent room where this bed is located. Matched forgivingly by Room Number or Code.',
  },
  {
    'Column Name': 'Bed Type',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Standard, Private, Semi-Private, ICU, NICU, PICU, Pediatric, Isolation, Emergency, Other (Default: Standard)',
    'Description': 'Clinical equipment category of the bed.',
  },
  {
    'Column Name': 'Bed Code',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'e.g., BED-101-A or LEAVE BLANK',
    'Description': 'Unique bed code. If left blank, system auto-generates BED-001. No database UUIDs required!',
  },
  {
    'Column Name': 'Daily Rate (PKR)',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Numeric rate >= 0 (Default: inherited from room rate)',
    'Description': 'Individual bed daily rate. If omitted, room rate applies.',
  },
  {
    'Column Name': 'Operational Status',
    'Requirement': 'OPTIONAL',
    'Allowed Values / Examples': 'Active / Out of Service (Default: Active)',
    'Description': 'Active beds appear on the Admission Bed Board ready for patient check-in.',
  },
];

export function downloadBedsBulkTemplate(): void {
  const wb = XLSX.utils.book_new();

  const wsBeds = XLSX.utils.json_to_sheet(BEDS_SAMPLE_ROWS, { header: BEDS_HEADERS });
  applyTableStyles(wsBeds, BEDS_HEADERS, [
    { wch: 18 }, // Bed Number
    { wch: 22 }, // Room
    { wch: 18 }, // Bed Type
    { wch: 16 }, // Bed Code
    { wch: 20 }, // Daily Rate
    { wch: 38 }, // Operational Status
  ]);
  XLSX.utils.book_append_sheet(wb, wsBeds, 'Beds Upload');

  const wsInstructions = XLSX.utils.json_to_sheet(BEDS_INSTRUCTIONS);
  applyTableStyles(
    wsInstructions,
    ['Column Name', 'Requirement', 'Allowed Values / Examples', 'Description'],
    [{ wch: 28 }, { wch: 16 }, { wch: 48 }, { wch: 75 }],
    true
  );
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  XLSX.writeFile(wb, `hospital_beds_bulk_template_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. ALL-IN-ONE WARDS, ROOMS & BEDS MASTER TEMPLATE
// ─────────────────────────────────────────────────────────────────────────────

export function downloadCompleteWardsRoomsBedsTemplate(): void {
  const wb = XLSX.utils.book_new();

  // Tab 1: Wards
  const wsWards = XLSX.utils.json_to_sheet(WARDS_SAMPLE_ROWS, { header: WARDS_HEADERS });
  applyTableStyles(wsWards, WARDS_HEADERS, [
    { wch: 34 }, { wch: 28 }, { wch: 18 }, { wch: 16 }, { wch: 18 },
    { wch: 16 }, { wch: 28 }, { wch: 45 }, { wch: 22 },
  ]);
  XLSX.utils.book_append_sheet(wb, wsWards, 'Wards');

  // Tab 2: Rooms
  const wsRooms = XLSX.utils.json_to_sheet(ROOMS_SAMPLE_ROWS, { header: ROOMS_HEADERS });
  applyTableStyles(wsRooms, ROOMS_HEADERS, [
    { wch: 18 }, { wch: 32 }, { wch: 18 }, { wch: 24 }, { wch: 28 },
    { wch: 14 }, { wch: 16 }, { wch: 16 }, { wch: 22 },
  ]);
  XLSX.utils.book_append_sheet(wb, wsRooms, 'Rooms');

  // Tab 3: Beds
  const wsBeds = XLSX.utils.json_to_sheet(BEDS_SAMPLE_ROWS, { header: BEDS_HEADERS });
  applyTableStyles(wsBeds, BEDS_HEADERS, [
    { wch: 18 }, { wch: 22 }, { wch: 18 }, { wch: 16 }, { wch: 20 }, { wch: 38 },
  ]);
  XLSX.utils.book_append_sheet(wb, wsBeds, 'Beds');

  // Tab 4: Instructions
  const combinedInstructions = [
    ...WARDS_INSTRUCTIONS.map((i) => ({ Section: 'Wards', ...i })),
    ...ROOMS_INSTRUCTIONS.map((i) => ({ Section: 'Rooms', ...i })),
    ...BEDS_INSTRUCTIONS.map((i) => ({ Section: 'Beds', ...i })),
  ];
  const wsInstructions = XLSX.utils.json_to_sheet(combinedInstructions);
  applyTableStyles(
    wsInstructions,
    ['Section', 'Column Name', 'Requirement', 'Allowed Values / Examples', 'Description'],
    [{ wch: 14 }, { wch: 26 }, { wch: 16 }, { wch: 45 }, { wch: 70 }],
    true
  );
  XLSX.utils.book_append_sheet(wb, wsInstructions, 'Instructions');

  XLSX.writeFile(wb, `hospital_inpatient_setup_template_${new Date().toISOString().slice(0, 10)}.xlsx`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. SMART EXCEL & CSV FILE PARSER
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Normalizes header string: strips asterisks, underscores, spaces, hyphens, and lowercases.
 * e.g., "Service Name *" -> "servicename", "department_code" -> "departmentcode"
 */
export function normalizeHeaderKey(header: string): string {
  return String(header || '')
    .toLowerCase()
    .replace(/[*_-\s]/g, '')
    .trim();
}

/**
 * Detects the most relevant data sheet in a multi-sheet workbook,
 * skipping instruction and metadata sheets.
 */
export function pickDataSheetName(
  workbook: XLSX.WorkBook,
  expectedKeywords: string[]
): string {
  const sheetNames = workbook.SheetNames;
  if (sheetNames.length === 1) return sheetNames[0];

  const skipRegex = /instruction|guide|readme|metadata|info|summary|notes/i;

  // 1. First look for sheets not named "instructions"
  const nonInstructionSheets = sheetNames.filter((name) => !skipRegex.test(name));

  // 2. Score sheets by count of expected keywords in their header row
  let bestSheet = nonInstructionSheets[0] || sheetNames[0];
  let highestScore = -1;

  for (const name of nonInstructionSheets) {
    const ws = workbook.Sheets[name];
    if (!ws) continue;
    const json = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1 });
    if (!json || json.length === 0) continue;
    const firstRow = (json[0] || []) as any[];
    const headersStr = firstRow.map((c) => String(c || '').toLowerCase()).join(' ');

    let score = 0;
    expectedKeywords.forEach((kw) => {
      if (headersStr.includes(kw.toLowerCase())) score++;
    });

    if (score > highestScore) {
      highestScore = score;
      bestSheet = name;
    }
  }

  return bestSheet;
}

/**
 * Reads any Excel (.xlsx, .xls) or CSV file as an ArrayBuffer
 * and returns forgivingly mapped row objects.
 */
export async function parseExcelOrCsvFile(
  file: File,
  expectedKeywords: string[] = []
): Promise<any[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = pickDataSheetName(workbook, expectedKeywords);
  const worksheet = workbook.Sheets[sheetName];
  if (!worksheet) return [];

  const rawRows = XLSX.utils.sheet_to_json<Record<string, any>>(worksheet, { defval: '' });

  // Map each row's keys so that both spaced, underscore, or asterisks versions match seamlessly
  return rawRows.map((raw) => {
    const normalized: Record<string, any> = {};
    Object.entries(raw).forEach(([k, v]) => {
      normalized[k] = v; // keep original
      const cleanKey = normalizeHeaderKey(k);
      normalized[cleanKey] = v;
    });
    return normalized;
  });
}
