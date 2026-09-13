import apiClient from './apiClient';

export interface BackendDepartment {
  id: string;
  name: string;
  code: string;
  type: string;
  headStaffId?: string;
  description?: string;
  isActive: boolean;
}

export interface BackendWard {
  id: string;
  name: string;
  code: string;
  departmentId: string;
  genderRestriction: string;
  isActive: boolean;
  rooms?: BackendRoom[];
}

export interface BackendRoom {
  id: string;
  wardId: string;
  roomNumber: string;
  roomType: string;
  dailyRate: string | number;
  isActive: boolean;
  beds?: BackendBed[];
}

export interface BackendBed {
  id: string;
  roomId: string;
  bedNumber: string;
  status: 'AVAILABLE' | 'RESERVED' | 'OCCUPIED' | 'OUT_OF_SERVICE';
  isActive: boolean;
}

export interface BackendServiceRate {
  id: string;
  code: string;
  name: string;
  departmentId: string;
  category: string;
  baseRate: string | number;
  doctorSharePercent?: string | number;
  isActive: boolean;
}

export interface BackendHospitalProfile {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  email?: string;
  emergencyContact?: string;
}

export const setupApiService = {
  // Hospital Profile
  async getProfile() {
    const res = await apiClient.get<{ data: BackendHospitalProfile }>('/setup/profile');
    return res.data.data;
  },

  async updateProfile(data: Partial<BackendHospitalProfile>) {
    const res = await apiClient.put<{ data: BackendHospitalProfile }>('/setup/profile', data);
    return res.data.data;
  },

  // Departments
  async getDepartments() {
    const res = await apiClient.get<{ data: BackendDepartment[] }>('/setup/departments');
    return res.data.data;
  },

  async createDepartment(data: { name: string; code: string; type: string; description?: string }) {
    const res = await apiClient.post<{ data: BackendDepartment }>('/setup/departments', data);
    return res.data.data;
  },

  // Wards, Rooms, Beds
  async getWards() {
    const res = await apiClient.get<{ data: BackendWard[] }>('/setup/wards');
    return res.data.data;
  },

  async getRooms(wardId?: string) {
    const res = await apiClient.get<{ data: BackendRoom[] }>('/setup/rooms', {
      params: { wardId },
    });
    return res.data.data;
  },

  async getBeds(roomId?: string, status?: string) {
    const res = await apiClient.get<{ data: BackendBed[] }>('/setup/beds', {
      params: { roomId, status },
    });
    return res.data.data;
  },

  // Service Rates
  async getServiceRates(departmentId?: string) {
    const res = await apiClient.get<{ data: BackendServiceRate[] }>('/setup/service-rates', {
      params: { departmentId },
    });
    return res.data.data;
  },

  // Panels
  async getPanels() {
    const res = await apiClient.get<{ data: any[] }>('/setup/panels');
    return res.data.data;
  },
};
