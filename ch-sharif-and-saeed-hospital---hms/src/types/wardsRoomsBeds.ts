export type WardType =
  | 'General'
  | 'Private'
  | 'Semi-Private'
  | 'ICU'
  | 'NICU'
  | 'PICU'
  | 'Pediatric'
  | 'Emergency Holding'
  | 'Isolation'
  | 'Maternity'
  | 'Other';

export type GenderPolicy =
  | 'Male'
  | 'Female'
  | 'Mixed'
  | 'Pediatric'
  | 'Not Applicable';

export type RoomType =
  | 'General'
  | 'Private'
  | 'Semi-Private'
  | 'ICU'
  | 'Isolation'
  | 'Suite'
  | 'Shared'
  | 'Other';

export type BedType =
  | 'Standard'
  | 'Private'
  | 'Semi-Private'
  | 'ICU'
  | 'NICU'
  | 'PICU'
  | 'Pediatric'
  | 'Isolation'
  | 'Emergency'
  | 'Other';

export type BedOccupancyStatus = 'Available' | 'Occupied' | 'Reserved' | 'Maintenance';

export type BedOperationalStatus = 'Active' | 'Cleaning' | 'Maintenance' | 'Out of Service' | 'Decommissioned';

export interface Ward {
  id: string;
  code: string;
  name: string;

  departmentId: string;
  departmentName: string;

  wardType: WardType;
  genderPolicy?: GenderPolicy;

  floor?: string;
  location?: string;
  description?: string;

  roomCount: number;
  bedCount: number;
  availableBeds?: number;

  status: 'Active' | 'Inactive';

  // Safeguard linkages
  historicalAdmissionCount?: number;

  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;

  statusChangedBy?: string;
  statusChangedAt?: string;
}

export interface Room {
  id: string;
  code: string;
  roomNumber: string;
  name: string;

  wardId: string;
  wardName: string;

  departmentId: string;
  departmentName: string;

  roomType: RoomType;
  floor?: string;
  capacity: number;
  bedsConfigured: number;

  dailyRoomRate: number; // PKR

  status: 'Active' | 'Inactive';

  // Safeguard linkages
  admissionLinkageCount?: number;

  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;

  statusChangedBy?: string;
  statusChangedAt?: string;
}

export interface Bed {
  id: string;
  code: string;
  bedNumber: string;

  roomId: string;
  roomName: string;

  wardId: string;
  wardName: string;

  departmentId: string;
  departmentName: string;

  bedType: BedType;
  dailyRate: number; // PKR
  dailyBedRate: number; // PKR

  occupancyStatus: BedOccupancyStatus;
  operationalStatus: BedOperationalStatus;

  currentPatientId?: string;
  currentPatientName?: string;
  admissionId?: string;

  // Safeguard linkages
  historicalAdmissionCount?: number;

  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;

  statusChangedBy?: string;
  statusChangedAt?: string;
}

export interface WardFilterState {
  searchTerm: string;
  departmentId: string;
  wardType: string;
  status: string;
}

export interface RoomFilterState {
  searchTerm: string;
  wardId: string;
  roomType: string;
  status: string;
}

export interface BedFilterState {
  searchTerm: string;
  wardId: string;
  roomId: string;
  bedType: string;
  occupancyStatus: string;
  operationalStatus: string;
}

export interface WardFormValues {
  code: string;
  name: string;
  departmentId: string;
  wardType: WardType;
  genderPolicy: GenderPolicy;
  floor: string;
  location: string;
  description: string;
  status: 'Active' | 'Inactive';
}

export interface RoomFormValues {
  code: string;
  roomNumber: string;
  name: string;
  wardId: string;
  roomType: RoomType;
  floor: string;
  capacity: number;
  dailyRoomRate: number;
  status: 'Active' | 'Inactive';
  autoGenerateBeds?: boolean;
}

export interface BedFormValues {
  code: string;
  bedNumber: string;
  roomId: string;
  bedType: BedType;
  dailyBedRate: number;
  dailyRate?: number;
  occupancyStatus: BedOccupancyStatus;
  operationalStatus: BedOperationalStatus;
  quantity?: number;
  additionalBeds?: number;
  numberingPrefix?: string;
}

export interface WardImportRow {
  rowNumber: number;
  wardCode: string;
  wardName: string;
  departmentCode: string;
  wardType: string;
  genderPolicy?: string;
  floor?: string;
  location?: string;
  status: string;
  isValid: boolean;
  errors: string[];
}

export interface RoomImportRow {
  rowNumber: number;
  roomCode: string;
  roomNumber: string;
  roomName: string;
  wardCode: string;
  roomType: string;
  capacity: number;
  dailyRoomRate: number;
  status: string;
  isValid: boolean;
  errors: string[];
}

export interface BedImportRow {
  rowNumber: number;
  bedCode: string;
  bedNumber: string;
  roomCode: string;
  bedType: string;
  dailyBedRate: number;
  occupancyStatus?: string;
  operationalStatus: string;
  isValid: boolean;
  errors: string[];
}
