import apiClient from './apiClient';

export interface BackendPatient {
  id: string;
  mrn: string;
  fullName: string;
  cnic?: string;
  phone: string;
  gender: string;
  dob?: string;
  address?: string;
  guardianName?: string;
  guardianRelation?: string;
  bloodGroup?: string;
  createdAt: string;
}

export interface BackendAppointment {
  id: string;
  tokenNumber: number;
  scheduledAt: string;
  status: string;
  encounterType: string;
  patient: BackendPatient;
  doctor: { id: string; fullName: string; designation: string };
  department: { id: string; name: string };
}

export interface BackendInvoice {
  id: string;
  invoiceNumber: string;
  sourceType: string;
  status: string;
  subtotal: string | number;
  discountTotal: string | number;
  taxTotal: string | number;
  total: string | number;
  paidTotal: string | number;
  balanceDue: string | number;
  createdAt: string;
  lines: Array<{
    id: string;
    description: string;
    quantity: number;
    rateSnapshot: string | number;
    lineNet: string | number;
  }>;
}

export const frontdeskApiService = {
  // Patients — use `services/patientRegistryService.ts` instead (this file
  // never had patient methods that matched the real split endpoints —
  // `/patients/panel` for Corporate/Panel and `/patients/encounters` for
  // Self-Pay, never a bare `/patients` — patientRegistryService.ts already
  // implements that correctly and is what NewAdmissionView.tsx uses).

  // Appointments
  async getAppointments(date?: string, doctorStaffId?: string) {
    const res = await apiClient.get<{ data: BackendAppointment[] }>('/appointments', {
      params: { date, doctorStaffId },
    });
    return res.data.data;
  },

  // NOTE: `createAppointment`/`updateAppointmentStatus` below have not been
  // verified against the real `bookAppointmentSchema`/route shapes (no
  // `PATCH /appointments/:id/status` route exists — status changes go
  // through `/:id/cancel` or `/:id/check-in` instead) and are unused so
  // far. Verify against `admission.schemas.ts`/`appointments.routes.ts`
  // before wiring a real Appointments page to them.
  async createAppointment(data: {
    patientId: string;
    doctorStaffId: string;
    departmentId: string;
    encounterType: string;
    scheduledAt: string;
    notes?: string;
  }) {
    const res = await apiClient.post<{ data: BackendAppointment }>('/appointments', data);
    return res.data.data;
  },

  async updateAppointmentStatus(id: string, status: string) {
    const res = await apiClient.patch<{ data: BackendAppointment }>(`/appointments/${id}/status`, {
      status,
    });
    return res.data.data;
  },

  // Invoices & Cashiering
  async getInvoices(search?: string, status?: string) {
    const res = await apiClient.get<{ data: BackendInvoice[] }>('/invoices', {
      params: { search, status },
    });
    return res.data.data;
  },

  async getInvoiceById(id: string) {
    const res = await apiClient.get<{ data: BackendInvoice }>(`/invoices/${id}`);
    return res.data.data;
  },

  // NOTE: there is no `POST /invoices` create route on the real backend —
  // invoices come from the encounter/admission billing flow instead
  // (`POST /encounters`, `/encounters/:id/services`, admission services).
  // Unused so far; verify before wiring a real "New Invoice" page to it.
  async createInvoice(data: {
    patientId: string;
    appointmentId?: string;
    sourceType: string;
    lines: Array<{
      serviceRateId?: string;
      description: string;
      quantity: number;
      rate: number;
      doctorStaffId?: string;
    }>;
  }) {
    const res = await apiClient.post<{ data: BackendInvoice }>('/invoices', data);
    return res.data.data;
  },

  async recordPayment(
    invoiceId: string,
    data: {
      amount: number;
      paymentMethod: string;
      referenceNote?: string;
    },
  ) {
    const res = await apiClient.post<{ data: any }>(`/invoices/${invoiceId}/payments`, data);
    return res.data.data;
  },

  /** `GET /cash/balance-sheet` — the logged-in cashier's own unsettled collections (§4.9). */
  async getCashBalance() {
    const res = await apiClient.get<{ data: any }>('/cash/balance-sheet');
    return res.data.data;
  },
};
