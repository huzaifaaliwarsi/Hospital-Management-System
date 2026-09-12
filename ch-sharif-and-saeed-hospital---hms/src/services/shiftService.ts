import { Shift, ShiftFilterState, ShiftFormData, ShiftKPIs, ShiftType } from '../types/shift';
import { User } from '../types';
import { DepartmentService } from './departmentService';
import { formatDisplayDate } from '../utils/dateConstants';

export const SHIFT_STORAGE_KEY = 'css_hms_shifts_dataset_v1';

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
 * Format 24-hour HH:mm string to 12-hour AM/PM format (e.g., "08:00" -> "08:00 AM", "20:30" -> "08:30 PM")
 */
export function format12HourTime(time24: string): string {
  if (!time24 || !time24.includes(':')) return time24 || '—';
  const [hStr, mStr] = time24.split(':');
  const h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return time24;

  const period = h >= 12 ? 'PM' : 'AM';
  const displayH = h % 12 === 0 ? 12 : h % 12;
  const padH = String(displayH).padStart(2, '0');
  const padM = String(m).padStart(2, '0');
  return `${padH}:${padM} ${period}`;
}

/**
 * Format minutes into readable hour and minute string (e.g., 480 -> "8h 00m", 450 -> "7h 30m")
 */
export function formatMinutesToHours(minutes: number): string {
  if (isNaN(minutes) || minutes < 0) return '0h 00m';
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${String(mins).padStart(2, '0')}m`;
}

/**
 * Format minutes into decimal hours (e.g., 480 -> "8.0 hrs", 450 -> "7.5 hrs")
 */
export function formatMinutesToDecimalHours(minutes: number): string {
  if (isNaN(minutes) || minutes < 0) return '0 hrs';
  const hrs = (minutes / 60).toFixed(1);
  return `${hrs.replace(/\.0$/, '')} hrs`;
}

export interface ShiftTimingCalculation {
  valid: boolean;
  error?: string;
  isOvernight: boolean;
  grossDurationMinutes: number;
  breakMinutes: number;
  netWorkingMinutes: number;
}

const TIME_FORMAT_REGEX = /^([01]\d|2[0-3]):[0-5]\d$/;

/**
 * Mathematical calculation of shift duration, overnight derivation, and net working minutes
 */
export function calculateShiftTiming(
  startTime: string,
  endTime: string,
  breakMinutes: number = 0
): ShiftTimingCalculation {
  if (!startTime || !endTime) {
    return {
      valid: false,
      error: 'Start time and end time are required.',
      isOvernight: false,
      grossDurationMinutes: 0,
      breakMinutes: breakMinutes ?? 0,
      netWorkingMinutes: 0,
    };
  }

  // Strict HH:mm validation: 00 through 23 hours, 00 through 59 minutes
  if (!TIME_FORMAT_REGEX.test(startTime) || !TIME_FORMAT_REGEX.test(endTime)) {
    return {
      valid: false,
      error: 'Invalid time format. Please provide valid HH:mm times (00:00 to 23:59).',
      isOvernight: false,
      grossDurationMinutes: 0,
      breakMinutes: breakMinutes ?? 0,
      netWorkingMinutes: 0,
    };
  }

  // Negative break duration is strictly prohibited (0 is valid)
  if (breakMinutes < 0) {
    return {
      valid: false,
      error: 'Break duration cannot be negative.',
      isOvernight: false,
      grossDurationMinutes: 0,
      breakMinutes,
      netWorkingMinutes: 0,
    };
  }

  const [startH, startM] = startTime.split(':').map((v) => parseInt(v, 10));
  const [endH, endM] = endTime.split(':').map((v) => parseInt(v, 10));

  const startTotal = startH * 60 + startM;
  const endTotal = endH * 60 + endM;

  if (startTotal === endTotal) {
    return {
      valid: false,
      error: 'Start Time and End Time cannot be identical. 24-hour single continuous shifts are invalid.',
      isOvernight: false,
      grossDurationMinutes: 0,
      breakMinutes,
      netWorkingMinutes: 0,
    };
  }

  let grossDurationMinutes: number;
  let isOvernight = false;

  if (endTotal > startTotal) {
    grossDurationMinutes = endTotal - startTotal;
    isOvernight = false;
  } else {
    // Crosses midnight
    grossDurationMinutes = 24 * 60 - startTotal + endTotal;
    isOvernight = true;
  }

  const normalizedBreak = isNaN(breakMinutes) ? 0 : breakMinutes;

  if (normalizedBreak >= grossDurationMinutes) {
    return {
      valid: false,
      error: `Break duration (${normalizedBreak} mins) cannot equal or exceed gross shift duration (${grossDurationMinutes} mins).`,
      isOvernight,
      grossDurationMinutes,
      breakMinutes: normalizedBreak,
      netWorkingMinutes: 0,
    };
  }

  const netWorkingMinutes = grossDurationMinutes - normalizedBreak;

  if (netWorkingMinutes <= 0) {
    return {
      valid: false,
      error: 'Net working duration must be greater than zero minutes.',
      isOvernight,
      grossDurationMinutes,
      breakMinutes: normalizedBreak,
      netWorkingMinutes: 0,
    };
  }

  return {
    valid: true,
    isOvernight,
    grossDurationMinutes,
    breakMinutes: normalizedBreak,
    netWorkingMinutes,
  };
}

export class ShiftService {
  /**
   * Load shifts from localStorage. Starts empty by default.
   */
  static loadShifts(): Shift[] {
    try {
      if (typeof window === 'undefined') return [];
      const stored = localStorage.getItem(SHIFT_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          return parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to load shifts from localStorage', e);
    }
    return [];
  }

  /**
   * Persist shifts array to localStorage
   */
  static saveShifts(shifts: Shift[]): void {
    try {
      if (typeof window === 'undefined') return;
      localStorage.setItem(SHIFT_STORAGE_KEY, JSON.stringify(shifts));
    } catch (e) {
      console.warn('Failed to save shifts to localStorage', e);
    }
  }

  /**
   * Query shifts with multi-criteria logical AND filtering
   */
  static getShifts(filters?: ShiftFilterState): Shift[] {
    const list = ShiftService.loadShifts();
    if (!filters) return list;

    return list.filter((shift) => {
      // 1. Search filter: Code, Name, or Department
      if (filters.searchTerm && filters.searchTerm.trim()) {
        const term = filters.searchTerm.trim().toLowerCase();
        const matchesCode = shift.code.toLowerCase().includes(term);
        const matchesName = shift.name.toLowerCase().includes(term);
        const matchesDept = shift.departmentName.toLowerCase().includes(term);
        if (!matchesCode && !matchesName && !matchesDept) {
          return false;
        }
      }

      // 2. Department filter
      if (filters.departmentId && filters.departmentId !== 'ALL') {
        if (shift.departmentId !== filters.departmentId) {
          return false;
        }
      }

      // 3. Shift Type filter
      if (filters.shiftType && filters.shiftType !== 'ALL') {
        if (shift.shiftType !== filters.shiftType) {
          return false;
        }
      }

      // 4. Schedule filter (Day vs Overnight)
      if (filters.schedule && filters.schedule !== 'ALL') {
        if (filters.schedule === 'DAY' && shift.isOvernight) {
          return false;
        }
        if (filters.schedule === 'OVERNIGHT' && !shift.isOvernight) {
          return false;
        }
      }

      // 5. Status filter
      if (filters.status && filters.status !== 'ALL') {
        if (shift.status !== filters.status) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Get single shift by ID
   */
  static getShiftById(id: string): Shift | undefined {
    const list = ShiftService.loadShifts();
    return list.find((s) => s.id === id);
  }

  /**
   * Calculate live KPI metrics across the shift dataset
   */
  static getKPIs(shifts?: Shift[]): ShiftKPIs {
    const dataset = shifts || ShiftService.loadShifts();
    const totalShifts = dataset.length;
    const activeShifts = dataset.filter((s) => s.status === 'ACTIVE').length;
    const overnightShifts = dataset.filter((s) => s.isOvernight).length;

    // Distinct department IDs covered
    const departmentIds = new Set(dataset.map((s) => s.departmentId).filter(Boolean));
    const departmentsCovered = departmentIds.size;

    return {
      totalShifts,
      activeShifts,
      overnightShifts,
      departmentsCovered,
    };
  }

  /**
   * Validate shift form data against business rules
   */
  static validateShift(
    data: ShiftFormData,
    existingShiftId?: string
  ): { valid: boolean; errors: Record<string, string> } {
    const errors: Record<string, string> = {};
    const shifts = ShiftService.loadShifts();

    // 1. Shift Code
    const cleanCode = (data.code || '').trim().toUpperCase();
    if (!cleanCode) {
      errors.code = 'Shift Code is required.';
    } else {
      const codeExists = shifts.some(
        (s) => s.code.toUpperCase() === cleanCode && s.id !== existingShiftId
      );
      if (codeExists) {
        errors.code = `Shift Code "${cleanCode}" already exists. Shift codes must be globally unique.`;
      }
    }

    // 2. Shift Name
    const cleanName = (data.name || '').trim();
    if (!cleanName) {
      errors.name = 'Shift Name is required.';
    }

    // 3. Canonical Department
    if (!data.departmentId) {
      errors.departmentId = 'Department selection is required.';
    } else {
      const departments = DepartmentService.getDepartments();
      const matchedDept = departments.find((d) => d.id === data.departmentId);
      if (!matchedDept) {
        errors.departmentId = 'Selected department is invalid or does not exist.';
      } else if (!existingShiftId && matchedDept.status !== 'Active') {
        // Only active departments may be selected for new shift
        errors.departmentId = `Department "${matchedDept.name}" is Inactive. Only Active departments may be assigned for new shifts.`;
      }
    }

    // 4. Shift Type
    const validTypes: ShiftType[] = ['MORNING', 'EVENING', 'NIGHT', 'CUSTOM'];
    if (!data.shiftType || !validTypes.includes(data.shiftType)) {
      errors.shiftType = 'Valid Shift Type is required (Morning, Evening, Night, or Custom).';
    }

    // 5. Timing & Duration Calculation
    const timingCalc = calculateShiftTiming(
      data.startTime,
      data.endTime,
      data.breakMinutes
    );

    if (!timingCalc.valid) {
      if (timingCalc.error?.includes('Break duration')) {
        errors.breakMinutes = timingCalc.error;
      } else {
        errors.time = timingCalc.error || 'Invalid shift timing.';
      }
    }

    // 6. Name duplicate in same department with identical timing & type
    if (cleanName && data.departmentId && timingCalc.valid) {
      const duplicateFound = shifts.some(
        (s) =>
          s.id !== existingShiftId &&
          s.departmentId === data.departmentId &&
          s.name.toLowerCase() === cleanName.toLowerCase() &&
          s.shiftType === data.shiftType &&
          s.startTime === data.startTime &&
          s.endTime === data.endTime
      );
      if (duplicateFound) {
        errors.name = `A shift named "${cleanName}" with identical type and timing already exists in this department.`;
      }
    }

    // 7. Arrival Grace & Early Exit Tolerance
    if (data.defaultArrivalGraceMinutes < 0) {
      errors.defaultArrivalGraceMinutes = 'Arrival grace cannot be negative.';
    }
    if (data.defaultEarlyExitToleranceMinutes < 0) {
      errors.defaultEarlyExitToleranceMinutes = 'Early exit tolerance cannot be negative.';
    }

    return {
      valid: Object.keys(errors).length === 0,
      errors,
    };
  }

  /**
   * Create a new shift record. Strictly enforces human accountability via currentUser.
   */
  static createShift(data: ShiftFormData, currentUser: User | null): Shift {
    if (!currentUser || !currentUser.id || !currentUser.name) {
      throw new Error('Authenticated management user required.');
    }

    const validation = ShiftService.validateShift(data);
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      throw new Error(firstError || 'Validation failed for shift creation.');
    }

    const departments = DepartmentService.getDepartments();
    const dept = departments.find((d) => d.id === data.departmentId);
    const departmentName = dept ? dept.name : 'Unknown Department';

    const timingCalc = calculateShiftTiming(
      data.startTime,
      data.endTime,
      data.breakMinutes
    );

    const now = formatAuditTimestamp();
    const id = `SHF-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

    const newShift: Shift = {
      id,
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      departmentId: data.departmentId,
      departmentName,
      shiftType: data.shiftType,
      startTime: data.startTime,
      endTime: data.endTime,
      isOvernight: timingCalc.isOvernight,
      grossDurationMinutes: timingCalc.grossDurationMinutes,
      breakMinutes: timingCalc.breakMinutes,
      netWorkingMinutes: timingCalc.netWorkingMinutes,
      defaultArrivalGraceMinutes: Math.max(0, data.defaultArrivalGraceMinutes || 0),
      defaultEarlyExitToleranceMinutes: Math.max(0, data.defaultEarlyExitToleranceMinutes || 0),
      defaultWeeklyOffDays: data.defaultWeeklyOffDays || [],
      status: data.status || 'ACTIVE',
      notes: data.notes?.trim() || '',

      createdByUserId: currentUser.id,
      createdByName: currentUser.name,
      createdByRole: currentUser.role,
      createdAt: now,

      updatedByUserId: currentUser.id,
      updatedByName: currentUser.name,
      updatedByRole: currentUser.role,
      updatedAt: now,
    };

    const shifts = ShiftService.loadShifts();
    shifts.unshift(newShift);
    ShiftService.saveShifts(shifts);

    return newShift;
  }

  /**
   * Update an existing shift record. Strictly enforces human accountability.
   */
  static updateShift(
    id: string,
    data: ShiftFormData,
    currentUser: User | null
  ): Shift {
    if (!currentUser || !currentUser.id || !currentUser.name) {
      throw new Error('Authenticated management user required.');
    }

    const shifts = ShiftService.loadShifts();
    const existingIndex = shifts.findIndex((s) => s.id === id);
    if (existingIndex === -1) {
      throw new Error(`Shift record with ID "${id}" was not found.`);
    }

    const validation = ShiftService.validateShift(data, id);
    if (!validation.valid) {
      const firstError = Object.values(validation.errors)[0];
      throw new Error(firstError || 'Validation failed for shift update.');
    }

    const existing = shifts[existingIndex];
    const departments = DepartmentService.getDepartments();
    const dept = departments.find((d) => d.id === data.departmentId);
    // If department exists, update name; otherwise preserve historical departmentName
    const departmentName = dept ? dept.name : existing.departmentName;

    const timingCalc = calculateShiftTiming(
      data.startTime,
      data.endTime,
      data.breakMinutes
    );

    const now = formatAuditTimestamp();
    const statusChanged = data.status !== existing.status;

    const updatedShift: Shift = {
      ...existing,
      code: data.code.trim().toUpperCase(),
      name: data.name.trim(),
      departmentId: data.departmentId,
      departmentName,
      shiftType: data.shiftType,
      startTime: data.startTime,
      endTime: data.endTime,
      isOvernight: timingCalc.isOvernight,
      grossDurationMinutes: timingCalc.grossDurationMinutes,
      breakMinutes: timingCalc.breakMinutes,
      netWorkingMinutes: timingCalc.netWorkingMinutes,
      defaultArrivalGraceMinutes: Math.max(0, data.defaultArrivalGraceMinutes || 0),
      defaultEarlyExitToleranceMinutes: Math.max(0, data.defaultEarlyExitToleranceMinutes || 0),
      defaultWeeklyOffDays: data.defaultWeeklyOffDays || [],
      status: data.status,
      notes: data.notes?.trim() || '',

      updatedByUserId: currentUser.id,
      updatedByName: currentUser.name,
      updatedByRole: currentUser.role,
      updatedAt: now,

      ...(statusChanged
        ? {
            statusChangedByUserId: currentUser.id,
            statusChangedByName: currentUser.name,
            statusChangedAt: now,
          }
        : {}),
    };

    shifts[existingIndex] = updatedShift;
    ShiftService.saveShifts(shifts);

    return updatedShift;
  }

  /**
   * Toggle shift status between ACTIVE and INACTIVE (No hard delete).
   */
  static toggleShiftStatus(id: string, currentUser: User | null): Shift {
    if (!currentUser || !currentUser.id || !currentUser.name) {
      throw new Error('Authenticated management user required.');
    }

    const shifts = ShiftService.loadShifts();
    const existingIndex = shifts.findIndex((s) => s.id === id);
    if (existingIndex === -1) {
      throw new Error(`Shift record with ID "${id}" was not found.`);
    }

    const existing = shifts[existingIndex];
    const newStatus = existing.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    const now = formatAuditTimestamp();

    const updatedShift: Shift = {
      ...existing,
      status: newStatus,
      updatedByUserId: currentUser.id,
      updatedByName: currentUser.name,
      updatedByRole: currentUser.role,
      updatedAt: now,
      statusChangedByUserId: currentUser.id,
      statusChangedByName: currentUser.name,
      statusChangedAt: now,
    };

    shifts[existingIndex] = updatedShift;
    ShiftService.saveShifts(shifts);

    return updatedShift;
  }
}
