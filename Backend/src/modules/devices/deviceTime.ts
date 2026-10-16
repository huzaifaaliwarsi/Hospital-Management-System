import { ValidationError } from '@/shared/errors/AppError';

export function localParts(at: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: timezone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).formatToParts(at);
  const get = (name: string) => parts.find(p => p.type === name)!.value;
  return { date: `${get('year')}-${get('month')}-${get('day')}`, time: `${get('hour')}:${get('minute')}:${get('second')}`, minutes: Number(get('hour')) * 60 + Number(get('minute')) };
}

export function dateOffset(date: string, days: number) {
  return new Date(Date.parse(date + 'T00:00:00Z') + days * 86400000).toISOString().slice(0, 10);
}

/** Offset-free device timestamps are local device time, never server time. */
export function parseDeviceTime(value: string, timezone: string): Date {
  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) {
    const at = new Date(value);
    const calendar = new Date(value.slice(0, 10) + 'T00:00:00Z');
    if (!Number.isNaN(at.getTime()) && !Number.isNaN(calendar.getTime()) && calendar.toISOString().slice(0, 10) === value.slice(0, 10)) return at;
  }
  const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/.exec(value);
  if (!match) throw new ValidationError('Punch time must be ISO with offset or YYYY-MM-DD HH:mm:ss');
  const wall = Date.parse(match[1] + 'T' + match[2] + 'Z');
  if (!Number.isFinite(wall)) throw new ValidationError('Invalid punch timestamp');
  let result = wall;
  for (let i = 0; i < 3; i++) {
    const p = localParts(new Date(result), timezone);
    result += wall - Date.parse(p.date + 'T' + p.time + 'Z');
  }
  const parsed = new Date(result);
  const check = localParts(parsed, timezone);
  if (check.date !== match[1] || check.time !== match[2]) throw new ValidationError('Invalid local punch date/time');
  return parsed;
}

type StaffSchedule = {
  assignedShift?: { name: string; startTime: string; endTime: string; defaultArrivalGraceMinutes: number; defaultEarlyExitToleranceMinutes: number; defaultWeeklyOffDays?: string[]; isActive?: boolean } | null;
  weeklySchedule: { dayOfWeek: string; isWorking: boolean; useShiftDefault: boolean; startTime: string | null; endTime: string | null; effectiveFrom?: Date }[];
};
export function shiftForDate(staff: StaffSchedule, date: string, timezone: string) {
  const weekday = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][new Date(date + 'T00:00:00Z').getUTCDay()];
  const day = staff.weeklySchedule.find(d => d.dayOfWeek === weekday && (!d.effectiveFrom || d.effectiveFrom <= new Date(date + 'T00:00:00Z')));
  if ((day && !day.isWorking) || (!day && staff.assignedShift?.defaultWeeklyOffDays?.includes(weekday!))) return null;
  if (staff.assignedShift?.isActive === false) throw new ValidationError('Assigned shift is inactive');
  const start = (!day?.useShiftDefault && day?.startTime) || staff.assignedShift?.startTime;
  const end = (!day?.useShiftDefault && day?.endTime) || staff.assignedShift?.endTime;
  if (!start || !end) throw new ValidationError('Assign a shift or weekly duty times before processing biometric attendance');
  const overnight = end <= start;
  return {
    start: parseDeviceTime(date + ' ' + start + ':00', timezone),
    end: parseDeviceTime(dateOffset(date, overnight ? 1 : 0) + ' ' + end + ':00', timezone),
    overnight, name: staff.assignedShift?.name ?? 'Weekly duty schedule',
    grace: staff.assignedShift?.defaultArrivalGraceMinutes ?? 0,
    tolerance: staff.assignedShift?.defaultEarlyExitToleranceMinutes ?? 0,
  };
}

/** Split adjacent overnight shifts halfway between prior end and next start. */
export function attendanceDay(at: Date, staff: StaffSchedule, timezone: string) {
  const today = localParts(at, timezone).date;
  const previousDate = dateOffset(today, -1);
  let previous: ReturnType<typeof shiftForDate> = null;
  try { previous = shiftForDate(staff, previousDate, timezone); } catch { /* No previous duty window; validate today's window below. */ }
  if (previous?.overnight) {
    let current: ReturnType<typeof shiftForDate> = null;
    try { current = shiftForDate(staff, today, timezone); } catch { /* Previous overnight checkout can arrive on a day without a shift. */ }
    const cutoff = current ? (previous.end.getTime() + current.start.getTime()) / 2 : previous.end.getTime() + 4 * 3600000;
    if (at.getTime() < cutoff) return previousDate;
  }
  return today;
}

