/**
 * Add-Medicine-form fix — regression suite for the "Fix and improve the
 * existing 'Add Medicine to Formulary' form" task: new basic fields
 * (strength, genericName, dosageForm), optional saleRate, the exact
 * "Panadol Extra" worked example from the spec (1 Box = 10 Strip, 1 Strip
 * = 10 Tablet -> 1 Box = 100 Tablet), packaging validations, sale-unit
 * generation, and edit-flow persistence.
 *
 * Self-contained against the running dev API (no test framework wired into
 * this project). Run with: npx tsx scripts/test-add-medicine-form.ts
 */
import { PrismaClient } from '@prisma/client';

const API_BASE = 'http://localhost:4100/api/v1';
const CREDENTIALS = { identifier: 'superadmin', password: 'TestPass@123' };
const TEST_CODES = ['TST-AMF-PANADOL', 'TST-AMF-NOPRICE', 'TST-AMF-DUP', 'TST-AMF-ZERO', 'TST-AMF-CIRC'];

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

  // ── 1. The exact "Panadol Extra" example from the spec ──────────────────
  console.log('\n[1] Panadol Extra — Base=Tablet, Purchase=Box, 1 Box=10 Strip, 1 Strip=10 Tablet');
  let panadolId = '';
  {
    const r = await api('POST', '/pharmacy/medicines', token, {
      code: 'TST-AMF-PANADOL',
      name: 'Panadol Extra',
      genericName: 'Paracetamol + Caffeine',
      strength: '500mg',
      dosageForm: 'Tablet',
      category: 'Analgesics',
      baseUnitId: u('Tablet'),
      baseIsPurchaseUnit: false,
      baseIsSaleUnit: true,
      packagingLevels: [
        { unitId: u('Strip'), conversionToBase: 10, isPurchaseUnit: false, isSaleUnit: true },
        { unitId: u('Box'), conversionToBase: 100, isPurchaseUnit: true, isSaleUnit: true },
      ],
      batchManaged: true,
      reorderLevel: 100,
      taxPercent: 0,
      // saleRate intentionally omitted — must save successfully (Default Sale Price is optional).
    });
    assert(r.status === 201, `Create succeeds without saleRate (status ${r.status}: ${JSON.stringify(r.body)})`);
    panadolId = r.body.data?.id;
    assert(Number(r.body.data?.saleRate) === 0, 'saleRate defaults to 0 when omitted (not rejected as required)');
    assert(r.body.data?.strength === '500mg', 'strength persisted');
    assert(r.body.data?.genericName === 'Paracetamol + Caffeine', 'genericName persisted');
    assert(r.body.data?.dosageForm === 'Tablet', 'dosageForm persisted');
    assert(Number(r.body.data?.reorderLevel) === 100, 'reorderLevel = 100 (Tablets, the base unit)');
    assert(Number(r.body.data?.currentStock ?? 0) === 0, 'currentStock = 0 on creation (Add Medicine never touches stock)');

    const pkg = await api('GET', `/pharmacy/medicines/${panadolId}/packaging`, token);
    const levels = pkg.body.data.levels as any[];
    const strip = levels.find((l) => l.unitId === u('Strip'));
    const box = levels.find((l) => l.unitId === u('Box'));
    assert(Number(strip?.conversionToBase) === 10, '1 Strip = 10 Tablet (conversion stored flat)');
    assert(Number(box?.conversionToBase) === 100, '1 Box = 100 Tablet (auto-calculated flat total)');
    assert(box?.isPurchaseUnit === true, 'Box is the single Default Purchase Unit');
    assert([levels.find((l) => l.level === 0)?.isSaleUnit, strip?.isSaleUnit, box?.isSaleUnit].every(Boolean), 'Sale Units = Tablet, Strip, Box (all three sellable)');
  }

  // ── 2. List row reflects new fields ──────────────────────────────────────
  console.log('\n[2] Formulary list includes the new fields');
  {
    const list = await api('GET', '/pharmacy/medicines', token);
    const row = list.body.data.find((m: any) => m.id === panadolId);
    assert(!!row, 'Panadol Extra appears in medicine list');
    assert(row?.strength === '500mg' && row?.dosageForm === 'Tablet' && row?.genericName === 'Paracetamol + Caffeine', 'list row carries strength/dosageForm/genericName');
  }

  // ── 3. Edit flow updates strength/dosageForm and packaging stays intact ──
  console.log('\n[3] Edit flow — update Strength/Dosage Form, keep packaging');
  {
    const r = await api('PATCH', `/pharmacy/medicines/${panadolId}`, token, {
      strength: '650mg',
      dosageForm: 'Caplet',
    });
    assert(r.status === 200, `Update succeeds (status ${r.status})`);
    assert(r.body.data?.strength === '650mg', 'strength updated to 650mg');
    assert(r.body.data?.dosageForm === 'Caplet', 'dosageForm updated to Caplet');
    const pkg = await api('GET', `/pharmacy/medicines/${panadolId}/packaging`, token);
    assert(pkg.body.data.levels.length === 3, 'Packaging untouched by a field-only edit (base + 2 levels still present)');
  }

  // ── 4. Medicine with NO packaging levels still saves (single-unit case) ──
  console.log('\n[4] Single-unit medicine with no Default Sale Price saves fine');
  {
    const r = await api('POST', '/pharmacy/medicines', token, {
      code: 'TST-AMF-NOPRICE', name: 'Test Saline Bottle', baseUnitId: u('Bottle'),
      baseIsPurchaseUnit: true, baseIsSaleUnit: true, packagingLevels: [], reorderLevel: 20,
    });
    assert(r.status === 201, `Create succeeds with empty packaging + no saleRate (status ${r.status})`);
    assert(Number(r.body.data?.saleRate) === 0, 'saleRate optional here too');
  }

  // ── 5. Validation: zero/negative conversion rejected ─────────────────────
  console.log('\n[5] Validation — zero/negative packaging conversion rejected');
  {
    const r = await api('POST', '/pharmacy/medicines', token, {
      code: 'TST-AMF-ZERO', name: 'Test Bad Packaging', baseUnitId: u('Tablet'),
      baseIsPurchaseUnit: false, baseIsSaleUnit: true,
      packagingLevels: [{ unitId: u('Box'), conversionToBase: 0, isPurchaseUnit: true, isSaleUnit: true }],
    });
    assert(r.status >= 400, `Zero conversion rejected (status ${r.status})`);
  }

  // ── 6. Validation: duplicate unit in chain rejected ──────────────────────
  console.log('\n[6] Validation — duplicate packaging unit rejected');
  {
    const r = await api('POST', '/pharmacy/medicines', token, {
      code: 'TST-AMF-DUP', name: 'Test Dup Packaging', baseUnitId: u('Tablet'),
      baseIsPurchaseUnit: false, baseIsSaleUnit: true,
      packagingLevels: [
        { unitId: u('Box'), conversionToBase: 100, isPurchaseUnit: true, isSaleUnit: true },
        { unitId: u('Box'), conversionToBase: 200, isPurchaseUnit: false, isSaleUnit: true },
      ],
    });
    assert(r.status >= 400, `Duplicate unit in packaging chain rejected (status ${r.status})`);
  }

  // ── 7. Validation: more than one Default Purchase Unit rejected ──────────
  console.log('\n[7] Validation — more than one Default Purchase Unit rejected');
  {
    const r = await api('POST', '/pharmacy/medicines', token, {
      code: 'TST-AMF-CIRC', name: 'Test Two Purchase Units', baseUnitId: u('Tablet'),
      baseIsPurchaseUnit: true, baseIsSaleUnit: true,
      packagingLevels: [{ unitId: u('Box'), conversionToBase: 100, isPurchaseUnit: true, isSaleUnit: true }],
    });
    assert(r.status >= 400, `Exactly-one-purchase-unit rule enforced (status ${r.status})`);
  }

  // ── 8. No Vendor field accepted on this endpoint (hard constraint) ───────
  console.log('\n[8] Medicine Master endpoint has no vendor concept');
  {
    const fs = await import('fs');
    const path = await import('path');
    const schemaSrc = fs.readFileSync(path.join(__dirname, '../src/modules/pharmacy/pharmacy.schemas.ts'), 'utf-8');
    assert(!schemaSrc.toLowerCase().includes('vendorid'), 'createMedicineBodySchema source has no vendorId field (Vendor stays in Purchase only)');
  }

  console.log(`\n━━━ Results: ${passed} passed, ${failed} failed ━━━`);
  await cleanup(prisma);
  await prisma.$disconnect();
  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error('Test run crashed:', err);
  process.exit(1);
});
