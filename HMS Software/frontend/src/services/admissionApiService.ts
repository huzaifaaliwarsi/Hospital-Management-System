import apiClient from './apiClient';

export interface BackendAdmission {
  id: string;
  admissionNumber: string;
  status: 'PLANNED' | 'ADMITTED' | 'DISCHARGED' | 'CANCELLED';
  medicationMode: 'SELF' | 'HOSPITAL_MANAGED';
  diagnosis?: string;
  expectedAt?: string;
  admittedAt?: string;
  dischargedAt?: string;
  estimatedAmount?: string | number;
  panelPatient?: any;
  selfPayEncounter?: any;
  department: { id: string; name: string };
  doctor: { id: string; fullName: string };
  bed?: {
    id: string;
    bedNumber: string;
    room: { id: string; roomNumber: string; ward: { id: string; name: string } };
  };
  dischargeClearances?: Array<{
    clearanceType: string;
    status: string;
    clearedAt?: string;
  }>;
}

export const admissionApiService = {
  async getAdmissions(status?: string, departmentId?: string) {
    const res = await apiClient.get<{ data: BackendAdmission[] }>('/admissions', {
      params: { status, departmentId },
    });
    return res.data.data;
  },

  async getAdmissionById(id: string) {
    const res = await apiClient.get<{ data: BackendAdmission }>(`/admissions/${id}`);
    return res.data.data;
  },

  async createPlannedAdmission(data: {
    patientId: string;
    departmentId: string;
    doctorStaffId: string;
    bedId?: string;
    diagnosis?: string;
    expectedAt?: string;
    estimatedAmount?: number;
    initialMedicationMode?: 'SELF' | 'HOSPITAL_MANAGED';
  }) {
    const res = await apiClient.post<{ data: BackendAdmission }>('/admissions/planned', data);
    return res.data.data;
  },

  async checkInAdmission(
    id: string,
    data: {
      bedId: string;
      advancePaymentReceived?: number;
      paymentMethod?: string;
    },
  ) {
    const res = await apiClient.post<{ data: BackendAdmission }>(`/admissions/${id}/check-in`, data);
    return res.data.data;
  },

  async transferBed(
    id: string,
    data: {
      toBedId: string;
      reason: string;
    },
  ) {
    const res = await apiClient.post<{ data: any }>(`/admissions/${id}/bed-transfer`, data);
    return res.data.data;
  },

  async setMedicationMode(
    id: string,
    data: {
      newMode: 'SELF' | 'HOSPITAL_MANAGED';
      reason: string;
    },
  ) {
    const res = await apiClient.post<{ data: any }>(`/admissions/${id}/medication-mode`, data);
    return res.data.data;
  },

  async requestAdvancePayment(
    id: string,
    data: {
      amount: number;
      reason: string;
    },
  ) {
    const res = await apiClient.post<{ data: any }>(`/admissions/${id}/request-advance`, data);
    return res.data.data;
  },

  async grantClearance(
    id: string,
    data: {
      clearanceType: 'CLINICAL' | 'HOSPITAL_BILLING' | 'PHARMACY';
      status: 'CLEARED' | 'WAIVED';
    },
  ) {
    const res = await apiClient.post<{ data: any }>(`/admissions/${id}/clearances`, data);
    return res.data.data;
  },

  async discharge(id: string) {
    const res = await apiClient.post<{ data: any }>(`/admissions/${id}/discharge`);
    return res.data.data;
  },

  async getDischargeSummary(id: string) {
    const res = await apiClient.get<{ data: any }>(`/admissions/${id}/discharge-summary`);
    return res.data.data;
  },
};
