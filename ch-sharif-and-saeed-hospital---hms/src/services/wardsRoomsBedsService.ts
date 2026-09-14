import apiClient from './apiClient';
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
import { DepartmentService } from './departmentService';
import { formatDisplayDate } from '../utils/dateConstants';

/**
 * Live Wards/Rooms/Beds service — a single `GET /setup/wards-rooms-beds`
 * call returns the full Department→Ward→Room→Bed hierarchy (with computed
 * counts and resolved actor labels from `setup.service.ts`), which is then
 * flattened here into the three separate cached arrays the existing
 * flat-list UI (`Ward[]`, `Room[]`, `Bed[]`) expects. Same in-memory-cache
 * pattern as Departments/Services — never localStorage.
 */

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

export const VALID_GENDER_POLICIES: GenderPolicy[] = ['Male', 'Female', 'Mixed', 'Pediatric', 'Not Applicable'];

export const VALID_ROOM_TYPES: RoomType[] = ['General', 'Private', 'Semi-Private', 'ICU', 'Isolation', 'Suite', 'Shared', 'Other'];

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

const OCCUPANCY_FROM_BACKEND: Record<string, BedOccupancyStatus> = {
  AVAILABLE: 'Available',
  RESERVED: 'Reserved',
  OCCUPIED: 'Occupied',
  OUT_OF_SERVICE: 'Maintenance',
};
const OCCUPANCY_TO_BACKEND: Record<BedOccupancyStatus, string> = {
  Available: 'AVAILABLE',
  Reserved: 'RESERVED',
  Occupied: 'OCCUPIED',
  Maintenance: 'OUT_OF_SERVICE',
};
const OPERATIONAL_FROM_BACKEND: Record<string, BedOperationalStatus> = {
  ACTIVE: 'Active',
  CLEANING: 'Cleaning',
  MAINTENANCE: 'Maintenance',
  OUT_OF_SERVICE: 'Out of Service',
  DECOMMISSIONED: 'Decommissioned',
};
const OPERATIONAL_TO_BACKEND: Record<BedOperationalStatus, string> = {
  Active: 'ACTIVE',
  Cleaning: 'CLEANING',
  Maintenance: 'MAINTENANCE',
  'Out of Service': 'OUT_OF_SERVICE',
  Decommissioned: 'DECOMMISSIONED',
};

function formatTimestamp(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const dateStr = formatDisplayDate(d);
  const timeStr = d.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' });
  return `${dateStr}, ${timeStr}`;
}

function toWard(raw: Record<string, any>): Ward {
  return {
    id: raw.id,
    code: raw.code || '',
    name: raw.name,
    departmentId: raw.departmentId,
    departmentName: raw.department?.name || '',
    wardType: (raw.wardType as WardType) || 'Other',
    genderPolicy: (raw.genderPolicy as GenderPolicy) || undefined,
    floor: raw.floor || undefined,
    location: raw.location || undefined,
    description: raw.description || undefined,
    roomCount: raw.roomCount ?? 0,
    bedCount: raw.bedCount ?? 0,
    availableBeds: raw.availableBeds ?? 0,
    status: raw.isActive ? 'Active' : 'Inactive',
    historicalAdmissionCount: 0,
    createdBy: raw.createdByLabel || 'System',
    createdAt: formatTimestamp(raw.createdAt),
    updatedBy: raw.updatedByLabel || 'System',
    updatedAt: formatTimestamp(raw.updatedAt),
    statusChangedBy: raw.statusChangedBy || undefined,
    statusChangedAt: raw.statusChangedAt ? formatTimestamp(raw.statusChangedAt) : undefined,
  };
}

function toRoom(raw: Record<string, any>, ward: { name: string; departmentId: string; departmentName: string }): Room {
  return {
    id: raw.id,
    code: raw.code || '',
    roomNumber: raw.roomNumber || '',
    name: raw.name,
    wardId: raw.wardId,
    wardName: ward.name,
    departmentId: ward.departmentId,
    departmentName: ward.departmentName,
    roomType: (raw.roomType as RoomType) || 'Other',
    floor: raw.floor || undefined,
    capacity: raw.capacity ?? 0,
    bedsConfigured: raw.bedsConfigured ?? 0,
    dailyRoomRate: Number(raw.dailyRoomRate ?? 0),
    status: raw.isActive ? 'Active' : 'Inactive',
    admissionLinkageCount: 0,
    createdBy: raw.createdByLabel || 'System',
    createdAt: formatTimestamp(raw.createdAt),
    updatedBy: raw.updatedByLabel || 'System',
    updatedAt: formatTimestamp(raw.updatedAt),
    statusChangedBy: raw.statusChangedBy || undefined,
    statusChangedAt: raw.statusChangedAt ? formatTimestamp(raw.statusChangedAt) : undefined,
  };
}

function toBed(
  raw: Record<string, any>,
  room: { name: string; wardId: string; wardName: string; departmentId: string; departmentName: string }
): Bed {
  return {
    id: raw.id,
    code: raw.code || '',
    bedNumber: raw.bedNumber,
    roomId: raw.roomId,
    roomName: room.name,
    wardId: room.wardId,
    wardName: room.wardName,
    departmentId: room.departmentId,
    departmentName: room.departmentName,
    bedType: (raw.bedType as BedType) || 'Other',
    dailyRate: Number(raw.dailyRate ?? 0),
    dailyBedRate: Number(raw.dailyRate ?? 0),
    occupancyStatus: OCCUPANCY_FROM_BACKEND[raw.status] || 'Available',
    operationalStatus: OPERATIONAL_FROM_BACKEND[raw.operationalStatus] || 'Active',
    currentPatientId: raw.currentPatientId || undefined,
    currentPatientName: raw.currentPatientName || undefined,
    admissionId: raw.admissionId || undefined,
    historicalAdmissionCount: 0,
    createdBy: raw.createdByLabel || 'System',
    createdAt: formatTimestamp(raw.createdAt),
    updatedBy: raw.updatedByLabel || 'System',
    updatedAt: formatTimestamp(raw.updatedAt),
    statusChangedBy: raw.statusChangedBy || undefined,
    statusChangedAt: raw.statusChangedAt ? formatTimestamp(raw.statusChangedAt) : undefined,
  };
}

let cachedWards: Ward[] = [];
let cachedRooms: Room[] = [];
let cachedBeds: Bed[] = [];

export async function fetchWardHierarchy(): Promise<{ wards: Ward[]; rooms: Room[]; beds: Bed[] }> {
  const res = await apiClient.get<{ data: Record<string, any>[] }>('/setup/wards-rooms-beds');
  const wards: Ward[] = [];
  const rooms: Room[] = [];
  const beds: Bed[] = [];

  for (const rawWard of res.data.data) {
    const wardInfo = { name: rawWard.name, departmentId: rawWard.departmentId, departmentName: rawWard.department?.name || '' };
    wards.push(toWard(rawWard));
    for (const rawRoom of rawWard.rooms || []) {
      const roomInfo = { name: rawRoom.name, wardId: rawWard.id, wardName: rawWard.name, ...wardInfo };
      rooms.push(toRoom(rawRoom, wardInfo));
      for (const rawBed of rawRoom.beds || []) {
        beds.push(toBed(rawBed, roomInfo));
      }
    }
  }

  cachedWards = wards;
  cachedRooms = rooms;
  cachedBeds = beds;
  return { wards, rooms, beds };
}

/** Async warm-up — call once at app startup so sync readers below have real data. */
export async function primeWardsRoomsBedsCache(): Promise<void> {
  try {
    await fetchWardHierarchy();
  } catch {
    // Leave cache empty; the Wards/Rooms/Beds page itself will surface the real error on its own fetch.
  }
}

export class WardsRoomsBedsService {
  static getWards(): Ward[] {
    return cachedWards;
  }
  static getRooms(): Room[] {
    return cachedRooms;
  }
  static getBeds(): Bed[] {
    return cachedBeds;
  }

  static getWardById(id: string): Ward | undefined {
    return cachedWards.find((w) => w.id === id);
  }
  static getRoomById(id: string): Room | undefined {
    return cachedRooms.find((r) => r.id === id);
  }
  static getBedById(id: string): Bed | undefined {
    return cachedBeds.find((b) => b.id === id);
  }

  static validateWardCode(code: string, currentId?: string): { isValid: boolean; message?: string } {
    const trimmed = code.trim().toUpperCase();
    // Optional — left blank, the backend auto-generates a unique code.
    if (!trimmed) return { isValid: true };
    if (!/^[A-Z0-9-]+$/.test(trimmed)) return { isValid: false, message: 'Code must be uppercase letters, numbers, and hyphens only.' };
    if (cachedWards.some((w) => w.code.toUpperCase() === trimmed && w.id !== currentId)) {
      return { isValid: false, message: `Ward code "${trimmed}" already exists.` };
    }
    return { isValid: true };
  }

  static validateRoomCode(code: string, currentId?: string): { isValid: boolean; message?: string } {
    const trimmed = code.trim().toUpperCase();
    // Optional — left blank, the backend auto-generates a unique code.
    if (!trimmed) return { isValid: true };
    if (!/^[A-Z0-9-]+$/.test(trimmed)) return { isValid: false, message: 'Code must be uppercase letters, numbers, and hyphens only.' };
    if (cachedRooms.some((r) => r.code.toUpperCase() === trimmed && r.id !== currentId)) {
      return { isValid: false, message: `Room code "${trimmed}" already exists.` };
    }
    return { isValid: true };
  }

  static validateBedCode(code: string, currentId?: string): { isValid: boolean; message?: string } {
    const trimmed = code.trim().toUpperCase();
    // Optional — left blank, the backend auto-generates a unique code.
    if (!trimmed) return { isValid: true };
    if (!/^[A-Z0-9-]+$/.test(trimmed)) return { isValid: false, message: 'Code must be uppercase letters, numbers, and hyphens only.' };
    if (cachedBeds.some((b) => b.code.toUpperCase() === trimmed && b.id !== currentId)) {
      return { isValid: false, message: `Bed code "${trimmed}" already exists.` };
    }
    return { isValid: true };
  }

  // ── Wards ──────────────────────────────────────────────────────────
  static async createWard(values: WardFormValues, _currentUser?: User | null): Promise<Ward> {
    const res = await apiClient.post<{ data: { id: string } }>('/setup/wards-rooms-beds/wards', {
      code: values.code?.trim() || undefined,
      departmentId: values.departmentId,
      name: values.name.trim(),
      wardType: values.wardType,
      genderPolicy: values.genderPolicy,
      floor: values.floor?.trim() || undefined,
      location: values.location?.trim() || undefined,
      description: values.description?.trim() || undefined,
      isActive: values.status === 'Active',
    });
    await fetchWardHierarchy();
    return cachedWards.find((w) => w.id === res.data.data.id)!;
  }

  static async updateWard(id: string, values: WardFormValues, _currentUser?: User | null): Promise<Ward> {
    await apiClient.patch(`/setup/wards-rooms-beds/wards/${id}`, {
      code: values.code?.trim() || undefined,
      departmentId: values.departmentId,
      name: values.name.trim(),
      wardType: values.wardType,
      genderPolicy: values.genderPolicy,
      floor: values.floor?.trim() || undefined,
      location: values.location?.trim() || undefined,
      description: values.description?.trim() || undefined,
      isActive: values.status === 'Active',
    });
    await fetchWardHierarchy();
    return cachedWards.find((w) => w.id === id)!;
  }

  static async changeWardStatus(id: string, newStatus: 'Active' | 'Inactive', _currentUser?: User | null): Promise<Ward> {
    await apiClient.patch(`/setup/wards-rooms-beds/wards/${id}`, { isActive: newStatus === 'Active' });
    await fetchWardHierarchy();
    return cachedWards.find((w) => w.id === id)!;
  }

  static async deleteWard(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      await apiClient.delete(`/setup/wards-rooms-beds/wards/${id}`);
      await fetchWardHierarchy();
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to delete ward.' };
    }
  }

  // ── Rooms ──────────────────────────────────────────────────────────
  static async createRoom(values: RoomFormValues, _currentUser?: User | null): Promise<Room> {
    const res = await apiClient.post<{ data: { id: string } }>('/setup/wards-rooms-beds/rooms', {
      code: values.code?.trim() || undefined,
      wardId: values.wardId,
      roomNumber: values.roomNumber?.trim() || undefined,
      name: values.name.trim(),
      roomType: values.roomType,
      capacity: values.capacity,
      dailyRoomRate: values.dailyRoomRate,
      isActive: values.status === 'Active',
    });
    await fetchWardHierarchy();
    return cachedRooms.find((r) => r.id === res.data.data.id)!;
  }

  static async updateRoom(id: string, values: RoomFormValues, _currentUser?: User | null): Promise<Room> {
    await apiClient.patch(`/setup/wards-rooms-beds/rooms/${id}`, {
      code: values.code?.trim() || undefined,
      wardId: values.wardId,
      roomNumber: values.roomNumber?.trim() || undefined,
      name: values.name.trim(),
      roomType: values.roomType,
      capacity: values.capacity,
      dailyRoomRate: values.dailyRoomRate,
      isActive: values.status === 'Active',
    });
    await fetchWardHierarchy();
    return cachedRooms.find((r) => r.id === id)!;
  }

  static async changeRoomStatus(id: string, newStatus: 'Active' | 'Inactive', _currentUser?: User | null): Promise<Room> {
    await apiClient.patch(`/setup/wards-rooms-beds/rooms/${id}`, { isActive: newStatus === 'Active' });
    await fetchWardHierarchy();
    return cachedRooms.find((r) => r.id === id)!;
  }

  static async deleteRoom(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      await apiClient.delete(`/setup/wards-rooms-beds/rooms/${id}`);
      await fetchWardHierarchy();
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to delete room.' };
    }
  }

  // ── Beds ───────────────────────────────────────────────────────────
  static async createBed(values: BedFormValues, _currentUser?: User | null): Promise<Bed> {
    const res = await apiClient.post<{ data: { id: string } }>('/setup/wards-rooms-beds/beds', {
      code: values.code?.trim() || undefined,
      roomId: values.roomId,
      bedNumber: values.bedNumber.trim(),
      bedType: values.bedType,
      dailyRate: values.dailyBedRate ?? values.dailyRate ?? 0,
      operationalStatus: OPERATIONAL_TO_BACKEND[values.operationalStatus],
    });
    await fetchWardHierarchy();
    return cachedBeds.find((b) => b.id === res.data.data.id)!;
  }

  static async updateBed(id: string, values: BedFormValues, _currentUser?: User | null): Promise<Bed> {
    await apiClient.patch(`/setup/wards-rooms-beds/beds/${id}`, {
      code: values.code?.trim() || undefined,
      bedNumber: values.bedNumber.trim(),
      bedType: values.bedType,
      dailyRate: values.dailyBedRate ?? values.dailyRate ?? 0,
      status: OCCUPANCY_TO_BACKEND[values.occupancyStatus],
      operationalStatus: OPERATIONAL_TO_BACKEND[values.operationalStatus],
    });
    await fetchWardHierarchy();
    return cachedBeds.find((b) => b.id === id)!;
  }

  static async changeBedOperationalStatus(id: string, newStatus: BedOperationalStatus, _currentUser?: User | null): Promise<Bed> {
    await apiClient.patch(`/setup/wards-rooms-beds/beds/${id}`, { operationalStatus: OPERATIONAL_TO_BACKEND[newStatus] });
    await fetchWardHierarchy();
    return cachedBeds.find((b) => b.id === id)!;
  }

  static async deleteBed(id: string): Promise<{ success: boolean; message?: string }> {
    try {
      await apiClient.delete(`/setup/wards-rooms-beds/beds/${id}`);
      await fetchWardHierarchy();
      return { success: true };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Failed to delete bed.' };
    }
  }

  // ── Aggregates ─────────────────────────────────────────────────────
  static getTopSummary() {
    const wards = this.getWards();
    const rooms = this.getRooms();
    const beds = this.getBeds();

    const totalWards = wards.length;
    const totalRooms = rooms.length;
    const totalBeds = beds.length;
    const availableBeds = beds.filter((b) => b.occupancyStatus === 'Available' && b.operationalStatus === 'Active').length;
    const occupiedBeds = beds.filter((b) => b.occupancyStatus === 'Occupied').length;
    const outOfServiceBeds = beds.filter((b) => b.operationalStatus !== 'Active' || b.occupancyStatus === 'Reserved').length;

    return { totalWards, totalRooms, totalBeds, availableBeds, occupiedBeds, outOfServiceBeds };
  }

  // ── Bulk Import ────────────────────────────────────────────────────
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

      // Ward Code is optional — left blank, the backend auto-generates a unique one.
      if (wardCode) {
        if (!/^[A-Z0-9-]+$/.test(wardCode)) {
          errors.push('Ward Code must contain uppercase alphanumeric and hyphens only.');
        } else if (existingCodes.has(wardCode)) {
          errors.push(`Ward Code "${wardCode}" already exists.`);
        } else if (batchCodes.has(wardCode)) {
          errors.push(`Duplicate Ward Code "${wardCode}" within import file.`);
        } else {
          batchCodes.add(wardCode);
        }
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

  /** Persists each validated row via a real `POST /setup/wards-rooms-beds/wards`, one at a time. */
  static async importWards(validRows: WardImportRow[]): Promise<{ imported: number; failures: string[] }> {
    const departments = DepartmentService.getDepartments();
    const deptMap = new Map(departments.map((d) => [d.code.toUpperCase(), d]));
    const failures: string[] = [];
    let imported = 0;

    for (const r of validRows) {
      const dept = deptMap.get(r.departmentCode.toUpperCase());
      if (!dept) {
        failures.push(`${r.wardCode}: department "${r.departmentCode}" not found`);
        continue;
      }
      try {
        await WardsRoomsBedsService.createWard({
          code: r.wardCode,
          name: r.wardName,
          departmentId: dept.id,
          wardType: r.wardType as WardType,
          genderPolicy: r.genderPolicy as GenderPolicy,
          floor: r.floor,
          location: r.location,
          description: '',
          status: r.status as 'Active' | 'Inactive',
        });
        imported += 1;
      } catch (err: any) {
        failures.push(`${r.wardCode}: ${err?.message || 'Failed to import'}`);
      }
    }
    return { imported, failures };
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

      // Room Code is optional — left blank, the backend auto-generates a unique one.
      if (roomCode) {
        if (!/^[A-Z0-9-]+$/.test(roomCode)) {
          errors.push('Room Code must contain uppercase alphanumeric and hyphens only.');
        } else if (existingCodes.has(roomCode)) {
          errors.push(`Room Code "${roomCode}" already exists.`);
        } else if (batchCodes.has(roomCode)) {
          errors.push(`Duplicate Room Code "${roomCode}" in import.`);
        } else {
          batchCodes.add(roomCode);
        }
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

  static async importRooms(validRows: RoomImportRow[]): Promise<{ imported: number; failures: string[] }> {
    const wards = this.getWards();
    const wardMap = new Map(wards.map((w) => [w.code.toUpperCase(), w]));
    const failures: string[] = [];
    let imported = 0;

    for (const r of validRows) {
      const ward = wardMap.get(r.wardCode.toUpperCase());
      if (!ward) {
        failures.push(`${r.roomCode}: ward "${r.wardCode}" not found`);
        continue;
      }
      try {
        await WardsRoomsBedsService.createRoom({
          code: r.roomCode,
          roomNumber: r.roomNumber,
          name: r.roomName,
          wardId: ward.id,
          roomType: r.roomType as RoomType,
          floor: ward.floor || '',
          capacity: r.capacity,
          dailyRoomRate: r.dailyRoomRate,
          status: r.status as 'Active' | 'Inactive',
        });
        imported += 1;
      } catch (err: any) {
        failures.push(`${r.roomCode}: ${err?.message || 'Failed to import'}`);
      }
    }
    return { imported, failures };
  }

  static validateBedImportRows(
    rows: any[],
    existingBeds: Bed[] = this.getBeds(),
    existingRooms: Room[] = this.getRooms(),
    _existingWards: Ward[] = this.getWards()
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

      // Bed Code is optional — left blank, the backend auto-generates a unique one.
      if (bedCode) {
        if (!/^[A-Z0-9-]+$/.test(bedCode)) {
          errors.push('Bed Code must contain uppercase alphanumeric and hyphens only.');
        } else if (existingCodes.has(bedCode)) {
          errors.push(`Bed Code "${bedCode}" already exists.`);
        } else if (batchCodes.has(bedCode)) {
          errors.push(`Duplicate Bed Code "${bedCode}" in import.`);
        } else {
          batchCodes.add(bedCode);
        }
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

  static async importBeds(validRows: BedImportRow[]): Promise<{ imported: number; failures: string[] }> {
    const rooms = this.getRooms();
    const roomMap = new Map(rooms.map((r) => [r.code.toUpperCase(), r]));
    const failures: string[] = [];
    let imported = 0;

    for (const r of validRows) {
      const room = roomMap.get(r.roomCode.toUpperCase());
      if (!room) {
        failures.push(`${r.bedCode}: room "${r.roomCode}" not found`);
        continue;
      }
      try {
        await WardsRoomsBedsService.createBed({
          code: r.bedCode,
          bedNumber: r.bedNumber,
          roomId: room.id,
          bedType: r.bedType as BedType,
          dailyBedRate: r.dailyBedRate,
          occupancyStatus: 'Available',
          operationalStatus: (r.operationalStatus as BedOperationalStatus) || 'Active',
        });
        imported += 1;
      } catch (err: any) {
        failures.push(`${r.bedCode}: ${err?.message || 'Failed to import'}`);
      }
    }
    return { imported, failures };
  }

  // ── Filtering ──────────────────────────────────────────────────────
  static filterWards(wards: Ward[], filters: WardFilterState): Ward[] {
    return wards.filter((w) => {
      if (filters.searchTerm.trim()) {
        const q = filters.searchTerm.toLowerCase().trim();
        if (!w.code.toLowerCase().includes(q) && !w.name.toLowerCase().includes(q) && !w.departmentName.toLowerCase().includes(q)) {
          return false;
        }
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
        if (
          !r.code.toLowerCase().includes(q) &&
          !r.roomNumber.toLowerCase().includes(q) &&
          !r.name.toLowerCase().includes(q) &&
          !r.wardName.toLowerCase().includes(q)
        ) {
          return false;
        }
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
        if (
          !b.code.toLowerCase().includes(q) &&
          !b.bedNumber.toLowerCase().includes(q) &&
          !b.roomName.toLowerCase().includes(q) &&
          !b.wardName.toLowerCase().includes(q)
        ) {
          return false;
        }
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
