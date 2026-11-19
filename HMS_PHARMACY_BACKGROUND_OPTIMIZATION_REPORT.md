# HMS and Pharmacy background optimization

Date: 2026-11-19. Scope: CH Hospital HMS and Standalone Pharmacy only.

## Result and review status

Local source changes and verification are complete. Pharmacy's recovery timer now defaults to 60 seconds, concurrent pulls in one worker share a run, pending-request HTTP reads have a deadline, and timer/SSE shutdown cleanup is explicit. HMS cron HTTP invocations coalesce within a worker, and an empty biometric queue avoids an unnecessary query. Financial calculations, stock rules, permissions and billing schedules were not changed.

**Ready for source review, not a claim of production acceptance.** No production connection, deployment, restart, process termination, Git commit or Git push was performed. No production environment settings or database schema were changed. Live delivery latency, multiple-worker ingestion safety and Namecheap NPROC reduction remain unverified. Ten HMS test failures also reproduce with the original HEAD source; see verification below.

The requested one-minute recovery schedule is implemented. An approved clinical delivery SLA was not available in the repository. Existing immediate dispatch is retained, but urgent delivery during outages cannot be certified from this audit. Review the delivery limitations before manual deployment.

## Evidence and scope of inspection

Reviewed the Namecheap audit, daily IPD billing audit, biometric handoff, Pharmacy performance audit and relevant financial verification documentation. Searched both backend and frontend source trees for timers, polling, cron entry points, Prisma constructors, HTTP calls, transactions, concurrency, process spawning and shutdown handlers. Followed the request creation, outbox recovery, SSE, dispensing/callback and cron paths. Examined package scripts, generated Prisma engine configuration, startup wrappers and serverless entries.

References below use current source line numbers; filenames under `HMS Software` and `Pharmacy Software` identify the project. This is code inspection plus local tests, not a production profiler trace or a claim that every application endpoint was exercised.

## Confirmed findings and changes

| Finding and cause | Evidence | Local resolution |
| --- | --- | --- |
| A 20-second timer, startup pull and every queue list request could run recovery concurrently. No in-flight guard existed. | Pharmacy `backend/src/server.ts:18`; `backend/src/modules/hms-requests/hms-requests.service.ts:208` and `:275` | Configurable 60-second interval, shared in-flight promise covering all sync callers, separate scheduler lifecycle guard. Completed results are not cached; a later call retries immediately. |
| Pending-request fetches had no deadline and all endpoint failures became an empty successful queue. Each fallback could log independently. | Pharmacy `backend/src/shared/hmsBridgeClient.ts:111` | One default 10-second AbortSignal deadline covers fallback requests and response bodies. Failed response bodies are canceled; exhausted/invalid responses throw to the service. |
| Background failures could be swallowed by catch-to-null calls; raw exception messages could contain sensitive context. | Pharmacy `backend/src/modules/hms-requests/hms-requests.service.ts:33`, `:270` | Sanitized warning at most once per minute per worker, with suppressed-warning count; service returns an error result. Scheduler has a final unexpected-error handler. No patient payloads or connection strings are logged by the new path. |
| Already-ingested outbox entries caused one existence query per entry on every pull. | Pharmacy `backend/src/modules/hms-requests/hms-requests.service.ts:215` | Select only external references in sequential batches of at most 200. A Set also suppresses duplicate references in the same response. Existing creation validation and DB uniqueness remain intact. Empty outboxes still use zero Pharmacy DB queries. |
| Startup/periodic sync timers were not cleared at shutdown; Prisma could disconnect while a timer continued to run. Repeated signals could start multiple shutdowns. | Pharmacy `backend/src/server.ts:26`; `backend/src/shared/hmsSyncScheduler.ts:1` | Start scheduling only after listen; clear both timers, drain active scheduled sync, close SSE clients, drain HTTP requests, then disconnect Prisma. Repeated shutdown signals are ignored. Forced-exit budget is sync timeout plus 10 seconds (20 seconds by default); it remains a bound, not a guarantee that every stuck operation can finish. |
| SSE heartbeat ran even with no clients; blocked client writes were ignored; open streams delayed HTTP shutdown. | Pharmacy `backend/src/shared/hmsEvents.ts:1` | Keep the 25-second heartbeat while clients exist, stop it with the last client, guard duplicate registration, clean close/error listeners, disconnect slow clients instead of indefinitely buffering, and end streams during shutdown. |
| Each notification chime allocated an AudioContext without closing it. | Pharmacy `frontend/src/context/HmsNotificationContext.tsx:62` | Close it after the final oscillator ends. No visible UI or notification behavior changed. |
| Concurrent cron HTTP requests could repeat the same whole scan within one worker. | HMS `backend/src/app.ts:43`, `:44`, `:92`, `:100` | Separate in-flight guards for room-charge and biometric cron routes. Authorization and no-store headers remain unchanged. All waiting callers receive the same run's result/error. A subsequent invocation retries normally. |
| Biometric processing loaded the hospital profile even if no pending rows existed. | HMS `backend/src/modules/devices/devices.service.ts:175` | Return the same zero counters immediately after the empty query. Nonempty normalization, retry metadata and attendance rules remain unchanged. |

## Scheduling and background inventory

| Component | Trigger/cadence | Assessment |
| --- | --- | --- |
| Pharmacy recovery | Startup after 2 seconds; periodic default 60 seconds; every on-demand queue list | Startup and on-demand behavior preserved. Periodic ticks during an active run do not enqueue additional work. |
| Pharmacy SSE | 25-second heartbeat while connected | Retained for proxy keepalive. Client registry remains process-local. |
| Pharmacy queue | `HmsRequestQueuePage.tsx:63`, 15-second TanStack Query polling; SSE event refresh at `:81` | Retained for reliability; see next section. Installed Query core only polls in the background if explicitly enabled, otherwise checks focus. |
| Pharmacy POS | `frontend/src/pages/PosPage.tsx:162`, 15-second refetch | Active-screen stock freshness; retained. |
| Pharmacy SSE reconnect | `HmsNotificationContext.tsx:115`, `:190`: 3 seconds awaiting token; 5 seconds after stream error | Existing effect cleanup closes EventSource and clears reconnect timer. No confirmed duplicate reconnect loop found. |
| HMS daily room charges | Authenticated `/api/cron/ipd-room-charges`; external schedule | Handler retained. Service checks Karachi posting time, default 11:00 AM; actual configured value remains authoritative. No in-process periodic billing timer. |
| HMS biometric retries | Authenticated `/api/cron/biometric-reprocess`; device ingest; manual retry; mapping creation | Retained. Batch limit 100, roughly 20-second loop budget, retry ordering by lastAttemptAt/receivedAt. Cron guard does not suppress direct ingest/manual work. |
| HMS blocked-discharge notification | `admission.service.ts:2276`, one-shot zero-delay callback after a blocked discharge attempt | Event-driven business notification, not an idle polling loop; unchanged. |
| HMS pharmacy requests / admission detail | `PharmacyRequestsView.tsx:148`, `AdmissionDetailModal.tsx:178`, 5 seconds | Existing hidden-tab, overlap and unmount/focus cleanup guards retained. |
| HMS settlements | `PharmacySettlementsView.tsx:60`, 5 seconds while mounted | Active-view polling retained; repeated/slow requests remain a profiling candidate. |
| HMS header | `Header.tsx:155`, notifications every 4 seconds; `:88`, display clock every 10 seconds | Existing active UI behavior retained; display clock does not query a database. |
| HMS invoice screen | `HospitalInvoicesView.tsx:226`, 6 seconds | Existing visibility/open-invoice guard and cleanup retained. |
| Other frontend timeouts | Printing/receipt windows, debounced search/form input, modal focus, toast/copy/login state | User-interaction timers, not recurring server jobs; no broad rewrite. |
| Process shutdown | Both server entry points | HMS existing HTTP drain/disconnect retained. Pharmacy enhanced as above. |

**Documentation mismatch:** daily billing and biometric documents describe Vercel cron schedules, but current `HMS Software/backend/vercel.json` contains no `crons` entries and declares maxDuration 60 seconds. The billing service has a 240-second batch budget. Neither that deployment's schedule nor Namecheap cPanel cron entries were accessible. Do not assume scheduled execution exists merely because routes exist. No schedule was removed or added in this task.

## Delivery, polling and idempotency

HMS already dispatches medicine requests immediately through `admission.service.ts:1320` / `:1355`, called after request creation at `:1560`. High-cost approval also dispatches at `:1672`. These routes were not changed to wait for the periodic timer. Pharmacy queue opening, manual refresh, mutation refreshes and SSE-triggered list calls still invoke immediate recovery. Dispense, approval and rejection UI refreshes remain unchanged.

The 60-second timer is fallback recovery. For a request becoming available just after a successful empty pull, an idle healthy worker normally starts its next scheduled attempt within about 60 seconds; network/DB work adds latency. Event-loop delays, ongoing runs, restarts, sleeping workers and endpoint failures can extend this. It is not an end-to-end 60-second guarantee. Failed direct dispatch with an active queue still has the existing 15-second polling opportunity.

**Urgency limitation:** HMS currently emits `ROUTINE` or `HIGH_COST_PENDING` in direct dispatch (`admission.service.ts:1359`) and `ROUTINE` in its pending endpoint (`pharmacy-bridge.service.ts:709`). Pharmacy can accept URGENT/STAT, and the recovery test preserves URGENT when supplied, but an HMS urgency-aware delivery contract is not established by that test. No clinical urgency policy was invented. Urgent outage/recovery timing needs hospital acceptance and a staging test before release.

Polling cannot safely be eliminated based on the present SSE design:

- SSE subscriptions/broadcasts live in one worker's Set, with no shared pub/sub or replay cursor. A request handled by another worker may not notify that browser.
- The frontend handles NEW_HMS_REQUEST; approval/dispense/reject/payment changes are not all covered by complete broadcast/replay behavior. A connected stream does not prove the queue is current.
- Missed events during a disconnect need polling recovery. The queue retains its 15-second fallback and action-triggered refreshes.

No debounce/cooldown was introduced that could postpone an explicit refresh. Concurrent list and timer sync callers share one operation, while each list still fetches its local result.

**Multiple workers:** every `server.ts` worker still owns a timer. In-flight guards do not coordinate across workers, deployments or hosts, nor do they serialize direct POST creation with recovery. The schema's unique externalRequestRef (`Pharmacy backend/prisma/schema.prisma:595`) remains; HMS line-tag deduplication remains. These are not proof of race-free admission-level line merging. A distributed lease or transactional creation redesign was not introduced without a concurrency fixture and deployment measurements.

**Existing recovery gaps outside the safe optimization:** recovery skips an already-existing external reference, so it does not repair later added lines for that reference. HMS pending payloads also omit the `[HMS_LINE:...]` tags supplied by direct dispatch. Direct-push versus pull races, admission-level merges and repeated dispensing require separate integration/concurrency verification. The changes preserve existing decisions and do not certify duplicate fulfillment as solved.

Other bridge mutations (immediate dispatch, fulfillment, settlement and collection callbacks) still contain fetches without explicit deadlines and existing fallback/error behavior. They were not given automatic retries or timeout changes here because an uncertain completed mutation can create financial retry ambiguity. Their idempotency/reconciliation needs dedicated tests before such changes. The new bounded timeout applies specifically to the read-only recovery pull.

## HMS billing and biometric safety

Room billing continues through `runScheduledRoomCharges` (`admission.service.ts:2539`) and `closeHospitalDay` (`:2501`). The current code selects ACTIVE and DISCHARGE_PENDING admissions with a priced assigned room and no daily log; it preserves the configured posting time and current date rules. Older documentation describing ACTIVE-only is stale. Admission/invoice row locks and the admission/business-date unique constraint remain. Each candidate uses its own transaction; successful postings survive later failures and retries select outstanding work. No posted charge or attendance record was edited.

The cron guards coalesce only overlapping calls to the same HTTP cron route in one process. They do not lock an entire deployment or block manual/day-close operations. Existing database locks/uniqueness remain the final billing protection.

Biometric raw-event durability, event-hash uniqueness, staff/date normalization, staff row locking, manual attendance protection and error retries remain. Empty runs now use one query instead of two. Tests cover the empty fast path, error retry metadata and one normalization per staff/day; real device interoperability was not exercised.

## Prisma, Node and NPROC investigation

- Both backend runtime source trees have one PrismaClient construction factory, in `src/db/client.ts:6`. Production imports reuse the module instance; development additionally uses globalThis. No per-request Prisma construction or runtime child-process/cluster/watcher launch was found in source. CLI/test scripts legitimately construct separate clients in separate processes.
- Generated local clients specify `engineType: "library"` (Pharmacy generated index line 725; HMS line 1959). Prisma engine work runs inside the Node process in this configuration. This does not establish its actual Linux thread count.
- `DATABASE_POOL_MAX` is validated with defaults 10/20 in Pharmacy/HMS env schemas but is not wired into either Prisma constructor. It is **not evidence of an effective production pool cap**. URL pool parameters, actual DB sessions and production worker counts were not measured or modified.
- No demonstrated runtime Prisma connection leak was found. HMS middleware registration could repeat under same-process module re-evaluation in development; no production duplication was established, so singleton/middleware code was left intact.
- HMS `app.js` requires `dist/server.js` once; both package start commands use `node dist/server.js`. `tsx watch` appears in development scripts, not production start. Actual Passenger settings, crash loops, orphaned OS processes and deployed start commands are unknown.
- The serverless entry modules create Express apps without importing `server.ts`; the Pharmacy recovery timer therefore requires the persistent server entry. This pre-existing hosting distinction is documented, not redesigned.
- Build/deployment scripts can launch Prisma CLI engines. Pharmacy's `vercel-build` includes migration and seed commands. Those scripts were **not run**. Only `npm run build`, typechecks and the listed tests were run; no migrate/db push/seed commands were used.

The old Namecheap audit's exact thread counts, assumed worker defaults, 75% reduction, hardcoded pool size 3 and guaranteed stability are not demonstrated by this repository. A timer callback is not a newly allocated OS process per tick. Database pool connections are not interchangeable with local Node OS threads. Fewer calls reduce application work; they do not prove fewer standing threads.

CloudLinux documents NPROC accounting for processes and threads, but the actual account limit and fault counters must be obtained from the host. `fork: Resource temporarily unavailable` is compatible with task/limit exhaustion; this audit cannot identify its exact production cause. No count of unnecessary workers or threads is claimed. [CloudLinux limits](https://docs.cloudlinux.com/cloudlinuxos/limits/)

Prisma documents URL connection_limit and CPU-dependent Rust-engine pool sizing for Prisma v6 and earlier; choose a measured per-instance connection budget rather than assuming every pool slot is open or consumes a local thread. [Prisma PostgreSQL connector](https://docs.prisma.io/docs/orm/v6/overview/databases/postgresql)

## Measured and calculated before/after

| Workload | Before | After | Evidence/limit |
| --- | ---: | ---: | --- |
| Periodic recovery attempts per healthy continuously running worker/day | 4,320 | 1,440 | Deterministic fake-timer day at 20s versus 60s; 66.7% fewer periodic attempts. |
| Same test including startup pull | 4,321 | 1,441 | Both retain one startup pull. |
| Concurrent recovery callers in one worker | Up to one run per caller | 20 callers share 1 HTTP pull | Synthetic test; no production latency claim. |
| Existing-reference checks for 401 pending references | 401 sequential existence reads by prior loop | 3 bounded reads | Mocked delegate counts with new implementation; excludes other creation queries. |
| Pharmacy DB reads for empty outbox | 0 | 0 | Preserved, asserted by test. HMS still queries its pending endpoint. |
| Empty biometric batch | 2 queries | 1 query | Early-return test verifies no profile/staff read. |
| SSE heartbeat with zero clients | A timer callback every 25s | No heartbeat timer | Code and fake-timer lifecycle checks; active-client interval remains 25s. |
| Queue polling | 240/hour per continuously active page | Unchanged | Intentional reliability fallback. This traffic is additional to periodic recovery, so overall HTTP reduction is not necessarily 66.7%. |
| Production NPROC, RSS, CPU, DB sessions and p95 latency | Not measured | Not measured | No Namecheap access or production load test. |

## Verification results

Environment: local Windows, Node v24.19.0. Production Node 20 was not exercised. Unit tests used synthetic inputs and a dummy loopback DB URL. Financial tests first checked that the configured DB host was loopback, then ran on local PostgreSQL with rollback-only fixtures. No production DB was contacted by these tests.

| Check | Result |
| --- | --- |
| HMS backend `npm run typecheck` and `npm run build` | PASS |
| Pharmacy backend `npm run typecheck` and `npm run build` | PASS; final build includes latest scheduler/shutdown edits |
| HMS frontend `npm run lint` (tsc) and `npm run build` | PASS |
| Pharmacy frontend `npm run lint` (tsc) and `npm run build` | PASS; typecheck repeated after audio cleanup |
| Pharmacy `npm run test:background` | 11/11 PASS: day counts, overlap, shutdown drain/cancel, retry, empty queue, bounded batching, duplicate references, urgency passthrough, on-demand fallback, deadline, SSE cleanup |
| HMS complete Vitest run | 489 PASS, 10 FAIL, 9 SKIP across 59 files. This run included the first 3 new background tests. |
| HMS targeted final run | 15/15 PASS: final 4 background tests, 7 daily IPD tests, 2 dispense-status tests, 2 request-billing tests |
| HMS original-source comparison | The same 10 failures reproduced: 47 pass / 10 fail in the three failing suites. Temporary Vitest loader read tracked HMS source from `git show HEAD:...`; working source was not reverted. Temporary config removed afterward. |
| Pharmacy income/expense local DB tests | 32 checks PASS; fixtures rolled back |
| Pharmacy revenue local DB tests | 29 checks PASS; duplicate HMS collection callbacks, refunds, recognition/COGS and rollback checked |
| Pharmacy frontend cache/stock + invoice tests | 5 + 4 PASS; executed with the already-installed backend TSX runner |
| HMS frontend patient-detail tests | 6/6 PASS |
| `git diff --check` | PASS (line-ending notices only) |

The ten existing HMS failures are: four in phase5_admission (clearance expectation drift and missing pharmacyClearance.findFirst mocks), three in phase6_inventory_pharmacy (missing purchase-order-line fixture data), and three timeouts in inventorySafety's mocked locking paths. They were not hidden, disabled or “fixed” by changing stock/financial behavior. DB-opt-in HMS suites stayed skipped; no destructive fixture-cleanup scripts were run.

PowerShell blocks npm.ps1 here, so npm.cmd was used. TSX initially failed in the restricted Windows sandbox with uv_os_get_passwd ENOMEM; approved reruns outside the sandbox passed. Pharmacy frontend's npx-based command stalled, so it was stopped and both exact test files ran via the installed backend runner without downloading dependencies. Builds retain existing large frontend chunk warnings.

**Verification boundary:** compilation, synthetic background tests, existing mocked HMS regression tests and local Pharmacy financial DB tests passed as listed. A full two-running-app medicine creation → approval/rejection → dispense → HMS clearance sequence, concurrent real-worker fulfillment, live urgent latency, real biometric device ingestion and production connection/thread lifecycle have not been executed. No blanket “no regressions” or production acceptance claim is made.

## Remaining risks and production recommendations for review

1. Obtain actual Namecheap NPROC/EP/PMEM limits and fault history. Record per-worker NLWP, memory, process age/parent and restart overlap under idle and peak load. Use safe read-only diagnostics such as `ps -u "$USER" -o pid,ppid,nlwp,etime,rss,comm` and `ps -u "$USER" -L --no-headers | wc -l`; reconcile account-level task counts with LVE membership. Do not publish full process arguments or environment contents.
2. Inventory actual application workers and cPanel cron entries. Check for a separate dev watcher/PM2/CLI process alongside Passenger. Confirm the host-supported worker controls before proposing any change. Process-local guards do not remove the need for this measurement.
3. Leave database pool and UV_THREADPOOL_SIZE settings unchanged until peak query concurrency, pool waits, DB max connections and thread measurements are available. No evidence supports universally setting connection_limit=3 or UV_THREADPOOL_SIZE=2 here. Set a per-worker pool budget only after load testing against all apps' combined DB budget.
4. Proposed application defaults are HMS_SYNC_INTERVAL_MS=60000 and HMS_SYNC_TIMEOUT_MS=10000. Validation permits 20000–300000 and 1000–30000 respectively. Defaults work without adding environment variables; overrides require operational review. These variables were not written to production or local .env files.
5. Before release, confirm urgent outage tolerance and test the immediate path plus timer recovery on staging, including restart during a pull, duplicate push/pull, multiple workers, failed callback recovery, incremental medicine additions and high-cost authorization. Resolve the existing integration gaps separately if these tests fail.
6. Confirm cron timing and allowed runtime on the actual host. Preserve room posting time, CRON_SECRET authentication and biometric retries. Verify row-lock/idempotency behavior with simultaneous external cron invocations; no cron should be disabled to reduce NPROC.
7. Measure mutation-call timeout/retry behavior separately before changing financial callbacks. Do not add blind retries to settlement/collection mutations. Do not use blanket process-kill commands as resource management.

## Files ready for manual review/deployment preparation

Runtime source changes:

- Pharmacy backend: `src/config/env.ts`, `src/server.ts`, `src/modules/hms-requests/hms-requests.service.ts`, `src/shared/hmsBridgeClient.ts`, `src/shared/hmsEvents.ts`, new `src/shared/singleFlight.ts` and `src/shared/hmsSyncScheduler.ts`.
- HMS backend: `src/app.ts`, `src/modules/devices/devices.service.ts`, new `src/shared/singleFlight.ts`.
- Pharmacy frontend: `src/context/HmsNotificationContext.tsx`.
- Verification: Pharmacy `scripts/test-background-sync.ts`, `scripts/test-background-integration.ts` and package.json test commands; HMS `tests/backgroundJobs.test.ts`; this report.

No dependency or schema migration is required by these changes. Generated tracked serverless bundles and tsbuildinfo files were restored after successful builds to keep the review focused on source. Rebuild from the reviewed source when preparing deployment artifacts; do not deploy an old tracked bundle as if it contains these changes. Local dist builds exist, but none were uploaded. Review the baseline failures and outstanding acceptance checks before approving a manual release. Work stops here for user review.

## Follow-up: requested local verification rerun (2026-11-19)

After the user requested local testing again, the current changed code passed **50 targeted checks**:

- Pharmacy background regression suite: 11/11 pass again.
- HMS background, daily IPD, dispense-status and request-billing suites: 15/15 pass again.
- New `npm run test:background-integration`: 24/24 checks pass against actual local PostgreSQL plus a loopback HTTP HMS simulator.

The new integration test uses the real Pharmacy sync, creation, approval, rejection and fulfillment service implementations. Prisma delegates are directed into one real rollback-only transaction; the pending-request and dispense-callback HTTP calls use real loopback sockets. External URLs are explicitly blocked, and a non-loopback database URL is rejected before creating a client. Fixtures contain synthetic data only.

Observed results:

1. Twenty simultaneous recovery callers generate one HTTP pull and one persisted request/line.
2. Repeating recovery does not duplicate the persisted request. URGENT is preserved in PostgreSQL.
3. Direct creation remains immediate, preserves STAT and reuses the existing request/line on a tagged retry.
4. Rejection and approval succeed using the actual service and database.
5. A partial dispense followed by the remaining quantity produces PARTIALLY_ACCEPTED then DISPENSED.
6. Both actual HTTP callbacks reach the local simulator; the first delta is 100 and final invoice amount is 200, with final DISPENSED status.
7. Stock decreases from 10 to 8, both dispenses share one invoice, and a further dispense of the completed request is rejected.
8. Actor, medicine and request fixture absence is verified after rollback. No test records are retained.

This closes the earlier gap for the Pharmacy service-level receive/approve/reject/dispense path with a real database. It does **not** certify the running HMS application's callback/clearance handling: the remote side was a simulator. Browser interaction, actual 60-second wall-clock delivery, independent-worker database races, urgent clinical SLA and production NPROC remain outside this local test. The timer cadence was verified with fake time in the background suite. The ten previously reproduced baseline HMS failures were not part of this focused rerun and remain documented above.

No runtime behavior was changed during this follow-up; only the integration test, its package command and this report were added/updated. No commit, push or deployment occurred.
