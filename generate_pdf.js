const fs = require('fs');
const path = require('path');
const { jsPDF } = require('./ch-sharif-and-saeed-hospital---hms/node_modules/jspdf');

const doc = new jsPDF({
  orientation: 'portrait',
  unit: 'pt',
  format: 'a4'
});

const pageWidth = doc.internal.pageSize.getWidth();
const pageHeight = doc.internal.pageSize.getHeight();
const margin = 40;
const contentWidth = pageWidth - (margin * 2);

let y = margin;

function checkPageBreak(requiredHeight) {
  if (y + requiredHeight > pageHeight - 50) {
    addFooter();
    doc.addPage();
    y = margin;
    addHeader();
  }
}

function addHeader() {
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text('CH SHARIF AND SAEED HOSPITAL | HMS BACKEND IMPLEMENTATION PROMPTS (SOURCE OF TRUTH V6.3)', margin, 25);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, 28, pageWidth - margin, 28);
}

function addFooter() {
  const pageNum = doc.internal.getNumberOfPages();
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.5);
  doc.line(margin, pageHeight - 30, pageWidth - margin, pageHeight - 30);
  doc.setFontSize(8);
  doc.setTextColor(148, 163, 184);
  doc.text('Prepared for Claude Code / Claude 3.7 Sonnet Implementation', margin, pageHeight - 18);
  doc.text(`Page ${pageNum}`, pageWidth - margin - 35, pageHeight - 18);
}

// ---------------- COVER / HEADER SECTION ----------------
doc.setFillColor(15, 23, 42); // Slate 900
doc.rect(margin, y, contentWidth, 110, 'F');

doc.setFont('helvetica', 'bold');
doc.setFontSize(18);
doc.setTextColor(255, 255, 255);
doc.text('CH SHARIF AND SAEED HOSPITAL', margin + 20, y + 35);

doc.setFontSize(12);
doc.setTextColor(56, 189, 248); // Sky 400
doc.text('Complete Backend Implementation Roadmap & Claude Prompts', margin + 20, y + 55);

doc.setFont('helvetica', 'normal');
doc.setFontSize(9);
doc.setTextColor(203, 213, 225);
doc.text('Strictly mapped to Client Source of Truth (16 Client.pdf / 17 System Specifications)', margin + 20, y + 75);
doc.text('Architecture: Node.js + Express.js + TypeScript + PostgreSQL (Prisma ORM)', margin + 20, y + 90);

y += 125;

// Intro Note
doc.setFillColor(241, 245, 249);
doc.rect(margin, y, contentWidth, 55, 'F');
doc.setDrawColor(203, 213, 225);
doc.rect(margin, y, contentWidth, 55, 'S');

doc.setFont('helvetica', 'bold');
doc.setFontSize(9.5);
doc.setTextColor(15, 23, 42);
doc.text('Hidayat Baraye Istemal (How to use with Claude):', margin + 12, y + 16);

doc.setFont('helvetica', 'normal');
doc.setFontSize(8.5);
doc.setTextColor(51, 65, 85);
doc.text('In prompts ko aik aik kar ke (Phase 1 se Phase 8) Claude ko dein. Har phase ke baad code verify karein,', margin + 12, y + 30);
doc.text('phir agla phase dein. Is se backend bina kisi hardcoded data ke clean aur scalable banega.', margin + 12, y + 43);

y += 70;

// Data Structure for Prompts
const phases = [
  {
    phase: 'PHASE 1',
    title: 'Project Setup, Architecture & Database Schema (Prisma + PostgreSQL)',
    objective: 'Create hms-backend directory, install packages, configure TS, and write complete Prisma schema strictly matching 16 Client.pdf.',
    promptText: `TASK: Initialize Node.js + Express + TypeScript Backend for CH Sharif & Saeed Hospital HMS

Context:
We have an existing React 19 + TypeScript frontend inside 'ch-sharif-and-saeed-hospital---hms'.
Now build a modular, production-grade backend inside a new directory 'hms-backend'.
All business rules must strictly follow '16 Client.pdf' (Source of Truth v6.3).

Tech Stack:
- Runtime: Node.js (v20+)
- Framework: Express.js with TypeScript
- ORM: Prisma ORM with PostgreSQL
- Validation: Zod
- Auth: JWT (jsonwebtoken) + bcryptjs
- Utilities: cors, helmet, morgan, dotenv, express-rate-limit

Instructions:
1. Initialize 'hms-backend' with package.json, tsconfig.json, .env.example.
2. Structure folders:
   src/config, src/controllers, src/middleware, src/routes, src/services, src/types, src/utils, app.ts, server.ts
3. In prisma/schema.prisma, define tables:
   - Staff (HR identity) vs PortalUser (Login credentials, 8 roles: SUPER_ADMIN, ADMIN, FRONT_DESK_BILLING, ADMISSION, INVENTORY_MANAGEMENT, PHARMACY_SUPER_ADMIN, PHARMACY_MANAGER, PHARMACY_SALES_DISPENSING).
   - Setup: HospitalProfile, Department, ServiceRate, Ward, Room, Bed, CorporatePanel.
   - Patient: PanelPatient (Permanent) vs SelfPayEncounter (Temporary case identity).
   - Billing: Appointment, HospitalInvoice, InvoiceLineItem, PaymentReceipt, UserCashBalance, AccountSettlement.
   - Admission: AdmissionRecord, BedTransferHistory, MedicationModeHistory (SELF vs HOSPITAL_MANAGED), AdmissionPaymentRequest, DualDischargeClearance.
   - Inventory: Supplier, StockItem, PurchaseOrder, StockLedger, SupplierLedger, DepartmentRequisition.
   - Pharmacy: MedicineMaster, MedicineBatch (FEFO), MedicineStockLedger, PharmacyDispense, PharmacyClearance.
   - Workforce: BiometricRawPunch, AttendanceRecord, AttendanceCorrectionLog, SalarySlip, DoctorCommissionRule, DoctorCommissionAccrual, CommissionPayout.
   - Audit trail on every transaction: created_by_user_id, collected_by_user_id, approved_by_user_id.
4. Create prisma/seed.ts with initial hospital profile, clinical/admin departments, wards/beds, and initial protected Super Admin & Admin accounts with hashed passwords.`
  },
  {
    phase: 'PHASE 2',
    title: 'Authentication, Protected Account Governance & Cashier Account Settlement',
    objective: 'Implement JWT login, enforce Super Admin protection server-side, and implement exact-user cash custody settlement.',
    promptText: `TASK: Implement Authentication, Protected Account Governance, and Universal User Cash Settlement API

Context:
Per '16 Client.pdf', two critical financial and security rules must be strictly enforced on backend:
1. Protected Governance: Admin cannot edit, demote, delete, or reset password of Super Admin.
2. Universal Cash Accountability: Admission portal never receives cash. Every cash user (Billing, funded Inventory, Pharmacy cashier) has their own UserCashBalance and submits their own AccountSettlement.

Instructions:
1. Implement JWT Auth: POST /api/v1/auth/login, GET /api/v1/auth/me, POST /api/v1/auth/refresh.
2. Create authenticate and authorizeRoles(...roles) middlewares.
3. In User Management controller, enforce protected account rules:
   - If user role is ADMIN and target user is SUPER_ADMIN -> return 403 Forbidden.
   - Prevent deleting currently active Super Admin or last remaining Super Admin.
4. Universal Cash Accountability Endpoints:
   - GET /api/v1/finance/my-balance-sheet: Returns logged-in cashier's opening float, collections, advances, refunds, petty expenses, and expected physical cash.
   - POST /api/v1/finance/settlements/submit: Cashier submits counted physical cash, calculates variance against unsettled transactions, and submits for custody transfer.
   - GET /api/v1/finance/settlements/pending: For Super Admin/Admin to review.
   - POST /api/v1/finance/settlements/:id/action: Reviewer accepts, partially accepts, or returns settlement.`
  },
  {
    phase: 'PHASE 3',
    title: 'Hospital Masters, Staff 360° Profiles & Patient Registry Endpoints',
    objective: 'Build real CRUD APIs for Hospital Setup, Staff Master 360° view, and Pakistani CNIC/Phone patient registry.',
    promptText: `TASK: Build REST APIs for Hospital Setup, Staff 360° Profiles, and Patient Registry

Context:
Refer to '16 Client.pdf' Sections 4, 5, 6, 31, 32. Eliminate all client-side mock arrays.

Instructions:
1. Hospital Setup APIs:
   - GET/PUT /api/v1/setup/hospital-profile (Hospital details, logo, NTN, print headers/footers).
   - /api/v1/setup/departments (Clinical & administrative).
   - /api/v1/setup/services-rates (Standard rates, discount allowances, panel applicability).
   - /api/v1/setup/wards-rooms-beds (Department -> Ward -> Room -> Bed hierarchy; status: Available, Occupied, Maintenance).
   - /api/v1/setup/corporate-panels (Corporate panel organizations, discount rules, credit limits).
2. Staff 360° Profile API:
   - /api/v1/staff (CRUD).
   - GET /api/v1/staff/:id/360: Returns HR profile, linked portal user account, shift history, attendance summary, staff-specific salary profile, and doctor commission rules.
3. Patient Registry API:
   - Validate Pakistani CNIC (XXXXX-XXXXXXX-X) and phone (03XX-XXXXXXX).
   - GET /api/v1/patients/check-duplicate?cnic=...&phone=...
   - Permanent Panel Patients (/api/v1/patients/panel).
   - Temporary Self-Pay Encounters (/api/v1/patients/encounters).`
  },
  {
    phase: 'PHASE 4',
    title: 'Front Desk Billing, Appointments & Doctor Share Calculation Engine',
    objective: 'Build appointment flow, advance collection, OPD/Emergency invoicing, and Doctor Commission calculation.',
    promptText: `TASK: Build Front Desk Billing, Appointments, and Invoicing Calculation Engine

Context:
Refer to '16 Client.pdf' Section 7, 8, 22, 35. Front Desk is the ONLY portal collecting hospital patient cash.

Instructions:
1. Appointments Flow:
   - POST /api/v1/appointments: Book appointment for panel or self-pay.
   - POST /api/v1/appointments/:id/advance: Collect advance payment; generates receipt linked to cashier.
   - POST /api/v1/appointments/:id/check-in: Converts appointment to active OPD/Observation/Emergency encounter.
2. Invoicing & Doctor Commission Calculation Engine:
   - Formula:
     Net Service Amount = Gross Service Amount - Approved Discount
     Doctor Commission = Net Eligible Service Amount * Doctor Commission % (or fixed rate)
     Hospital Remaining Share = Net Service Amount - Doctor Commission
   - Automatically apply Panel discount rules if panel patient.
   - Require Admin approval if discount exceeds threshold.
3. Receipts & Cashier Updates:
   - Adjust prior advance payment against final hospital invoice.
   - Cash payments automatically update current cashier's UserCashBalance.
   - Digital/POS payments tracked separately without inflating physical cash.`
  },
  {
    phase: 'PHASE 5',
    title: 'Inpatient Admission, Bed Lifecycle & Dual Clearance Discharge Workflow',
    objective: 'Manage planned admission, bed transfers, medication modes, and the 3-key gate for final discharge.',
    promptText: `TASK: Implement Inpatient Admission (IPD), Bed Allocation, and Dual Clearance Discharge

Context:
Refer to '16 Client.pdf' Sections 9, 10, 11, 12, 13, 23.
Crucial: Admission NEVER collects cash. Final discharge requires Dual Clearance.

Instructions:
1. Planned Admission & Billing Hand-off:
   - POST /api/v1/admissions/planned: Create planned admission.
   - POST /api/v1/admissions/:id/request-advance: Sends payment request to Billing queue.
2. Bed Lifecycle:
   - POST /api/v1/admissions/:id/check-in: Assign bed -> Status becomes Occupied.
   - POST /api/v1/admissions/:id/bed-transfer: Transfer patient bed; log from_bed, to_bed, timestamp, actor.
   - POST /api/v1/admissions/:id/add-service: Append running hospital services and bed day charges.
3. Medication Mode:
   - POST /api/v1/admissions/:id/medication-mode: Toggle SELF vs HOSPITAL_MANAGED with reason and actor.
   - In HOSPITAL_MANAGED mode, allow sending medicine requests to Standalone Pharmacy queue.
4. Dual Clearance Discharge Gate:
   - Clinical Ready = Doctor sign-off.
   - Hospital Clearance = Billing confirms all hospital bills paid.
   - Pharmacy Clearance = Pharmacy confirms all medicine dues cleared.
   - POST /api/v1/admissions/:id/discharge: Allowed ONLY when all 3 clearances are approved. Automatically frees bed to Available.`
  },
  {
    phase: 'PHASE 6',
    title: 'General Inventory & Standalone Pharmacy Integration Engine',
    objective: 'Implement non-medicine inventory ledgers, and batch/FEFO dispensing with Pharmacy clearance.',
    promptText: `TASK: Implement General Inventory Ledgers and Standalone Pharmacy Integration

Context:
Refer to '16 Client.pdf' Sections 13, 14, 16, 17, 33, 34.
HMS Inventory is non-medicine; Standalone Pharmacy owns medicine stock and FEFO dispensing.

Instructions:
1. General Inventory:
   - Supplier Master & Supplier Ledger (track purchases, returns, payments, credits, outstanding).
   - Fund Request: Inventory staff requests petty cash advance -> Admin approves -> credited to user cash balance.
   - Purchase/Receipt: Posts stock IN into StockLedger; cash payment reduces user cash balance.
   - Department Issue/Return: Requisition -> Issue stock -> Deduct StockLedger with department tag.
2. Standalone Pharmacy Integration:
   - Medicine Master, Batches, Expiry, Cost, Sale Price.
   - FEFO Engine: Auto-allocate nearest non-expired batch upon dispensing.
   - Dispensing: Retail walk-in sale + HMS Inpatient Request queue.
   - Dispensing creates Pharmacy Invoice and updates Pharmacy Clearance callback to HMS Admission.`
  },
  {
    phase: 'PHASE 7',
    title: 'Biometric Attendance, Salary Payroll & Doctor Commission Engines',
    objective: 'Process punch logs, calculate salary payroll, and independently accrue/pay doctor commissions.',
    promptText: `TASK: Implement Attendance Normalization, Staff Salary Payroll, and Doctor Commission Streams

Context:
Refer to '16 Client.pdf' Sections 18, 19, 20, 21, 25, 26, 35.
Crucial: Salary Payroll (attendance-driven) and Doctor Commission (service-driven) are independent liabilities!

Instructions:
1. Biometric Attendance Engine:
   - POST /api/v1/attendance/punch-ingest: Receive raw device punch logs.
   - Map punches against assigned shift (grace period, late-in, early-exit, absent).
   - Admin Attendance Correction: PUT /api/v1/attendance/:id/correct (log original, corrected, reason, user).
2. Salary Payroll Engine:
   - Formula:
     Generated Salary = Base Salary + Approved Allowances - Attendance Deductions - Other Deductions +/- Adjustments
   - Lifecycle: Generated -> Approved -> Paid (Full, Partial, or Later).
3. Doctor Commission Engine:
   - Accrues from completed eligible service lines.
   - Single-inclusion rule: A service line can only be included in ONE generated commission statement.
   - Generation -> Approval -> Independent payout and outstanding tracking.`
  },
  {
    phase: 'PHASE 8',
    title: 'Frontend Refactoring (Removing LocalStorage & Connecting Real Express APIs)',
    objective: 'Replace localStorage in the React frontend with Axios client and connect live endpoints.',
    promptText: `TASK: Refactor React Frontend to Remove LocalStorage Mock Data and Connect to Live Express Backend

Context:
Frontend in 'ch-sharif-and-saeed-hospital---hms' uses localStorage (hms_patient_registry_v1, etc.) and ModulePlaceholderView.
Connect it to the backend running at http://localhost:5000/api/v1.

Instructions:
1. Create Axios client in src/services/api/apiClient.ts:
   - Base URL from VITE_API_URL or http://localhost:5000/api/v1.
   - Request interceptor: Attach JWT Bearer token from AuthContext.
   - Response interceptor: Handle 401 (redirect to /login), 403, and toast notifications.
2. Refactor services in src/services/:
   - Replace adminUserService.ts, patientRegistryService.ts, departmentService.ts, etc., with real async HTTP calls.
   - Remove hardcoded mock arrays and localStorage keys.
3. Replace ModulePlaceholderView.tsx with real working components:
   - Front Desk Invoicing & Payment Collection screen.
   - Cashier Balance Sheet & Account Settlement modal.
   - Admission Bed Allocation & Dual Clearance screen.
   - Inventory Requisition & Stock Ledger screen.
   - Standalone Pharmacy Queue & Dispensing screen.`
  }
];

phases.forEach((p, index) => {
  checkPageBreak(120);

  // Phase Badge & Title
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.roundedRect(margin, y, 70, 18, 3, 3, 'F');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text(p.phase, margin + 14, y + 12);

  doc.setFontSize(11);
  doc.setTextColor(15, 23, 42);
  doc.text(p.title, margin + 80, y + 13);
  y += 26;

  // Objective
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(8.5);
  doc.setTextColor(71, 85, 105);
  const splitObj = doc.splitTextToSize(`Objective: ${p.objective}`, contentWidth);
  doc.text(splitObj, margin, y);
  y += (splitObj.length * 11) + 8;

  // Prompt Box
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.8);
  const promptLines = doc.splitTextToSize(p.promptText, contentWidth - 20);
  const boxHeight = (promptLines.length * 9.8) + 16;

  checkPageBreak(boxHeight + 15);

  doc.setFillColor(248, 250, 252);
  doc.rect(margin, y, contentWidth, boxHeight, 'F');
  doc.setDrawColor(203, 213, 225);
  doc.rect(margin, y, contentWidth, boxHeight, 'S');

  doc.setTextColor(30, 41, 59);
  doc.text(promptLines, margin + 10, y + 13);

  y += boxHeight + 22;
});

// Add headers and footers to all pages
const totalPages = doc.internal.getNumberOfPages();
for (let i = 1; i <= totalPages; i++) {
  doc.setPage(i);
  addHeader();
  addFooter();
}

const outputPath = path.join(__dirname, 'HMS_Backend_Implementation_Prompts.pdf');
const pdfBuffer = doc.output('arraybuffer');
fs.writeFileSync(outputPath, Buffer.from(pdfBuffer));

console.log('PDF generated successfully at:', outputPath);
