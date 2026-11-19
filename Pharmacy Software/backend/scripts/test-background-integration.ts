/** Local PostgreSQL + loopback HMS simulator. All database writes roll back. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createServer } from 'node:http';
import { PrismaClient } from '@prisma/client';
import { prisma } from '../src/db/client';
import { env } from '../src/config/env';
import { hmsRequestsService } from '../src/modules/hms-requests/hms-requests.service';

async function main() {
  const databaseUrl = new URL(process.env.DATABASE_URL || '');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(databaseUrl.hostname), 'Only a loopback test database is allowed');
  const db = new PrismaClient();
  const marker = `BACKGROUND-${randomUUID()}`;
  const rollback = new Error('ROLLBACK_BACKGROUND_INTEGRATION');
  const callbacks: any[] = [];
  let pending: any[] = [];
  let pulls = 0;
  let checks = 0;
  function check(actual: unknown, expected: unknown, label: string) {
    assert.deepEqual(actual, expected, label);
    checks++;
    console.log('PASS', label);
  }
  const server = createServer(async (req, res) => {
    if (req.headers['x-bridge-token'] !== env.INTERNAL_BRIDGE_SECRET) {
      res.writeHead(401).end(); return;
    }
    res.setHeader('Content-Type', 'application/json');
    if (req.url === '/api/v1/pharmacy-bridge/pending-requests') {
      pulls++;
      res.end(JSON.stringify({ data: pending })); return;
    }
    if (req.url === '/api/v1/pharmacy-bridge/callback/dispensed') {
      const chunks: Buffer[] = [];
      for await (const chunk of req) chunks.push(Buffer.from(chunk));
      callbacks.push(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      res.end(JSON.stringify({ data: { received: true } })); return;
    }
    res.writeHead(404).end('{}');
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const address = server.address();
  assert.ok(address && typeof address !== 'string');
  const origin = `http://127.0.0.1:${address.port}`;
  const originalUrl = env.HMS_BACKEND_URL;
  const originalFetch = globalThis.fetch;
  env.HMS_BACKEND_URL = `${origin}/api/v1`;
  // Explicitly prohibit the application's production fallback URLs during this test.
  globalThis.fetch = ((input: any, init: any) => {
    const url = new URL(typeof input === 'string' ? input : input.url ?? String(input));
    if (url.origin !== origin) throw new Error('External network disabled in local integration test');
    return originalFetch(input, init);
  }) as typeof fetch;
  async function waitForCallback(count: number) {
    const deadline = Date.now() + 3000;
    while (callbacks.length < count && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 10));
    check(callbacks.length, count, 'Dispense callback reached loopback HMS endpoint');
  }
  try {
    try {
      await db.$transaction(async (tx) => {
        // Exercise actual service queries against one rollback-only transaction.
        // This intentionally does not simulate independent worker transactions.
        const saved = new Map<string, any>();
        for (const name of Object.keys(prisma)) {
          if ((tx as any)[name]?.findMany) {
            saved.set(name, (prisma as any)[name]);
            (prisma as any)[name] = (tx as any)[name];
          }
        }
        saved.set('$transaction', prisma.$transaction);
        (prisma as any).$transaction = (run: (client: typeof tx) => Promise<unknown>) => run(tx);
        try {
          const actor = await tx.portalUser.create({ data: { username: marker, fullName: 'Synthetic background test', passwordHash: 'unused', role: 'SUPER_ADMIN' } });
          const unit = await tx.unit.create({ data: { name: marker, shortCode: marker.slice(-8) } });
          const medicine = await tx.medicineMaster.create({ data: { code: marker, name: 'Synthetic background medicine', unit: 'Tablet', baseUnitId: unit.id, saleRate: 100, purchaseRate: 60, taxPercent: 0 } });
          const batch = await tx.medicineBatch.create({ data: { medicineId: medicine.id, batchNumber: marker, expiryDate: new Date('2099-01-01'), costRate: 60, saleRate: 100 } });
          await tx.stockLedgerEntry.create({ data: { medicineId: medicine.id, batchId: batch.id, movementType: 'PURCHASE_IN', quantityDelta: 10, referenceTable: 'background_test', referenceId: marker, actorId: actor.id } });
          pending = [{ externalRequestRef: marker, externalAdmissionRef: marker, urgency: 'URGENT', lines: [{ medicineId: medicine.id, requestedQuantity: 2, notes: `[HMS_LINE:${marker}]` }] }];
          const results = await Promise.all(Array.from({ length: 20 }, () => hmsRequestsService.syncFromHmsOutbox()));
          check(pulls, 1, '20 concurrent sync callers perform one real HTTP pull');
          check(results.every((result) => result.synced === 1 && !result.error), true, 'All callers receive the same successful ingestion');
          const request = await tx.medicineRequest.findUniqueOrThrow({ where: { externalRequestRef: marker }, include: { lines: true } });
          check(request.urgency, 'URGENT', 'Recovery preserves urgency in PostgreSQL');
          check(request.lines.length, 1, 'Only one request line is persisted');
          check((await hmsRequestsService.syncFromHmsOutbox()).synced, 0, 'A later retry recognizes the persisted request');
          check(await tx.medicineRequest.count({ where: { externalRequestRef: marker } }), 1, 'Repeated sync does not duplicate the request');

          const direct = { externalRequestRef: `${marker}-direct`, externalAdmissionRef: `${marker}-direct`, urgency: 'STAT' as const, lines: [{ medicineId: medicine.id, requestedQuantity: 1, notes: `[HMS_LINE:${marker}-direct]` }] };
          const immediate = await hmsRequestsService.createRequest(direct);
          check(immediate.urgency, 'STAT', 'Immediate dispatch creation remains available without a timer');
          const repeated = await hmsRequestsService.createRequest(direct);
          check(repeated.id, immediate.id, 'Repeated direct dispatch reuses the request');
          check(repeated.lines.length, 1, 'HMS line tags prevent repeated direct-dispatch lines');
          const rejected = await hmsRequestsService.reject(immediate.id, { reason: 'Synthetic rejection test' }, actor.id);
          check(rejected.status, 'REJECTED', 'Rejection remains functional');

          const approved = await hmsRequestsService.approve(request.id, actor.id);
          check(approved.approvedById, actor.id, 'Approval remains functional');
          const partial = await hmsRequestsService.fulfill(request.id, { lines: [{ requestLineId: request.lines[0]!.id, dispenseQuantity: 1 }] }, actor.id);
          check(partial.status, 'PARTIALLY_ACCEPTED', 'Partial dispensing preserves status');
          await waitForCallback(1);
          check(callbacks[0].deltaAmount, 100, 'Partial dispense callback carries the correct delta');
          const full = await hmsRequestsService.fulfill(request.id, { lines: [{ requestLineId: request.lines[0]!.id, dispenseQuantity: 1 }] }, actor.id);
          check(full.status, 'DISPENSED', 'Remaining quantity completes dispensing');
          await waitForCallback(2);
          check(callbacks[1].requestStatuses[0].status, 'DISPENSED', 'HMS callback receives final request status');
          check(callbacks[1].totalAmount, 200, 'HMS callback receives accumulated invoice amount');
          const stock = await tx.stockLedgerEntry.aggregate({ where: { medicineId: medicine.id }, _sum: { quantityDelta: true } });
          check(Number(stock._sum.quantityDelta), 8, 'Exactly two units leave stock');
          check(await tx.pharmacyInvoice.count({ where: { externalAdmissionRef: marker } }), 1, 'Partial and final dispenses share one invoice');
          await assert.rejects(() => hmsRequestsService.fulfill(request.id, { lines: [{ requestLineId: request.lines[0]!.id, dispenseQuantity: 1 }] }, actor.id));
          checks++; console.log('PASS Completed request cannot be dispensed again');
        } finally {
          for (const [name, value] of saved) (prisma as any)[name] = value;
        }
        throw rollback;
      }, { timeout: 60_000 });
    } catch (error) { if (error !== rollback) throw error; }
    check(await db.portalUser.count({ where: { username: marker } }), 0, 'Actor fixture rolled back');
    check(await db.medicineMaster.count({ where: { code: marker } }), 0, 'Medicine/stock fixtures rolled back');
    check(await db.medicineRequest.count({ where: { externalAdmissionRef: { startsWith: marker } } }), 0, 'Requests and invoice fixtures rolled back');
    console.log(`PASS ${checks} local PostgreSQL/HTTP integration checks; no production access`);
  } finally {
    env.HMS_BACKEND_URL = originalUrl;
    globalThis.fetch = originalFetch;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await db.$disconnect();
    await prisma.$disconnect();
  }
}
main().catch((error) => {
  // Deliberately omit SQL/connection strings and fixture records from failure logs.
  console.error('FAIL local integration:', error instanceof Error ? error.name : 'unknown error');
  if (error instanceof assert.AssertionError) console.error(error.message);
  process.exitCode = 1;
});
