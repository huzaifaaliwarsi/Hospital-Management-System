/**
 * Dynamic frontend date source for hospital operations and administrative context.
 * Uses the browser/system local date as the frontend source of truth,
 * with architecture prepared for hospital-configured timezone from backend in future.
 */

export interface HospitalDateContext {
  timezone?: string; // Prepared for future backend setting e.g. 'Asia/Karachi'
}

/**
 * Get the current operational Date object (local system date).
 */
export const getHospitalCurrentDate = (_context?: HospitalDateContext): Date => {
  return new Date();
};

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export const formatDisplayDate = (d: Date = new Date()): string => {
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${day} ${month} ${year}`;
};

export const formatHeaderDate = (d: Date = new Date()): string => {
  const dayName = DAY_NAMES[d.getDay()];
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTH_NAMES[d.getMonth()];
  const year = d.getFullYear();
  return `${dayName}, ${day} ${month} ${year}`;
};

export const formatDateISO = (d: Date = new Date()): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const getYesterdayDate = (d: Date = new Date()): Date => {
  const y = new Date(d);
  y.setDate(y.getDate() - 1);
  return y;
};

export const getStartOfWeek = (d: Date = new Date()): Date => {
  const date = new Date(d);
  const day = date.getDay();
  // Monday as start of week (day 1); if Sunday (day 0), diff is -6
  const diff = (day === 0 ? -6 : 1) - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const getEndOfWeek = (d: Date = new Date()): Date => {
  const start = getStartOfWeek(d);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return end;
};

export const getStartOfMonth = (d: Date = new Date()): Date => {
  return new Date(d.getFullYear(), d.getMonth(), 1);
};

export const getEndOfMonth = (d: Date = new Date()): Date => {
  return new Date(d.getFullYear(), d.getMonth() + 1, 0);
};

/**
 * Returns dynamic period label for dashboard filters based on actual local date.
 */
export const getDynamicPeriodLabel = (
  preset: 'today' | 'yesterday' | 'this_week' | 'this_month' | 'custom',
  customFrom?: string,
  customTo?: string
): string => {
  const now = getHospitalCurrentDate();
  if (preset === 'today') {
    return `Today (${formatDisplayDate(now)})`;
  }
  if (preset === 'yesterday') {
    const yesterday = getYesterdayDate(now);
    return `Yesterday (${formatDisplayDate(yesterday)})`;
  }
  if (preset === 'this_week') {
    const start = getStartOfWeek(now);
    return `This Week (${formatDisplayDate(start)} - ${formatDisplayDate(now)})`;
  }
  if (preset === 'this_month') {
    const start = getStartOfMonth(now);
    const end = getEndOfMonth(now);
    return `This Month (${formatDisplayDate(start)} - ${formatDisplayDate(end)})`;
  }
  if (customFrom && customTo) {
    return `Custom Range (${customFrom} to ${customTo})`;
  }
  return 'Custom Date Range';
};

// Initialized dynamic constants based on current system local time
export const CURRENT_MOCK_DATE = getHospitalCurrentDate();
export const CURRENT_MOCK_DATE_STR = formatDisplayDate(CURRENT_MOCK_DATE);
export const CURRENT_MOCK_DATE_HEADER = formatHeaderDate(CURRENT_MOCK_DATE);
export const CURRENT_MOCK_DATE_ISO = formatDateISO(CURRENT_MOCK_DATE);
