/**
 * medicine-packaging-plan — regression test suite for the configurable
 * packaging/unit architecture (Unit master, MedicinePackagingLevel,
 * Purchase/POS unit conversion, batch packaging snapshots).
 *
 * No test framework is wired into this project yet, so this is a
 * self-contained, repeatable script against the running dev API — each
 * check is an assertion that throws (and the process exits 1) on failure,
 * printing a ✅/❌ per case. All test medicines are cleaned up at the end
 * (and cleaned up first, in case a previous run was interrupted).
 *
 * Prereqs: backend dev server running on :4100, superadmin credentials
 * below valid for this environment.
 *
 * Run with: npx tsx scripts/test-packaging-architecture.ts
 */
import { PrismaClient } from '@prisma/client';

const API_BASE = 'http://localhost:4100/api/v1';
const CREDENTIALS = { identifier: 'superadmin', password: 'TestPass@123' };
const TEST_CODES = ['TST-PKG-SIMPLE', 'TST-PKG-2LVL', 'TST-PKG-4LVL', 'TST-PKG-BADPURCH', 'TST-PKG-DUP'];

let passed = 0;
let failed = 0;

function assert(condition: boolean, message: string) {
  if (condition) {
    console.log(`  ✅ ${message}`);
    passed++;
  } else {
    console.log(`  ❌ ${message}`);
    failed++;
  }
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
    await prisma.pharmacyInvoiceLine.deleteMany({ where: { medicineId: med.id } });
    const invoices = await prisma.pharmacyInvoice.findMany({ where: { lines: { some: { medicineId: med.id } } } });
    for (const inv of invoices) {
      await prisma.pharmacyPayment.deleteMany({ where: { invoiceId: inv.id } });
      await prisma.pharmacyInvoice.delete({ where: { id: inv.id } });
    }
    await prisma.purchaseLine.deleteMany({ where: { medicineId: med.id } });
    await prisma.medicineBatch.deleteMany({ where: { medicineId: med.id } });
    await prisma.medicinePackagingLevel.deleteMany({ where: { medicineId: med.id } });
    await prisma.medicineMaster.delete({ where: { id: med.id } });
  }
}

async function main() {
  const prisma = new PrismaClient();
  console.log('Cleaning up any leftover test data from a previous run…');
  await cleanup(prisma);

  const login = await api('POST', '/auth/login', null, CREDENTIALS);
  if (login.status !== 200) throw new Error(`Login failed: ${JSON.stringify(login.body)}`);
  const token = login.body.data.accessToken as string;

  const unitsRes = await api('GET', '/units', token);
  const unitsByName = new Map<string, string>(unitsRes.body.data.map((u: any) => [u.name, u.id]));
  const u = (name: string) => {
    const id = unitsByName.get(name);
    if (!id) throw new Error(`Unit "${name}" not found in catalog`);
    return id;
  };
  const vendorsRes = await api('GET', '/vendors', token);
  const vendorId = vendorsRes.body.data[0]?.id;
  if (!vendorId) throw new Error('No vendor in DB to test purchases against');

  // ── 1. Single-unit medicine (Bottle only) ────────────────────────────
  console.log('\n[1] Single-unit medicine ("Bottle" only, no breakdown)');
  {
    const r = await api('POST', '/pharmacy/medicines', token, {
      code: 'TST-PKG-SIMPLE', name: 'Test Cough Syrup', baseUnitId: u('Bottle'),
      baseIsPurchaseUnit: true, baseIsSaleUnit: true, packagingLevels: [],
      saleRate: 150, taxPercent: 0, reorderLevel: 5,
    });
    assert(r.status === 201, `medicine created (status ${r.status})`);
    const pkg = await api('GET', `/pharmacy/medicines/${r.body.data.id}/packaging`, token);
    assert(pkg.body.data.levels.length === 1, `exactly one packaging level (base only), got ${pkg.body.data.levels.length}`);
    assert(Number(pkg.body.data.levels[0].conversionToBase) === 1, 'base level conversionToBase === 1');
  }

  // ── 2. Two-level: Box -> Tablet (no intermediate Strip) ──────────────
  console.log('\n[2] Two-level medicine (Box -> Tablet, no Strip)');
  {
    const r = await api('POST', '/pharmacy/medicines', token, {
      code: 'TST-PKG-2LVL', name: 'Test Vial Medicine', baseUnitId: u('Vial'),
      baseIsPurchaseUnit: false, baseIsSaleUnit: true,
      packagingLevels: [{ unitId: u('Box'), conversionToBase: 20, isPurchaseUnit: true, isSaleUnit: true }],
      saleRate: 300, taxPercent: 0, reorderLevel: 5,
    });
    assert(r.status === 201, `medicine created (status ${r.status})`);
    const pkg = await api('GET', `/pharmacy/medicines/${r.body.data.id}/packaging`, token);
    const box = pkg.body.data.levels.find((l: any) => l.unit.name === 'Box');
    assert(Number(box.conversionToBase) === 20, `1 Box = 20 Vial, got ${box?.conversionToBase}`);
  }

  // ── 3. Four-level chain: Carton -> Box -> Strip -> Tablet ────────────
  console.log('\n[3] Four-level chain (Carton -> Box -> Strip -> Tablet) — arbitrary depth, not hardcoded to 3');
  let fourLevelMedicineId = '';
  {
    // Relative chain as a pharmacist enters it: 1 Carton = 5 Box, 1 Box = 10 Strip, 1 Strip = 10 Tablet.
    // Flat (what the API stores): Strip=10, Box=10*10=100, Carton=100*5=500.
    const r = await api('POST', '/pharmacy/medicines', token, {
      code: 'TST-PKG-4LVL', name: 'Test Four Level Medicine', baseUnitId: u('Tablet'),
      baseIsPurchaseUnit: false, baseIsSaleUnit: true,
      packagingLevels: [
        { unitId: u('Strip'), conversionToBase: 10, isPurchaseUnit: false, isSaleUnit: true },
        { unitId: u('Box'), conversionToBase: 100, isPurchaseUnit: false, isSaleUnit: true },
        { unitId: u('Carton'), conversionToBase: 500, isPurchaseUnit: true, isSaleUnit: false },
      ],
      saleRate: 5, taxPercent: 0, reorderLevel: 50,
    });
    assert(r.status === 201, `medicine created (status ${r.status})`);
    fourLevelMedicineId = r.body.data.id;
    const pkg = await api('GET', `/pharmacy/medicines/${fourLevelMedicineId}/packaging`, token);
    const byName = new Map(pkg.body.data.levels.map((l: any) => [l.unit.name, Number(l.conversionToBase)]));
    assert(byName.get('Tablet') === 1, 'Tablet (base) = 1');
    assert(byName.get('Strip') === 10, `Strip = 10, got ${byName.get('Strip')}`);
    assert(byName.get('Box') === 100, `Box = 100, got ${byName.get('Box')}`);
    assert(byName.get('Carton') === 500, `Carton = 500, got ${byName.get('Carton')}`);

    // Purchase 2 Cartons @ Rs 5000/Carton -> expect 1000 Tablets stock, Rs10/Tablet cost.
    const purchase = await api('POST', '/vendors/purchases', token, {
      vendorId, purchaseDate: new Date().toISOString(),
      lines: [{ medicineId: fourLevelMedicineId, batchNumber: 'TST-4LVL-B1', expiryDate: '2028-01-01', purchaseUnitId: u('Carton'), purchaseUnitQuantity: 2, unitCost: 5000, discountAmount: 0, taxAmount: 0 }],
      paidNow: 0, post: true,
    });
    assert(purchase.status === 201, `purchase posted (status ${purchase.status})`);
    const pline = purchase.body.data.lines[0];
    assert(Number(pline.quantity) === 1000, `base stock added = 1000 Tablet, got ${pline.quantity}`);
    assert(Number(pline.unitCost) === 10, `per-base cost = Rs10/Tablet, got ${pline.unitCost}`);
    assert(Number(pline.batch.purchaseUnitConversionToBase) === 500, 'batch snapshot froze 1 Carton = 500 Tablet');
    const snapshotChain = pline.batch.packagingSnapshotJson;
    assert(Array.isArray(snapshotChain) && snapshotChain.length === 4, `batch snapshot preserved full 4-level chain, got ${JSON.stringify(snapshotChain)}`);

    // Sell 3 Boxes via POS -> expect 300 base Tablets deducted.
    const sale = await api('POST', '/pharmacy/dispense', token, {
      lines: [{ medicineId: fourLevelMedicineId, saleUnitId: u('Box'), saleUnitQuantity: 3, discountAmount: 0 }],
      invoiceDiscount: 0, payments: [{ method: 'CASH', amount: 1500 }],
    });
    assert(sale.status === 201, `POS sale of 3 Box completed (status ${sale.status})`);
    assert(Number(sale.body.data.lines[0].quantity) === 300, `base qty deducted = 300 Tablet, got ${sale.body.data.lines[0].quantity}`);

    // Re-purchasing the SAME batch number with a DIFFERENT pack size must be blocked.
    const conflictingPurchase = await api('POST', '/vendors/purchases', token, {
      vendorId, purchaseDate: new Date().toISOString(),
      lines: [{ medicineId: fourLevelMedicineId, batchNumber: 'TST-4LVL-B1', expiryDate: '2028-01-01', purchaseUnitId: u('Box'), purchaseUnitQuantity: 1, unitCost: 1000, discountAmount: 0, taxAmount: 0 }],
      paidNow: 0, post: true,
    });
    assert(conflictingPurchase.status === 400, `re-purchasing same batch with a different pack size is rejected (status ${conflictingPurchase.status})`);

    // But re-purchasing with the SAME packaging (more Cartons) must succeed and add stock correctly.
    const samePackagingPurchase = await api('POST', '/vendors/purchases', token, {
      vendorId, purchaseDate: new Date().toISOString(),
      lines: [{ medicineId: fourLevelMedicineId, batchNumber: 'TST-4LVL-B1', expiryDate: '2028-01-01', purchaseUnitId: u('Carton'), purchaseUnitQuantity: 1, unitCost: 5000, discountAmount: 0, taxAmount: 0 }],
      paidNow: 0, post: true,
    });
    assert(samePackagingPurchase.status === 201, `re-purchasing the same batch with the SAME pack size succeeds (status ${samePackagingPurchase.status})`);
  }

  // ── 4. Validation: must have exactly one Default Purchase Unit ──────
  console.log('\n[4] Validation — exactly one Default Purchase Unit required');
  {
    const zeroChosen = await api('POST', '/pharmacy/medicines', token, {
      code: 'TST-PKG-BADPURCH', name: 'Test Bad Purchase Unit', baseUnitId: u('Jar'),
      baseIsPurchaseUnit: false, baseIsSaleUnit: true, packagingLevels: [],
      saleRate: 10, taxPercent: 0, reorderLevel: 5,
    });
    assert(zeroChosen.status === 400, `zero purchase units chosen is rejected (status ${zeroChosen.status})`);

    const twoChosen = await api('POST', '/pharmacy/medicines', token, {
      code: 'TST-PKG-BADPURCH', name: 'Test Bad Purchase Unit', baseUnitId: u('Jar'),
      baseIsPurchaseUnit: true, baseIsSaleUnit: true,
      packagingLevels: [{ unitId: u('Carton'), conversionToBase: 12, isPurchaseUnit: true, isSaleUnit: true }],
      saleRate: 10, taxPercent: 0, reorderLevel: 5,
    });
    assert(twoChosen.status === 400, `two purchase units chosen is rejected (status ${twoChosen.status})`);
  }

  // ── 5. Validation — duplicate unit across levels ─────────────────────
  console.log('\n[5] Validation — duplicate unit in packaging levels rejected');
  {
    const dup = await api('POST', '/pharmacy/medicines', token, {
      code: 'TST-PKG-DUP', name: 'Test Duplicate Unit', baseUnitId: u('Tube'),
      baseIsPurchaseUnit: false, baseIsSaleUnit: true,
      packagingLevels: [
        { unitId: u('Box'), conversionToBase: 10, isPurchaseUnit: false, isSaleUnit: true },
        { unitId: u('Box'), conversionToBase: 20, isPurchaseUnit: true, isSaleUnit: true },
      ],
      saleRate: 10, taxPercent: 0, reorderLevel: 5,
    });
    assert(dup.status === 400, `duplicate unit ("Box" twice) is rejected (status ${dup.status})`);
  }

  // ── 6. Validation — conversion must be > 1 ───────────────────────────
  console.log('\n[6] Validation — packaging level conversion must exceed 1 base unit');
  {
    const bad = await api('POST', '/pharmacy/medicines', token, {
      code: 'TST-PKG-DUP', name: 'Test Bad Conversion', baseUnitId: u('Tube'),
      baseIsPurchaseUnit: false, baseIsSaleUnit: true,
      packagingLevels: [{ unitId: u('Box'), conversionToBase: 1, isPurchaseUnit: true, isSaleUnit: true }],
      saleRate: 10, taxPercent: 0, reorderLevel: 5,
    });
    assert(bad.status === 400, `conversionToBase=1 on a pack level is rejected (status ${bad.status})`);
  }

  console.log('\nCleaning up test data…');
  await cleanup(prisma);
  await prisma.$disconnect();

  console.log(`\n${'─'.repeat(50)}\n${passed} passed, ${failed} failed\n${'─'.repeat(50)}`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
