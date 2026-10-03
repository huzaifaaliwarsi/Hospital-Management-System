import { env } from '@/config/env';

export const pharmacyBridgeClient = {
  async getMedicines(search?: string) {
    try {
      const url = new URL(`${env.PHARMACY_BACKEND_URL}/pharmacy/medicines`);
      if (search) url.searchParams.set('search', search);

      const res = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'x-bridge-token': env.INTERNAL_BRIDGE_SECRET,
        },
      });

      if (!res.ok) return null;
      const data = await res.json();
      return (data as any).data;
    } catch {
      return null;
    }
  },

  async dispatchMedicineRequest(payload: {
    externalAdmissionRef: string;
    externalRequestRef: string;
    patientNameSnapshot?: string;
    urgency?: string;
    requestedByExternal?: string;
    lines: Array<{ medicineId: string; requestedQuantity: number; notes?: string }>;
  }) {
    try {
      const url = `${env.PHARMACY_BACKEND_URL}/hms-requests`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bridge-token': env.INTERNAL_BRIDGE_SECRET,
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error((errJson as any)?.error?.message || `Pharmacy returned HTTP ${res.status}`);
      }

      const json = await res.json();
      return (json as any).data;
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[pharmacyBridgeClient] dispatchMedicineRequest failed:', err.message);
      throw err;
    }
  },

  async notifyPatientCollected(payload: {
    pharmacyInvoiceNumber: string;
    collectedAmount: number;
    receiptNumber?: string;
    collectedAt?: string;
  }) {
    try {
      const url = `${env.PHARMACY_BACKEND_URL}/hms-requests/callback/patient-collected`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bridge-token': env.INTERNAL_BRIDGE_SECRET,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        // eslint-disable-next-line no-console
        console.warn('[pharmacyBridgeClient] notifyPatientCollected warning:', errJson);
      }
      return await res.json().catch(() => ({}));
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[pharmacyBridgeClient] notifyPatientCollected failed:', err.message);
      return null;
    }
  },

  async releaseSettlement(payload: {
    settlementNumber: string;
    pharmacyInvoiceNumber: string;
    releasedAmount: number;
    remainingPayable: number;
    paymentMethod?: string;
    paymentReference?: string;
    releasedBy?: string;
    releasedAt?: string;
    remarks?: string;
  }) {
    try {
      const url = `${env.PHARMACY_BACKEND_URL}/hms-requests/settlement/release`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-bridge-token': env.INTERNAL_BRIDGE_SECRET,
        },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error((errJson as any)?.error?.message || `Pharmacy returned HTTP ${res.status}`);
      }
      return await res.json();
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[pharmacyBridgeClient] releaseSettlement failed:', err.message);
      throw err;
    }
  },
};
