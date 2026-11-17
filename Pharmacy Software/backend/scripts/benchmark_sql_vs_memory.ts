import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { randomUUID } from 'node:crypto';
import { pharmacyService } from '../src/modules/pharmacy/pharmacy.service';

const prisma = new PrismaClient();

async function benchmarkComparison() {
  console.log('=== BENCHMARK: SQL-LEVEL PAGINATION VS IN-MEMORY PAGINATION ===\n');

  const rollback = new Error('BENCHMARK_ROLLBACK');

  try {
    await prisma.$transaction(async (tx) => {
      const marker = 'SQLBENCH-' + randomUUID().slice(0, 8);
      const user = await tx.portalUser.create({
        data: { username: marker, fullName: 'Bench User ' + marker, passwordHash: 'NO', role: 'ADMIN' },
      });

      const scale = 5000;
      console.log(`Generating ${scale} synthetic invoices with multiple collections...`);

      const invData: Prisma.PharmacyInvoiceCreateManyInput[] = [];
      const baseDate = new Date('2026-11-01T10:00:00Z').getTime();

      for (let i = 0; i < scale; i++) {
        const invId = randomUUID();
        const createdAt = new Date(baseDate + (i * 3600000) % (30 * 86400000));
        invData.push({
          id: invId,
          invoiceNumber: `${marker}-${String(i).padStart(6, '0')}`,
          channel: i % 5 === 0 ? 'HMS_LINKED' : 'RETAIL',
          customerName: `Customer ${i} ${marker}`,
          subtotal: 1000,
          discountTotal: 0,
          taxTotal: 0,
          total: 1000,
          paidTotal: i % 2 === 0 ? 500 : 1000,
          outstanding: i % 2 === 0 ? 500 : 0,
          status: i % 2 === 0 ? 'PARTIALLY_PAID' : 'PAID',
          dispensedById: user.id,
          createdAt,
        });
      }
      await tx.pharmacyInvoice.createMany({ data: invData });

      const payData: Prisma.PharmacyPaymentCreateManyInput[] = [];
      for (let i = 0; i < scale; i++) {
        const inv = invData[i];
        payData.push({
          id: randomUUID(),
          invoiceId: inv.id,
          amount: 500,
          method: 'CASH',
          isInitial: true,
          collectedById: user.id,
          paidAt: inv.createdAt,
        });
        if (i % 2 !== 0) {
          payData.push({
            id: randomUUID(),
            invoiceId: inv.id,
            amount: 500,
            method: 'CARD',
            isInitial: false,
            collectedById: user.id,
            paidAt: new Date(new Date(inv.createdAt).getTime() + 5 * 86400000),
          });
        }
      }
      await tx.pharmacyPayment.createMany({ data: payData });

      console.log(`Created ${scale} invoices and ${payData.length} payments.\n`);

      // ── Benchmark 1: Existing In-Memory Slicing ──
      console.log('--- Testing In-Memory Slicing (Current Method) ---');
      const memBefore1 = process.memoryUsage().heapUsed;
      const t1Start = performance.now();
      const inMemoryResult = (await pharmacyService.listInvoices(
        { transactions: 'true', page: 1, limit: 25 },
        tx
      )) as any;
      const t1End = performance.now();
      const memAfter1 = process.memoryUsage().heapUsed;
      const t1 = Math.round(t1End - t1Start);
      const heap1 = Math.round(((memAfter1 - memBefore1) / 1024 / 1024) * 100) / 100;
      console.log(`In-Memory Execution Time: ${t1} ms | Heap Delta: ${heap1} MB`);
      console.log(`In-Memory Items: ${inMemoryResult.items.length} of ${inMemoryResult.total}\n`);

      // ── Benchmark 2: Database-Side SQL LIMIT/OFFSET Query ──
      console.log('--- Testing Database-Side SQL Pagination ---');
      const memBefore2 = process.memoryUsage().heapUsed;
      const t2Start = performance.now();

      // Run SQL projection with LIMIT 25 OFFSET 0
      const sqlPage = tx.$queryRaw<any[]>`
        WITH ranked_payments AS (
          SELECT
            p.id, p.invoice_id, p.amount, p.method, p.paid_at, p.payment_account_id, p.collected_by, p.is_initial,
            ROW_NUMBER() OVER (PARTITION BY p.invoice_id ORDER BY p.paid_at ASC, p.id ASC) as pay_rank
          FROM pharmacy_payments p
          WHERE p.amount > 0
        ),
        classified_payments AS (
          SELECT
            p.id, p.invoice_id, p.amount, p.method, p.paid_at, p.payment_account_id, p.collected_by,
            CASE
              WHEN p.is_initial = true THEN true
              WHEN p.is_initial = false THEN false
              WHEN p.paid_at = i.created_at THEN true
              WHEN (p.paid_at + INTERVAL '5 hours')::date = (i.created_at + INTERVAL '5 hours')::date AND rp.pay_rank = 1 THEN true
              ELSE false
            END as is_initial_effective
          FROM pharmacy_payments p
          JOIN pharmacy_invoices i ON i.id = p.invoice_id
          LEFT JOIN ranked_payments rp ON rp.id = p.id
        ),
        first_hms_events AS (
          SELECT DISTINCT ON (e.invoice_id)
            e.id, e.invoice_id, e.collection_delta, e.occurred_at, e.reference, e.method, e.actor_id
          FROM pharmacy_financial_events e
          JOIN pharmacy_invoices i ON i.id = e.invoice_id
          WHERE e.kind LIKE 'HMS_%' AND e.occurred_at IS NOT NULL AND e.collection_delta > 0
            AND (e.occurred_at + INTERVAL '5 hours')::date = (i.created_at + INTERVAL '5 hours')::date
          ORDER BY e.invoice_id, e.occurred_at ASC, e.id ASC
        ),
        invoice_returns AS (
          SELECT invoice_id, COALESCE(SUM(sale_delta), 0) as total_return_sale
          FROM pharmacy_financial_events WHERE kind = 'RETURN' GROUP BY invoice_id
        ),
        invoice_legacy_refunds AS (
          SELECT r.reference_id as invoice_id, COALESCE(SUM(r.amount), 0) as total_refund_amount
          FROM cash_ledger_entries r
          WHERE r.category = 'REFUND' AND r.reference_table = 'pharmacy_invoices'
            AND NOT EXISTS (SELECT 1 FROM pharmacy_financial_events e WHERE e.reference = r.id)
          GROUP BY r.reference_id
        ),
        initial_payments_agg AS (
          SELECT
            cp.invoice_id,
            COALESCE(SUM(cp.amount), 0) as initial_collected,
            STRING_AGG('PAY-' || UPPER(SUBSTRING(cp.id, 1, 8)), ', ' ORDER BY cp.paid_at ASC, cp.id ASC) as initial_receipts,
            STRING_AGG(cp.method::text, ', ' ORDER BY cp.paid_at ASC, cp.id ASC) as initial_methods,
            STRING_AGG(COALESCE(pa.name, ''), ', ' ORDER BY cp.paid_at ASC, cp.id ASC) as initial_accounts,
            STRING_AGG(COALESCE(pu.full_name, ''), ', ' ORDER BY cp.paid_at ASC, cp.id ASC) as initial_collectors
          FROM classified_payments cp
          LEFT JOIN payment_accounts pa ON pa.id = cp.payment_account_id
          LEFT JOIN portal_users pu ON pu.id = cp.collected_by
          WHERE cp.is_initial_effective = true
          GROUP BY cp.invoice_id
        ),
        all_transactions AS (
          SELECT
            'invoice:' || i.id as id, i.id as invoice_id, 'invoice:' || i.id as transaction_id,
            'Original Sale' as transaction_type, i.created_at as transaction_at, i.created_at as invoice_created_at,
            i.invoice_number, i.channel::text as channel, i.customer_name, i.external_admission_ref, i.status::text as status,
            i.outstanding::numeric as outstanding, i.total::numeric as invoice_total, i.paid_total::numeric as invoice_paid_total,
            i.subtotal::numeric as invoice_subtotal, i.discount_total::numeric as invoice_discount_total, i.tax_total::numeric as invoice_tax_total,
            (i.total - COALESCE(ret.total_return_sale, 0) + COALESCE(ref.total_refund_amount, 0))::numeric as billing_amount,
            (COALESCE(ipa.initial_collected, 0) + COALESCE(fhe.collection_delta, 0))::numeric as collected_amount,
            NULLIF(TRIM(CONCAT_WS(', ', ipa.initial_receipts, fhe.reference)), '') as receipt_number,
            NULLIF(TRIM(CONCAT_WS(', ', ipa.initial_methods, fhe.method)), '') as payment_method,
            NULLIF(TRIM(ipa.initial_accounts), '') as payment_account_name,
            COALESCE(NULLIF(TRIM(CONCAT_WS(', ', ipa.initial_collectors, CASE WHEN fhe.id IS NOT NULL THEN COALESCE(fhe.actor_id, 'HMS Front Desk') END)), ''), u.full_name, 'Staff') as collected_by_name,
            u.id as dispensed_by_id, u.full_name as dispensed_by_full_name, u.username as dispensed_by_username
          FROM pharmacy_invoices i
          JOIN portal_users u ON u.id = i.dispensed_by
          LEFT JOIN initial_payments_agg ipa ON ipa.invoice_id = i.id
          LEFT JOIN first_hms_events fhe ON fhe.invoice_id = i.id
          LEFT JOIN invoice_returns ret ON ret.invoice_id = i.id
          LEFT JOIN invoice_legacy_refunds ref ON ref.invoice_id = i.id

          UNION ALL

          SELECT
            'payment:' || cp.id as id, i.id as invoice_id, 'payment:' || cp.id as transaction_id,
            CASE WHEN cp.amount < 0 THEN 'Collection Reversal' ELSE 'Remaining Collection' END as transaction_type,
            cp.paid_at as transaction_at, i.created_at as invoice_created_at,
            i.invoice_number, i.channel::text as channel, i.customer_name, i.external_admission_ref, i.status::text as status,
            i.outstanding::numeric as outstanding, i.total::numeric as invoice_total, i.paid_total::numeric as invoice_paid_total,
            i.subtotal::numeric as invoice_subtotal, i.discount_total::numeric as invoice_discount_total, i.tax_total::numeric as invoice_tax_total,
            0::numeric as billing_amount, cp.amount::numeric as collected_amount,
            'PAY-' || UPPER(SUBSTRING(cp.id, 1, 8)) as receipt_number, cp.method::text as payment_method,
            COALESCE(pa.name, '') as payment_account_name, COALESCE(pu.full_name, 'Staff') as collected_by_name,
            u.id as dispensed_by_id, u.full_name as dispensed_by_full_name, u.username as dispensed_by_username
          FROM classified_payments cp
          JOIN pharmacy_invoices i ON i.id = cp.invoice_id
          JOIN portal_users u ON u.id = i.dispensed_by
          LEFT JOIN payment_accounts pa ON pa.id = cp.payment_account_id
          LEFT JOIN portal_users pu ON pu.id = cp.collected_by
          WHERE cp.is_initial_effective = false
        )
        SELECT * FROM all_transactions
        ORDER BY transaction_at DESC, id ASC
        LIMIT 25 OFFSET 0;
      `;

      const sqlSummary = tx.$queryRaw<any[]>`
        WITH ranked_payments AS (
          SELECT p.id, p.invoice_id, p.amount, p.paid_at, p.is_initial,
            ROW_NUMBER() OVER (PARTITION BY p.invoice_id ORDER BY p.paid_at ASC, p.id ASC) as pay_rank
          FROM pharmacy_payments p WHERE p.amount > 0
        ),
        classified_payments AS (
          SELECT p.id, p.invoice_id, p.amount, p.paid_at,
            CASE
              WHEN p.is_initial = true THEN true
              WHEN p.is_initial = false THEN false
              WHEN p.paid_at = i.created_at THEN true
              WHEN (p.paid_at + INTERVAL '5 hours')::date = (i.created_at + INTERVAL '5 hours')::date AND rp.pay_rank = 1 THEN true
              ELSE false
            END as is_initial_effective
          FROM pharmacy_payments p JOIN pharmacy_invoices i ON i.id = p.invoice_id LEFT JOIN ranked_payments rp ON rp.id = p.id
        ),
        all_tx AS (
          SELECT i.id as invoice_id, i.total::numeric as billing_amount, COALESCE(SUM(cp.amount), 0)::numeric as collected_amount, i.outstanding::numeric as outstanding
          FROM pharmacy_invoices i
          LEFT JOIN classified_payments cp ON cp.invoice_id = i.id AND cp.is_initial_effective = true
          GROUP BY i.id, i.total, i.outstanding

          UNION ALL

          SELECT cp.invoice_id, 0::numeric as billing_amount, cp.amount::numeric as collected_amount, i.outstanding::numeric as outstanding
          FROM classified_payments cp JOIN pharmacy_invoices i ON i.id = cp.invoice_id
          WHERE cp.is_initial_effective = false
        ),
        summary_m AS (
          SELECT COALESCE(SUM(billing_amount), 0) as total_billing, COALESCE(SUM(collected_amount), 0) as total_collected, COUNT(*) as total_count, COUNT(DISTINCT invoice_id) as total_invoices
          FROM all_tx
        ),
        distinct_inv AS (SELECT DISTINCT ON (invoice_id) outstanding FROM all_tx),
        out_m AS (SELECT COALESCE(SUM(outstanding), 0) as total_outstanding FROM distinct_inv)
        SELECT s.*, o.total_outstanding FROM summary_m s, out_m o;
      `;

      const [pagedRows, summaryRows] = await Promise.all([sqlPage, sqlSummary]);
      const t2End = performance.now();
      const memAfter2 = process.memoryUsage().heapUsed;
      const t2 = Math.round(t2End - t2Start);
      const heap2 = Math.round(((memAfter2 - memBefore2) / 1024 / 1024) * 100) / 100;

      console.log(`Database SQL Execution Time: ${t2} ms | Heap Delta: ${heap2} MB`);
      console.log(`Database SQL Items: ${pagedRows.length} (Total in DB: ${summaryRows[0].total_count})`);
      console.log(`Speedup: ${(t1 / t2).toFixed(1)}x faster | Memory reduction: ${(heap1 / Math.max(0.01, heap2)).toFixed(1)}x less memory\n`);

      throw rollback;
    }, { timeout: 180000 });
  } catch (err) {
    if (err !== rollback) console.error(err);
    else console.log('Benchmark comparison finished cleanly.');
  } finally {
    await prisma.$disconnect();
  }
}

benchmarkComparison().catch(console.error);

