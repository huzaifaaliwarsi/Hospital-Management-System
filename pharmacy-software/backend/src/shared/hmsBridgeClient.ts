import { env } from '@/config/env';

function getHmsBaseUrls(): string[] {
  const url = (env.HMS_BACKEND_URL || '').trim().replace(/\/+$/, '');
  const urls: string[] = [];
  if (url) urls.push(url);
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    if (!urls.includes('https://hms-project-backend.vercel.app/api/v1')) {
      urls.unshift('https://hms-project-backend.vercel.app/api/v1');
    }
  } else {
    if (!urls.includes('http://localhost:4000/api/v1')) {
      urls.push('http://localhost:4000/api/v1');
    }
    if (!urls.includes('https://hms-project-backend.vercel.app/api/v1')) {
      urls.push('https://hms-project-backend.vercel.app/api/v1');
    }
  }
  return urls;
}

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
    requestStatuses?: Array<{ externalRequestRef: string; status: 'DISPENSED' | 'PARTIALLY_FULFILLED' }>;
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
    const urlsToTry = getHmsBaseUrls();
    for (const baseUrl of urlsToTry) {
      try {
        const url = `${baseUrl}/pharmacy-bridge/callback/dispensed`;
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
          console.warn(`[hmsBridgeClient] notifyDispensed on ${baseUrl} returned non-200:`, errJson);
          continue;
        }

        return await res.json();
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.warn(`[hmsBridgeClient] notifyDispensed failed on ${baseUrl}: ${err.message}`);
      }
    }
    return null;
  },

  async requestSettlement(payload: {
    settlementNumber: string;
    pharmacyInvoiceNumber: string;
    requestedAmount: number;
    requestedBy: string;
    remarks?: string;
  }) {
    const urlsToTry = getHmsBaseUrls();
    let lastError: any = null;
    for (const baseUrl of urlsToTry) {
      try {
        const url = `${baseUrl}/pharmacy-bridge/settlement/request`;
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
        lastError = err;
        // eslint-disable-next-line no-console
        console.warn(`[hmsBridgeClient] requestSettlement failed on ${baseUrl}: ${err.message}`);
      }
    }
    throw lastError;
  },
};
