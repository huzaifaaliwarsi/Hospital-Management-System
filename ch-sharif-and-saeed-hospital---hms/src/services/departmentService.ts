import {
  Department,
  DepartmentFilterState,
  DepartmentFormValues,
  DepartmentHeadOption,
  DepartmentImportRow,
  DepartmentImportValidationResult,
  DepartmentType,
} from '../types/department';
import { User } from '../types';
import { formatDisplayDate } from '../utils/dateConstants';
import { INITIAL_DEPARTMENTS } from '../features/superAdmin/departments/departmentMockData';

const STORAGE_KEY = 'css_hms_departments_dataset_v1';

/**
 * Helper to build standard audit user string e.g. "Prof. Dr. Tariq Saeed (Super Admin)"
 */
export const formatAuditUser = (user?: User | null): string => {
  if (!user) return 'Prof. Dr. Tariq Saeed (Super Admin)';
  return `${user.name} (${user.role})`;
};

/**
 * Helper to build current timestamp e.g. "08 Sep 2026, 05:40 PM"
 */
export const formatAuditTimestamp = (): string => {
  const d = new Date();
  const dateStr = formatDisplayDate(d);
  const timeStr = d.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${dateStr}, ${timeStr}`;
};

/**
 * Valid department types list
 */
export const VALID_DEPARTMENT_TYPES: DepartmentType[] = [
  'Clinical',
  'Surgical',
  'Diagnostic',
  'Emergency',
  'Pharmacy',
  'Administrative',
  'Support Service',
  'Other',
];

/**
 * Client service layer for Departments module.
 * Prepared with full REST semantics for future backend integration.
 */
export class DepartmentService {
  /**
   * Initialize or retrieve departments from local storage
   */
  static loadDepartmentsFromStorage(initialData: Department[]): Department[] {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load departments from localStorage, using initial dataset', e);
    }
    return initialData;
  }

  /**
   * Canonical helper to resolve any legacy ID, department code, or name variation
   * into a standardized { id: string, name: string, code: string }
   */
  static resolveCanonicalDepartment(
    rawId?: string | null,
    rawName?: string | null,
    departmentsList?: Department[]
  ): { id: string; name: string; code: string } {
    const departments =
      departmentsList && departmentsList.length > 0
        ? departmentsList
        : DepartmentService.getDepartments();

    const cleanId = (rawId || '').trim();
    const cleanName = (rawName || '').trim();

    // 1. Direct ID match (e.g. 'DEP-01', 'DEP-07')
    if (cleanId) {
      const matchId = departments.find(
        (d) => d.id.toLowerCase() === cleanId.toLowerCase()
      );
      if (matchId) {
        return { id: matchId.id, name: matchId.name, code: matchId.code };
      }

      // 2. Direct Code match (e.g. 'DEP-MED', 'DEP-ER')
      const matchCode = departments.find(
        (d) => d.code.toLowerCase() === cleanId.toLowerCase()
      );
      if (matchCode) {
        return { id: matchCode.id, name: matchCode.name, code: matchCode.code };
      }
    }

    // 3. Known Legacy slug map
    const LEGACY_MAP: Record<string, string> = {
      dept_cardiology: 'DEP-03',
      dept_emergency: 'DEP-07',
      dept_admin: 'DEP-09',
      dept_internal_med: 'DEP-01',
      dept_radiology: 'DEP-05',
      dept_pathology: 'DEP-06',
      dept_general_surgery: 'DEP-02',
      dept_pediatrics: 'DEP-04',
      dept_ortho: 'DEP-10',
      dept_gyn: 'DEP-11',
      dept_eye: 'DEP-12',
      dept_pharm: 'DEP-08',
    };

    if (cleanId && LEGACY_MAP[cleanId.toLowerCase()]) {
      const targetId = LEGACY_MAP[cleanId.toLowerCase()];
      const mapped = departments.find((d) => d.id === targetId);
      if (mapped) {
        return { id: mapped.id, name: mapped.name, code: mapped.code };
      }
    }

    // 4. Match by Department Name substrings
    const nameToMatch = cleanName || cleanId;
    if (nameToMatch) {
      const lower = nameToMatch.toLowerCase();
      // Exact name
      const exact = departments.find((d) => d.name.toLowerCase() === lower);
      if (exact) {
        return { id: exact.id, name: exact.name, code: exact.code };
      }

      // Keyword heuristics
      let keywordId: string | null = null;
      if (lower.includes('cardio')) keywordId = 'DEP-03';
      else if (lower.includes('emerg') || lower.includes('trauma')) keywordId = 'DEP-07';
      else if (lower.includes('internal') || lower.includes('medicine')) keywordId = 'DEP-01';
      else if (lower.includes('radio') || lower.includes('imaging')) keywordId = 'DEP-05';
      else if (lower.includes('patho') || lower.includes('lab')) keywordId = 'DEP-06';
      else if (lower.includes('surg') || lower.includes('ot complex')) keywordId = 'DEP-02';
      else if (lower.includes('pediat') || lower.includes('neonat') || lower.includes('nicu')) keywordId = 'DEP-04';
      else if (lower.includes('admin')) keywordId = 'DEP-09';
      else if (lower.includes('ortho')) keywordId = 'DEP-10';
      else if (lower.includes('gyn') || lower.includes('obstet')) keywordId = 'DEP-11';
      else if (lower.includes('eye') || lower.includes('ophth')) keywordId = 'DEP-12';
      else if (lower.includes('pharm')) keywordId = 'DEP-08';

      if (keywordId) {
        const dept = departments.find((d) => d.id === keywordId);
        if (dept) {
          return { id: dept.id, name: dept.name, code: dept.code };
        }
      }
    }

    // 5. Fallback
    const firstActive = departments.find((d) => d.status === 'Active') || departments[0];
    return {
      id: cleanId || firstActive?.id || 'DEP-01',
      name: cleanName || firstActive?.name || 'General Medicine',
      code: firstActive?.code || 'DEP-MED',
    };
  }

  /**
   * Save departments to local storage
   */
  static saveDepartmentsToStorage(departments: Department[]): void {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(departments));
    } catch (e) {
      console.warn('Failed to save departments to localStorage', e);
    }
  }

  /**
   * Retrieve departments - accepts optional array and filter parameters
   */
  static getDepartments(
    allDepartments?: Department[],
    filters?: DepartmentFilterState
  ): Department[] {
    const list =
      allDepartments && allDepartments.length > 0
        ? allDepartments
        : DepartmentService.loadDepartmentsFromStorage(INITIAL_DEPARTMENTS);

    if (!filters) {
      return list;
    }

    return list.filter((dept) => {
      // 1. Search term across Department Code, Department Name, Head / In-charge
      if (filters.searchTerm?.trim()) {
        const query = filters.searchTerm.toLowerCase().trim();
        const matchCode = dept.code.toLowerCase().includes(query);
        const matchName = dept.name.toLowerCase().includes(query);
        const matchHead = dept.headName.toLowerCase().includes(query);
        if (!matchCode && !matchName && !matchHead) {
          return false;
        }
      }

      // 2. Department Type filter
      if (filters.type && filters.type !== 'All') {
        if (dept.type !== filters.type) {
          return false;
        }
      }

      // 3. Status filter
      if (filters.status && filters.status !== 'All') {
        if (dept.status !== filters.status) {
          return false;
        }
      }

      // 4. Operational Capability filter
      if (filters.capability && filters.capability !== 'All') {
        switch (filters.capability) {
          case 'OPD':
            if (!dept.opdEnabled) return false;
            break;
          case 'Observation':
            if (!dept.observationEnabled) return false;
            break;
          case 'Emergency':
            if (!dept.emergencyEnabled) return false;
            break;
          case 'Admission':
            if (!dept.admissionEnabled) return false;
            break;
          case 'Pharmacy Related':
            if (!dept.pharmacyRelated) return false;
            break;
          case 'None':
            if (
              dept.opdEnabled ||
              dept.observationEnabled ||
              dept.emergencyEnabled ||
              dept.admissionEnabled ||
              dept.pharmacyRelated
            ) {
              return false;
            }
            break;
        }
      }

      return true;
    });
  }

  /**
   * Retrieve department by ID - accepts (departments, id) or just (id)
   */
  static getDepartmentById(
    allDepartmentsOrId: Department[] | string,
    idOrUndefined?: string
  ): Department | undefined {
    let list: Department[];
    let targetId: string;

    if (typeof allDepartmentsOrId === 'string') {
      targetId = allDepartmentsOrId;
      list = DepartmentService.loadDepartmentsFromStorage(INITIAL_DEPARTMENTS);
    } else {
      list = allDepartmentsOrId;
      targetId = idOrUndefined || '';
    }

    return list.find((d) => d.id === targetId || d.code === targetId);
  }

  /**
   * Future API endpoint: POST /departments
   */
  static async createDepartment(
    payload: DepartmentFormValues,
    currentUser: User | null,
    existingDepartments: Department[]
  ): Promise<Department> {
    const formattedCode = payload.code.trim().toUpperCase();

    // Check duplicate code
    const isDuplicate = existingDepartments.some(
      (d) => d.code.toUpperCase() === formattedCode
    );
    if (isDuplicate) {
      throw new Error(`Department Code "${formattedCode}" already exists. Department code must be unique.`);
    }

    const timestamp = formatAuditTimestamp();
    const actor = formatAuditUser(currentUser);

    const newDept: Department = {
      id: `DEP-${Date.now().toString().slice(-4)}`,
      code: formattedCode,
      name: payload.name.trim(),
      type: payload.type,
      description: payload.description.trim(),
      headUserId: payload.headUserId,
      headName: payload.headName || 'Not Assigned',
      contactExtension: payload.contactExtension.trim() || '—',
      location: payload.location.trim() || '—',
      opdEnabled: payload.opdEnabled,
      observationEnabled: payload.observationEnabled,
      emergencyEnabled: payload.emergencyEnabled,
      admissionEnabled: payload.admissionEnabled,
      pharmacyRelated: payload.pharmacyRelated,
      doctorCount: 0,
      staffCount: 0,
      serviceCount: 0,
      wardCount: 0,
      status: payload.status,
      createdBy: actor,
      createdAt: timestamp,
      updatedBy: actor,
      updatedAt: timestamp,
      statusChangedBy: actor,
      statusChangedAt: timestamp,
    };

    return newDept;
  }

  /**
   * Future API endpoint: PATCH /departments/:id
   */
  static async updateDepartment(
    id: string,
    payload: DepartmentFormValues,
    currentUser: User | null,
    existingDepartments: Department[]
  ): Promise<Department> {
    const target = existingDepartments.find((d) => d.id === id);
    if (!target) {
      throw new Error(`Department with ID ${id} not found.`);
    }

    const formattedCode = payload.code.trim().toUpperCase();
    // Verify duplicate code if code was changed
    if (formattedCode !== target.code.toUpperCase()) {
      const isDuplicate = existingDepartments.some(
        (d) => d.id !== id && d.code.toUpperCase() === formattedCode
      );
      if (isDuplicate) {
        throw new Error(`Department Code "${formattedCode}" is already taken by another department.`);
      }
    }

    const timestamp = formatAuditTimestamp();
    const actor = formatAuditUser(currentUser);

    const updated: Department = {
      ...target,
      code: formattedCode,
      name: payload.name.trim(),
      type: payload.type,
      description: payload.description.trim(),
      headUserId: payload.headUserId,
      headName: payload.headName || 'Not Assigned',
      contactExtension: payload.contactExtension.trim() || '—',
      location: payload.location.trim() || '—',
      opdEnabled: payload.opdEnabled,
      observationEnabled: payload.observationEnabled,
      emergencyEnabled: payload.emergencyEnabled,
      admissionEnabled: payload.admissionEnabled,
      pharmacyRelated: payload.pharmacyRelated,
      status: payload.status,
      updatedBy: actor,
      updatedAt: timestamp,
    };

    if (payload.status !== target.status) {
      updated.statusChangedBy = actor;
      updated.statusChangedAt = timestamp;
    }

    return updated;
  }

  /**
   * Future API endpoint: PATCH /departments/:id/status
   */
  static async updateDepartmentStatus(
    id: string,
    newStatus: 'Active' | 'Inactive',
    currentUser: User | null,
    existingDepartments: Department[]
  ): Promise<Department> {
    const target = existingDepartments.find((d) => d.id === id);
    if (!target) {
      throw new Error(`Department with ID ${id} not found.`);
    }

    const timestamp = formatAuditTimestamp();
    const actor = formatAuditUser(currentUser);

    const updated: Department = {
      ...target,
      status: newStatus,
      updatedBy: actor,
      updatedAt: timestamp,
      statusChangedBy: actor,
      statusChangedAt: timestamp,
    };

    return updated;
  }

  /**
   * Future API endpoint: DELETE /departments/:id
   * Block delete if department has linked records (doctors, staff, services, wards > 0)
   */
  static async deleteDepartment(id: string, existingDepartments: Department[]): Promise<void> {
    const target = existingDepartments.find((d) => d.id === id);
    if (!target) {
      throw new Error(`Department with ID ${id} not found.`);
    }

    if (
      target.doctorCount > 0 ||
      target.staffCount > 0 ||
      target.serviceCount > 0 ||
      target.wardCount > 0
    ) {
      throw new Error(
        'This department is linked to hospital records and cannot be deleted. Deactivate it instead.'
      );
    }
  }

  /**
   * Future API endpoint: POST /departments/import
   * Validate uploaded Excel / CSV rows against schema and existing data
   */
  static validateImportRows(
    rows: DepartmentImportRow[],
    existingDepartments: Department[],
    headOptions: DepartmentHeadOption[]
  ): DepartmentImportValidationResult[] {
    const existingCodes = new Set(existingDepartments.map((d) => d.code.toUpperCase()));
    const seenFileCodes = new Set<string>();

    return rows.map((row, idx) => {
      const rowNumber = idx + 2; // Row 1 is header
      const rawCode = (row.department_code || '').trim().toUpperCase();
      const rawName = (row.department_name || '').trim();
      const rawType = (row.department_type || '').trim();
      const rawHead = (row.head_identifier || '').trim();
      const rawStatus = (row.status || 'Active').trim();

      // 1. Missing Department Code
      if (!rawCode) {
        return {
          rowNumber,
          data: row,
          status: 'Invalid',
          errorMessage: 'Missing required Department Code',
        };
      }

      // Department Code format validation
      const codeRegex = /^[A-Z0-9-]+$/;
      if (!codeRegex.test(rawCode)) {
        return {
          rowNumber,
          data: row,
          status: 'Invalid',
          errorMessage: 'Department Code must contain uppercase letters, numbers, and hyphens only',
        };
      }

      // 2. Duplicate Department Code (either in existing registry or in this batch)
      if (existingCodes.has(rawCode) || seenFileCodes.has(rawCode)) {
        return {
          rowNumber,
          data: row,
          status: 'Duplicate',
          errorMessage: `Duplicate code "${rawCode}" already registered in hospital system`,
        };
      }
      seenFileCodes.add(rawCode);

      // 3. Missing Department Name
      if (!rawName) {
        return {
          rowNumber,
          data: row,
          status: 'Invalid',
          errorMessage: 'Missing required Department Name',
        };
      }

      // 4. Invalid Department Type
      const matchedType = VALID_DEPARTMENT_TYPES.find(
        (t) => t.toLowerCase() === rawType.toLowerCase()
      );
      if (!matchedType) {
        return {
          rowNumber,
          data: row,
          status: 'Invalid',
          errorMessage: `Invalid Department Type "${rawType}". Allowed: ${VALID_DEPARTMENT_TYPES.join(', ')}`,
        };
      }

      // 5. Invalid Status
      const normalizedStatus =
        rawStatus.toLowerCase() === 'inactive' ? 'Inactive' : 'Active';

      // 6. Unknown head identifier (if provided)
      let resolvedHeadUserId = '';
      let resolvedHeadName = 'Not Assigned';
      if (rawHead && rawHead.toLowerCase() !== 'not assigned' && rawHead !== '—') {
        const foundHead = headOptions.find(
          (h) =>
            h.userId.toLowerCase() === rawHead.toLowerCase() ||
            h.name.toLowerCase() === rawHead.toLowerCase()
        );
        if (!foundHead) {
          return {
            rowNumber,
            data: row,
            status: 'Invalid',
            errorMessage: `Unknown Head / In-charge identifier "${rawHead}"`,
          };
        }
        resolvedHeadUserId = foundHead.userId;
        resolvedHeadName = foundHead.name;
      }

      // 7. Parse booleans
      const parseBool = (val: any): boolean => {
        if (typeof val === 'boolean') return val;
        if (typeof val === 'string') {
          const lower = val.trim().toLowerCase();
          return lower === 'true' || lower === '1' || lower === 'yes';
        }
        return false;
      };

      const convertedDept: Department = {
        id: `DEP-IMP-${Date.now().toString().slice(-4)}-${idx}`,
        code: rawCode,
        name: rawName,
        type: matchedType,
        description: (row.description || '').trim(),
        headUserId: resolvedHeadUserId,
        headName: resolvedHeadName,
        contactExtension: (row.contact_extension || '—').trim(),
        location: (row.location || '—').trim(),
        opdEnabled: parseBool(row.opd_enabled),
        observationEnabled: parseBool(row.observation_enabled),
        emergencyEnabled: parseBool(row.emergency_enabled),
        admissionEnabled: parseBool(row.admission_enabled),
        pharmacyRelated: parseBool(row.pharmacy_related),
        doctorCount: 0,
        staffCount: 0,
        serviceCount: 0,
        wardCount: 0,
        status: normalizedStatus,
        createdBy: 'Excel Batch Import',
        createdAt: formatAuditTimestamp(),
        updatedBy: 'Excel Batch Import',
        updatedAt: formatAuditTimestamp(),
        statusChangedBy: 'Excel Batch Import',
        statusChangedAt: formatAuditTimestamp(),
      };

      return {
        rowNumber,
        data: row,
        status: 'Valid',
        convertedDepartment: convertedDept,
      };
    });
  }

  /**
   * Helper to trigger download of sample CSV template
   */
  static downloadTemplate(): void {
    const headers = [
      'department_code',
      'department_name',
      'department_type',
      'description',
      'head_identifier',
      'contact_extension',
      'location',
      'opd_enabled',
      'observation_enabled',
      'emergency_enabled',
      'admission_enabled',
      'pharmacy_related',
      'status',
    ].join(',');

    const sampleRow1 = [
      'DEP-ENT',
      'Otolaryngology (ENT)',
      'Surgical',
      'Ear Nose and Throat clinic and audiology',
      'DOC-008',
      'Ext. 314',
      'Third Floor Block B',
      'TRUE',
      'FALSE',
      'FALSE',
      'TRUE',
      'FALSE',
      'Active',
    ].join(',');

    const sampleRow2 = [
      'DEP-DERM',
      'Dermatology',
      'Clinical',
      'Skin disease outpatient care',
      'DOC-004',
      'Ext. 318',
      'Third Floor Block A',
      'TRUE',
      'FALSE',
      'FALSE',
      'FALSE',
      'FALSE',
      'Active',
    ].join(',');

    const csvContent = `${headers}\n${sampleRow1}\n${sampleRow2}\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'CHSS_Department_Import_Template.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  /**
   * Export CSV utility respecting active filters
   */
  static exportToCSV(
    departments: Department[],
    filename = 'CHSS_Department_Directory.csv'
  ): void {
    const headers = [
      'Department Code',
      'Department Name',
      'Department Type',
      'Head / In-charge',
      'Location / Floor',
      'Contact Extension',
      'OPD Enabled',
      'Observation Enabled',
      'Emergency Enabled',
      'Admission Enabled',
      'Pharmacy Related',
      'Doctors Count',
      'Staff Count',
      'Services Count',
      'Wards Count',
      'Status',
      'Updated By',
      'Updated Date',
    ].join(',');

    const rows = departments.map((d) => {
      const escape = (str: string) => `"${(str || '').replace(/"/g, '""')}"`;
      return [
        escape(d.code),
        escape(d.name),
        escape(d.type),
        escape(d.headName),
        escape(d.location),
        escape(d.contactExtension),
        d.opdEnabled ? 'YES' : 'NO',
        d.observationEnabled ? 'YES' : 'NO',
        d.emergencyEnabled ? 'YES' : 'NO',
        d.admissionEnabled ? 'YES' : 'NO',
        d.pharmacyRelated ? 'YES' : 'NO',
        d.doctorCount,
        d.staffCount,
        d.serviceCount,
        d.wardCount,
        escape(d.status),
        escape(d.updatedBy),
        escape(d.updatedAt),
      ].join(',');
    });

    const csvContent = `${headers}\n${rows.join('\n')}\n`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
