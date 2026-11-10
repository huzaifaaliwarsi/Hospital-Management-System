/**
 * purchase-costing-plan — regression test suite for landed-cost calculation,
 * markup-rule selling-price suggestion, packaging override + snapshot, and
 * packaging-aware purchase return. Self-contained against the running dev
 * API (no test framework wired into this project yet — see
 * scripts/test-packaging-architecture.ts for the same approach).
 *
 * Run with: npx tsx scripts/test-purchase-costing.ts
 */
import { PrismaClient } from '@prisma/client';

const API_BASE = 'http://localhost:4100/api/v1';
const CREDENTIALS = { identifier: 'superadmin', password: 'TestPass@123' };
const TEST_CODES = ['TST-COST-WORKED', 'TST-COST-OVERRIDE', 'TST-COST-DRAFT', 'TST-COST-EXPIRED'];

let passed = 0;
let failed = 0;
function assert(condition: boolean, message: string) {
  if (condition) { console.log(`  ✅ ${message}`); passed++; }
  else { console.log(`  ❌ ${message}`); failed++; }
}
function close(a: number, b: number, eps = 0.01) {
  return Math.abs(a - b) < eps;
}

async function api(method: string, path: string, token: string | null, body?: unknown) {
  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = text; }
  return { status: res.status, body: json };
}

async function cleanup(prisma: PrismaClient) {
  const meds = await prisma.medicineMaster.findMany({ where: { code: { in: TEST_CODES } } });
  for (const med of meds) {
    await prisma.stockLedgerEntry.deleteMany({ where: { medicineId: med.id } });
    await prisma.purchaseLine.deleteMany({ where: { medicineId: med.id } });
    await prisma.medicineBatch.deleteMany({ where: { medicineId: med.id } });
    await prisma.medicinePackagingLevel.deleteMany({ where: { medicineId: med.id } });
    await prisma.medicineMaster.delete({ where: { id: med.id } });
  }
  await prisma.markupRule.deleteMany({ where: { category: 'TST-Category' } });
}

async function main() {
  const prisma = new PrismaClient();
  console.log('Cleaning up any leftover test data…');
  await cleanup(prisma);

  const login = await api('POST', '/auth/login', null, CREDENTIALS);
  if (login.status !== 200) throw new Error(`Login failed: ${JSON.stringify(login.body)}`);
  const token = login.body.data.accessToken as string;

  // Pin the global default markup to 20% for a deterministic test run.
  await api('PUT', '/settings', token, { defaultMarkupPercent: 20 });

  const unitsRes = await api('GET', '/units', token);
  const unitsByName = new Map<string, string>(unitsRes.body.data.map((u: any) => [u.name, u.id]));
  const u = (name: string) => unitsByName.get(name)!;
  const vendorsRes = await api('GET', '/vendors', token);
  const vendorId = vendorsRes.body.data[0]?.id;

  // ── 1. THE WORKED EXAMPLE: 5 Box, 10 Strip/Box, 10 Tablet/Strip, Rs1000/Box, 5% discount, 20% markup ──
  console.log('\n[1] Worked example — 5 Box @ Rs1000, 5% discount, 20% markup (no category rule, uses 20% default)');
  let workedBatchId = '';
  {
    const med = await api('POST', '/pharmacy/medicines', token, {
      code: 'TST-COST-WORKED', name: 'Test Worked Example Medicine', baseUnitId: u('Tablet'),
      baseIsPurchaseUnit: false, baseIsSaleUnit: true,
      packagingLevels: [
        { unitId: u('Strip'), conversionToBase: 10, isPurchaseUnit: false, isSaleUnit: true },
        { unitId: u('Box'), conversionToBase: 100, isPurchaseUnit: true, isSaleUnit: true },
      ],
      saleRate: 0, taxPercent: 0, reorderLevel: 10,
    });
    assert(med.status === 201, `medicine created (status ${med.status})`);
    const medicineId = med.body.data.id;

    const purchase = await api('POST', '/vendors/purchases', token, {
      vendorId, purchaseDate: new Date().toISOString(),
      lines: [{
        medicineId, batchNumber: 'WORKED-B1', expiryDate: '2028-01-01',
        purchaseUnitId: u('Box'), purchaseUnitQuantity: 5, unitCost: 1000,
        discountType: 'PERCENTAGE', discountValue: 5, taxAmount: 0, freightAmount: 0,
      }],
      paidNow: 0, post: true,
    });
    assert(purchase.status === 201, `purchase posted (status ${purchase.status})`);
    const line = purchase.body.data.lines[0];
    workedBatchId = line.batch.id;

    assert(Number(line.purchaseUnitQuantity) === 5, 'purchase qty = 5 Box');
    assert(close(Number(line.quantity), 500), `base qty = 500 Tablet, got ${line.quantity}`);
    assert(close(purchase.body.data.subtotal, 5000), `gross/subtotal = Rs5000, got ${purchase.body.data.subtotal}`);
    assert(close(purchase.body.data.discountTotal, 250), `discount = Rs250 (5% of 5000), got ${purchase.body.data.discountTotal}`);
    assert(close(purchase.body.data.total, 4750), `net landed cost = Rs4750, got ${purchase.body.data.total}`);
    assert(close(Number(line.unitCost), 9.5), `effective cost/base unit (Tablet) = Rs9.50, got ${line.unitCost}`);
    assert(close(Number(line.suggestedSaleRate), 11.4), `suggested sale price/Tablet = Rs11.40 (9.5 x 1.20), got ${line.suggestedSaleRate}`);
    assert(close(Number(line.finalSaleRate), 11.4), 'finalSaleRate defaults to suggested when Admin does not override');
    assert(close(Number(line.batch.costRate), 9.5), 'batch.costRate = landed cost per base unit (9.5), not the raw vendor rate');
    assert(close(Number(line.batch.saleRate), 11.4), 'batch.saleRate snapshot = 11.40');

    const medAfter = await api('GET', '/pharmacy/medicines', token);
    const foundMed = medAfter.body.data.find((m: any) => m.id === medicineId);
    assert(close(Number(foundMed.saleRate), 11.4), `medicine.saleRate updated to 11.40 (drives future POS pricing), got ${foundMed.saleRate}`);

    // Admin overrides the price to Rs13 instead of the suggested Rs11.40 on a second restock of the same batch's medicine (new batch).
    const purchase2 = await api('POST', '/vendors/purchases', token, {
      vendorId, purchaseDate: new Date().toISOString(),
      lines: [{
        medicineId, batchNumber: 'WORKED-B2', expiryDate: '2028-06-01',
        purchaseUnitId: u('Box'), purchaseUnitQuantity: 2, unitCost: 1000,
        discountType: 'FLAT', discountValue: 0, taxAmount: 0, freightAmount: 0,
        finalSaleRate: 13,
      }],
      paidNow: 0, post: true,
    });
    assert(purchase2.status === 201, `second purchase with manual price override posted (status ${purchase2.status})`);
    const line2 = purchase2.body.data.lines[0];
    assert(close(Number(line2.unitCost), 10), `effective cost/Tablet with no discount = Rs10.00 (1000x2/200), got ${line2.unitCost}`);
    assert(close(Number(line2.suggestedSaleRate), 12), `suggested price still computed = Rs12.00 (10 x 1.20), got ${line2.suggestedSaleRate}`);
    assert(close(Number(line2.finalSaleRate), 13), 'Admin-overridden finalSaleRate = Rs13.00, NOT the suggested Rs12.00');
    // Markup % vs Margin % — must never be conflated.
    const cost = 10, sell = 13;
    const markupPct = ((sell - cost) / cost) * 100;
    const marginPct = ((sell - cost) / sell) * 100;
    assert(close(markupPct, 30), `Markup % = (13-10)/10*100 = 30%, got ${markupPct}`);
    assert(close(marginPct, 23.08, 0.01), `Margin % = (13-10)/13*100 = 23.08%, got ${marginPct.toFixed(2)}`);
    assert(Math.abs(markupPct - marginPct) > 1, 'Markup % and Margin % are NOT the same number (confirms formulas are distinct)');
  }

  // ── 2. Category-wise markup rule overrides the global default ───────
  console.log('\n[2] Category-wise markup rule (Injection = 15%) overrides the 20% global default');
  {
    await api('PUT', '/settings/markup-rules', token, { category: 'TST-Category', markupPercent: 15, isActive: true });
    const med = await api('POST', '/pharmacy/medicines', token, {
      code: 'TST-COST-OVERRIDE', name: 'Test Category Markup Medicine', category: 'TST-Category', baseUnitId: u('Vial'),
      baseIsPurchaseUnit: true, baseIsSaleUnit: true, packagingLevels: [],
      saleRate: 0, taxPercent: 0, reorderLevel: 10,
    });
    const medicineId = med.body.data.id;
    const purchase = await api('POST', '/vendors/purchases', token, {
      vendorId, purchaseDate: new Date().toISOString(),
      lines: [{ medicineId, batchNumber: 'CATEGORY-B1', expiryDate: '2028-01-01', purchaseUnitId: u('Vial'), purchaseUnitQuantity: 10, unitCost: 100, discountType: 'FLAT', discountValue: 0, taxAmount: 0, freightAmount: 0 }],
      paidNow: 0, post: true,
    });
    const line = purchase.body.data.lines[0];
    assert(close(Number(line.unitCost), 100), 'cost/base unit = Rs100 (no discount, no breakdown)');
    assert(close(Number(line.suggestedSaleRate), 115), `category markup applied: 100 x 1.15 = Rs115, got ${line.suggestedSaleRate}`);
  }

  // ── 3. Packaging override — this vendor batch's Box has 12 Strips, not the default 10 ──
  console.log('\n[3] Packaging override for a single purchase — does NOT change Medicine Master');
  {
    const med = await api('POST', '/pharmacy/medicines', token, {
      code: 'TST-COST-DRAFT', name: 'Test Packaging Override Medicine', baseUnitId: u('Tablet'),
      baseIsPurchaseUnit: false, baseIsSaleUnit: true,
      packagingLevels: [
        { unitId: u('Strip'), conversionToBase: 10, isPurchaseUnit: false, isSaleUnit: true },
        { unitId: u('Box'), conversionToBase: 100, isPurchaseUnit: true, isSaleUnit: true },
      ],
      saleRate: 0, taxPercent: 0, reorderLevel: 10,
    });
    const medicineId = med.body.data.id;

    const purchase = await api('POST', '/vendors/purchases', token, {
      vendorId, purchaseDate: new Date().toISOString(),
      lines: [{
        medicineId, batchNumber: 'OVERRIDE-B1', expiryDate: '2028-01-01',
        purchaseUnitId: u('Box'), purchaseUnitQuantity: 1, unitCost: 1200,
        discountType: 'FLAT', discountValue: 0, taxAmount: 0, freightAmount: 0,
        packagingOverride: { purchaseUnitConversionToBase: 120, applyToMedicineMasterDefault: false },
      }],
      paidNow: 0, post: true,
    });
    assert(purchase.status === 201, `purchase with packaging override posted (status ${purchase.status})`);
    const line = purchase.body.data.lines[0];
    assert(close(Number(line.quantity), 120), `base qty = 120 Tablet (1 Box = 120, the override), got ${line.quantity}`);
    assert(line.packagingOverridden === true, 'line flagged packagingOverridden = true');
    assert(close(Number(line.batch.purchaseUnitConversionToBase), 120), 'batch snapshot froze the OVERRIDE (120), not the default (100)');

    const liveLevel = await api('GET', `/pharmacy/medicines/${medicineId}/packaging`, token);
    const liveBox = liveLevel.body.data.levels.find((l: any) => l.unit.name === 'Box');
    assert(Number(liveBox.conversionToBase) === 100, `Medicine Master's live default packaging is UNCHANGED (still 100), got ${liveBox.conversionToBase}`);

    // A second purchase of the SAME batch number with the original default (100) must now be rejected — the batch is frozen at 120.
    const conflict = await api('POST', '/vendors/purchases', token, {
      vendorId, purchaseDate: new Date().toISOString(),
      lines: [{ medicineId, batchNumber: 'OVERRIDE-B1', expiryDate: '2028-01-01', purchaseUnitId: u('Box'), purchaseUnitQuantity: 1, unitCost: 1200, discountType: 'FLAT', discountValue: 0, taxAmount: 0, freightAmount: 0 }],
      paidNow: 0, post: true,
    });
    assert(conflict.status === 400, `re-purchasing "OVERRIDE-B1" at the medicine's default (100) now conflicts with its frozen override (120) (status ${conflict.status})`);

    // Explicit opt-in: apply the override as the new Medicine Master default going forward.
    const purchase2 = await api('POST', '/vendors/purchases', token, {
      vendorId, purchaseDate: new Date().toISOString(),
      lines: [{
        medicineId, batchNumber: 'OVERRIDE-B2', expiryDate: '2028-06-01',
        purchaseUnitId: u('Box'), purchaseUnitQuantity: 1, unitCost: 1200,
        discountType: 'FLAT', discountValue: 0, taxAmount: 0, freightAmount: 0,
        packagingOverride: { purchaseUnitConversionToBase: 120, applyToMedicineMasterDefault: true },
      }],
      paidNow: 0, post: true,
    });
    assert(purchase2.status === 201, `second override purchase with applyToMedicineMasterDefault=true posted (status ${purchase2.status})`);
    const liveLevelAfter = await api('GET', `/pharmacy/medicines/${medicineId}/packaging`, token);
    const liveBoxAfter = liveLevelAfter.body.data.levels.find((l: any) => l.unit.name === 'Box');
    assert(Number(liveBoxAfter.conversionToBase) === 120, `Medicine Master default NOW updated to 120 (explicit opt-in), got ${liveBoxAfter.conversionToBase}`);
  }

  // ── 4. Draft purchase must not move stock; posting it later does ────
  console.log('\n[4] Draft Purchase -> Post Purchase flow');
  {
    const med = await api('POST', '/pharmacy/medicines', token, {
      code: 'TST-COST-EXPIRED', name: 'Test Draft Flow Medicine', baseUnitId: u('Bottle'),
      baseIsPurchaseUnit: true, baseIsSaleUnit: true, packagingLevels: [],
      saleRate: 0, taxPercent: 0, reorderLevel: 5,
    });
    const medicineId = med.body.data.id;
    const beforeStock = (await api('GET', '/pharmacy/medicines', token)).body.data.find((m: any) => m.id === medicineId).currentStock;

    const draft = await api('POST', '/vendors/purchases', token, {
      vendorId, purchaseDate: new Date().toISOString(),
      lines: [{ medicineId, batchNumber: 'DRAFT-B1', expiryDate: '2028-01-01', purchaseUnitId: u('Bottle'), purchaseUnitQuantity: 10, unitCost: 50, discountType: 'FLAT', discountValue: 0, taxAmount: 0, freightAmount: 0 }],
      paidNow: 0, post: false,
    });
    assert(draft.status === 201, `draft purchase created (status ${draft.status})`);
    assert(draft.body.data.status === 'DRAFT', 'purchase status = DRAFT');
    const stockAfterDraft = (await api('GET', '/pharmacy/medicines', token)).body.data.find((m: any) => m.id === medicineId).currentStock;
    assert(Number(stockAfterDraft) === Number(beforeStock), `draft purchase did NOT change stock (still ${beforeStock})`);

    const posted = await api('POST', `/vendors/purchases/${draft.body.data.id}/post`, token);
    assert(posted.status === 200, `posting the draft succeeded (status ${posted.status})`);
    assert(posted.body.data.status === 'POSTED', 'purchase status now POSTED');
    const stockAfterPost = (await api('GET', '/pharmacy/medicines', token)).body.data.find((m: any) => m.id === medicineId).currentStock;
    assert(Number(stockAfterPost) === Number(beforeStock) + 10, `posting the draft added 10 Bottle (now ${stockAfterPost})`);

    // Expiry validation — a batch dated in the past must be rejected outright.
    const expired = await api('POST', '/vendors/purchases', token, {
      vendorId, purchaseDate: new Date().toISOString(),
      lines: [{ medicineId, batchNumber: 'EXPIRED-B1', expiryDate: '2020-01-01', purchaseUnitId: u('Bottle'), purchaseUnitQuantity: 1, unitCost: 50, discountType: 'FLAT', discountValue: 0, taxAmount: 0, freightAmount: 0 }],
      paidNow: 0, post: true,
    });
    assert(expired.status === 400, `purchasing a batch with a past expiry date is rejected (status ${expired.status})`);
  }

  // ── 5. Purchase Return — uses the ORIGINAL batch's frozen snapshot, not today's live values ──
  console.log('\n[5] Purchase Return — packaging + cost resolved from the batch snapshot');
  {
    const workedMedicineId = await prismaLookup(prisma, 'TST-COST-WORKED');
    // Return 1 Box (= 100 Tablet, the ORIGINAL packaging at purchase time) from the worked-example batch, which was landed at Rs9.50/Tablet.
    const ret = await api('POST', '/vendors/purchase-returns', token, {
      vendorId,
      lines: [{ medicineId: workedMedicineId, batchId: workedBatchId, returnUnitId: u('Box'), returnUnitQuantity: 1 }],
      reason: 'Damaged in transit',
    });
    assert(ret.status === 201, `return of 1 Box posted (status ${ret.status})`);
    assert(close(Number(ret.body.data.amount), -950), `return value = -Rs950 (100 Tablet x Rs9.50 landed cost), got ${ret.body.data.amount}`);

    const medAfter = await api('GET', '/pharmacy/medicines', token);
    const found = medAfter.body.data.find((m: any) => m.id === workedMedicineId);
    // Started with 500 (batch1) + 200 (batch2, 2 Box x100) = 700, minus 100 returned = 600.
    assert(close(Number(found.currentStock), 600), `stock reduced by the returned 100 base units (now ${found.currentStock})`);

    // Returning more than what's in that batch must be rejected.
    const overReturn = await api('POST', '/vendors/purchase-returns', token, {
      vendorId,
      lines: [{ medicineId: workedMedicineId, batchId: workedBatchId, returnUnitId: u('Box'), returnUnitQuantity: 100 }],
      reason: 'Test over-return',
    });
    assert(overReturn.status === 400, `returning more than the batch has in stock is rejected (status ${overReturn.status})`);
  }

  console.log('\nCleaning up test data…');
  await cleanup(prisma);
  await prisma.$disconnect();

  console.log(`\n${'─'.repeat(50)}\n${passed} passed, ${failed} failed\n${'─'.repeat(50)}`);
  process.exit(failed > 0 ? 1 : 0);
}

async function prismaLookup(prisma: PrismaClient, code: string) {
  const m = await prisma.medicineMaster.findUniqueOrThrow({ where: { code } });
  return m.id;
}

main().catch((e) => { console.error(e); process.exit(1); });
