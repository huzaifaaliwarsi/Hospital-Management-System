import { env } from '@/config/env';

function resolvePharmacyBaseUrl(): string {
  let url = (env.PHARMACY_BACKEND_URL || '').trim();
  if (process.env.VERCEL || process.env.NODE_ENV === 'production') {
    if (!url || url.includes('localhost') || url.includes('127.0.0.1')) {
      url = 'https://pharmacy-software-backend.vercel.app/api/v1';
    }
  }
  return (url || 'http://localhost:4100/api/v1').replace(/\/+$/, '');
}

export const pharmacyBridgeClient = {
  async getMedicines(search?: string) {
    const firstUrl = resolvePharmacyBaseUrl();
    const urlsToTry = [firstUrl];
    if (!firstUrl.includes('pharmacy-software-backend.vercel.app')) {
      urlsToTry.push('https://pharmacy-software-backend.vercel.app/api/v1');
    }

    for (const baseUrl of urlsToTry) {
      try {
        const url = new URL(`${baseUrl}/pharmacy/medicines`);
        if (search) url.searchParams.set('search', search);

        const res = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'x-bridge-token': env.INTERNAL_BRIDGE_SECRET,
          },
        });

        if (!res.ok) continue;
        const data = await res.json();
        if (data && (data as any).data) {
          return (data as any).data;
        }
      } catch (err: any) {
        // eslint-disable-next-line no-console
        console.warn(`[pharmacyBridgeClient] getMedicines failed on ${baseUrl}: ${err.message}`);
      }
    }
    return null;
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
      const baseUrl = env.PHARMACY_BACKEND_URL.replace(/\/+$/, '');
      const url = `${baseUrl}/hms-requests`;
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
      const baseUrl = env.PHARMACY_BACKEND_URL.replace(/\/+$/, '');
      const url = `${baseUrl}/hms-requests/callback/patient-collected`;
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

  /**
   * Manual resync for when `notifyPatientCollected` silently failed (network
   * blip, Pharmacy backend unreachable at that moment — that call swallows
   * errors so the Front Desk cashier's payment flow never breaks on it).
   * Unlike `notifyPatientCollected`, this THROWS on failure — it's invoked
   * from an explicit "Resync to Pharmacy" action, so the admin needs to see
   * if it didn't work, not have it silently swallowed again.
   */
  async reconcileCollection(payload: {
    pharmacyInvoiceNumber: string;
    authoritativeCollectedAmount: number;
  }) {
    const baseUrl = env.PHARMACY_BACKEND_URL.replace(/\/+$/, '');
    const url = `${baseUrl}/hms-requests/callback/reconcile-collection`;
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
      const baseUrl = env.PHARMACY_BACKEND_URL.replace(/\/+$/, '');
      const url = `${baseUrl}/hms-requests/settlement/release`;
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
