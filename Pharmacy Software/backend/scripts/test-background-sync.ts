import assert from 'node:assert/strict';
import { test, type TestContext } from 'node:test';
import { EventEmitter } from 'node:events';
import type { Response } from 'express';
import { startHmsSyncScheduler } from '../src/shared/hmsSyncScheduler';
import { singleFlight } from '../src/shared/singleFlight';
import { registerSseClient, broadcastHmsNotification, closeSseClients } from '../src/shared/hmsEvents';
import { hmsRequestsService } from '../src/modules/hms-requests/hms-requests.service';
import { hmsBridgeClient } from '../src/shared/hmsBridgeClient';
import { prisma } from '../src/db/client';
import { env } from '../src/config/env';

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
// Prisma delegates expose methods through a Proxy, not property descriptors.
function stub(t: TestContext, target: any, key: string, implementation: (...args: any[]) => any) {
  const original = target[key];
  const mock = t.mock.fn(implementation);
  target[key] = mock;
  t.after(() => { target[key] = original; });
  return mock;
}

test('one-day timer workload: 4320 -> 1440 periodic attempts, plus one startup pull', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  for (const [interval, expected] of [[20_000, 4321], [60_000, 1441]]) {
    let calls = 0;
    const stop = startHmsSyncScheduler(async () => { calls++; }, interval!, assert.fail);
    // Advance in 2-second steps, allowing each async invocation to settle.
    for (let time = 0; time < 86_400_000; time += 2000) {
      t.mock.timers.tick(2000);
      await flush();
    }
    await stop();
    assert.equal(calls, expected);
  }
  assert.equal(env.HMS_SYNC_INTERVAL_MS, 60_000);
});

test('scheduler skips overlap, drains active work and cancels both timers', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  let release!: () => void;
  let calls = 0;
  const stop = startHmsSyncScheduler(() => {
    calls++;
    return new Promise<void>((resolve) => { release = resolve; });
  }, 60_000, assert.fail);
  t.mock.timers.tick(2000); await flush();
  t.mock.timers.tick(180_000); await flush();
  assert.equal(calls, 1);
  let drained = false;
  const stopping = stop().then(() => { drained = true; });
  await flush(); assert.equal(drained, false);
  release(); await stopping;
  t.mock.timers.tick(180_000); await flush();
  assert.equal(calls, 1);
});

test('stop before startup prevents any sync; rejection retries on next tick', async (t) => {
  t.mock.timers.enable({ apis: ['setTimeout', 'setInterval'] });
  let calls = 0, errors = 0;
  const stopped = startHmsSyncScheduler(async () => { calls++; }, 60_000, assert.fail);
  await stopped();
  t.mock.timers.tick(60_000); await flush(); assert.equal(calls, 0);
  const stop = startHmsSyncScheduler(async () => { calls++; throw new Error('synthetic'); }, 60_000, () => { errors++; });
  t.mock.timers.tick(2000); await flush();
  t.mock.timers.tick(60_000); await flush();
  await stop();
  assert.equal(calls, 2); assert.equal(errors, 2);
});

test('single-flight shares errors and allows recovery', async () => {
  let calls = 0;
  const run = singleFlight(async () => { if (++calls === 1) throw new Error('retry'); return 2; });
  const first = run(); assert.equal(run(), first);
  await assert.rejects(first, /retry/);
  assert.equal(await run(), 2);
});

test('concurrent on-demand and timer sync share one HTTP pull; empty queue uses zero DB reads', async (t) => {
  let release!: (value: []) => void;
  const pull = t.mock.method(hmsBridgeClient, 'getPendingRequests', () => new Promise<[]>((resolve) => { release = resolve; }));
  const reads = stub(t, prisma.medicineRequest, 'findMany', async () => []);
  const runs = Array.from({ length: 20 }, () => hmsRequestsService.syncFromHmsOutbox());
  await flush(); assert.equal(pull.mock.callCount(), 1);
  release([]);
  assert.deepEqual(await Promise.all(runs), Array(20).fill({ synced: 0 }));
  assert.equal(reads.mock.callCount(), 0);
});

test('existing outbox references use bounded batches (401 queries -> 3) without recreation', async (t) => {
  const pending = Array.from({ length: 401 }, (_, i) => ({ externalRequestRef: `TEST-${i}`, lines: [] }));
  t.mock.method(hmsBridgeClient, 'getPendingRequests', async () => pending as any);
  const reads = stub(t, prisma.medicineRequest, 'findMany', async (args: any) => args.where.externalRequestRef.in.map((externalRequestRef: string) => ({ externalRequestRef })));
  const create = t.mock.method(hmsRequestsService, 'createRequest', async () => { throw new Error('must not recreate'); });
  assert.deepEqual(await hmsRequestsService.syncFromHmsOutbox(), { synced: 0 });
  assert.equal(reads.mock.callCount(), 3);
  assert.equal(create.mock.callCount(), 0);
  assert.ok(reads.mock.calls.every((call) => (call.arguments[0] as any).where.externalRequestRef.in.length <= 200));
});

test('failed sync remains retryable and imports a duplicate reference once, preserving urgency', async (t) => {
  let pulls = 0;
  const pending = { externalRequestRef: 'TEST-URGENT', externalAdmissionRef: 'TEST-ADM', urgency: 'URGENT', lines: [{ medicineId: 'TEST-MED', requestedQuantity: 1 }] };
  t.mock.method(hmsBridgeClient, 'getPendingRequests', async () => {
    if (++pulls === 1) throw new Error('synthetic transport failure');
    return [pending, pending] as any;
  });
  stub(t, prisma.medicineRequest, 'findMany', async () => []);
  stub(t, prisma.medicineMaster, 'findUnique', async () => ({ id: 'TEST-MED' }) as any);
  const create = t.mock.method(hmsRequestsService, 'createRequest', async () => ({ id: 'TEST-REQUEST' }) as any);
  assert.ok((await hmsRequestsService.syncFromHmsOutbox()).error);
  assert.deepEqual(await hmsRequestsService.syncFromHmsOutbox(), { synced: 1 });
  assert.equal(create.mock.callCount(), 1);
  assert.equal(create.mock.calls[0]!.arguments[0].urgency, 'URGENT');
});

test('list still immediately pulls and returns local requests when HMS is offline', async (t) => {
  const pull = t.mock.method(hmsBridgeClient, 'getPendingRequests', async () => { throw new Error('offline'); });
  stub(t, prisma.medicineRequest, 'findMany', async () => []);
  assert.deepEqual(await hmsRequestsService.list({} as any), []);
  assert.equal(pull.mock.callCount(), 1);
});

test('pending HTTP pull uses one bounded deadline, cancels failed bodies, and reports failure', async (t) => {
  let signal: AbortSignal | undefined;
  let canceled = 0;
  const fetchMock = t.mock.method(globalThis, 'fetch', async (_url: any, options: any) => {
    assert.ok(options.signal instanceof AbortSignal);
    if (signal) assert.equal(options.signal, signal);
    signal = options.signal;
    return { ok: false, body: { cancel: async () => { canceled++; } } } as any;
  });
  await assert.rejects(hmsBridgeClient.getPendingRequests(), /unavailable/);
  assert.ok(fetchMock.mock.callCount() >= 1);
  assert.equal(canceled, fetchMock.mock.callCount());
});

test('a stalled pending HTTP request aborts at its deadline and releases single-flight', async (t) => {
  const original = env.HMS_SYNC_TIMEOUT_MS;
  env.HMS_SYNC_TIMEOUT_MS = 30;
  t.after(() => { env.HMS_SYNC_TIMEOUT_MS = original; });
  t.mock.method(globalThis, 'fetch', (_url: any, options: any) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(options.signal.reason), { once: true });
  }));
  // AbortSignal's timer is unref'd; keep the test alive without opening a socket.
  const keepAlive = setInterval(() => {}, 1000);
  try {
    assert.ok((await hmsRequestsService.syncFromHmsOutbox()).error);
    assert.ok((await hmsRequestsService.syncFromHmsOutbox()).error);
  } finally { clearInterval(keepAlive); }
});

class FakeResponse extends EventEmitter {
  destroyed = false;
  writableEnded = false;
  writes: string[] = [];
  writable = true;
  write(data: string) { this.writes.push(data); return this.writable; }
  end() { this.writableEnded = true; this.emit('close'); }
  destroy() { this.destroyed = true; this.emit('close'); return this; }
}
test('SSE keeps one 25s heartbeat, cleans disconnects, drops slow clients and drains shutdown', async (t) => {
  t.mock.timers.enable({ apis: ['setInterval'] });
  t.after(closeSseClients);
  const first = new FakeResponse(), second = new FakeResponse();
  registerSseClient(first as unknown as Response);
  registerSseClient(first as unknown as Response);
  registerSseClient(second as unknown as Response);
  assert.equal(first.listenerCount('close'), 1);
  t.mock.timers.tick(25_000);
  assert.equal(first.writes.filter((s) => s === ':heartbeat\n\n').length, 1);
  first.end();
  assert.equal(first.listenerCount('error'), 0);
  second.writable = false;
  broadcastHmsNotification({ type: 'NEW_HMS_REQUEST', timestamp: 'synthetic' });
  assert.equal(second.destroyed, true);
  const count = second.writes.length;
  t.mock.timers.tick(50_000); assert.equal(second.writes.length, count);
  const third = new FakeResponse(); registerSseClient(third as unknown as Response);
  closeSseClients(); assert.equal(third.writableEnded, true);
});
