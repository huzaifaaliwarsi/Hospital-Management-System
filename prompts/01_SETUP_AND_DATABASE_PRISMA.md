# PHASE 1: Backend Setup, Architecture & Database Schema (Prisma + PostgreSQL)

```markdown
TASK: Initialize Node.js + Express + TypeScript Backend for CH Sharif & Saeed Hospital HMS

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
   src/
   ├── config/          # db connection, env configuration, constants
   ├── controllers/     # route controllers
   ├── middleware/      # auth, rbac, errorHandler, zod validator
   ├── routes/          # express routers per module
   ├── services/        # business logic & calculation services
   ├── types/           # typescript interfaces & types
   ├── utils/           # response helpers, loggers, audit helpers
   ├── app.ts
   └── server.ts
3. In prisma/schema.prisma, define tables strictly per 16 Client.pdf:
   - Staff (HR identity) vs PortalUser (Login credentials, 8 roles: SUPER_ADMIN, ADMIN, FRONT_DESK_BILLING, ADMISSION, INVENTORY_MANAGEMENT, PHARMACY_SUPER_ADMIN, PHARMACY_MANAGER, PHARMACY_SALES_DISPENSING).
   - Setup: HospitalProfile, Department, ServiceRate, Ward, Room, Bed, CorporatePanel.
   - Patient: PanelPatient (Permanent) vs SelfPayEncounter (Temporary case identity).
   - Billing: Appointment, HospitalInvoice, InvoiceLineItem, PaymentReceipt, UserCashBalance, AccountSettlement.
   - Admission: AdmissionRecord, BedTransferHistory, MedicationModeHistory (SELF vs HOSPITAL_MANAGED), AdmissionPaymentRequest, DualDischargeClearance.
   - Inventory: Supplier, StockItem, PurchaseOrder, StockLedger, SupplierLedger, DepartmentRequisition.
   - Pharmacy: MedicineMaster, MedicineBatch (FEFO), MedicineStockLedger, PharmacyDispense, PharmacyClearance.
   - Workforce: BiometricRawPunch, AttendanceRecord, AttendanceCorrectionLog, SalarySlip, DoctorCommissionRule, DoctorCommissionAccrual, CommissionPayout.
   - Audit trail on every transaction: created_by_user_id, collected_by_user_id, approved_by_user_id.
4. Create prisma/seed.ts with initial hospital profile, clinical/admin departments, wards/beds, and initial protected Super Admin & Admin accounts with hashed passwords.
5. Provide npm scripts to run migrations, seeding, and start dev server:
   - npm run dev
   - npm run prisma:migrate
   - npm run prisma:seed
```
