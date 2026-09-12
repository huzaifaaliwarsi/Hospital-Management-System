import {
  HospitalService,
  ServiceCategory,
  BillingUnit,
  ServiceFilterState,
  ServiceFormValues,
  ServiceImportRow,
  ServiceImportValidationResult,
} from '../types/serviceRates';
import { User } from '../types';
import { DepartmentService, formatAuditUser, formatAuditTimestamp } from './departmentService';
import { getHospitalProfile } from './hospitalProfileService';

const STORAGE_KEY = 'css_hms_services_catalog_v1';

export const VALID_SERVICE_CATEGORIES: ServiceCategory[] = [
  'Consultation',
  'Emergency',
  'Observation',
  'Admission',
  'Room / Bed',
  'Procedure',
  'Surgery',
  'Diagnostic',
  'Laboratory',
  'Radiology',
  'Nursing',
  'Miscellaneous',
  'Other',
];

export const VALID_BILLING_UNITS: BillingUnit[] = [
  'Per Visit',
  'Per Consultation',
  'Per Procedure',
  'Per Test',
  'Per Day',
  'Per Hour',
  'Per Session',
  'Per Unit',
  'One-Time',
  'Other',
];

export const INITIAL_SERVICES: HospitalService[] = [
  {
    id: 'srv_001',
    code: 'SRV-OPD-001',
    name: 'General OPD Consultation',
    description: 'Outpatient specialist initial consultation and assessment',
    departmentId: 'DEP-03',
    departmentName: 'Cardiology',
    category: 'Consultation',
    standardRate: 2500,
    currency: 'PKR',
    billingUnit: 'Per Consultation',
    panelEligible: true,
    manualRateOverrideAllowed: false,
    discountAllowed: true,
    status: 'Active',
    linkedInvoiceCount: 142,
    linkedPanelRuleCount: 6,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2026, 09:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '15 Aug 2026, 11:30 AM',
  },
  {
    id: 'srv_002',
    code: 'SRV-EMG-001',
    name: 'Emergency Triage & Consultation',
    description: 'Immediate 24/7 emergency medical examination and resuscitation initiation',
    departmentId: 'DEP-07',
    departmentName: 'Emergency',
    category: 'Emergency',
    standardRate: 2000,
    currency: 'PKR',
    billingUnit: 'Per Visit',
    panelEligible: true,
    manualRateOverrideAllowed: true,
    discountAllowed: false,
    status: 'Active',
    linkedInvoiceCount: 388,
    linkedPanelRuleCount: 8,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2026, 09:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '02 Aug 2026, 03:15 PM',
  },
  {
    id: 'srv_003',
    code: 'SRV-OBS-001',
    name: 'Emergency Observation (Up to 4 Hours)',
    description: 'Short-stay clinical monitoring, vital signs tracking and immediate therapy',
    departmentId: 'DEP-07',
    departmentName: 'Emergency',
    category: 'Observation',
    standardRate: 3500,
    currency: 'PKR',
    billingUnit: 'Per Session',
    panelEligible: true,
    manualRateOverrideAllowed: false,
    discountAllowed: true,
    status: 'Active',
    linkedInvoiceCount: 95,
    linkedPanelRuleCount: 4,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 10:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '12 Jul 2026, 02:00 PM',
  },
  {
    id: 'srv_004',
    code: 'SRV-ADM-001',
    name: 'Inpatient Admission Processing Fee',
    description: 'Registration, digital bed allocation file opening and initial nursing dossier',
    departmentId: 'DEP-09',
    departmentName: 'Administration',
    category: 'Admission',
    standardRate: 1500,
    currency: 'PKR',
    billingUnit: 'One-Time',
    panelEligible: true,
    manualRateOverrideAllowed: false,
    discountAllowed: false,
    status: 'Active',
    linkedInvoiceCount: 210,
    linkedPanelRuleCount: 5,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 10:30 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '10 Jun 2026, 04:20 PM',
  },
  {
    id: 'srv_005',
    code: 'SRV-BED-GEN',
    name: 'General Ward Bed Accommodation',
    description: 'Daily inpatient accommodation with routine round-the-clock nursing supervision',
    departmentId: 'DEP-01',
    departmentName: 'General Medicine',
    category: 'Room / Bed',
    standardRate: 3000,
    currency: 'PKR',
    billingUnit: 'Per Day',
    panelEligible: true,
    manualRateOverrideAllowed: false,
    discountAllowed: true,
    status: 'Active',
    linkedInvoiceCount: 312,
    linkedPanelRuleCount: 6,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '08 Jan 2026, 11:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '18 Jul 2026, 01:10 PM',
  },
  {
    id: 'srv_006',
    code: 'SRV-BED-ICU',
    name: 'Intensive Care Unit (ICU) Bed with Monitor',
    description: 'Comprehensive hemodynamic monitoring, ventilator support and 1:1 specialized critical nursing',
    departmentId: 'DEP-07',
    departmentName: 'Emergency',
    category: 'Room / Bed',
    standardRate: 15000,
    currency: 'PKR',
    billingUnit: 'Per Day',
    panelEligible: true,
    manualRateOverrideAllowed: false,
    discountAllowed: false,
    status: 'Active',
    linkedInvoiceCount: 84,
    linkedPanelRuleCount: 5,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '08 Jan 2026, 11:15 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '22 Aug 2026, 05:45 PM',
  },
  {
    id: 'srv_007',
    code: 'SRV-RAD-XRAY',
    name: 'Digital Chest X-Ray (PA View)',
    description: 'Single exposure digital radiograph with immediate PACS archive and radiologist reporting',
    departmentId: 'DEP-05',
    departmentName: 'Radiology',
    category: 'Radiology',
    standardRate: 1800,
    currency: 'PKR',
    billingUnit: 'Per Test',
    panelEligible: true,
    manualRateOverrideAllowed: false,
    discountAllowed: true,
    status: 'Active',
    linkedInvoiceCount: 520,
    linkedPanelRuleCount: 7,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '10 Jan 2026, 09:30 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '28 Aug 2026, 10:15 AM',
  },
  {
    id: 'srv_008',
    code: 'SRV-RAD-USG',
    name: 'Ultrasound Whole Abdomen & Pelvis',
    description: 'High-resolution abdominal color Doppler and morphological sonography',
    departmentId: 'DEP-05',
    departmentName: 'Radiology',
    category: 'Radiology',
    standardRate: 3500,
    currency: 'PKR',
    billingUnit: 'Per Test',
    panelEligible: true,
    manualRateOverrideAllowed: false,
    discountAllowed: true,
    status: 'Active',
    linkedInvoiceCount: 340,
    linkedPanelRuleCount: 6,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '10 Jan 2026, 09:45 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '14 Jul 2026, 03:30 PM',
  },
  {
    id: 'srv_009',
    code: 'SRV-LAB-CBC',
    name: 'Complete Blood Count (CBC) with ESR',
    description: 'Automated 5-part hematology differential analyzer with peripheral smear review',
    departmentId: 'DEP-06',
    departmentName: 'Pathology',
    category: 'Laboratory',
    standardRate: 950,
    currency: 'PKR',
    billingUnit: 'Per Test',
    panelEligible: true,
    manualRateOverrideAllowed: false,
    discountAllowed: true,
    status: 'Active',
    linkedInvoiceCount: 890,
    linkedPanelRuleCount: 8,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '12 Jan 2026, 10:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '01 Sep 2026, 11:20 AM',
  },
  {
    id: 'srv_010',
    code: 'SRV-LAB-LFT',
    name: 'Liver Function Tests (LFTs)',
    description: 'Serum Bilirubin, ALT/SGPT, AST/SGOT, Alkaline Phosphatase, Total Protein, Albumin',
    departmentId: 'DEP-06',
    departmentName: 'Pathology',
    category: 'Laboratory',
    standardRate: 1800,
    currency: 'PKR',
    billingUnit: 'Per Test',
    panelEligible: true,
    manualRateOverrideAllowed: false,
    discountAllowed: true,
    status: 'Active',
    linkedInvoiceCount: 460,
    linkedPanelRuleCount: 7,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '12 Jan 2026, 10:30 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '19 Aug 2026, 04:00 PM',
  },
  {
    id: 'srv_011',
    code: 'SRV-PROC-ECG',
    name: '12-Lead Electrocardiogram (ECG)',
    description: 'Diagnostic computerized 12-channel rhythm strip with cardiologist interpretation',
    departmentId: 'DEP-03',
    departmentName: 'Cardiology',
    category: 'Diagnostic',
    standardRate: 1200,
    currency: 'PKR',
    billingUnit: 'Per Test',
    panelEligible: true,
    manualRateOverrideAllowed: false,
    discountAllowed: true,
    status: 'Active',
    linkedInvoiceCount: 375,
    linkedPanelRuleCount: 6,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '15 Jan 2026, 02:00 PM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '03 Aug 2026, 09:10 AM',
  },
  {
    id: 'srv_012',
    code: 'SRV-PROC-NEB',
    name: 'Nebulization Therapy',
    description: 'Aerosolized bronchodilator inhalation with disposable kit and oxygen assist',
    departmentId: 'DEP-07',
    departmentName: 'Emergency',
    category: 'Procedure',
    standardRate: 600,
    currency: 'PKR',
    billingUnit: 'Per Session',
    panelEligible: true,
    manualRateOverrideAllowed: false,
    discountAllowed: true,
    status: 'Active',
    linkedInvoiceCount: 215,
    linkedPanelRuleCount: 5,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '15 Jan 2026, 02:30 PM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '16 Jul 2026, 12:45 PM',
  },
  {
    id: 'srv_013',
    code: 'SRV-NUR-DRS',
    name: 'Surgical Wound Dressing (Medium)',
    description: 'Aseptic cleansing, antiseptic application and sterile post-operative dressing',
    departmentId: 'DEP-02',
    departmentName: 'General Surgery',
    category: 'Nursing',
    standardRate: 1000,
    currency: 'PKR',
    billingUnit: 'Per Procedure',
    panelEligible: true,
    manualRateOverrideAllowed: false,
    discountAllowed: true,
    status: 'Active',
    linkedInvoiceCount: 160,
    linkedPanelRuleCount: 4,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '18 Jan 2026, 11:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '24 Jul 2026, 02:20 PM',
  },
  {
    id: 'srv_014',
    code: 'SRV-SURG-OTM',
    name: 'Major Operation Theatre Facility Charges (Hour 1)',
    description: 'Sterile surgical suite usage, laparoscopy tower, scrub nurse and OT technician support',
    departmentId: 'DEP-02',
    departmentName: 'General Surgery',
    category: 'Surgery',
    standardRate: 25000,
    currency: 'PKR',
    billingUnit: 'Per Hour',
    panelEligible: true,
    manualRateOverrideAllowed: true,
    discountAllowed: false,
    status: 'Active',
    linkedInvoiceCount: 78,
    linkedPanelRuleCount: 5,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '20 Jan 2026, 03:00 PM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '30 Aug 2026, 04:15 PM',
  },
  {
    id: 'srv_015',
    code: 'SRV-MISC-AMB',
    name: 'Basic Life Support Ambulance Transport (Local)',
    description: 'Within city radius patient transfer with emergency EMT on board',
    departmentId: 'DEP-07',
    departmentName: 'Emergency',
    category: 'Miscellaneous',
    standardRate: 4000,
    currency: 'PKR',
    billingUnit: 'Per Visit',
    panelEligible: false,
    manualRateOverrideAllowed: true,
    discountAllowed: false,
    status: 'Active',
    linkedInvoiceCount: 45,
    linkedPanelRuleCount: 0,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '22 Jan 2026, 01:30 PM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '11 Jul 2026, 05:00 PM',
  },
  {
    id: 'srv_016',
    code: 'SRV-PROC-OLD',
    name: 'Legacy Manual Blood Glucose Dipstick',
    description: 'Older manual dipstick protocol replaced by automated laboratory glucometer analyzer',
    departmentId: 'DEP-06',
    departmentName: 'Pathology',
    category: 'Diagnostic',
    standardRate: 250,
    currency: 'PKR',
    billingUnit: 'Per Test',
    panelEligible: false,
    manualRateOverrideAllowed: false,
    discountAllowed: false,
    status: 'Inactive',
    linkedInvoiceCount: 0,
    linkedPanelRuleCount: 0,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '02 Jan 2026, 10:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '05 Mar 2026, 02:00 PM',
    statusChangedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    statusChangedAt: '05 Mar 2026, 02:00 PM',
  },
];

export class ServiceRatesService {
  static getServices(): HospitalService[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      const departments = DepartmentService.getDepartments();

      let rawList: HospitalService[];
      if (!stored) {
        rawList = INITIAL_SERVICES;
      } else {
        rawList = JSON.parse(stored);
      }

      let modified = false;
      const normalized = rawList.map((s: any) => {
        const canonical = DepartmentService.resolveCanonicalDepartment(
          s.departmentId || s.departmentCode || s.department,
          s.departmentName || s.department,
          departments
        );
        const rate = Number(s.standardRate ?? 0);
        if (
          s.departmentId !== canonical.id ||
          s.departmentName !== canonical.name ||
          s.standardRate !== rate
        ) {
          modified = true;
          return {
            ...s,
            departmentId: canonical.id,
            departmentName: canonical.name,
            standardRate: rate,
          };
        }
        return s;
      });

      if (!stored || modified) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      }
      return normalized;
    } catch (err) {
      console.error('Failed to load services from localStorage:', err);
      return INITIAL_SERVICES;
    }
  }

  static saveServices(services: HospitalService[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(services));
    } catch (err) {
      console.error('Failed to persist services to localStorage:', err);
    }
  }

  static getServiceById(id: string): HospitalService | undefined {
    return this.getServices().find((s) => s.id === id);
  }

  static validateServiceCode(code: string, currentId?: string): { isValid: boolean; message?: string } {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      return { isValid: false, message: 'Service code is required.' };
    }
    // Uppercase, alphanumeric and hyphen only
    const validPattern = /^[A-Z0-9-]+$/;
    if (!validPattern.test(trimmed)) {
      return { isValid: false, message: 'Code must contain uppercase letters, numbers, and hyphens only.' };
    }

    const services = this.getServices();
    const isDuplicate = services.some(
      (s) => s.code.toUpperCase() === trimmed && s.id !== currentId
    );
    if (isDuplicate) {
      return { isValid: false, message: `Service code "${trimmed}" already exists in master catalog.` };
    }

    return { isValid: true };
  }

  static createService(values: ServiceFormValues, currentUser?: User | null): HospitalService {
    const codeCheck = this.validateServiceCode(values.code);
    if (!codeCheck.isValid) {
      throw new Error(codeCheck.message || 'Invalid service code.');
    }

    const departments = DepartmentService.getDepartments();
    const deptInfo = DepartmentService.resolveCanonicalDepartment(
      values.departmentId,
      undefined,
      departments
    );
    const dept = departments.find((d) => d.id === deptInfo.id);
    if (!dept) {
      throw new Error('Selected department does not exist in master registry.');
    }
    if (dept.status !== 'Active') {
      throw new Error('Cannot create new service under an Inactive department.');
    }

    if (values.standardRate < 0) {
      throw new Error('Standard rate cannot be negative.');
    }

    const profile = getHospitalProfile();
    const currency = profile.currency || 'PKR';

    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();

    const newService: HospitalService = {
      id: `srv_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      description: values.description?.trim() || '',
      departmentId: dept.id,
      departmentName: dept.name,
      category: values.category,
      standardRate: Number(values.standardRate) || 0,
      currency,
      billingUnit: values.billingUnit,
      panelEligible: values.panelEligible,
      manualRateOverrideAllowed: values.manualRateOverrideAllowed,
      discountAllowed: values.discountAllowed,
      status: values.status,
      linkedInvoiceCount: 0,
      linkedPanelRuleCount: 0,
      createdBy: auditUser,
      createdAt: auditTime,
      updatedBy: auditUser,
      updatedAt: auditTime,
    };

    const services = this.getServices();
    const updated = [newService, ...services];
    this.saveServices(updated);

    return newService;
  }

  static updateService(id: string, values: ServiceFormValues, currentUser?: User | null): HospitalService {
    const services = this.getServices();
    const existingIndex = services.findIndex((s) => s.id === id);
    if (existingIndex === -1) {
      throw new Error('Service record not found.');
    }

    const codeCheck = this.validateServiceCode(values.code, id);
    if (!codeCheck.isValid) {
      throw new Error(codeCheck.message || 'Invalid service code.');
    }

    const departments = DepartmentService.getDepartments();
    const deptInfo = DepartmentService.resolveCanonicalDepartment(
      values.departmentId,
      undefined,
      departments
    );
    const dept = departments.find((d) => d.id === deptInfo.id);
    if (!dept) {
      throw new Error('Selected department does not exist in master registry.');
    }

    if (values.standardRate < 0) {
      throw new Error('Standard rate cannot be negative.');
    }

    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();
    const existing = services[existingIndex];

    const updatedService: HospitalService = {
      ...existing,
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      description: values.description?.trim() || '',
      departmentId: dept.id,
      departmentName: dept.name,
      category: values.category,
      standardRate: Number(values.standardRate) || 0,
      billingUnit: values.billingUnit,
      panelEligible: values.panelEligible,
      manualRateOverrideAllowed: values.manualRateOverrideAllowed,
      discountAllowed: values.discountAllowed,
      status: values.status,
      updatedBy: auditUser,
      updatedAt: auditTime,
    };

    if (existing.status !== values.status) {
      updatedService.statusChangedBy = auditUser;
      updatedService.statusChangedAt = auditTime;
    }

    services[existingIndex] = updatedService;
    this.saveServices(services);

    return updatedService;
  }

  static changeServiceStatus(
    id: string,
    newStatus: 'Active' | 'Inactive',
    currentUser?: User | null
  ): HospitalService {
    const services = this.getServices();
    const existingIndex = services.findIndex((s) => s.id === id);
    if (existingIndex === -1) {
      throw new Error('Service not found.');
    }

    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();
    const existing = services[existingIndex];

    const updatedService: HospitalService = {
      ...existing,
      status: newStatus,
      updatedBy: auditUser,
      updatedAt: auditTime,
      statusChangedBy: auditUser,
      statusChangedAt: auditTime,
    };

    services[existingIndex] = updatedService;
    this.saveServices(services);
    return updatedService;
  }

  static deleteService(id: string): { success: boolean; message?: string } {
    const services = this.getServices();
    const service = services.find((s) => s.id === id);
    if (!service) {
      return { success: false, message: 'Service not found.' };
    }

    // Safeguard check
    if ((service.linkedInvoiceCount ?? 0) > 0 || (service.linkedPanelRuleCount ?? 0) > 0) {
      return {
        success: false,
        message: 'This service is linked to hospital billing records and cannot be deleted. Deactivate it instead.',
      };
    }

    const remaining = services.filter((s) => s.id !== id);
    this.saveServices(remaining);
    return { success: true };
  }

  static filterServices(
    services: HospitalService[],
    filters: ServiceFilterState
  ): HospitalService[] {
    return services.filter((s) => {
      // 1. Search across Code, Name, Department
      if (filters.searchTerm.trim()) {
        const query = filters.searchTerm.toLowerCase().trim();
        const matchCode = s.code.toLowerCase().includes(query);
        const matchName = s.name.toLowerCase().includes(query);
        const matchDept = s.departmentName.toLowerCase().includes(query);
        if (!matchCode && !matchName && !matchDept) return false;
      }

      // 2. Department filter
      if (filters.departmentId !== 'All') {
        if (String(s.departmentId) !== String(filters.departmentId)) return false;
      }

      // 3. Category filter
      if (filters.category !== 'All') {
        if (s.category !== filters.category) return false;
      }

      // 4. Panel Eligible filter
      if (filters.panelEligible !== 'All') {
        const isEligible = filters.panelEligible === 'Yes';
        if (s.panelEligible !== isEligible) return false;
      }

      // 5. Status filter
      if (filters.status !== 'All') {
        if (s.status !== filters.status) return false;
      }

      return true;
    });
  }

  static getKPIs(services: HospitalService[]) {
    const totalServices = services.length;
    const activeServices = services.filter((s) => s.status === 'Active').length;
    const clinicalServices = services.filter((s) =>
      ['Consultation', 'Emergency', 'Observation', 'Admission', 'Room / Bed'].includes(s.category)
    ).length;
    const diagnosticProcedureServices = services.filter((s) =>
      ['Diagnostic', 'Laboratory', 'Radiology', 'Procedure', 'Surgery'].includes(s.category)
    ).length;
    const panelEligibleServices = services.filter((s) => s.panelEligible).length;

    return {
      totalServices,
      activeServices,
      clinicalServices,
      diagnosticProcedureServices,
      panelEligibleServices,
    };
  }

  static validateImportRows(
    rawRows: any[],
    existingServices: HospitalService[]
  ): ServiceImportValidationResult {
    const departments = DepartmentService.getDepartments();
    const deptCodeMap = new Map(departments.map((d) => [d.code.toUpperCase(), d]));
    const existingCodeSet = new Set(existingServices.map((s) => s.code.toUpperCase()));
    const seenFileCodes = new Set<string>();

    const validRows: ServiceImportRow[] = [];
    const invalidRows: ServiceImportRow[] = [];

    rawRows.forEach((row, idx) => {
      const rowNum = idx + 2;
      const errors: string[] = [];

      const rawCode = String(row.service_code || row.code || '').trim().toUpperCase();
      const rawName = String(row.service_name || row.name || '').trim();
      const rawDeptCode = String(row.department_code || row.dept_code || '').trim().toUpperCase();
      const rawCat = String(row.category || '').trim();
      const rawDesc = String(row.description || '').trim();
      const rawUnit = String(row.billing_unit || row.unit || '').trim();
      const rawRate = Number(row.standard_rate ?? row.rate);
      const rawPanel = String(row.panel_eligible || '').trim().toLowerCase();
      const rawDiscount = String(row.discount_allowed || '').trim().toLowerCase();
      const rawOverride = String(row.manual_rate_override_allowed || '').trim().toLowerCase();
      const rawStatus = String(row.status || 'Active').trim();

      // Validate Service Code
      if (!rawCode) {
        errors.push('Missing service code.');
      } else if (!/^[A-Z0-9-]+$/.test(rawCode)) {
        errors.push('Code must contain uppercase letters, numbers, and hyphens only.');
      } else if (existingCodeSet.has(rawCode)) {
        errors.push(`Service code "${rawCode}" already exists in master catalog.`);
      } else if (seenFileCodes.has(rawCode)) {
        errors.push(`Duplicate code "${rawCode}" found within uploaded file.`);
      } else {
        seenFileCodes.add(rawCode);
      }

      // Validate Service Name
      if (!rawName) {
        errors.push('Missing service name.');
      }

      // Validate Department Code
      let matchedDept = rawDeptCode ? deptCodeMap.get(rawDeptCode) : undefined;
      if (!rawDeptCode) {
        errors.push('Missing department code.');
      } else if (!matchedDept) {
        errors.push(`Department code "${rawDeptCode}" not recognized in hospital directory.`);
      } else if (matchedDept.status !== 'Active') {
        errors.push(`Department "${matchedDept.name}" (${rawDeptCode}) is currently Inactive.`);
      }

      // Validate Category
      if (!rawCat) {
        errors.push('Missing service category.');
      } else if (!VALID_SERVICE_CATEGORIES.includes(rawCat as ServiceCategory)) {
        errors.push(`Invalid category "${rawCat}". Valid: ${VALID_SERVICE_CATEGORIES.join(', ')}.`);
      }

      // Validate Billing Unit
      if (!rawUnit) {
        errors.push('Missing billing unit.');
      } else if (!VALID_BILLING_UNITS.includes(rawUnit as BillingUnit)) {
        errors.push(`Invalid billing unit "${rawUnit}". Valid: ${VALID_BILLING_UNITS.join(', ')}.`);
      }

      // Validate Rate
      if (isNaN(rawRate) || rawRate < 0) {
        errors.push('Standard rate must be a non-negative number.');
      }

      // Validate Status
      const normalizedStatus: 'Active' | 'Inactive' =
        rawStatus.toLowerCase() === 'inactive' ? 'Inactive' : 'Active';

      const panelEligible = ['true', 'yes', '1', 'y'].includes(rawPanel);
      const discountAllowed = ['true', 'yes', '1', 'y'].includes(rawDiscount);
      const manualRateOverrideAllowed = ['true', 'yes', '1', 'y'].includes(rawOverride);

      const parsedRow: ServiceImportRow = {
        rowNumber: rowNum,
        serviceCode: rawCode,
        serviceName: rawName,
        departmentCode: rawDeptCode,
        category: rawCat,
        description: rawDesc,
        billingUnit: rawUnit,
        standardRate: isNaN(rawRate) ? 0 : rawRate,
        panelEligible,
        discountAllowed,
        manualRateOverrideAllowed,
        status: normalizedStatus,
        isValid: errors.length === 0,
        errors,
      };

      if (errors.length === 0) {
        validRows.push(parsedRow);
      } else {
        invalidRows.push(parsedRow);
      }
    });

    return {
      totalRows: rawRows.length,
      validRows,
      invalidRows,
    };
  }

  static importServices(
    validRows: ServiceImportRow[],
    currentUser?: User | null
  ): number {
    const departments = DepartmentService.getDepartments();
    const deptCodeMap = new Map(departments.map((d) => [d.code.toUpperCase(), d]));
    const profile = getHospitalProfile();
    const currency = profile.currency || 'PKR';
    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();

    const services = this.getServices();

    const newServices: HospitalService[] = validRows.map((r, i) => {
      const dept = deptCodeMap.get(r.departmentCode.toUpperCase())!;
      return {
        id: `srv_imp_${Date.now()}_${i}`,
        code: r.serviceCode,
        name: r.serviceName,
        description: r.description || '',
        departmentId: dept.id,
        departmentName: dept.name,
        category: r.category as ServiceCategory,
        standardRate: r.standardRate,
        currency,
        billingUnit: r.billingUnit as BillingUnit,
        panelEligible: r.panelEligible,
        manualRateOverrideAllowed: r.manualRateOverrideAllowed,
        discountAllowed: r.discountAllowed,
        status: r.status,
        linkedInvoiceCount: 0,
        linkedPanelRuleCount: 0,
        createdBy: auditUser,
        createdAt: auditTime,
        updatedBy: auditUser,
        updatedAt: auditTime,
      };
    });

    const combined = [...newServices, ...services];
    this.saveServices(combined);
    return newServices.length;
  }
}
