export type ShiftType = 'MORNING' | 'EVENING' | 'NIGHT' | 'CUSTOM';

export type ShiftStatus = 'ACTIVE' | 'INACTIVE';

export type Weekday =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export const WEEKDAYS: Weekday[] = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export interface Shift {
  id: string;
  code: string;
  name: string;

  departmentId: string;
  departmentName: string;

  shiftType: ShiftType;
  // MORNING | EVENING | NIGHT | CUSTOM

  startTime: string;
  // HH:mm

  endTime: string;
  // HH:mm

  isOvernight: boolean;
  // derived / stored safely

  grossDurationMinutes: number;
  breakMinutes: number;
  netWorkingMinutes: number;

  defaultArrivalGraceMinutes: number;
  defaultEarlyExitToleranceMinutes: number;

  defaultWeeklyOffDays: Weekday[];
  // optional array of weekdays

  status: ShiftStatus;
  // ACTIVE | INACTIVE

  notes?: string;

  createdByUserId: string;
  createdByName: string;
  createdByRole: string;
  createdAt: string;

  updatedByUserId: string;
  updatedByName: string;
  updatedByRole: string;
  updatedAt: string;

  statusChangedByUserId?: string;
  statusChangedByName?: string;
  statusChangedAt?: string;
}

export interface ShiftFilterState {
  searchTerm: string;
  departmentId: string; // 'ALL' or departmentId
  shiftType: 'ALL' | ShiftType;
  schedule: 'ALL' | 'DAY' | 'OVERNIGHT';
  status: 'ALL' | ShiftStatus;
}

export interface ShiftFormData {
  code: string;
  name: string;
  departmentId: string;
  shiftType: ShiftType;
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  breakMinutes: number;
  defaultArrivalGraceMinutes: number;
  defaultEarlyExitToleranceMinutes: number;
  defaultWeeklyOffDays: Weekday[];
  status: ShiftStatus;
  notes: string;
}

export interface ShiftKPIs {
  totalShifts: number;
  activeShifts: number;
  overnightShifts: number;
  departmentsCovered: number;
}
