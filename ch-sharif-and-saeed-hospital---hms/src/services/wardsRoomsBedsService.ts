import {
  Ward,
  Room,
  Bed,
  WardType,
  RoomType,
  BedType,
  GenderPolicy,
  BedOccupancyStatus,
  BedOperationalStatus,
  WardFilterState,
  RoomFilterState,
  BedFilterState,
  WardFormValues,
  RoomFormValues,
  BedFormValues,
  WardImportRow,
  RoomImportRow,
  BedImportRow,
} from '../types/wardsRoomsBeds';
import { User } from '../types';
import { DepartmentService, formatAuditUser, formatAuditTimestamp } from './departmentService';

const WARDS_STORAGE_KEY = 'css_hms_wards_dataset_v1';
const ROOMS_STORAGE_KEY = 'css_hms_rooms_dataset_v1';
const BEDS_STORAGE_KEY = 'css_hms_beds_dataset_v1';

export const VALID_WARD_TYPES: WardType[] = [
  'General',
  'Private',
  'Semi-Private',
  'ICU',
  'NICU',
  'PICU',
  'Pediatric',
  'Emergency Holding',
  'Isolation',
  'Maternity',
  'Other',
];

export const VALID_GENDER_POLICIES: GenderPolicy[] = [
  'Male',
  'Female',
  'Mixed',
  'Pediatric',
  'Not Applicable',
];

export const VALID_ROOM_TYPES: RoomType[] = [
  'General',
  'Private',
  'Semi-Private',
  'ICU',
  'Isolation',
  'Suite',
  'Shared',
  'Other',
];

export const VALID_BED_TYPES: BedType[] = [
  'Standard',
  'Private',
  'Semi-Private',
  'ICU',
  'NICU',
  'PICU',
  'Pediatric',
  'Isolation',
  'Emergency',
  'Other',
];

export const INITIAL_WARDS: Ward[] = [
  {
    id: 'wrd_icu',
    code: 'WRD-ICU-01',
    name: 'Intensive Care Unit (ICU)',
    departmentId: 'DEP-07',
    departmentName: 'Emergency',
    wardType: 'ICU',
    genderPolicy: 'Mixed',
    floor: '2nd Floor',
    location: 'West Wing, Critical Care Complex',
    description: 'Advanced adult multi-disciplinary intensive care unit with central invasive telemetry',
    roomCount: 2,
    bedCount: 6,
    availableBeds: 2,
    status: 'Active',
    historicalAdmissionCount: 45,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2026, 10:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '12 Aug 2026, 03:00 PM',
  },
  {
    id: 'wrd_ccu',
    code: 'WRD-CCU-01',
    name: 'Coronary Care Unit (CCU)',
    departmentId: 'DEP-03',
    departmentName: 'Cardiology',
    wardType: 'ICU',
    genderPolicy: 'Mixed',
    floor: '2nd Floor',
    location: 'North Wing, Heart Institute',
    description: 'Post-angioplasty and acute coronary syndrome intensive cardiology bay',
    roomCount: 1,
    bedCount: 4,
    availableBeds: 2,
    status: 'Active',
    historicalAdmissionCount: 38,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2026, 10:30 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '15 Jul 2026, 11:20 AM',
  },
  {
    id: 'wrd_gen_male',
    code: 'WRD-MED-M',
    name: 'Male Medical Ward',
    departmentId: 'DEP-01',
    departmentName: 'General Medicine',
    wardType: 'General',
    genderPolicy: 'Male',
    floor: '3rd Floor',
    location: 'East Wing, Inpatient Tower',
    description: 'Inpatient internal medicine male cohort ward with dedicated nursing station',
    roomCount: 2,
    bedCount: 8,
    availableBeds: 4,
    status: 'Active',
    historicalAdmissionCount: 112,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 09:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '20 Jul 2026, 02:45 PM',
  },
  {
    id: 'wrd_pvt',
    code: 'WRD-PVT-01',
    name: 'Executive Private Ward',
    departmentId: 'DEP-01',
    departmentName: 'General Medicine',
    wardType: 'Private',
    genderPolicy: 'Mixed',
    floor: '4th Floor',
    location: 'South Wing, Premium Inpatient Pavilion',
    description: 'En-suite executive single rooms with patient attendant lodging accommodation',
    roomCount: 2,
    bedCount: 2,
    availableBeds: 1,
    status: 'Active',
    historicalAdmissionCount: 52,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 09:30 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '05 Aug 2026, 04:10 PM',
  },
  {
    id: 'wrd_nicu',
    code: 'WRD-NICU-01',
    name: 'Neonatal Intensive Care Unit (NICU)',
    departmentId: 'DEP-04',
    departmentName: 'Pediatrics',
    wardType: 'NICU',
    genderPolicy: 'Pediatric',
    floor: '1st Floor',
    location: 'Maternal-Child Health Complex',
    description: 'Level-III neonatal care with phototherapy, radiant warmers and CPAP incubators',
    roomCount: 1,
    bedCount: 4,
    availableBeds: 2,
    status: 'Active',
    historicalAdmissionCount: 64,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '10 Jan 2026, 11:00 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '18 Aug 2026, 01:15 PM',
  },
];

export const INITIAL_ROOMS: Room[] = [
  {
    id: 'rm_icu_101',
    code: 'RM-ICU-101',
    roomNumber: 'ICU-101',
    name: 'ICU Main Bay A',
    wardId: 'wrd_icu',
    wardName: 'Intensive Care Unit (ICU)',
    departmentId: 'DEP-07',
    departmentName: 'Emergency',
    roomType: 'ICU',
    floor: '2nd Floor',
    capacity: 4,
    bedsConfigured: 4,
    dailyRoomRate: 15000,
    status: 'Active',
    admissionLinkageCount: 30,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2026, 10:15 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '12 Aug 2026, 03:00 PM',
  },
  {
    id: 'rm_icu_102',
    code: 'RM-ICU-102',
    roomNumber: 'ICU-102',
    name: 'ICU Isolation Suite',
    wardId: 'wrd_icu',
    wardName: 'Intensive Care Unit (ICU)',
    departmentId: 'DEP-07',
    departmentName: 'Emergency',
    roomType: 'Isolation',
    floor: '2nd Floor',
    capacity: 2,
    bedsConfigured: 2,
    dailyRoomRate: 18000,
    status: 'Active',
    admissionLinkageCount: 15,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2026, 10:20 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '12 Aug 2026, 03:00 PM',
  },
  {
    id: 'rm_ccu_201',
    code: 'RM-CCU-201',
    roomNumber: 'CCU-201',
    name: 'CCU Monitoring Bay',
    wardId: 'wrd_ccu',
    wardName: 'Coronary Care Unit (CCU)',
    departmentId: 'DEP-03',
    departmentName: 'Cardiology',
    roomType: 'ICU',
    floor: '2nd Floor',
    capacity: 4,
    bedsConfigured: 4,
    dailyRoomRate: 14000,
    status: 'Active',
    admissionLinkageCount: 38,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2026, 10:35 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '15 Jul 2026, 11:20 AM',
  },
  {
    id: 'rm_med_301',
    code: 'RM-MED-301',
    roomNumber: '301',
    name: 'Male Bay Alpha',
    wardId: 'wrd_gen_male',
    wardName: 'Male Medical Ward',
    departmentId: 'DEP-01',
    departmentName: 'General Medicine',
    roomType: 'General',
    floor: '3rd Floor',
    capacity: 4,
    bedsConfigured: 4,
    dailyRoomRate: 3000,
    status: 'Active',
    admissionLinkageCount: 60,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 09:10 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '20 Jul 2026, 02:45 PM',
  },
  {
    id: 'rm_med_302',
    code: 'RM-MED-302',
    roomNumber: '302',
    name: 'Male Bay Beta',
    wardId: 'wrd_gen_male',
    wardName: 'Male Medical Ward',
    departmentId: 'DEP-01',
    departmentName: 'General Medicine',
    roomType: 'General',
    floor: '3rd Floor',
    capacity: 4,
    bedsConfigured: 4,
    dailyRoomRate: 3000,
    status: 'Active',
    admissionLinkageCount: 52,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 09:15 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '20 Jul 2026, 02:45 PM',
  },
  {
    id: 'rm_pvt_401',
    code: 'RM-PVT-401',
    roomNumber: '401',
    name: 'Executive Deluxe Suite',
    wardId: 'wrd_pvt',
    wardName: 'Executive Private Ward',
    departmentId: 'DEP-01',
    departmentName: 'General Medicine',
    roomType: 'Suite',
    floor: '4th Floor',
    capacity: 1,
    bedsConfigured: 1,
    dailyRoomRate: 12000,
    status: 'Active',
    admissionLinkageCount: 28,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 09:40 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '05 Aug 2026, 04:10 PM',
  },
  {
    id: 'rm_pvt_402',
    code: 'RM-PVT-402',
    roomNumber: '402',
    name: 'Standard Private Room',
    wardId: 'wrd_pvt',
    wardName: 'Executive Private Ward',
    departmentId: 'DEP-01',
    departmentName: 'General Medicine',
    roomType: 'Private',
    floor: '4th Floor',
    capacity: 1,
    bedsConfigured: 1,
    dailyRoomRate: 8500,
    status: 'Active',
    admissionLinkageCount: 24,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 09:45 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '05 Aug 2026, 04:10 PM',
  },
  {
    id: 'rm_nicu_101',
    code: 'RM-NICU-101',
    roomNumber: 'NICU-101',
    name: 'Neonatal Pod Alpha',
    wardId: 'wrd_nicu',
    wardName: 'Neonatal Intensive Care Unit (NICU)',
    departmentId: 'DEP-04',
    departmentName: 'Pediatrics',
    roomType: 'ICU',
    floor: '1st Floor',
    capacity: 4,
    bedsConfigured: 4,
    dailyRoomRate: 10000,
    status: 'Active',
    admissionLinkageCount: 64,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '10 Jan 2026, 11:10 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '18 Aug 2026, 01:15 PM',
  },
];

const RAW_INITIAL_BEDS: any[] = [
  // ICU Beds
  {
    id: 'bed_icu_01',
    code: 'BED-ICU-01',
    bedNumber: 'B-01',
    roomId: 'rm_icu_101',
    roomName: 'ICU Main Bay A',
    wardId: 'wrd_icu',
    wardName: 'Intensive Care Unit (ICU)',
    departmentId: 'dept_emergency',
    departmentName: 'Emergency & Trauma Center',
    bedType: 'ICU',
    dailyRate: 15000,
    occupancyStatus: 'Occupied',
    operationalStatus: 'Active',
    currentPatientId: 'pat_demo_01',
    currentPatientName: 'Demo Patient (ADM-2026-041)',
    admissionId: 'ADM-2026-041',
    historicalAdmissionCount: 12,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2026, 10:20 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '05 Sep 2026, 09:15 AM',
  },
  {
    id: 'bed_icu_02',
    code: 'BED-ICU-02',
    bedNumber: 'B-02',
    roomId: 'rm_icu_101',
    roomName: 'ICU Main Bay A',
    wardId: 'wrd_icu',
    wardName: 'Intensive Care Unit (ICU)',
    departmentId: 'dept_emergency',
    departmentName: 'Emergency & Trauma Center',
    bedType: 'ICU',
    dailyRate: 15000,
    occupancyStatus: 'Occupied',
    operationalStatus: 'Active',
    currentPatientId: 'pat_demo_02',
    currentPatientName: 'Demo Patient (ADM-2026-048)',
    admissionId: 'ADM-2026-048',
    historicalAdmissionCount: 9,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2026, 10:20 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '06 Sep 2026, 10:30 AM',
  },
  {
    id: 'bed_icu_03',
    code: 'BED-ICU-03',
    bedNumber: 'B-03',
    roomId: 'rm_icu_101',
    roomName: 'ICU Main Bay A',
    wardId: 'wrd_icu',
    wardName: 'Intensive Care Unit (ICU)',
    departmentId: 'dept_emergency',
    departmentName: 'Emergency & Trauma Center',
    bedType: 'ICU',
    dailyRate: 15000,
    occupancyStatus: 'Available',
    operationalStatus: 'Active',
    historicalAdmissionCount: 6,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2026, 10:20 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '01 Sep 2026, 02:00 PM',
  },
  {
    id: 'bed_icu_04',
    code: 'BED-ICU-04',
    bedNumber: 'B-04',
    roomId: 'rm_icu_101',
    roomName: 'ICU Main Bay A',
    wardId: 'wrd_icu',
    wardName: 'Intensive Care Unit (ICU)',
    departmentId: 'dept_emergency',
    departmentName: 'Emergency & Trauma Center',
    bedType: 'ICU',
    dailyRate: 15000,
    occupancyStatus: 'Available',
    operationalStatus: 'Cleaning',
    historicalAdmissionCount: 3,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2026, 10:20 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '08 Sep 2026, 08:30 AM',
  },
  {
    id: 'bed_icu_05',
    code: 'BED-ICU-05',
    bedNumber: 'B-05',
    roomId: 'rm_icu_102',
    roomName: 'ICU Isolation Suite',
    wardId: 'wrd_icu',
    wardName: 'Intensive Care Unit (ICU)',
    departmentId: 'dept_emergency',
    departmentName: 'Emergency & Trauma Center',
    bedType: 'Isolation',
    dailyRate: 18000,
    occupancyStatus: 'Occupied',
    operationalStatus: 'Active',
    currentPatientId: 'pat_demo_03',
    currentPatientName: 'Demo Patient (ADM-2026-052)',
    admissionId: 'ADM-2026-052',
    historicalAdmissionCount: 8,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2026, 10:25 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '07 Sep 2026, 04:00 PM',
  },
  {
    id: 'bed_icu_06',
    code: 'BED-ICU-06',
    bedNumber: 'B-06',
    roomId: 'rm_icu_102',
    roomName: 'ICU Isolation Suite',
    wardId: 'wrd_icu',
    wardName: 'Intensive Care Unit (ICU)',
    departmentId: 'dept_emergency',
    departmentName: 'Emergency & Trauma Center',
    bedType: 'Isolation',
    dailyRate: 18000,
    occupancyStatus: 'Available',
    operationalStatus: 'Active',
    historicalAdmissionCount: 7,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2026, 10:25 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '04 Sep 2026, 01:00 PM',
  },

  // CCU Beds
  {
    id: 'bed_ccu_01',
    code: 'BED-CCU-01',
    bedNumber: 'B-01',
    roomId: 'rm_ccu_201',
    roomName: 'CCU Monitoring Bay',
    wardId: 'wrd_ccu',
    wardName: 'Coronary Care Unit (CCU)',
    departmentId: 'dept_cardiology',
    departmentName: 'Cardiology & Cath Lab',
    bedType: 'ICU',
    dailyRate: 14000,
    occupancyStatus: 'Occupied',
    operationalStatus: 'Active',
    currentPatientId: 'pat_demo_04',
    currentPatientName: 'Demo Patient (ADM-2026-055)',
    admissionId: 'ADM-2026-055',
    historicalAdmissionCount: 11,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2026, 10:40 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '06 Sep 2026, 05:20 PM',
  },
  {
    id: 'bed_ccu_02',
    code: 'BED-CCU-02',
    bedNumber: 'B-02',
    roomId: 'rm_ccu_201',
    roomName: 'CCU Monitoring Bay',
    wardId: 'wrd_ccu',
    wardName: 'Coronary Care Unit (CCU)',
    departmentId: 'dept_cardiology',
    departmentName: 'Cardiology & Cath Lab',
    bedType: 'ICU',
    dailyRate: 14000,
    occupancyStatus: 'Available',
    operationalStatus: 'Active',
    historicalAdmissionCount: 9,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2026, 10:40 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '02 Sep 2026, 11:15 AM',
  },
  {
    id: 'bed_ccu_03',
    code: 'BED-CCU-03',
    bedNumber: 'B-03',
    roomId: 'rm_ccu_201',
    roomName: 'CCU Monitoring Bay',
    wardId: 'wrd_ccu',
    wardName: 'Coronary Care Unit (CCU)',
    departmentId: 'dept_cardiology',
    departmentName: 'Cardiology & Cath Lab',
    bedType: 'ICU',
    dailyRate: 14000,
    occupancyStatus: 'Available',
    operationalStatus: 'Active',
    historicalAdmissionCount: 10,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2026, 10:40 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '03 Sep 2026, 03:40 PM',
  },
  {
    id: 'bed_ccu_04',
    code: 'BED-CCU-04',
    bedNumber: 'B-04',
    roomId: 'rm_ccu_201',
    roomName: 'CCU Monitoring Bay',
    wardId: 'wrd_ccu',
    wardName: 'Coronary Care Unit (CCU)',
    departmentId: 'dept_cardiology',
    departmentName: 'Cardiology & Cath Lab',
    bedType: 'ICU',
    dailyRate: 14000,
    occupancyStatus: 'Available',
    operationalStatus: 'Maintenance',
    historicalAdmissionCount: 8,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '01 Jan 2026, 10:40 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '07 Sep 2026, 09:00 AM',
  },

  // General Male Medical Beds
  {
    id: 'bed_med_01',
    code: 'BED-MED-301-A',
    bedNumber: '301-A',
    roomId: 'rm_med_301',
    roomName: 'Male Bay Alpha',
    wardId: 'wrd_gen_male',
    wardName: 'Male Medical Ward',
    departmentId: 'dept_internal_med',
    departmentName: 'Internal Medicine',
    bedType: 'Standard',
    dailyRate: 3000,
    occupancyStatus: 'Occupied',
    operationalStatus: 'Active',
    currentPatientId: 'pat_demo_05',
    currentPatientName: 'Demo Patient (ADM-2026-061)',
    admissionId: 'ADM-2026-061',
    historicalAdmissionCount: 16,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 09:20 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '04 Sep 2026, 10:00 AM',
  },
  {
    id: 'bed_med_02',
    code: 'BED-MED-301-B',
    bedNumber: '301-B',
    roomId: 'rm_med_301',
    roomName: 'Male Bay Alpha',
    wardId: 'wrd_gen_male',
    wardName: 'Male Medical Ward',
    departmentId: 'dept_internal_med',
    departmentName: 'Internal Medicine',
    bedType: 'Standard',
    dailyRate: 3000,
    occupancyStatus: 'Occupied',
    operationalStatus: 'Active',
    currentPatientId: 'pat_demo_06',
    currentPatientName: 'Demo Patient (ADM-2026-063)',
    admissionId: 'ADM-2026-063',
    historicalAdmissionCount: 14,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 09:20 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '05 Sep 2026, 01:10 PM',
  },
  {
    id: 'bed_med_03',
    code: 'BED-MED-301-C',
    bedNumber: '301-C',
    roomId: 'rm_med_301',
    roomName: 'Male Bay Alpha',
    wardId: 'wrd_gen_male',
    wardName: 'Male Medical Ward',
    departmentId: 'dept_internal_med',
    departmentName: 'Internal Medicine',
    bedType: 'Standard',
    dailyRate: 3000,
    occupancyStatus: 'Available',
    operationalStatus: 'Active',
    historicalAdmissionCount: 15,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 09:20 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '02 Sep 2026, 04:30 PM',
  },
  {
    id: 'bed_med_04',
    code: 'BED-MED-301-D',
    bedNumber: '301-D',
    roomId: 'rm_med_301',
    roomName: 'Male Bay Alpha',
    wardId: 'wrd_gen_male',
    wardName: 'Male Medical Ward',
    departmentId: 'dept_internal_med',
    departmentName: 'Internal Medicine',
    bedType: 'Standard',
    dailyRate: 3000,
    occupancyStatus: 'Available',
    operationalStatus: 'Active',
    historicalAdmissionCount: 15,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 09:20 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '03 Sep 2026, 12:00 PM',
  },
  {
    id: 'bed_med_05',
    code: 'BED-MED-302-A',
    bedNumber: '302-A',
    roomId: 'rm_med_302',
    roomName: 'Male Bay Beta',
    wardId: 'wrd_gen_male',
    wardName: 'Male Medical Ward',
    departmentId: 'dept_internal_med',
    departmentName: 'Internal Medicine',
    bedType: 'Standard',
    dailyRate: 3000,
    occupancyStatus: 'Occupied',
    operationalStatus: 'Active',
    currentPatientId: 'pat_demo_07',
    currentPatientName: 'Demo Patient (ADM-2026-069)',
    admissionId: 'ADM-2026-069',
    historicalAdmissionCount: 13,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 09:25 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '06 Sep 2026, 03:00 PM',
  },
  {
    id: 'bed_med_06',
    code: 'BED-MED-302-B',
    bedNumber: '302-B',
    roomId: 'rm_med_302',
    roomName: 'Male Bay Beta',
    wardId: 'wrd_gen_male',
    wardName: 'Male Medical Ward',
    departmentId: 'dept_internal_med',
    departmentName: 'Internal Medicine',
    bedType: 'Standard',
    dailyRate: 3000,
    occupancyStatus: 'Available',
    operationalStatus: 'Active',
    historicalAdmissionCount: 12,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 09:25 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '01 Sep 2026, 09:00 AM',
  },
  {
    id: 'bed_med_07',
    code: 'BED-MED-302-C',
    bedNumber: '302-C',
    roomId: 'rm_med_302',
    roomName: 'Male Bay Beta',
    wardId: 'wrd_gen_male',
    wardName: 'Male Medical Ward',
    departmentId: 'dept_internal_med',
    departmentName: 'Internal Medicine',
    bedType: 'Standard',
    dailyRate: 3000,
    occupancyStatus: 'Available',
    operationalStatus: 'Active',
    historicalAdmissionCount: 14,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 09:25 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '04 Sep 2026, 02:15 PM',
  },
  {
    id: 'bed_med_08',
    code: 'BED-MED-302-D',
    bedNumber: '302-D',
    roomId: 'rm_med_302',
    roomName: 'Male Bay Beta',
    wardId: 'wrd_gen_male',
    wardName: 'Male Medical Ward',
    departmentId: 'dept_internal_med',
    departmentName: 'Internal Medicine',
    bedType: 'Standard',
    dailyRate: 3000,
    occupancyStatus: 'Available',
    operationalStatus: 'Out of Service',
    historicalAdmissionCount: 13,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 09:25 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '08 Sep 2026, 07:00 AM',
  },

  // Private Ward Beds
  {
    id: 'bed_pvt_01',
    code: 'BED-PVT-401',
    bedNumber: '401-Bed',
    roomId: 'rm_pvt_401',
    roomName: 'Executive Deluxe Suite',
    wardId: 'wrd_pvt',
    wardName: 'Executive Private Ward',
    departmentId: 'dept_internal_med',
    departmentName: 'Internal Medicine',
    bedType: 'Private',
    dailyRate: 12000,
    occupancyStatus: 'Occupied',
    operationalStatus: 'Active',
    currentPatientId: 'pat_demo_08',
    currentPatientName: 'Demo Patient (ADM-2026-074)',
    admissionId: 'ADM-2026-074',
    historicalAdmissionCount: 28,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 09:50 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '07 Sep 2026, 11:45 AM',
  },
  {
    id: 'bed_pvt_02',
    code: 'BED-PVT-402',
    bedNumber: '402-Bed',
    roomId: 'rm_pvt_402',
    roomName: 'Standard Private Room',
    wardId: 'wrd_pvt',
    wardName: 'Executive Private Ward',
    departmentId: 'dept_internal_med',
    departmentName: 'Internal Medicine',
    bedType: 'Private',
    dailyRate: 8500,
    occupancyStatus: 'Available',
    operationalStatus: 'Active',
    historicalAdmissionCount: 24,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '05 Jan 2026, 09:50 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '05 Sep 2026, 04:00 PM',
  },

  // NICU Beds
  {
    id: 'bed_nicu_01',
    code: 'BED-NICU-01',
    bedNumber: 'Incubator 01',
    roomId: 'rm_nicu_101',
    roomName: 'Neonatal Pod Alpha',
    wardId: 'wrd_nicu',
    wardName: 'Neonatal Intensive Care Unit (NICU)',
    departmentId: 'dept_pediatrics',
    departmentName: 'Pediatrics & Neonatology',
    bedType: 'NICU',
    dailyRate: 10000,
    occupancyStatus: 'Occupied',
    operationalStatus: 'Active',
    currentPatientId: 'pat_demo_09',
    currentPatientName: 'Demo Neonate (ADM-2026-080)',
    admissionId: 'ADM-2026-080',
    historicalAdmissionCount: 18,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '10 Jan 2026, 11:15 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '06 Sep 2026, 06:10 PM',
  },
  {
    id: 'bed_nicu_02',
    code: 'BED-NICU-02',
    bedNumber: 'Incubator 02',
    roomId: 'rm_nicu_101',
    roomName: 'Neonatal Pod Alpha',
    wardId: 'wrd_nicu',
    wardName: 'Neonatal Intensive Care Unit (NICU)',
    departmentId: 'dept_pediatrics',
    departmentName: 'Pediatrics & Neonatology',
    bedType: 'NICU',
    dailyRate: 10000,
    occupancyStatus: 'Available',
    operationalStatus: 'Active',
    historicalAdmissionCount: 16,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '10 Jan 2026, 11:15 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '04 Sep 2026, 08:00 AM',
  },
  {
    id: 'bed_nicu_03',
    code: 'BED-NICU-03',
    bedNumber: 'Incubator 03',
    roomId: 'rm_nicu_101',
    roomName: 'Neonatal Pod Alpha',
    wardId: 'wrd_nicu',
    wardName: 'Neonatal Intensive Care Unit (NICU)',
    departmentId: 'dept_pediatrics',
    departmentName: 'Pediatrics & Neonatology',
    bedType: 'NICU',
    dailyRate: 10000,
    occupancyStatus: 'Available',
    operationalStatus: 'Active',
    historicalAdmissionCount: 15,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '10 Jan 2026, 11:15 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '03 Sep 2026, 11:00 AM',
  },
  {
    id: 'bed_nicu_04',
    code: 'BED-NICU-04',
    bedNumber: 'Incubator 04',
    roomId: 'rm_nicu_101',
    roomName: 'Neonatal Pod Alpha',
    wardId: 'wrd_nicu',
    wardName: 'Neonatal Intensive Care Unit (NICU)',
    departmentId: 'dept_pediatrics',
    departmentName: 'Pediatrics & Neonatology',
    bedType: 'NICU',
    dailyRate: 10000,
    occupancyStatus: 'Available',
    operationalStatus: 'Cleaning',
    historicalAdmissionCount: 15,
    createdBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    createdAt: '10 Jan 2026, 11:15 AM',
    updatedBy: 'Prof. Dr. Tariq Saeed (Super Admin)',
    updatedAt: '08 Sep 2026, 09:00 AM',
  },
];

export const INITIAL_BEDS: Bed[] = RAW_INITIAL_BEDS.map((b) => {
  const room = INITIAL_ROOMS.find((r) => r.id === b.roomId);
  const ward = INITIAL_WARDS.find((w) => w.id === (room?.wardId || b.wardId));
  const deptId = room?.departmentId || ward?.departmentId || b.departmentId;
  const deptName = room?.departmentName || ward?.departmentName || b.departmentName;
  const roomName = room?.name || b.roomName;
  const wardName = ward?.name || b.wardName;
  const wardId = ward?.id || b.wardId;
  const rate = Number(b.dailyBedRate ?? b.dailyRate ?? room?.dailyRoomRate ?? 2000);
  return {
    ...b,
    wardId,
    wardName,
    roomId: b.roomId,
    roomName,
    departmentId: deptId,
    departmentName: deptName,
    dailyBedRate: rate,
    dailyRate: rate,
  };
});

export class WardsRoomsBedsService {
  // WARDS
  // ----------------------------------------------------
  static getWards(): Ward[] {
    try {
      const stored = localStorage.getItem(WARDS_STORAGE_KEY);
      const departments = DepartmentService.getDepartments();

      let rawWards: Ward[];
      if (!stored) {
        rawWards = INITIAL_WARDS;
      } else {
        rawWards = JSON.parse(stored);
      }

      let modified = false;
      const normalized = rawWards.map((w: any) => {
        const canonical = DepartmentService.resolveCanonicalDepartment(
          w.departmentId,
          w.departmentName,
          departments
        );
        if (w.departmentId !== canonical.id || w.departmentName !== canonical.name) {
          modified = true;
          return {
            ...w,
            departmentId: canonical.id,
            departmentName: canonical.name,
          };
        }
        return w;
      });

      if (!stored || modified) {
        localStorage.setItem(WARDS_STORAGE_KEY, JSON.stringify(normalized));
      }
      return normalized;
    } catch (err) {
      console.error('Failed to load wards:', err);
      return INITIAL_WARDS;
    }
  }

  static saveWards(wards: Ward[]): void {
    try {
      localStorage.setItem(WARDS_STORAGE_KEY, JSON.stringify(wards));
    } catch (err) {
      console.error('Failed to save wards:', err);
    }
  }

  static getWardById(id: string): Ward | undefined {
    return this.getWards().find((w) => w.id === id);
  }

  static validateWardCode(code: string, currentId?: string): { isValid: boolean; message?: string } {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return { isValid: false, message: 'Ward code is required.' };
    if (!/^[A-Z0-9-]+$/.test(trimmed)) {
      return { isValid: false, message: 'Ward code must contain uppercase letters, numbers, and hyphens only.' };
    }
    const wards = this.getWards();
    const isDup = wards.some((w) => w.code.toUpperCase() === trimmed && w.id !== currentId);
    if (isDup) return { isValid: false, message: `Ward code "${trimmed}" already exists.` };
    return { isValid: true };
  }

  static createWard(values: WardFormValues, currentUser?: User | null): Ward {
    const codeCheck = this.validateWardCode(values.code);
    if (!codeCheck.isValid) throw new Error(codeCheck.message);

    const departments = DepartmentService.getDepartments();
    const deptInfo = DepartmentService.resolveCanonicalDepartment(values.departmentId, undefined, departments);
    const dept = departments.find((d) => d.id === deptInfo.id);
    if (!dept) throw new Error('Selected department does not exist.');
    if (dept.status !== 'Active') throw new Error('Cannot create ward under an inactive department.');

    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();

    const newWard: Ward = {
      id: `wrd_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      departmentId: dept.id,
      departmentName: dept.name,
      wardType: values.wardType,
      genderPolicy: values.genderPolicy,
      floor: values.floor.trim(),
      location: values.location.trim(),
      description: values.description.trim(),
      roomCount: 0,
      bedCount: 0,
      availableBeds: 0,
      status: values.status,
      historicalAdmissionCount: 0,
      createdBy: auditUser,
      createdAt: auditTime,
      updatedBy: auditUser,
      updatedAt: auditTime,
    };

    const wards = [newWard, ...this.getWards()];
    this.saveWards(wards);
    return newWard;
  }

  static updateWard(id: string, values: WardFormValues, currentUser?: User | null): Ward {
    const wards = this.getWards();
    const idx = wards.findIndex((w) => w.id === id);
    if (idx === -1) throw new Error('Ward not found.');

    const codeCheck = this.validateWardCode(values.code, id);
    if (!codeCheck.isValid) throw new Error(codeCheck.message);

    const departments = DepartmentService.getDepartments();
    const deptInfo = DepartmentService.resolveCanonicalDepartment(values.departmentId, undefined, departments);
    const dept = departments.find((d) => d.id === deptInfo.id);
    if (!dept) throw new Error('Selected department does not exist.');

    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();
    const existing = wards[idx];

    const updated: Ward = {
      ...existing,
      code: values.code.trim().toUpperCase(),
      name: values.name.trim(),
      departmentId: dept.id,
      departmentName: dept.name,
      wardType: values.wardType,
      genderPolicy: values.genderPolicy,
      floor: values.floor.trim(),
      location: values.location.trim(),
      description: values.description.trim(),
      status: values.status,
      updatedBy: auditUser,
      updatedAt: auditTime,
    };

    if (existing.status !== values.status) {
      updated.statusChangedBy = auditUser;
      updated.statusChangedAt = auditTime;
    }

    wards[idx] = updated;
    this.saveWards(wards);

    // Synchronize rooms and beds departmentName and wardName if ward changed
    this.syncWardHierarchy(updated);

    return updated;
  }

  static changeWardStatus(id: string, newStatus: 'Active' | 'Inactive', currentUser?: User | null): Ward {
    const wards = this.getWards();
    const idx = wards.findIndex((w) => w.id === id);
    if (idx === -1) throw new Error('Ward not found.');

    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();
    const existing = wards[idx];

    existing.status = newStatus;
    existing.updatedBy = auditUser;
    existing.updatedAt = auditTime;
    existing.statusChangedBy = auditUser;
    existing.statusChangedAt = auditTime;

    wards[idx] = existing;
    this.saveWards(wards);
    return existing;
  }

  static deleteWard(id: string): { success: boolean; message?: string } {
    const ward = this.getWardById(id);
    if (!ward) return { success: false, message: 'Ward not found.' };

    const rooms = this.getRooms().filter((r) => r.wardId === id);
    const beds = this.getBeds().filter((b) => b.wardId === id);

    if (rooms.length > 0 || beds.length > 0 || (ward.historicalAdmissionCount ?? 0) > 0) {
      return {
        success: false,
        message: `This ward contains ${rooms.length} configured room(s) and ${beds.length} bed(s) or historical admission records. Deactivate it instead.`,
      };
    }

    const remaining = this.getWards().filter((w) => w.id !== id);
    this.saveWards(remaining);
    return { success: true };
  }

  // ----------------------------------------------------
  // ROOMS
  // ----------------------------------------------------
  static getRooms(): Room[] {
    try {
      const stored = localStorage.getItem(ROOMS_STORAGE_KEY);
      const wards = this.getWards();
      const wardMap = new Map(wards.map((w) => [w.id, w]));

      let rawRooms: Room[];
      if (!stored) {
        rawRooms = INITIAL_ROOMS;
      } else {
        rawRooms = JSON.parse(stored);
      }

      let modified = false;
      const normalized = rawRooms.map((r: any) => {
        const parentWard = wardMap.get(r.wardId);
        const rate = Number(r.dailyRoomRate ?? 0);
        const capacity = Number(r.capacity ?? 1);
        const bedsConfigured = Number(r.bedsConfigured ?? 0);
        const deptId = parentWard?.departmentId || r.departmentId;
        const deptName = parentWard?.departmentName || r.departmentName;
        const wardName = parentWard?.name || r.wardName;

        if (
          r.departmentId !== deptId ||
          r.departmentName !== deptName ||
          r.wardName !== wardName ||
          r.dailyRoomRate !== rate ||
          r.capacity !== capacity
        ) {
          modified = true;
          return {
            ...r,
            departmentId: deptId,
            departmentName: deptName,
            wardName,
            dailyRoomRate: rate,
            capacity,
            bedsConfigured,
          };
        }
        return r;
      });

      if (!stored || modified) {
        localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(normalized));
      }
      return normalized;
    } catch (err) {
      console.error('Failed to load rooms:', err);
      return INITIAL_ROOMS;
    }
  }

  static saveRooms(rooms: Room[]): void {
    try {
      localStorage.setItem(ROOMS_STORAGE_KEY, JSON.stringify(rooms));
    } catch (err) {
      console.error('Failed to save rooms:', err);
    }
  }

  static getRoomById(id: string): Room | undefined {
    return this.getRooms().find((r) => r.id === id);
  }

  static validateRoomCode(code: string, currentId?: string): { isValid: boolean; message?: string } {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return { isValid: false, message: 'Room code is required.' };
    if (!/^[A-Z0-9-]+$/.test(trimmed)) {
      return { isValid: false, message: 'Room code must contain uppercase letters, numbers, and hyphens only.' };
    }
    const rooms = this.getRooms();
    const isDup = rooms.some((r) => r.code.toUpperCase() === trimmed && r.id !== currentId);
    if (isDup) return { isValid: false, message: `Room code "${trimmed}" already exists.` };
    return { isValid: true };
  }

  static createRoom(values: RoomFormValues, currentUser?: User | null): Room {
    const codeCheck = this.validateRoomCode(values.code);
    if (!codeCheck.isValid) throw new Error(codeCheck.message);

    const ward = this.getWardById(values.wardId);
    if (!ward) throw new Error('Selected ward does not exist.');
    if (ward.status !== 'Active') throw new Error('Cannot create room under an inactive ward.');

    if (values.capacity <= 0) throw new Error('Room capacity must be at least 1.');
    if (values.dailyRoomRate < 0) throw new Error('Daily room rate cannot be negative.');

    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();

    const newRoom: Room = {
      id: `rm_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      code: values.code.trim().toUpperCase(),
      roomNumber: values.roomNumber.trim(),
      name: values.name.trim() || `Room ${values.roomNumber.trim()}`,
      wardId: ward.id,
      wardName: ward.name,
      departmentId: ward.departmentId,
      departmentName: ward.departmentName,
      roomType: values.roomType,
      floor: values.floor.trim() || ward.floor || '',
      capacity: Number(values.capacity) || 1,
      bedsConfigured: 0,
      dailyRoomRate: Number(values.dailyRoomRate) || 0,
      status: values.status,
      admissionLinkageCount: 0,
      createdBy: auditUser,
      createdAt: auditTime,
      updatedBy: auditUser,
      updatedAt: auditTime,
    };

    const rooms = [newRoom, ...this.getRooms()];
    this.saveRooms(rooms);
    this.refreshWardCounts();

    return newRoom;
  }

  static updateRoom(id: string, values: RoomFormValues, currentUser?: User | null): Room {
    const rooms = this.getRooms();
    const idx = rooms.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Room not found.');

    const codeCheck = this.validateRoomCode(values.code, id);
    if (!codeCheck.isValid) throw new Error(codeCheck.message);

    const ward = this.getWardById(values.wardId);
    if (!ward) throw new Error('Selected ward does not exist.');

    if (values.capacity <= 0) throw new Error('Room capacity must be at least 1.');
    if (values.dailyRoomRate < 0) throw new Error('Daily room rate cannot be negative.');

    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();
    const existing = rooms[idx];

    const updated: Room = {
      ...existing,
      code: values.code.trim().toUpperCase(),
      roomNumber: values.roomNumber.trim(),
      name: values.name.trim() || `Room ${values.roomNumber.trim()}`,
      wardId: ward.id,
      wardName: ward.name,
      departmentId: ward.departmentId,
      departmentName: ward.departmentName,
      roomType: values.roomType,
      floor: values.floor.trim() || ward.floor || '',
      capacity: Number(values.capacity) || 1,
      dailyRoomRate: Number(values.dailyRoomRate) || 0,
      status: values.status,
      updatedBy: auditUser,
      updatedAt: auditTime,
    };

    if (existing.status !== values.status) {
      updated.statusChangedBy = auditUser;
      updated.statusChangedAt = auditTime;
    }

    rooms[idx] = updated;
    this.saveRooms(rooms);
    this.refreshWardCounts();

    // Synchronize beds that link to this room
    this.syncRoomHierarchy(updated);

    return updated;
  }

  static changeRoomStatus(id: string, newStatus: 'Active' | 'Inactive', currentUser?: User | null): Room {
    const rooms = this.getRooms();
    const idx = rooms.findIndex((r) => r.id === id);
    if (idx === -1) throw new Error('Room not found.');

    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();
    const existing = rooms[idx];

    existing.status = newStatus;
    existing.updatedBy = auditUser;
    existing.updatedAt = auditTime;
    existing.statusChangedBy = auditUser;
    existing.statusChangedAt = auditTime;

    rooms[idx] = existing;
    this.saveRooms(rooms);
    return existing;
  }

  static deleteRoom(id: string): { success: boolean; message?: string } {
    const room = this.getRoomById(id);
    if (!room) return { success: false, message: 'Room not found.' };

    const beds = this.getBeds().filter((b) => b.roomId === id);
    if (beds.length > 0 || (room.admissionLinkageCount ?? 0) > 0) {
      return {
        success: false,
        message: `This room contains ${beds.length} configured bed(s) or historical admission records. Deactivate it instead.`,
      };
    }

    const remaining = this.getRooms().filter((r) => r.id !== id);
    this.saveRooms(remaining);
    this.refreshWardCounts();
    return { success: true };
  }

  // ----------------------------------------------------
  // BEDS
  // ----------------------------------------------------
  static getBeds(): Bed[] {
    try {
      const stored = localStorage.getItem(BEDS_STORAGE_KEY);
      const rooms = this.getRooms();
      const roomMap = new Map(rooms.map((r) => [r.id, r]));

      let rawBeds: Bed[];
      if (!stored) {
        rawBeds = INITIAL_BEDS;
      } else {
        rawBeds = JSON.parse(stored);
      }

      let modified = false;
      const normalized = rawBeds.map((b: any) => {
        const parentRoom = roomMap.get(b.roomId);
        const rate = Number(b.dailyBedRate ?? b.dailyRate ?? parentRoom?.dailyRoomRate ?? 2000);
        const roomName = parentRoom?.name || b.roomName;
        const wardId = parentRoom?.wardId || b.wardId;
        const wardName = parentRoom?.wardName || b.wardName;
        const deptId = parentRoom?.departmentId || b.departmentId;
        const deptName = parentRoom?.departmentName || b.departmentName;

        if (
          b.dailyBedRate !== rate ||
          b.dailyRate !== rate ||
          b.departmentId !== deptId ||
          b.departmentName !== deptName ||
          b.wardId !== wardId ||
          b.wardName !== wardName ||
          b.roomName !== roomName
        ) {
          modified = true;
          return {
            ...b,
            dailyBedRate: rate,
            dailyRate: rate,
            roomId: b.roomId,
            roomName,
            wardId,
            wardName,
            departmentId: deptId,
            departmentName: deptName,
          };
        }
        return b;
      });

      if (!stored || modified) {
        localStorage.setItem(BEDS_STORAGE_KEY, JSON.stringify(normalized));
      }
      return normalized;
    } catch (err) {
      console.error('Failed to load beds:', err);
      return INITIAL_BEDS;
    }
  }

  static saveBeds(beds: Bed[]): void {
    try {
      localStorage.setItem(BEDS_STORAGE_KEY, JSON.stringify(beds));
    } catch (err) {
      console.error('Failed to save beds:', err);
    }
  }

  static getBedById(id: string): Bed | undefined {
    return this.getBeds().find((b) => b.id === id);
  }

  static validateBedCode(code: string, currentId?: string): { isValid: boolean; message?: string } {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) return { isValid: false, message: 'Bed code is required.' };
    if (!/^[A-Z0-9-]+$/.test(trimmed)) {
      return { isValid: false, message: 'Bed code must contain uppercase letters, numbers, and hyphens only.' };
    }
    const beds = this.getBeds();
    const isDup = beds.some((b) => b.code.toUpperCase() === trimmed && b.id !== currentId);
    if (isDup) return { isValid: false, message: `Bed code "${trimmed}" already exists.` };
    return { isValid: true };
  }

  static createBed(values: BedFormValues, currentUser?: User | null): Bed {
    const codeCheck = this.validateBedCode(values.code);
    if (!codeCheck.isValid) throw new Error(codeCheck.message);

    const room = this.getRoomById(values.roomId);
    if (!room) throw new Error('Selected room does not exist.');
    if (room.status !== 'Active') throw new Error('Cannot add bed to an inactive room.');

    const bedRate = Number(values.dailyBedRate ?? values.dailyRate ?? 0);
    if (bedRate < 0) throw new Error('Daily bed rate cannot be negative.');

    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();

    // Default occupancy for new bed: Available (B19 rule)
    const newBed: Bed = {
      id: `bed_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      code: values.code.trim().toUpperCase(),
      bedNumber: values.bedNumber.trim(),
      roomId: room.id,
      roomName: room.name,
      wardId: room.wardId,
      wardName: room.wardName,
      departmentId: room.departmentId,
      departmentName: room.departmentName,
      bedType: values.bedType,
      dailyRate: bedRate,
      dailyBedRate: bedRate,
      occupancyStatus: 'Available',
      operationalStatus: values.operationalStatus,
      historicalAdmissionCount: 0,
      createdBy: auditUser,
      createdAt: auditTime,
      updatedBy: auditUser,
      updatedAt: auditTime,
    };

    const beds = [newBed, ...this.getBeds()];
    this.saveBeds(beds);
    this.refreshWardCounts();

    return newBed;
  }

  static updateBed(id: string, values: BedFormValues, currentUser?: User | null): Bed {
    const beds = this.getBeds();
    const idx = beds.findIndex((b) => b.id === id);
    if (idx === -1) throw new Error('Bed not found.');

    const codeCheck = this.validateBedCode(values.code, id);
    if (!codeCheck.isValid) throw new Error(codeCheck.message);

    const room = this.getRoomById(values.roomId);
    if (!room) throw new Error('Selected room does not exist.');

    const bedRate = Number(values.dailyBedRate ?? values.dailyRate ?? 0);
    if (bedRate < 0) throw new Error('Daily bed rate cannot be negative.');

    const existing = beds[idx];

    // Safeguard B22: If bed is occupied, cannot take Out of Service / Maintenance
    if (
      existing.occupancyStatus === 'Occupied' &&
      values.operationalStatus !== 'Active'
    ) {
      throw new Error(
        'This bed is currently occupied and cannot be taken out of service until the active admission is transferred or discharged.'
      );
    }

    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();

    const updated: Bed = {
      ...existing,
      code: values.code.trim().toUpperCase(),
      bedNumber: values.bedNumber.trim(),
      roomId: room.id,
      roomName: room.name,
      wardId: room.wardId,
      wardName: room.wardName,
      departmentId: room.departmentId,
      departmentName: room.departmentName,
      bedType: values.bedType,
      dailyRate: bedRate,
      dailyBedRate: bedRate,
      operationalStatus: values.operationalStatus,
      updatedBy: auditUser,
      updatedAt: auditTime,
    };

    if (existing.operationalStatus !== values.operationalStatus) {
      updated.statusChangedBy = auditUser;
      updated.statusChangedAt = auditTime;
    }

    beds[idx] = updated;
    this.saveBeds(beds);
    this.refreshWardCounts();

    return updated;
  }

  static changeBedOperationalStatus(
    id: string,
    newStatus: BedOperationalStatus,
    currentUser?: User | null
  ): Bed {
    const beds = this.getBeds();
    const idx = beds.findIndex((b) => b.id === id);
    if (idx === -1) throw new Error('Bed not found.');

    const existing = beds[idx];
    // Safeguard: cannot take occupied bed out of service
    if (existing.occupancyStatus === 'Occupied' && newStatus !== 'Active') {
      throw new Error(
        'This bed is currently occupied and cannot be taken out of service until the active admission is transferred or discharged.'
      );
    }

    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();

    existing.operationalStatus = newStatus;
    existing.updatedBy = auditUser;
    existing.updatedAt = auditTime;
    existing.statusChangedBy = auditUser;
    existing.statusChangedAt = auditTime;

    beds[idx] = existing;
    this.saveBeds(beds);
    this.refreshWardCounts();
    return existing;
  }

  static deleteBed(id: string): { success: boolean; message?: string } {
    const bed = this.getBedById(id);
    if (!bed) return { success: false, message: 'Bed not found.' };

    // Safeguard B25: cannot delete if occupied or historical admission exists
    if (bed.occupancyStatus === 'Occupied' || (bed.historicalAdmissionCount ?? 0) > 0) {
      return {
        success: false,
        message: 'This bed is occupied or linked to historical admission records and cannot be deleted. Change its operational status to Out of Service instead.',
      };
    }

    const remaining = this.getBeds().filter((b) => b.id !== id);
    this.saveBeds(remaining);
    this.refreshWardCounts();
    return { success: true };
  }

  // ----------------------------------------------------
  // HIERARCHY SYNCHRONIZATION & RECONCILED TOP SUMMARY
  // ----------------------------------------------------
  static refreshWardCounts(): void {
    const wards = this.getWards();
    const rooms = this.getRooms();
    const beds = this.getBeds();

    // 1. Update rooms configured count
    const roomBedMap = new Map<string, number>();
    beds.forEach((b) => {
      roomBedMap.set(b.roomId, (roomBedMap.get(b.roomId) || 0) + 1);
    });

    const updatedRooms = rooms.map((r) => ({
      ...r,
      bedsConfigured: roomBedMap.get(r.id) || 0,
    }));
    this.saveRooms(updatedRooms);

    // 2. Update wards room & bed count
    const wardRoomMap = new Map<string, number>();
    const wardBedMap = new Map<string, number>();
    const wardAvailBedMap = new Map<string, number>();

    rooms.forEach((r) => {
      wardRoomMap.set(r.wardId, (wardRoomMap.get(r.wardId) || 0) + 1);
    });

    beds.forEach((b) => {
      wardBedMap.set(b.wardId, (wardBedMap.get(b.wardId) || 0) + 1);
      if (b.occupancyStatus === 'Available' && b.operationalStatus === 'Active') {
        wardAvailBedMap.set(b.wardId, (wardAvailBedMap.get(b.wardId) || 0) + 1);
      }
    });

    const updatedWards = wards.map((w) => ({
      ...w,
      roomCount: wardRoomMap.get(w.id) || 0,
      bedCount: wardBedMap.get(w.id) || 0,
      availableBeds: wardAvailBedMap.get(w.id) || 0,
    }));
    this.saveWards(updatedWards);
  }

  private static syncWardHierarchy(updatedWard: Ward): void {
    const rooms = this.getRooms();
    const beds = this.getBeds();

    const newRooms = rooms.map((r) => {
      if (r.wardId === updatedWard.id) {
        return {
          ...r,
          wardName: updatedWard.name,
          departmentId: updatedWard.departmentId,
          departmentName: updatedWard.departmentName,
        };
      }
      return r;
    });
    this.saveRooms(newRooms);

    const newBeds = beds.map((b) => {
      if (b.wardId === updatedWard.id) {
        return {
          ...b,
          wardName: updatedWard.name,
          departmentId: updatedWard.departmentId,
          departmentName: updatedWard.departmentName,
        };
      }
      return b;
    });
    this.saveBeds(newBeds);
  }

  private static syncRoomHierarchy(updatedRoom: Room): void {
    const beds = this.getBeds();
    const newBeds = beds.map((b) => {
      if (b.roomId === updatedRoom.id) {
        return {
          ...b,
          roomName: updatedRoom.name,
          wardId: updatedRoom.wardId,
          wardName: updatedRoom.wardName,
          departmentId: updatedRoom.departmentId,
          departmentName: updatedRoom.departmentName,
        };
      }
      return b;
    });
    this.saveBeds(newBeds);
  }

  /**
   * Top Shared Summary - strictly reconciled
   * Total Beds = Available + Occupied + Out of Service / Reserved
   */
  static getTopSummary() {
    const wards = this.getWards();
    const rooms = this.getRooms();
    const beds = this.getBeds();

    const totalWards = wards.length;
    const totalRooms = rooms.length;
    const totalBeds = beds.length;

    const availableBeds = beds.filter(
      (b) => b.occupancyStatus === 'Available' && b.operationalStatus === 'Active'
    ).length;

    const occupiedBeds = beds.filter((b) => b.occupancyStatus === 'Occupied').length;

    // Reserved or Non-Active (Cleaning, Maintenance, Out of Service)
    const outOfServiceBeds = beds.filter(
      (b) => b.operationalStatus !== 'Active' || b.occupancyStatus === 'Reserved'
    ).length;

    return {
      totalWards,
      totalRooms,
      totalBeds,
      availableBeds,
      occupiedBeds,
      outOfServiceBeds,
    };
  }

  // ----------------------------------------------------
  // BULK IMPORT & VALIDATION
  // ----------------------------------------------------
  static validateWardImportRows(
    rows: any[],
    existingWards: Ward[] = this.getWards()
  ): { totalRows: number; validRows: WardImportRow[]; invalidRows: WardImportRow[] } {
    const validRows: WardImportRow[] = [];
    const invalidRows: WardImportRow[] = [];
    const existingCodes = new Set(existingWards.map((w) => w.code.toUpperCase()));
    const batchCodes = new Set<string>();
    const departments = DepartmentService.getDepartments();
    const deptCodes = new Set(departments.map((d) => d.code.toUpperCase()));

    rows.forEach((r, idx) => {
      const rowNumber = idx + 2;
      const errors: string[] = [];

      const wardCode = String(r['Ward Code'] || r['wardCode'] || '').trim().toUpperCase();
      const wardName = String(r['Ward Name'] || r['wardName'] || '').trim();
      const departmentCode = String(r['Department Code'] || r['departmentCode'] || '').trim().toUpperCase();
      const wardType = String(r['Ward Type'] || r['wardType'] || 'General').trim();
      const genderPolicy = String(r['Gender Policy'] || r['genderPolicy'] || 'Not Applicable').trim();
      const floor = String(r['Floor'] || r['floor'] || '').trim();
      const location = String(r['Location'] || r['location'] || '').trim();
      const status = String(r['Status'] || r['status'] || 'Active').trim();

      if (!wardCode) {
        errors.push('Ward Code is required.');
      } else if (!/^[A-Z0-9-]+$/.test(wardCode)) {
        errors.push('Ward Code must contain uppercase alphanumeric and hyphens only.');
      } else if (existingCodes.has(wardCode)) {
        errors.push(`Ward Code "${wardCode}" already exists.`);
      } else if (batchCodes.has(wardCode)) {
        errors.push(`Duplicate Ward Code "${wardCode}" within import file.`);
      } else {
        batchCodes.add(wardCode);
      }

      if (!wardName) errors.push('Ward Name is required.');
      if (!departmentCode) {
        errors.push('Department Code is required.');
      } else if (!deptCodes.has(departmentCode)) {
        errors.push(`Department Code "${departmentCode}" not found.`);
      }

      const item: WardImportRow = {
        rowNumber,
        wardCode,
        wardName,
        departmentCode,
        wardType,
        genderPolicy,
        floor,
        location,
        status: status.toLowerCase() === 'inactive' ? 'Inactive' : 'Active',
        isValid: errors.length === 0,
        errors,
      };

      if (item.isValid) validRows.push(item);
      else invalidRows.push(item);
    });

    return { totalRows: rows.length, validRows, invalidRows };
  }

  static importWards(validRows: WardImportRow[], currentUser?: User | null): number {
    const departments = DepartmentService.getDepartments();
    const deptMap = new Map(departments.map((d) => [d.code.toUpperCase(), d]));
    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();

    const newWards: Ward[] = validRows.map((r) => {
      const dept = deptMap.get(r.departmentCode.toUpperCase())!;
      return {
        id: `wrd_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        code: r.wardCode,
        name: r.wardName,
        departmentId: dept.id,
        departmentName: dept.name,
        wardType: (r.wardType as WardType) || 'General',
        genderPolicy: (r.genderPolicy as GenderPolicy) || 'Not Applicable',
        floor: r.floor || 'Ground Floor',
        location: r.location || 'Main Building',
        description: 'Imported via spreadsheet batch',
        roomCount: 0,
        bedCount: 0,
        availableBeds: 0,
        status: r.status as 'Active' | 'Inactive',
        historicalAdmissionCount: 0,
        createdBy: auditUser,
        createdAt: auditTime,
        updatedBy: auditUser,
        updatedAt: auditTime,
      };
    });

    const currentWards = this.getWards();
    this.saveWards([...newWards, ...currentWards]);
    return newWards.length;
  }

  static validateRoomImportRows(
    rows: any[],
    existingRooms: Room[] = this.getRooms(),
    existingWards: Ward[] = this.getWards()
  ): { totalRows: number; validRows: RoomImportRow[]; invalidRows: RoomImportRow[] } {
    const validRows: RoomImportRow[] = [];
    const invalidRows: RoomImportRow[] = [];
    const existingCodes = new Set(existingRooms.map((r) => r.code.toUpperCase()));
    const batchCodes = new Set<string>();
    const wardCodes = new Set(existingWards.map((w) => w.code.toUpperCase()));

    rows.forEach((r, idx) => {
      const rowNumber = idx + 2;
      const errors: string[] = [];

      const roomCode = String(r['Room Code'] || r['roomCode'] || '').trim().toUpperCase();
      const roomNumber = String(r['Room Number'] || r['roomNumber'] || '').trim();
      const roomName = String(r['Room Name'] || r['roomName'] || '').trim();
      const wardCode = String(r['Ward Code'] || r['wardCode'] || '').trim().toUpperCase();
      const roomType = String(r['Room Type'] || r['roomType'] || 'General').trim();
      const capacity = parseInt(r['Capacity'] || r['capacity'] || '2', 10);
      const dailyRoomRate = parseFloat(r['Daily Room Rate (PKR)'] || r['dailyRoomRate'] || '3500');
      const status = String(r['Status'] || r['status'] || 'Active').trim();

      if (!roomCode) {
        errors.push('Room Code is required.');
      } else if (!/^[A-Z0-9-]+$/.test(roomCode)) {
        errors.push('Room Code must contain uppercase alphanumeric and hyphens only.');
      } else if (existingCodes.has(roomCode)) {
        errors.push(`Room Code "${roomCode}" already exists.`);
      } else if (batchCodes.has(roomCode)) {
        errors.push(`Duplicate Room Code "${roomCode}" in import.`);
      } else {
        batchCodes.add(roomCode);
      }

      if (!roomNumber) errors.push('Room Number is required.');
      if (!roomName) errors.push('Room Name is required.');
      if (!wardCode) {
        errors.push('Ward Code is required.');
      } else if (!wardCodes.has(wardCode)) {
        errors.push(`Parent Ward Code "${wardCode}" not found.`);
      }

      if (isNaN(capacity) || capacity < 1) errors.push('Capacity must be >= 1.');
      if (isNaN(dailyRoomRate) || dailyRoomRate < 0) errors.push('Daily rate must be >= 0.');

      const item: RoomImportRow = {
        rowNumber,
        roomCode,
        roomNumber,
        roomName,
        wardCode,
        roomType,
        capacity: isNaN(capacity) ? 2 : capacity,
        dailyRoomRate: isNaN(dailyRoomRate) ? 3500 : dailyRoomRate,
        status: status.toLowerCase() === 'inactive' ? 'Inactive' : 'Active',
        isValid: errors.length === 0,
        errors,
      };

      if (item.isValid) validRows.push(item);
      else invalidRows.push(item);
    });

    return { totalRows: rows.length, validRows, invalidRows };
  }

  static importRooms(validRows: RoomImportRow[], currentUser?: User | null): number {
    const wards = this.getWards();
    const wardMap = new Map(wards.map((w) => [w.code.toUpperCase(), w]));
    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();

    const newRooms: Room[] = validRows.map((r) => {
      const ward = wardMap.get(r.wardCode.toUpperCase())!;
      return {
        id: `rm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        code: r.roomCode,
        roomNumber: r.roomNumber,
        name: r.roomName,
        wardId: ward.id,
        wardName: ward.name,
        departmentId: ward.departmentId,
        departmentName: ward.departmentName,
        roomType: (r.roomType as RoomType) || 'General',
        floor: ward.floor || 'Ground Floor',
        capacity: r.capacity,
        bedsConfigured: 0,
        dailyRoomRate: r.dailyRoomRate,
        status: r.status as 'Active' | 'Inactive',
        admissionLinkageCount: 0,
        createdBy: auditUser,
        createdAt: auditTime,
        updatedBy: auditUser,
        updatedAt: auditTime,
      };
    });

    const currentRooms = this.getRooms();
    this.saveRooms([...newRooms, ...currentRooms]);
    this.refreshWardCounts();
    return newRooms.length;
  }

  static validateBedImportRows(
    rows: any[],
    existingBeds: Bed[] = this.getBeds(),
    existingRooms: Room[] = this.getRooms(),
    existingWards: Ward[] = this.getWards()
  ): { totalRows: number; validRows: BedImportRow[]; invalidRows: BedImportRow[] } {
    const validRows: BedImportRow[] = [];
    const invalidRows: BedImportRow[] = [];
    const existingCodes = new Set(existingBeds.map((b) => b.code.toUpperCase()));
    const batchCodes = new Set<string>();
    const roomCodes = new Set(existingRooms.map((r) => r.code.toUpperCase()));

    rows.forEach((r, idx) => {
      const rowNumber = idx + 2;
      const errors: string[] = [];

      const bedCode = String(r['Bed Code'] || r['bedCode'] || '').trim().toUpperCase();
      const bedNumber = String(r['Bed Number'] || r['bedNumber'] || '').trim();
      const roomCode = String(r['Room Code'] || r['roomCode'] || '').trim().toUpperCase();
      const bedType = String(r['Bed Type'] || r['bedType'] || 'Standard').trim();
      const dailyBedRate = parseFloat(r['Daily Bed Rate (PKR)'] || r['dailyBedRate'] || '2000');
      const operationalStatus = String(r['Operational Status'] || r['operationalStatus'] || 'Active').trim();

      if (!bedCode) {
        errors.push('Bed Code is required.');
      } else if (!/^[A-Z0-9-]+$/.test(bedCode)) {
        errors.push('Bed Code must contain uppercase alphanumeric and hyphens only.');
      } else if (existingCodes.has(bedCode)) {
        errors.push(`Bed Code "${bedCode}" already exists.`);
      } else if (batchCodes.has(bedCode)) {
        errors.push(`Duplicate Bed Code "${bedCode}" in import.`);
      } else {
        batchCodes.add(bedCode);
      }

      if (!bedNumber) errors.push('Bed Number is required.');
      if (!roomCode) {
        errors.push('Room Code is required.');
      } else if (!roomCodes.has(roomCode)) {
        errors.push(`Parent Room Code "${roomCode}" not found.`);
      }

      if (isNaN(dailyBedRate) || dailyBedRate < 0) errors.push('Daily rate must be >= 0.');

      const item: BedImportRow = {
        rowNumber,
        bedCode,
        bedNumber,
        roomCode,
        bedType,
        dailyBedRate: isNaN(dailyBedRate) ? 2000 : dailyBedRate,
        occupancyStatus: 'Available',
        operationalStatus: operationalStatus.toLowerCase() === 'out of service' ? 'Out of Service' : 'Active',
        isValid: errors.length === 0,
        errors,
      };

      if (item.isValid) validRows.push(item);
      else invalidRows.push(item);
    });

    return { totalRows: rows.length, validRows, invalidRows };
  }

  static importBeds(validRows: BedImportRow[], currentUser?: User | null): number {
    const rooms = this.getRooms();
    const roomMap = new Map(rooms.map((r) => [r.code.toUpperCase(), r]));
    const auditUser = formatAuditUser(currentUser);
    const auditTime = formatAuditTimestamp();

    const newBeds: Bed[] = validRows.map((r) => {
      const room = roomMap.get(r.roomCode.toUpperCase())!;
      return {
        id: `bed_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        code: r.bedCode,
        bedNumber: r.bedNumber,
        roomId: room.id,
        roomNumber: room.roomNumber,
        roomName: room.name,
        wardId: room.wardId,
        wardName: room.wardName,
        departmentId: room.departmentId,
        departmentName: room.departmentName,
        bedType: (r.bedType as BedType) || 'Standard',
        dailyBedRate: r.dailyBedRate,
        dailyRate: r.dailyBedRate,
        occupancyStatus: 'Available',
        operationalStatus: (r.operationalStatus as BedOperationalStatus) || 'Active',
        historicalAdmissionCount: 0,
        createdBy: auditUser,
        createdAt: auditTime,
        updatedBy: auditUser,
        updatedAt: auditTime,
      };
    });

    const currentBeds = this.getBeds();
    this.saveBeds([...newBeds, ...currentBeds]);
    this.refreshWardCounts();
    return newBeds.length;
  }

  // ----------------------------------------------------
  // FILTERING
  // ----------------------------------------------------
  static filterWards(wards: Ward[], filters: WardFilterState): Ward[] {
    return wards.filter((w) => {
      if (filters.searchTerm.trim()) {
        const q = filters.searchTerm.toLowerCase().trim();
        const mCode = w.code.toLowerCase().includes(q);
        const mName = w.name.toLowerCase().includes(q);
        const mDept = w.departmentName.toLowerCase().includes(q);
        if (!mCode && !mName && !mDept) return false;
      }
      if (filters.departmentId !== 'All' && w.departmentId !== filters.departmentId) return false;
      if (filters.wardType !== 'All' && w.wardType !== filters.wardType) return false;
      if (filters.status !== 'All' && w.status !== filters.status) return false;
      return true;
    });
  }

  static filterRooms(rooms: Room[], filters: RoomFilterState): Room[] {
    return rooms.filter((r) => {
      if (filters.searchTerm.trim()) {
        const q = filters.searchTerm.toLowerCase().trim();
        const mCode = r.code.toLowerCase().includes(q);
        const mNum = r.roomNumber.toLowerCase().includes(q);
        const mName = r.name.toLowerCase().includes(q);
        const mWard = r.wardName.toLowerCase().includes(q);
        if (!mCode && !mNum && !mName && !mWard) return false;
      }
      if (filters.wardId !== 'All' && r.wardId !== filters.wardId) return false;
      if (filters.roomType !== 'All' && r.roomType !== filters.roomType) return false;
      if (filters.status !== 'All' && r.status !== filters.status) return false;
      return true;
    });
  }

  static filterBeds(beds: Bed[], filters: BedFilterState): Bed[] {
    return beds.filter((b) => {
      if (filters.searchTerm.trim()) {
        const q = filters.searchTerm.toLowerCase().trim();
        const mCode = b.code.toLowerCase().includes(q);
        const mNum = b.bedNumber.toLowerCase().includes(q);
        const mRoom = b.roomName.toLowerCase().includes(q);
        const mWard = b.wardName.toLowerCase().includes(q);
        if (!mCode && !mNum && !mRoom && !mWard) return false;
      }
      if (filters.wardId !== 'All' && b.wardId !== filters.wardId) return false;
      if (filters.roomId !== 'All' && b.roomId !== filters.roomId) return false;
      if (filters.bedType !== 'All' && b.bedType !== filters.bedType) return false;
      if (filters.occupancyStatus !== 'All' && b.occupancyStatus !== filters.occupancyStatus) return false;
      if (filters.operationalStatus !== 'All' && b.operationalStatus !== filters.operationalStatus) return false;
      return true;
    });
  }
}
