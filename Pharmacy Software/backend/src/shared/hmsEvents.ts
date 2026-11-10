import type { Response } from 'express';

const sseClients = new Set<Response>();

export function registerSseClient(res: Response) {
  sseClients.add(res);

  // Send initial connection acknowledgement
  res.write(`data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  res.on('close', () => {
    sseClients.delete(res);
  });
}

export function broadcastHmsNotification(payload: {
  type: 'NEW_HMS_REQUEST' | 'REQUEST_STATUS_UPDATED' | 'PATIENT_PAID';
  requestNumber?: string;
  patientName?: string;
  admissionRef?: string;
  urgency?: string;
  medicinesSummary?: string;
  totalAmount?: number;
  timestamp: string;
}) {
  const data = `data: ${JSON.stringify(payload)}\n\n`;
  for (const client of sseClients) {
    try {
      client.write(data);
    } catch {
      sseClients.delete(client);
    }
  }
}

// Heartbeat ping every 25s to keep connections alive through proxies
setInterval(() => {
  for (const client of sseClients) {
    try {
      client.write(':heartbeat\n\n');
    } catch {
      sseClients.delete(client);
    }
  }
}, 25000).unref();
