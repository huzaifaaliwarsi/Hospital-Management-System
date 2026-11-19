import type { Response } from 'express';

const sseClients = new Set<Response>();
let heartbeat: ReturnType<typeof setInterval> | undefined;

function removeClient(res: Response) {
  sseClients.delete(res);
  if (sseClients.size === 0 && heartbeat) {
    clearInterval(heartbeat);
    heartbeat = undefined;
  }
}

function writeToClient(res: Response, data: string) {
  try {
    if (!res.destroyed && !res.writableEnded && res.write(data)) return;
  } catch {
    // A disconnected/slow client must not accumulate an unbounded output buffer.
  }
  removeClient(res);
  res.destroy();
}

export function closeSseClients() {
  for (const res of sseClients) res.end();
  sseClients.clear();
  if (heartbeat) clearInterval(heartbeat);
  heartbeat = undefined;
}

export function registerSseClient(res: Response) {
  if (sseClients.has(res)) return;
  sseClients.add(res);
  const cleanup = () => {
    removeClient(res);
    res.off('close', cleanup);
    res.off('error', cleanup);
  };
  res.once('close', cleanup);
  res.once('error', cleanup);

  // Send initial connection acknowledgement
  writeToClient(res, `data: ${JSON.stringify({ type: 'CONNECTED', timestamp: new Date().toISOString() })}\n\n`);

  if (sseClients.size > 0 && !heartbeat) {
    heartbeat = setInterval(() => {
      for (const client of sseClients) writeToClient(client, ':heartbeat\n\n');
    }, 25_000);
    heartbeat.unref();
  }
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
  for (const client of sseClients) writeToClient(client, data);
}
