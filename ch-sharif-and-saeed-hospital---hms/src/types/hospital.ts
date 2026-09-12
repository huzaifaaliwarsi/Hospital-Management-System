export interface DayWorkingHours {
  day: 'Monday' | 'Tuesday' | 'Wednesday' | 'Thursday' | 'Friday' | 'Saturday' | 'Sunday';
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface HospitalProfile {
  id: string;
  name: string;
  shortName: string;
  logo: string | null;
  hospitalType: string;
  registrationNumber: string;
  licenseNumber: string;
  accreditationBody: string;
  accreditationNumber: string;
  status: 'Active' | 'Inactive';

  // Contact
  primaryPhone: string;
  alternatePhone: string;
  emergencyPhone: string;
  primaryEmail: string;
  secondaryEmail: string;
  website: string;

  // Address
  addressLine1: string;
  addressLine2: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;

  // Operations
  currency: string;
  timezone: string;
  weekStartDay: string;
  workingMode: string;
  opdOpenTime: string;
  opdCloseTime: string;
  emergencyEnabled: boolean;
  emergencyMode: '24/7' | 'Custom Hours' | '';
  dateFormat: string;
  timeFormat: string;

  // Working hours
  workingHours: DayWorkingHours[];

  // Billing & Legal
  legalBusinessName: string;
  taxNumber: string;
  salesTaxNumber: string;
  billingAddress: string;
  invoicePhone: string;
  invoiceEmail: string;
  invoicePrefix: string;
  receiptPrefix: string;

  // Audit
  createdAt: string;
  createdBy: string;
  updatedAt: string;
  updatedBy: string;
}

export interface HospitalSystemAggregateCounts {
  departments: number;
  doctors: number;
  staffUsers: number;
  inpatientWards: number;
  hospitalRooms: number;
  totalBeds: number;
  activePanels: number;
}

export const INITIAL_WORKING_HOURS: DayWorkingHours[] = [
  { day: 'Monday', isOpen: false, openTime: '', closeTime: '' },
  { day: 'Tuesday', isOpen: false, openTime: '', closeTime: '' },
  { day: 'Wednesday', isOpen: false, openTime: '', closeTime: '' },
  { day: 'Thursday', isOpen: false, openTime: '', closeTime: '' },
  { day: 'Friday', isOpen: false, openTime: '', closeTime: '' },
  { day: 'Saturday', isOpen: false, openTime: '', closeTime: '' },
  { day: 'Sunday', isOpen: false, openTime: '', closeTime: '' },
];

export const DEFAULT_HOSPITAL_PROFILE: HospitalProfile = {
  id: 'hosp_css_01',
  name: 'CH Sharif and Saeed Hospital',
  shortName: '',
  logo: null,
  hospitalType: '',
  registrationNumber: '',
  licenseNumber: '',
  accreditationBody: '',
  accreditationNumber: '',
  status: 'Active',

  primaryPhone: '',
  alternatePhone: '',
  emergencyPhone: '',
  primaryEmail: '',
  secondaryEmail: '',
  website: '',

  addressLine1: '',
  addressLine2: '',
  city: '',
  province: '',
  postalCode: '',
  country: 'Pakistan',

  currency: 'PKR',
  timezone: 'UTC+05:00 (Pakistan Standard Time)',
  weekStartDay: 'Monday',
  workingMode: '',
  opdOpenTime: '',
  opdCloseTime: '',
  emergencyEnabled: false,
  emergencyMode: '',
  dateFormat: 'DD/MM/YYYY',
  timeFormat: '12-Hour (hh:mm A)',

  workingHours: INITIAL_WORKING_HOURS,

  legalBusinessName: '',
  taxNumber: '',
  salesTaxNumber: '',
  billingAddress: '',
  invoicePhone: '',
  invoiceEmail: '',
  invoicePrefix: 'INV',
  receiptPrefix: 'REC',

  createdAt: '01 Jan 2026, 09:00 AM',
  createdBy: 'System Setup',
  updatedAt: '08 Sep 2026, 11:30 AM',
  updatedBy: 'Super Admin',
};
