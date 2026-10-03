import { env } from '@/config/env';

export const hmsBridgeClient = {
  async notifyDispensed(payload: {
    dispenseEventId?: string;
    externalAdmissionRef: string;
    externalRequestRef?: string | null;
    pharmacyInvoiceId: string;
    pharmacyInvoiceNumber: string;
    subtotal: number;
    taxTotal: number;
    discountTotal: number;
    totalAmount: number;
    deltaAmount?: number;
    dispensedBy: string;
    dispensedAt: string;
    lines: Array<{
      dispenseEventId?: string;
      externalRequestRef?: string | null;
      medicineName: string;
      batchNumber?: string | null;
      quantity: number;
      rate: number;
      lineNet: number;
    }>;
  }) {
    try {
      const url = `${env.HMS_BACKEND_URL}/pharmacy-bridge/callback/dispensed`;
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
        console.error('[hmsBridgeClient] notifyDispensed non-200 response:', errJson);
        return null;
      }

      return await res.json();
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[hmsBridgeClient] notifyDispensed failed:', err.message);
      return null;
    }
  },

  async requestSettlement(payload: {
    settlementNumber: string;
    pharmacyInvoiceNumber: string;
    requestedAmount: number;
    requestedBy: string;
    remarks?: string;
  }) {
    try {
      const url = `${env.HMS_BACKEND_URL}/pharmacy-bridge/settlement/request`;
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
        throw new Error((errJson as any)?.error?.message || `HMS returned HTTP ${res.status}`);
      }

      return await res.json();
    } catch (err: any) {
      // eslint-disable-next-line no-console
      console.error('[hmsBridgeClient] requestSettlement failed:', err.message);
      throw err;
    }
  },
};
