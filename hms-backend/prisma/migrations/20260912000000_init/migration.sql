-- CreateEnum
CREATE TYPE "PortalRole" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'FRONT_DESK_BILLING', 'ADMISSION', 'INVENTORY_MANAGEMENT', 'PHARMACY_SUPER_ADMIN', 'PHARMACY_MANAGER', 'PHARMACY_SALES_DISPENSING');

-- CreateEnum
CREATE TYPE "PortalUserStatus" AS ENUM ('ACTIVE', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "StaffEmploymentStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'TERMINATED');

-- CreateEnum
CREATE TYPE "DepartmentType" AS ENUM ('CLINICAL', 'ADMINISTRATIVE');

-- CreateEnum
CREATE TYPE "BedStatus" AS ENUM ('AVAILABLE', 'RESERVED', 'OCCUPIED', 'OUT_OF_SERVICE');

-- CreateEnum
CREATE TYPE "AppointmentStatus" AS ENUM ('DRAFT', 'CONFIRMED', 'CHECKED_IN', 'COMPLETED', 'RESCHEDULED', 'CANCELLED', 'NO_SHOW');

-- CreateEnum
CREATE TYPE "EncounterType" AS ENUM ('OPD', 'OBSERVATION', 'EMERGENCY');

-- CreateEnum
CREATE TYPE "InvoiceSourceType" AS ENUM ('APPOINTMENT', 'WALK_IN', 'ADMISSION');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'CARD', 'BANK', 'ONLINE');

-- CreateEnum
CREATE TYPE "AdmissionStatus" AS ENUM ('PLANNED', 'CONFIRMED', 'ACTIVE', 'DISCHARGE_PENDING', 'DISCHARGED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MedicationMode" AS ENUM ('SELF', 'HOSPITAL_MANAGED');

-- CreateEnum
CREATE TYPE "PaymentRequestType" AS ENUM ('ADVANCE', 'PARTIAL', 'FINAL');

-- CreateEnum
CREATE TYPE "PaymentRequestStatus" AS ENUM ('PENDING', 'FULFILLED', 'PARTIALLY_FULFILLED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "ClearanceType" AS ENUM ('CLINICAL', 'HOSPITAL_BILLING', 'PHARMACY');

-- CreateEnum
CREATE TYPE "ClearanceStatus" AS ENUM ('PENDING', 'CLEARED', 'NOT_APPLICABLE');

-- CreateEnum
CREATE TYPE "StockMovementType" AS ENUM ('PURCHASE_RECEIPT', 'DEPARTMENT_RETURN', 'TRANSFER_IN', 'POSITIVE_ADJUSTMENT', 'DEPARTMENT_ISSUE', 'SUPPLIER_RETURN', 'TRANSFER_OUT', 'NEGATIVE_ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SupplierLedgerEntryType" AS ENUM ('PURCHASE_CREDIT', 'PAYMENT', 'RETURN', 'CREDIT_NOTE');

-- CreateEnum
CREATE TYPE "PurchasePaymentMethod" AS ENUM ('PETTY_CASH', 'MANAGEMENT_DIRECT', 'ONLINE', 'CREDIT');

-- CreateEnum
CREATE TYPE "PurchaseOrderStatus" AS ENUM ('DRAFT', 'ORDERED', 'PARTIALLY_RECEIVED', 'RECEIVED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "RequisitionStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_RETURNED', 'CLOSED');

-- CreateEnum
CREATE TYPE "MedicineStockMovementType" AS ENUM ('RECEIPT', 'DISPENSE', 'SALE', 'RETURN_IN', 'RETURN_OUT', 'TRANSFER_IN', 'TRANSFER_OUT', 'EXPIRY', 'DAMAGE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "PharmacySaleChannel" AS ENUM ('RETAIL', 'HMS_LINKED');

-- CreateEnum
CREATE TYPE "PharmacyClearanceStatus" AS ENUM ('REQUESTED', 'ACCEPTED', 'PARTIALLY_FULFILLED', 'REJECTED', 'DISPENSING', 'DISPENSED', 'INVOICED', 'CLEARANCE_SENT', 'INTEGRATION_ERROR');

-- CreateEnum
CREATE TYPE "CashModuleScope" AS ENUM ('BILLING', 'INVENTORY', 'PHARMACY');

-- CreateEnum
CREATE TYPE "CashDirection" AS ENUM ('IN', 'OUT');

-- CreateEnum
CREATE TYPE "CashCategory" AS ENUM ('COLLECTION', 'PURCHASE', 'REFUND', 'EXPENSE', 'PETTY_CASH_ISSUE', 'RECOVERY');

-- CreateEnum
CREATE TYPE "SettlementStatus" AS ENUM ('PREPARED', 'SUBMITTED', 'ACCEPTED', 'PARTIALLY_ACCEPTED', 'RETURNED', 'REJECTED');

-- CreateEnum
CREATE TYPE "AttendanceStatus" AS ENUM ('PRESENT', 'ABSENT', 'LATE', 'EARLY_EXIT', 'MISSING_PUNCH', 'LEAVE');

-- CreateEnum
CREATE TYPE "SalaryStatus" AS ENUM ('DRAFT', 'GENERATED', 'APPROVED', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "CommissionRuleType" AS ENUM ('FIXED_PER_SERVICE', 'PERCENTAGE');

-- CreateEnum
CREATE TYPE "CommissionBasis" AS ENUM ('GROSS', 'NET');

-- CreateEnum
CREATE TYPE "CommissionStatus" AS ENUM ('ACCRUED', 'GENERATED', 'APPROVED', 'PARTIALLY_PAID', 'PAID');

-- CreateTable
CREATE TABLE "staff" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "joining_date" DATE NOT NULL,
    "employment_status" "StaffEmploymentStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "staff_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_employment_history" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "designation" TEXT NOT NULL,
    "shift_name" TEXT,
    "shift_start" TIMESTAMP(3),
    "shift_end" TIMESTAMP(3),
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "reason" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "staff_employment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "salary_basis" TEXT NOT NULL,
    "description" TEXT,
    "default_payroll_divisor" INTEGER NOT NULL DEFAULT 30,
    "deduction_rule_schema" JSONB,
    "allowance_rule_schema" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "salary_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "staff_salary_profiles" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "salary_template_id" TEXT,
    "salary_basis" TEXT NOT NULL,
    "base_amount" DECIMAL(14,2) NOT NULL,
    "payroll_divisor" INTEGER NOT NULL DEFAULT 30,
    "deduction_rules" JSONB NOT NULL DEFAULT '{}',
    "allowance_rules" JSONB NOT NULL DEFAULT '{}',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "staff_salary_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "portal_users" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT,
    "username" TEXT NOT NULL,
    "email" TEXT,
    "password_hash" TEXT NOT NULL,
    "role" "PortalRole" NOT NULL,
    "status" "PortalUserStatus" NOT NULL DEFAULT 'ACTIVE',
    "is_protected" BOOLEAN NOT NULL DEFAULT false,
    "is_cash_handling" BOOLEAN NOT NULL DEFAULT false,
    "must_reset_password" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "portal_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" TEXT NOT NULL,
    "portal_user_id" TEXT NOT NULL,
    "token_hash" TEXT NOT NULL,
    "user_agent" TEXT,
    "ip_address" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "replaced_by" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_profile" (
    "id" TEXT NOT NULL,
    "name" TEXT,
    "contact_phone" TEXT,
    "contact_email" TEXT,
    "address" TEXT,
    "working_hours" TEXT,
    "logo_url" TEXT,
    "billing_legal_metadata" JSONB,
    "print_header_config" JSONB,
    "print_footer_config" JSONB,
    "currency_code" VARCHAR(3) NOT NULL DEFAULT 'PKR',
    "rounding_mode" TEXT NOT NULL DEFAULT 'ROUND_HALF_UP',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Karachi',
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "hospital_profile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "head_staff_id" TEXT,
    "department_type" "DepartmentType" NOT NULL,
    "supports_opd" BOOLEAN NOT NULL DEFAULT false,
    "supports_admission" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "updated_by" TEXT,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "service_rates" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "category" TEXT,
    "billing_unit" TEXT NOT NULL,
    "standard_rate" DECIMAL(14,2) NOT NULL,
    "panel_eligible" BOOLEAN NOT NULL DEFAULT false,
    "discount_allowed" BOOLEAN NOT NULL DEFAULT true,
    "manual_rate_override_allowed" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "service_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "wards" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ward_type" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "wards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rooms" (
    "id" TEXT NOT NULL,
    "ward_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "room_type" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "rooms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "beds" (
    "id" TEXT NOT NULL,
    "room_id" TEXT NOT NULL,
    "bed_number" TEXT NOT NULL,
    "daily_rate" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "BedStatus" NOT NULL DEFAULT 'AVAILABLE',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "beds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "corporate_panels" (
    "id" TEXT NOT NULL,
    "organization_name" TEXT NOT NULL,
    "contact" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "credit_limit" DECIMAL(14,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "corporate_panels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel_discount_rules" (
    "id" TEXT NOT NULL,
    "corporate_panel_id" TEXT NOT NULL,
    "service_rate_id" TEXT NOT NULL,
    "discount_percent" DECIMAL(5,2) NOT NULL,
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,

    CONSTRAINT "panel_discount_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "panel_patients" (
    "id" TEXT NOT NULL,
    "mr_number" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "guardian_name" TEXT,
    "gender" TEXT,
    "dob" DATE,
    "cnic_or_passport" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "corporate_panel_id" TEXT NOT NULL,
    "panel_member_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "panel_patients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "self_pay_encounters" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "guardian_name" TEXT,
    "gender" TEXT,
    "dob" DATE,
    "cnic_or_passport" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "self_pay_encounters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "appointments" (
    "id" TEXT NOT NULL,
    "panel_patient_id" TEXT,
    "self_pay_encounter_id" TEXT,
    "department_id" TEXT NOT NULL,
    "doctor_staff_id" TEXT NOT NULL,
    "service_rate_id" TEXT NOT NULL,
    "slot_at" TIMESTAMP(3) NOT NULL,
    "estimated_amount" DECIMAL(14,2) NOT NULL,
    "status" "AppointmentStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "appointments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "hospital_invoices" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "source_type" "InvoiceSourceType" NOT NULL,
    "encounter_type" "EncounterType",
    "appointment_id" TEXT,
    "admission_record_id" TEXT,
    "panel_patient_id" TEXT,
    "self_pay_encounter_id" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paid_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "hospital_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_line_items" (
    "id" TEXT NOT NULL,
    "hospital_invoice_id" TEXT NOT NULL,
    "service_rate_id" TEXT NOT NULL,
    "rate_snapshot" DECIMAL(14,2) NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL DEFAULT 1,
    "line_gross" DECIMAL(14,2) NOT NULL,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount_reason" TEXT,
    "line_net" DECIMAL(14,2) NOT NULL,
    "performed_by_staff_id" TEXT,
    "is_completed" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "invoice_line_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_receipts" (
    "id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "hospital_invoice_id" TEXT,
    "admission_payment_request_id" TEXT,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "collected_by" TEXT NOT NULL,
    "collected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "is_reversed" BOOLEAN NOT NULL DEFAULT false,
    "printed_at" TIMESTAMP(3),

    CONSTRAINT "payment_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_cash_balances" (
    "id" TEXT NOT NULL,
    "portal_user_id" TEXT NOT NULL,
    "module_scope" "CashModuleScope" NOT NULL,
    "direction" "CashDirection" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "category" "CashCategory" NOT NULL,
    "is_physical_cash" BOOLEAN NOT NULL,
    "payment_receipt_id" TEXT,
    "is_settled" BOOLEAN NOT NULL DEFAULT false,
    "occurred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_cash_balances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_settlements" (
    "id" TEXT NOT NULL,
    "portal_user_id" TEXT NOT NULL,
    "module_scope" "CashModuleScope" NOT NULL,
    "period_start" TIMESTAMP(3) NOT NULL,
    "period_end" TIMESTAMP(3) NOT NULL,
    "expected_cash" DECIMAL(14,2) NOT NULL,
    "physical_cash" DECIMAL(14,2) NOT NULL,
    "variance" DECIMAL(14,2) NOT NULL,
    "variance_reason" TEXT,
    "handover_amount" DECIMAL(14,2),
    "carry_forward_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "SettlementStatus" NOT NULL DEFAULT 'PREPARED',
    "submitted_at" TIMESTAMP(3),
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "remarks" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_settlements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settlement_transactions" (
    "account_settlement_id" TEXT NOT NULL,
    "user_cash_balance_id" TEXT NOT NULL,

    CONSTRAINT "settlement_transactions_pkey" PRIMARY KEY ("account_settlement_id","user_cash_balance_id")
);

-- CreateTable
CREATE TABLE "admission_records" (
    "id" TEXT NOT NULL,
    "admission_number" TEXT NOT NULL,
    "panel_patient_id" TEXT,
    "self_pay_encounter_id" TEXT,
    "department_id" TEXT NOT NULL,
    "doctor_staff_id" TEXT NOT NULL,
    "bed_id" TEXT,
    "status" "AdmissionStatus" NOT NULL DEFAULT 'PLANNED',
    "medication_mode" "MedicationMode" NOT NULL DEFAULT 'SELF',
    "diagnosis" TEXT,
    "expected_at" TIMESTAMP(3),
    "admitted_at" TIMESTAMP(3),
    "discharged_at" TIMESTAMP(3),
    "estimated_amount" DECIMAL(14,2),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "admission_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bed_transfer_history" (
    "id" TEXT NOT NULL,
    "admission_record_id" TEXT NOT NULL,
    "from_bed_id" TEXT,
    "to_bed_id" TEXT NOT NULL,
    "reason" TEXT,
    "transferred_by" TEXT NOT NULL,
    "transferred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "bed_transfer_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medication_mode_history" (
    "id" TEXT NOT NULL,
    "admission_record_id" TEXT NOT NULL,
    "previous_mode" "MedicationMode" NOT NULL,
    "new_mode" "MedicationMode" NOT NULL,
    "reason" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medication_mode_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "admission_payment_requests" (
    "id" TEXT NOT NULL,
    "admission_record_id" TEXT NOT NULL,
    "request_type" "PaymentRequestType" NOT NULL,
    "requested_amount" DECIMAL(14,2) NOT NULL,
    "notes" TEXT,
    "status" "PaymentRequestStatus" NOT NULL DEFAULT 'PENDING',
    "requested_by" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admission_payment_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "dual_discharge_clearances" (
    "id" TEXT NOT NULL,
    "admission_record_id" TEXT NOT NULL,
    "clearance_type" "ClearanceType" NOT NULL,
    "status" "ClearanceStatus" NOT NULL DEFAULT 'PENDING',
    "cleared_by" TEXT,
    "cleared_at" TIMESTAMP(3),

    CONSTRAINT "dual_discharge_clearances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contact" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "terms" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_items" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL,
    "reorder_level" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "stock_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_orders" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "status" "PurchaseOrderStatus" NOT NULL DEFAULT 'DRAFT',
    "invoice_reference" TEXT,
    "payment_method" "PurchasePaymentMethod",
    "total_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),

    CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_order_lines" (
    "id" TEXT NOT NULL,
    "purchase_order_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "received_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,

    CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_ledger" (
    "id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "movement_type" "StockMovementType" NOT NULL,
    "quantity_delta" DECIMAL(14,3) NOT NULL,
    "reference_table" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_ledger" (
    "id" TEXT NOT NULL,
    "supplier_id" TEXT NOT NULL,
    "entry_type" "SupplierLedgerEntryType" NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "reference_table" TEXT,
    "reference_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actor_id" TEXT,

    CONSTRAINT "supplier_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_requisitions" (
    "id" TEXT NOT NULL,
    "department_id" TEXT NOT NULL,
    "status" "RequisitionStatus" NOT NULL DEFAULT 'DRAFT',
    "issued_by" TEXT NOT NULL,
    "received_by_name" TEXT,
    "issued_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "department_requisitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department_requisition_lines" (
    "id" TEXT NOT NULL,
    "department_requisition_id" TEXT NOT NULL,
    "stock_item_id" TEXT NOT NULL,
    "quantity" DECIMAL(14,3) NOT NULL,
    "returned_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,

    CONSTRAINT "department_requisition_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_masters" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT,
    "unit" TEXT NOT NULL,
    "batch_managed" BOOLEAN NOT NULL DEFAULT true,
    "purchase_rate" DECIMAL(14,2),
    "sale_rate" DECIMAL(14,2),
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "medicine_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_batches" (
    "id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "batch_number" TEXT NOT NULL,
    "expiry_date" DATE NOT NULL,
    "cost_rate" DECIMAL(14,2) NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "medicine_batches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "medicine_stock_ledger" (
    "id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "movement_type" "MedicineStockMovementType" NOT NULL,
    "quantity_delta" DECIMAL(14,3) NOT NULL,
    "reference_table" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "actor_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "medicine_stock_ledger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_dispenses" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "channel" "PharmacySaleChannel" NOT NULL,
    "pharmacy_clearance_id" TEXT,
    "panel_patient_id" TEXT,
    "self_pay_encounter_id" TEXT,
    "subtotal" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "discount_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "paid_total" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'UNPAID',
    "dispensed_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pharmacy_dispenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_dispense_lines" (
    "id" TEXT NOT NULL,
    "pharmacy_dispense_id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "batch_id" TEXT,
    "quantity" DECIMAL(14,3) NOT NULL,
    "rate_snapshot" DECIMAL(14,2) NOT NULL,
    "discount_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "line_net" DECIMAL(14,2) NOT NULL,

    CONSTRAINT "pharmacy_dispense_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_clearances" (
    "id" TEXT NOT NULL,
    "medicine_request_number" TEXT NOT NULL,
    "admission_record_id" TEXT NOT NULL,
    "status" "PharmacyClearanceStatus" NOT NULL DEFAULT 'REQUESTED',
    "idempotency_key" TEXT NOT NULL,
    "requested_by" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fulfilled_by" TEXT,
    "fulfilled_at" TIMESTAMP(3),

    CONSTRAINT "pharmacy_clearances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pharmacy_clearance_lines" (
    "id" TEXT NOT NULL,
    "pharmacy_clearance_id" TEXT NOT NULL,
    "medicine_id" TEXT NOT NULL,
    "requested_quantity" DECIMAL(14,3) NOT NULL,
    "approved_quantity" DECIMAL(14,3),
    "dispensed_quantity" DECIMAL(14,3) NOT NULL DEFAULT 0,
    "batch_id" TEXT,
    "notes" TEXT,

    CONSTRAINT "pharmacy_clearance_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "biometric_raw_punches" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "device_source" TEXT NOT NULL,
    "punch_at" TIMESTAMP(3) NOT NULL,
    "raw_payload" JSONB,
    "imported_by" TEXT,
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "biometric_raw_punches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_records" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "attendance_date" DATE NOT NULL,
    "shift_name" TEXT,
    "shift_start" TIMESTAMP(3),
    "shift_end" TIMESTAMP(3),
    "actual_in" TIMESTAMP(3),
    "actual_out" TIMESTAMP(3),
    "late_minutes" INTEGER NOT NULL DEFAULT 0,
    "early_exit_minutes" INTEGER NOT NULL DEFAULT 0,
    "worked_minutes" INTEGER NOT NULL DEFAULT 0,
    "status" "AttendanceStatus" NOT NULL DEFAULT 'ABSENT',
    "is_approved" BOOLEAN NOT NULL DEFAULT false,
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "attendance_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "attendance_correction_logs" (
    "id" TEXT NOT NULL,
    "attendance_record_id" TEXT NOT NULL,
    "original_value" JSONB NOT NULL,
    "corrected_value" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "changed_by" TEXT NOT NULL,
    "changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attendance_correction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_slips" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "period_type" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "base_amount" DECIMAL(14,2) NOT NULL,
    "allowances" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "attendance_deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "other_deductions" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "adjustments" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "generated_amount" DECIMAL(14,2) NOT NULL,
    "component_breakdown" JSONB NOT NULL,
    "calculation_snapshot" JSONB NOT NULL,
    "status" "SalaryStatus" NOT NULL DEFAULT 'DRAFT',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_slips_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "salary_payments" (
    "id" TEXT NOT NULL,
    "salary_slip_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "paid_by" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "salary_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_commission_rules" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "service_rate_id" TEXT,
    "rule_type" "CommissionRuleType" NOT NULL,
    "rate" DECIMAL(14,2) NOT NULL,
    "basis" "CommissionBasis" NOT NULL DEFAULT 'NET',
    "effective_from" DATE NOT NULL,
    "effective_to" DATE,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT,

    CONSTRAINT "doctor_commission_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "doctor_commission_accruals" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "invoice_line_item_id" TEXT NOT NULL,
    "period_type" TEXT NOT NULL,
    "period_start" DATE NOT NULL,
    "period_end" DATE NOT NULL,
    "commission_amount" DECIMAL(14,2) NOT NULL,
    "rule_snapshot" JSONB NOT NULL,
    "status" "CommissionStatus" NOT NULL DEFAULT 'ACCRUED',
    "approved_by" TEXT,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "doctor_commission_accruals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_payouts" (
    "id" TEXT NOT NULL,
    "doctor_commission_accrual_id" TEXT NOT NULL,
    "amount" DECIMAL(14,2) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "reference" TEXT,
    "paid_by" TEXT NOT NULL,
    "paid_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_payouts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "commission_reversals" (
    "id" TEXT NOT NULL,
    "doctor_commission_accrual_id" TEXT NOT NULL,
    "reversal_amount" DECIMAL(14,2) NOT NULL,
    "reason" TEXT NOT NULL,
    "reversed_by" TEXT NOT NULL,
    "reversed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "commission_reversals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity_type" TEXT NOT NULL,
    "entity_id" TEXT,
    "before_state" JSONB,
    "after_state" JSONB,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "request_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "staff_employee_id_key" ON "staff"("employee_id");

-- CreateIndex
CREATE INDEX "staff_employment_history_staff_id_effective_from_idx" ON "staff_employment_history"("staff_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "salary_templates_name_key" ON "salary_templates"("name");

-- CreateIndex
CREATE INDEX "staff_salary_profiles_staff_id_effective_from_idx" ON "staff_salary_profiles"("staff_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "portal_users_staff_id_key" ON "portal_users"("staff_id");

-- CreateIndex
CREATE UNIQUE INDEX "portal_users_username_key" ON "portal_users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "portal_users_email_key" ON "portal_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "service_rates_code_key" ON "service_rates"("code");

-- CreateIndex
CREATE UNIQUE INDEX "beds_room_id_bed_number_key" ON "beds"("room_id", "bed_number");

-- CreateIndex
CREATE UNIQUE INDEX "panel_discount_rules_corporate_panel_id_service_rate_id_eff_key" ON "panel_discount_rules"("corporate_panel_id", "service_rate_id", "effective_from");

-- CreateIndex
CREATE UNIQUE INDEX "panel_patients_mr_number_key" ON "panel_patients"("mr_number");

-- CreateIndex
CREATE INDEX "appointments_doctor_staff_id_idx" ON "appointments"("doctor_staff_id");

-- CreateIndex
CREATE INDEX "appointments_department_id_idx" ON "appointments"("department_id");

-- CreateIndex
CREATE UNIQUE INDEX "hospital_invoices_invoice_number_key" ON "hospital_invoices"("invoice_number");

-- CreateIndex
CREATE INDEX "hospital_invoices_panel_patient_id_idx" ON "hospital_invoices"("panel_patient_id");

-- CreateIndex
CREATE INDEX "hospital_invoices_self_pay_encounter_id_idx" ON "hospital_invoices"("self_pay_encounter_id");

-- CreateIndex
CREATE INDEX "hospital_invoices_admission_record_id_idx" ON "hospital_invoices"("admission_record_id");

-- CreateIndex
CREATE UNIQUE INDEX "payment_receipts_receipt_number_key" ON "payment_receipts"("receipt_number");

-- CreateIndex
CREATE UNIQUE INDEX "user_cash_balances_payment_receipt_id_key" ON "user_cash_balances"("payment_receipt_id");

-- CreateIndex
CREATE UNIQUE INDEX "admission_records_admission_number_key" ON "admission_records"("admission_number");

-- CreateIndex
CREATE INDEX "admission_records_status_idx" ON "admission_records"("status");

-- CreateIndex
CREATE INDEX "admission_records_bed_id_idx" ON "admission_records"("bed_id");

-- CreateIndex
CREATE UNIQUE INDEX "dual_discharge_clearances_admission_record_id_clearance_typ_key" ON "dual_discharge_clearances"("admission_record_id", "clearance_type");

-- CreateIndex
CREATE UNIQUE INDEX "stock_items_code_key" ON "stock_items"("code");

-- CreateIndex
CREATE INDEX "stock_ledger_stock_item_id_created_at_idx" ON "stock_ledger"("stock_item_id", "created_at");

-- CreateIndex
CREATE INDEX "supplier_ledger_supplier_id_created_at_idx" ON "supplier_ledger"("supplier_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "medicine_masters_code_key" ON "medicine_masters"("code");

-- CreateIndex
CREATE INDEX "medicine_batches_medicine_id_expiry_date_idx" ON "medicine_batches"("medicine_id", "expiry_date");

-- CreateIndex
CREATE UNIQUE INDEX "medicine_batches_medicine_id_batch_number_key" ON "medicine_batches"("medicine_id", "batch_number");

-- CreateIndex
CREATE INDEX "medicine_stock_ledger_medicine_id_batch_id_created_at_idx" ON "medicine_stock_ledger"("medicine_id", "batch_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_dispenses_invoice_number_key" ON "pharmacy_dispenses"("invoice_number");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_clearances_medicine_request_number_key" ON "pharmacy_clearances"("medicine_request_number");

-- CreateIndex
CREATE UNIQUE INDEX "pharmacy_clearances_idempotency_key_key" ON "pharmacy_clearances"("idempotency_key");

-- CreateIndex
CREATE UNIQUE INDEX "attendance_records_staff_id_attendance_date_key" ON "attendance_records"("staff_id", "attendance_date");

-- CreateIndex
CREATE UNIQUE INDEX "doctor_commission_accruals_invoice_line_item_id_key" ON "doctor_commission_accruals"("invoice_line_item_id");

-- CreateIndex
CREATE INDEX "audit_logs_entity_type_entity_id_idx" ON "audit_logs"("entity_type", "entity_id");

-- AddForeignKey
ALTER TABLE "staff" ADD CONSTRAINT "staff_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_employment_history" ADD CONSTRAINT "staff_employment_history_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_employment_history" ADD CONSTRAINT "staff_employment_history_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_employment_history" ADD CONSTRAINT "staff_employment_history_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_templates" ADD CONSTRAINT "salary_templates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_salary_profiles" ADD CONSTRAINT "staff_salary_profiles_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_salary_profiles" ADD CONSTRAINT "staff_salary_profiles_salary_template_id_fkey" FOREIGN KEY ("salary_template_id") REFERENCES "salary_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "staff_salary_profiles" ADD CONSTRAINT "staff_salary_profiles_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "portal_users" ADD CONSTRAINT "portal_users_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_portal_user_id_fkey" FOREIGN KEY ("portal_user_id") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_head_staff_id_fkey" FOREIGN KEY ("head_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_rates" ADD CONSTRAINT "service_rates_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "service_rates" ADD CONSTRAINT "service_rates_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wards" ADD CONSTRAINT "wards_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "wards" ADD CONSTRAINT "wards_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_ward_id_fkey" FOREIGN KEY ("ward_id") REFERENCES "wards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "rooms" ADD CONSTRAINT "rooms_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_room_id_fkey" FOREIGN KEY ("room_id") REFERENCES "rooms"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "beds" ADD CONSTRAINT "beds_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "corporate_panels" ADD CONSTRAINT "corporate_panels_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panel_discount_rules" ADD CONSTRAINT "panel_discount_rules_corporate_panel_id_fkey" FOREIGN KEY ("corporate_panel_id") REFERENCES "corporate_panels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panel_discount_rules" ADD CONSTRAINT "panel_discount_rules_service_rate_id_fkey" FOREIGN KEY ("service_rate_id") REFERENCES "service_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panel_patients" ADD CONSTRAINT "panel_patients_corporate_panel_id_fkey" FOREIGN KEY ("corporate_panel_id") REFERENCES "corporate_panels"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "panel_patients" ADD CONSTRAINT "panel_patients_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "self_pay_encounters" ADD CONSTRAINT "self_pay_encounters_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_panel_patient_id_fkey" FOREIGN KEY ("panel_patient_id") REFERENCES "panel_patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_self_pay_encounter_id_fkey" FOREIGN KEY ("self_pay_encounter_id") REFERENCES "self_pay_encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_doctor_staff_id_fkey" FOREIGN KEY ("doctor_staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_service_rate_id_fkey" FOREIGN KEY ("service_rate_id") REFERENCES "service_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_invoices" ADD CONSTRAINT "hospital_invoices_appointment_id_fkey" FOREIGN KEY ("appointment_id") REFERENCES "appointments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_invoices" ADD CONSTRAINT "hospital_invoices_admission_record_id_fkey" FOREIGN KEY ("admission_record_id") REFERENCES "admission_records"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_invoices" ADD CONSTRAINT "hospital_invoices_panel_patient_id_fkey" FOREIGN KEY ("panel_patient_id") REFERENCES "panel_patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_invoices" ADD CONSTRAINT "hospital_invoices_self_pay_encounter_id_fkey" FOREIGN KEY ("self_pay_encounter_id") REFERENCES "self_pay_encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "hospital_invoices" ADD CONSTRAINT "hospital_invoices_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_hospital_invoice_id_fkey" FOREIGN KEY ("hospital_invoice_id") REFERENCES "hospital_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_service_rate_id_fkey" FOREIGN KEY ("service_rate_id") REFERENCES "service_rates"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_line_items" ADD CONSTRAINT "invoice_line_items_performed_by_staff_id_fkey" FOREIGN KEY ("performed_by_staff_id") REFERENCES "staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_hospital_invoice_id_fkey" FOREIGN KEY ("hospital_invoice_id") REFERENCES "hospital_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_admission_payment_request_id_fkey" FOREIGN KEY ("admission_payment_request_id") REFERENCES "admission_payment_requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_receipts" ADD CONSTRAINT "payment_receipts_collected_by_fkey" FOREIGN KEY ("collected_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cash_balances" ADD CONSTRAINT "user_cash_balances_portal_user_id_fkey" FOREIGN KEY ("portal_user_id") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_cash_balances" ADD CONSTRAINT "user_cash_balances_payment_receipt_id_fkey" FOREIGN KEY ("payment_receipt_id") REFERENCES "payment_receipts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_settlements" ADD CONSTRAINT "account_settlements_portal_user_id_fkey" FOREIGN KEY ("portal_user_id") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_settlements" ADD CONSTRAINT "account_settlements_reviewed_by_fkey" FOREIGN KEY ("reviewed_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_transactions" ADD CONSTRAINT "settlement_transactions_account_settlement_id_fkey" FOREIGN KEY ("account_settlement_id") REFERENCES "account_settlements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settlement_transactions" ADD CONSTRAINT "settlement_transactions_user_cash_balance_id_fkey" FOREIGN KEY ("user_cash_balance_id") REFERENCES "user_cash_balances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_records" ADD CONSTRAINT "admission_records_panel_patient_id_fkey" FOREIGN KEY ("panel_patient_id") REFERENCES "panel_patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_records" ADD CONSTRAINT "admission_records_self_pay_encounter_id_fkey" FOREIGN KEY ("self_pay_encounter_id") REFERENCES "self_pay_encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_records" ADD CONSTRAINT "admission_records_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_records" ADD CONSTRAINT "admission_records_doctor_staff_id_fkey" FOREIGN KEY ("doctor_staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_records" ADD CONSTRAINT "admission_records_bed_id_fkey" FOREIGN KEY ("bed_id") REFERENCES "beds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_records" ADD CONSTRAINT "admission_records_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfer_history" ADD CONSTRAINT "bed_transfer_history_admission_record_id_fkey" FOREIGN KEY ("admission_record_id") REFERENCES "admission_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfer_history" ADD CONSTRAINT "bed_transfer_history_from_bed_id_fkey" FOREIGN KEY ("from_bed_id") REFERENCES "beds"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfer_history" ADD CONSTRAINT "bed_transfer_history_to_bed_id_fkey" FOREIGN KEY ("to_bed_id") REFERENCES "beds"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bed_transfer_history" ADD CONSTRAINT "bed_transfer_history_transferred_by_fkey" FOREIGN KEY ("transferred_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_mode_history" ADD CONSTRAINT "medication_mode_history_admission_record_id_fkey" FOREIGN KEY ("admission_record_id") REFERENCES "admission_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medication_mode_history" ADD CONSTRAINT "medication_mode_history_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_payment_requests" ADD CONSTRAINT "admission_payment_requests_admission_record_id_fkey" FOREIGN KEY ("admission_record_id") REFERENCES "admission_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "admission_payment_requests" ADD CONSTRAINT "admission_payment_requests_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dual_discharge_clearances" ADD CONSTRAINT "dual_discharge_clearances_admission_record_id_fkey" FOREIGN KEY ("admission_record_id") REFERENCES "admission_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "dual_discharge_clearances" ADD CONSTRAINT "dual_discharge_clearances_cleared_by_fkey" FOREIGN KEY ("cleared_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_items" ADD CONSTRAINT "stock_items_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_order_lines" ADD CONSTRAINT "purchase_order_lines_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_ledger" ADD CONSTRAINT "stock_ledger_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ledger" ADD CONSTRAINT "supplier_ledger_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_ledger" ADD CONSTRAINT "supplier_ledger_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_requisitions" ADD CONSTRAINT "department_requisitions_department_id_fkey" FOREIGN KEY ("department_id") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_requisitions" ADD CONSTRAINT "department_requisitions_issued_by_fkey" FOREIGN KEY ("issued_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_requisition_lines" ADD CONSTRAINT "department_requisition_lines_department_requisition_id_fkey" FOREIGN KEY ("department_requisition_id") REFERENCES "department_requisitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "department_requisition_lines" ADD CONSTRAINT "department_requisition_lines_stock_item_id_fkey" FOREIGN KEY ("stock_item_id") REFERENCES "stock_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_masters" ADD CONSTRAINT "medicine_masters_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_batches" ADD CONSTRAINT "medicine_batches_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicine_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_batches" ADD CONSTRAINT "medicine_batches_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_stock_ledger" ADD CONSTRAINT "medicine_stock_ledger_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicine_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_stock_ledger" ADD CONSTRAINT "medicine_stock_ledger_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "medicine_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "medicine_stock_ledger" ADD CONSTRAINT "medicine_stock_ledger_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_dispenses" ADD CONSTRAINT "pharmacy_dispenses_pharmacy_clearance_id_fkey" FOREIGN KEY ("pharmacy_clearance_id") REFERENCES "pharmacy_clearances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_dispenses" ADD CONSTRAINT "pharmacy_dispenses_panel_patient_id_fkey" FOREIGN KEY ("panel_patient_id") REFERENCES "panel_patients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_dispenses" ADD CONSTRAINT "pharmacy_dispenses_self_pay_encounter_id_fkey" FOREIGN KEY ("self_pay_encounter_id") REFERENCES "self_pay_encounters"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_dispenses" ADD CONSTRAINT "pharmacy_dispenses_dispensed_by_fkey" FOREIGN KEY ("dispensed_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_dispense_lines" ADD CONSTRAINT "pharmacy_dispense_lines_pharmacy_dispense_id_fkey" FOREIGN KEY ("pharmacy_dispense_id") REFERENCES "pharmacy_dispenses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_dispense_lines" ADD CONSTRAINT "pharmacy_dispense_lines_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicine_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_dispense_lines" ADD CONSTRAINT "pharmacy_dispense_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "medicine_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_clearances" ADD CONSTRAINT "pharmacy_clearances_admission_record_id_fkey" FOREIGN KEY ("admission_record_id") REFERENCES "admission_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_clearances" ADD CONSTRAINT "pharmacy_clearances_requested_by_fkey" FOREIGN KEY ("requested_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_clearances" ADD CONSTRAINT "pharmacy_clearances_fulfilled_by_fkey" FOREIGN KEY ("fulfilled_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_clearance_lines" ADD CONSTRAINT "pharmacy_clearance_lines_pharmacy_clearance_id_fkey" FOREIGN KEY ("pharmacy_clearance_id") REFERENCES "pharmacy_clearances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_clearance_lines" ADD CONSTRAINT "pharmacy_clearance_lines_medicine_id_fkey" FOREIGN KEY ("medicine_id") REFERENCES "medicine_masters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pharmacy_clearance_lines" ADD CONSTRAINT "pharmacy_clearance_lines_batch_id_fkey" FOREIGN KEY ("batch_id") REFERENCES "medicine_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_raw_punches" ADD CONSTRAINT "biometric_raw_punches_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "biometric_raw_punches" ADD CONSTRAINT "biometric_raw_punches_imported_by_fkey" FOREIGN KEY ("imported_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_records" ADD CONSTRAINT "attendance_records_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_correction_logs" ADD CONSTRAINT "attendance_correction_logs_attendance_record_id_fkey" FOREIGN KEY ("attendance_record_id") REFERENCES "attendance_records"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attendance_correction_logs" ADD CONSTRAINT "attendance_correction_logs_changed_by_fkey" FOREIGN KEY ("changed_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_slips" ADD CONSTRAINT "salary_slips_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_slips" ADD CONSTRAINT "salary_slips_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "salary_payments" ADD CONSTRAINT "salary_payments_salary_slip_id_fkey" FOREIGN KEY ("salary_slip_id") REFERENCES "salary_slips"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_commission_rules" ADD CONSTRAINT "doctor_commission_rules_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_commission_rules" ADD CONSTRAINT "doctor_commission_rules_service_rate_id_fkey" FOREIGN KEY ("service_rate_id") REFERENCES "service_rates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_commission_rules" ADD CONSTRAINT "doctor_commission_rules_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_commission_accruals" ADD CONSTRAINT "doctor_commission_accruals_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "staff"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_commission_accruals" ADD CONSTRAINT "doctor_commission_accruals_invoice_line_item_id_fkey" FOREIGN KEY ("invoice_line_item_id") REFERENCES "invoice_line_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "doctor_commission_accruals" ADD CONSTRAINT "doctor_commission_accruals_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_doctor_commission_accrual_id_fkey" FOREIGN KEY ("doctor_commission_accrual_id") REFERENCES "doctor_commission_accruals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_payouts" ADD CONSTRAINT "commission_payouts_paid_by_fkey" FOREIGN KEY ("paid_by") REFERENCES "portal_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "commission_reversals" ADD CONSTRAINT "commission_reversals_doctor_commission_accrual_id_fkey" FOREIGN KEY ("doctor_commission_accrual_id") REFERENCES "doctor_commission_accruals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "portal_users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

