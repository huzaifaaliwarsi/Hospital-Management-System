const fs = require('fs');
const jwt = require('./hms-backend/node_modules/jsonwebtoken');
const dotenv = require('./hms-backend/node_modules/dotenv');
const { PrismaClient: HmsPrismaClient } = require('./hms-backend/node_modules/@prisma/client');
const { PrismaClient: PharmPrismaClient } = require('./pharmacy-software/backend/node_modules/@prisma/client');

const hmsEnv = dotenv.parse(fs.readFileSync('./hms-backend/.env'));
const pharmEnv = dotenv.parse(fs.readFileSync('./pharmacy-software/backend/.env'));

const hmsPrisma = new HmsPrismaClient({ datasources: { db: { url: hmsEnv.DATABASE_URL } } });
const pharmPrisma = new PharmPrismaClient({ datasources: { db: { url: pharmEnv.DATABASE_URL } } });

const HMS_API = 'http://localhost:4000/api/v1';
const PHARM_API = 'http://localhost:4100/api/v1';
const BRIDGE_SECRET = 'chss_bridge_shared_secret_2026_secure';

async function main() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('       HMS ↔ PHARMACY INVOICE ARCHITECTURE END-TO-END TEST SUITE');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  const total = 7;

  try {
    // 0. Setup Auth Tokens
    const pharmAdmin = await pharmPrisma.portalUser.findFirst({ where: { role: 'ADMIN' } });
    const hmsAdmin = await hmsPrisma.portalUser.findFirst({ where: { role: 'ADMIN' } });

    const pharmToken = jwt.sign(
      { sub: pharmAdmin.id, role: 'ADMIN', mustResetPassword: false },
      pharmEnv.JWT_ACCESS_SECRET
    );
    const hmsToken = jwt.sign(
      { sub: hmsAdmin.id, role: 'ADMIN', mustResetPassword: false },
      hmsEnv.JWT_ACCESS_SECRET
    );

    // 1. Setup Patient and Admission 1
    let patient = await hmsPrisma.selfPayEncounter.findFirst({ where: { fullName: 'Ali Architecture Test' } });
    if (!patient) {
      patient = await hmsPrisma.selfPayEncounter.create({
        data: { mrNumber: `MR-${Date.now().toString().slice(-6)}`, fullName: 'Ali Architecture Test', phone: '03009998877' },
      });
    }

    const dept = await hmsPrisma.department.findFirst() || await hmsPrisma.department.create({
      data: { code: 'IPD', name: 'Inpatient Department' },
    });

    const adm1Num = `ADM-${Date.now().toString().slice(-5)}`;
    const admission1 = await hmsPrisma.admissionRecord.create({
      data: {
        admissionNumber: adm1Num,
        selfPayEncounterId: patient.id,
        departmentId: dept.id,
        status: 'CONFIRMED',
        admittedAt: new Date(),
        notes: 'HMS-Pharmacy Architecture Test',
      },
    });

    console.log(`[Setup] Patient: Ali (ID: ${patient.id})`);
    console.log(`[Setup] Admission 1 Created: ${adm1Num}\n`);

    // 2. Setup Medicines
    let panadol = await pharmPrisma.medicineMaster.findFirst({ where: { name: 'Panadol' } });
    if (!panadol) {
      const u = await pharmPrisma.unit.findFirst();
      panadol = await pharmPrisma.medicineMaster.create({
        data: { code: `MED-PAN-${Date.now()}`, name: 'Panadol', unit: 'Tablet', baseUnitId: u.id, saleRate: 10, isActive: true },
      });
    } else {
      await pharmPrisma.medicineMaster.update({ where: { id: panadol.id }, data: { saleRate: 10 } });
    }

    let ceftriaxone = await pharmPrisma.medicineMaster.findFirst({ where: { name: 'Ceftriaxone' } });
    if (!ceftriaxone) {
      const u = await pharmPrisma.unit.findFirst();
      ceftriaxone = await pharmPrisma.medicineMaster.create({
        data: { code: `MED-CEF-${Date.now()}`, name: 'Ceftriaxone', unit: 'Vial', baseUnitId: u.id, saleRate: 500, isActive: true },
      });
    } else {
      await pharmPrisma.medicineMaster.update({ where: { id: ceftriaxone.id }, data: { saleRate: 500 } });
    }

    // Ensure stock batches & stock ledger entries
    let panBatch = await pharmPrisma.medicineBatch.findFirst({ where: { medicineId: panadol.id } });
    if (!panBatch) {
      panBatch = await pharmPrisma.medicineBatch.create({
        data: { medicineId: panadol.id, batchNumber: 'BAT-PAN-01', expiryDate: new Date('2029-01-01'), costRate: 7 },
      });
      await pharmPrisma.stockLedgerEntry.create({
        data: {
          medicineId: panadol.id,
          batchId: panBatch.id,
          movementType: 'OPENING_STOCK',
          quantityDelta: 200,
          referenceTable: 'manual_seed',
          referenceId: panBatch.id,
          actorId: pharmAdmin.id,
        },
      });
    }

    let cefBatch = await pharmPrisma.medicineBatch.findFirst({ where: { medicineId: ceftriaxone.id } });
    if (!cefBatch) {
      cefBatch = await pharmPrisma.medicineBatch.create({
        data: { medicineId: ceftriaxone.id, batchNumber: 'BAT-CEF-01', expiryDate: new Date('2029-01-01'), costRate: 350 },
      });
      await pharmPrisma.stockLedgerEntry.create({
        data: {
          medicineId: ceftriaxone.id,
          batchId: cefBatch.id,
          movementType: 'OPENING_STOCK',
          quantityDelta: 100,
          referenceTable: 'manual_seed',
          referenceId: cefBatch.id,
          actorId: pharmAdmin.id,
        },
      });
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: Same Admission + 3 Medicine Requests → Exactly ONE Pharmacy Invoice
    // ─────────────────────────────────────────────────────────────────────────
    console.log('-----------------------------------------------------------------------');
    console.log('TEST 1: Same active admission + 3 requests → exactly ONE Pharmacy Invoice');
    console.log('-----------------------------------------------------------------------');

    // Request 1: Panadol 10 tablets
    const req1Res = await fetch(`${PHARM_API}/hms-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-key': BRIDGE_SECRET },
      body: JSON.stringify({
        externalAdmissionRef: adm1Num,
        externalRequestRef: `MED-REQ-001-${adm1Num}`,
        patientNameSnapshot: 'Ali Architecture Test',
        lines: [{ medicineId: panadol.id, requestedQuantity: 10 }],
      }),
    });
    const req1Data = await req1Res.json();
    if (!req1Res.ok) {
      console.error('Request 1 creation failed:', req1Res.status, req1Data);
      process.exit(1);
    }
    const req1Id = req1Data.data.id;
    const req1LineId = req1Data.data.lines[0].id;

    // Fulfill Request 1
    const f1Res = await fetch(`${PHARM_API}/hms-requests/${req1Id}/fulfill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pharmToken}` },
      body: JSON.stringify({
        lines: [{ requestLineId: req1LineId, dispenseQuantity: 10 }],
      }),
    });
    const f1Data = await f1Res.json();
    if (!f1Res.ok) {
      console.error('Fulfill Request 1 failed:', f1Res.status, f1Data);
      process.exit(1);
    }

    const inv1 = await pharmPrisma.pharmacyInvoice.findFirst({
      where: { channel: 'HMS_LINKED', externalAdmissionRef: adm1Num },
    });
    console.log(`✓ Request 1 Dispensed: Panadol 10 -> Invoice ${inv1?.invoiceNumber}, Total: ${inv1?.total}`);

    // Request 2: Ceftriaxone 2 vials
    const req2Res = await fetch(`${PHARM_API}/hms-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-key': BRIDGE_SECRET },
      body: JSON.stringify({
        externalAdmissionRef: adm1Num,
        externalRequestRef: `MED-REQ-002-${adm1Num}`,
        patientNameSnapshot: 'Ali Architecture Test',
        lines: [{ medicineId: ceftriaxone.id, requestedQuantity: 2 }],
      }),
    });
    const req2Data = await req2Res.json();
    const req2Id = req2Data.data.id;
    const req2LineId = req2Data.data.lines[0].id;

    // Fulfill Request 2
    await fetch(`${PHARM_API}/hms-requests/${req2Id}/fulfill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pharmToken}` },
      body: JSON.stringify({
        lines: [{ requestLineId: req2LineId, dispenseQuantity: 2 }],
      }),
    });

    const inv2 = await pharmPrisma.pharmacyInvoice.findFirst({
      where: { channel: 'HMS_LINKED', externalAdmissionRef: adm1Num },
    });
    console.log(`✓ Request 2 Dispensed: Ceftriaxone 2 -> Same Invoice ${inv2.invoiceNumber}, New Total: ${inv2.total}`);

    // Request 3: Panadol 5 tablets
    const req3Res = await fetch(`${PHARM_API}/hms-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-key': BRIDGE_SECRET },
      body: JSON.stringify({
        externalAdmissionRef: adm1Num,
        externalRequestRef: `MED-REQ-003-${adm1Num}`,
        patientNameSnapshot: 'Ali Architecture Test',
        lines: [{ medicineId: panadol.id, requestedQuantity: 5 }],
      }),
    });
    const req3Data = await req3Res.json();
    const req3Id = req3Data.data.id;
    const req3LineId = req3Data.data.lines[0].id;

    // Fulfill Request 3
    await fetch(`${PHARM_API}/hms-requests/${req3Id}/fulfill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pharmToken}` },
      body: JSON.stringify({
        lines: [{ requestLineId: req3LineId, dispenseQuantity: 5 }],
      }),
    });

    const allInvoicesAdm1 = await pharmPrisma.pharmacyInvoice.findMany({
      where: { channel: 'HMS_LINKED', externalAdmissionRef: adm1Num },
      include: { lines: true },
    });

    console.log(`✓ Request 3 Dispensed: Panadol 5 -> Same Invoice ${allInvoicesAdm1[0].invoiceNumber}, Final Total: ${allInvoicesAdm1[0].total}`);

    if (allInvoicesAdm1.length === 1 && Number(allInvoicesAdm1[0].total) === 1150) {
      console.log(`✓ PASS: Exactly ONE Pharmacy Invoice (${allInvoicesAdm1[0].invoiceNumber}) with total 1150 (100 + 1000 + 50)!\n`);
      passed++;
    } else {
      console.error(`✗ FAIL: Invoices count: ${allInvoicesAdm1.length}, Total: ${allInvoicesAdm1[0]?.total}\n`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Same Admission + Multiple Dispenses → Exactly ONE Active HMS Bill
    // ─────────────────────────────────────────────────────────────────────────
    console.log('-----------------------------------------------------------------------');
    console.log('TEST 2: Same active admission → exactly ONE Hospital Invoice in HMS');
    console.log('-----------------------------------------------------------------------');

    // Poll for webhook completion in HMS (handling cloud database latency)
    let hmsInvoices = [];
    let hmsCharges = [];
    for (let attempt = 0; attempt < 25; attempt++) {
      await new Promise((r) => setTimeout(r, 1000));
      hmsInvoices = await hmsPrisma.hospitalInvoice.findMany({
        where: { admissionRecordId: admission1.id, invoiceNumber: { startsWith: 'INV-PHARM-' } },
      });
      hmsCharges = await hmsPrisma.hmsPharmacyCharge.findMany({
        where: { admissionRecordId: admission1.id },
      });
      if (hmsInvoices.length === 1 && hmsCharges.length === 1 && Number(hmsCharges[0].totalAmount) === 1150) {
        break;
      }
    }

    console.log(`  HMS Hospital Invoices count: ${hmsInvoices.length} (${hmsInvoices[0]?.invoiceNumber})`);
    console.log(`  HMS Pharmacy Charges count: ${hmsCharges.length}`);
    console.log(`  HMS Hospital Invoice Total: ${hmsInvoices[0]?.total}`);
    console.log(`  HMS Pharmacy Charge Total: ${hmsCharges[0]?.totalAmount}`);

    if (hmsInvoices.length === 1 && hmsCharges.length === 1 && Number(hmsCharges[0].totalAmount) === 1150) {
      console.log('✓ PASS: Exactly ONE Hospital Invoice and ONE Pharmacy Charge in HMS with total 1150!\n');
      passed++;
    } else {
      console.error('✗ FAIL: Duplicate invoices or incorrect total in HMS!\n');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Same Medicine Repeated → Aggregated Correct, History Preserved
    // ─────────────────────────────────────────────────────────────────────────
    console.log('-----------------------------------------------------------------------');
    console.log('TEST 3: Same medicine repeated → granular history preserved');
    console.log('-----------------------------------------------------------------------');

    const lines = allInvoicesAdm1[0].lines;
    const panadolLines = lines.filter((l) => l.medicineId === panadol.id);

    console.log(`  Total dispense lines on invoice: ${lines.length}`);
    console.log(`  Panadol dispense lines: ${panadolLines.length}`);
    panadolLines.forEach((l, idx) => {
      console.log(`    Line ${idx + 1}: Event: ${l.dispenseEventId}, Req: ${l.externalRequestRef}, Qty: ${l.quantity}, Net: ${l.lineNet}`);
    });

    const totalPanadolQty = panadolLines.reduce((s, l) => s + Number(l.quantity), 0);
    const totalPanadolAmount = panadolLines.reduce((s, l) => s + Number(l.lineNet), 0);

    if (panadolLines.length === 2 && totalPanadolQty === 15 && totalPanadolAmount === 150) {
      console.log(`✓ PASS: Underlying batch/dispense events preserved separately; UI aggregated total = 15 tablets (PKR 150)!\n`);
      passed++;
    } else {
      console.error(`✗ FAIL: History destroyed or incorrect aggregated sum!\n`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Callback Retry → Idempotency, No Duplication
    // ─────────────────────────────────────────────────────────────────────────
    console.log('-----------------------------------------------------------------------');
    console.log('TEST 4: Callback retry with same dispenseEventId → Idempotent response');
    console.log('-----------------------------------------------------------------------');

    const eventIdToRetry = panadolLines[1].dispenseEventId;
    const totalBefore = Number(hmsCharges[0].totalAmount);

    const retryRes = await fetch(`${HMS_API}/pharmacy-bridge/callback/dispensed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-key': BRIDGE_SECRET },
      body: JSON.stringify({
        dispenseEventId: eventIdToRetry,
        externalAdmissionRef: adm1Num,
        externalRequestRef: `MED-REQ-003-${adm1Num}`,
        pharmacyInvoiceNumber: allInvoicesAdm1[0].invoiceNumber,
        subtotal: 1150,
        taxTotal: 0,
        discountTotal: 0,
        totalAmount: 1150,
        deltaAmount: 50,
        dispensedBy: 'Pharmacist',
        lines: [],
      }),
    });
    const retryData = await retryRes.json();

    const chargeAfterRetry = await hmsPrisma.hmsPharmacyCharge.findUnique({
      where: { pharmacyInvoiceNumber: allInvoicesAdm1[0].invoiceNumber },
    });

    console.log(`  Retry response data: alreadyProcessed = ${retryData.data?.alreadyProcessed}`);
    console.log(`  Total before retry: ${totalBefore}, Total after retry: ${chargeAfterRetry.totalAmount}`);

    if (retryData.data?.alreadyProcessed === true && Number(chargeAfterRetry.totalAmount) === totalBefore) {
      console.log('✓ PASS: Idempotent callback retry handled cleanly without altering totals!\n');
      passed++;
    } else {
      console.error('✗ FAIL: Callback retry duplicated amounts or was not recognized as idempotent!\n');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: Partial Payment → New Dispense Increases Outstanding, Preserves Paid
    // ─────────────────────────────────────────────────────────────────────────
    console.log('-----------------------------------------------------------------------');
    console.log('TEST 5: Partial payment at Front Desk, then new dispense arrives');
    console.log('-----------------------------------------------------------------------');

    // Collect 500 at Front Desk
    const payRes = await fetch(`${HMS_API}/admission-billing/${admission1.id}/payments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${hmsToken}` },
      body: JSON.stringify({
        amount: 500,
        paymentMethod: 'CASH',
        reference: 'RCPT-E2E-500',
      }),
    });
    const payData = await payRes.json();
    const rcptNum = payData.data?.receipts?.[0]?.receiptNumber || payData.data?.receipt?.receiptNumber || 'RCPT-OK';
    console.log(`✓ Front Desk Payment Collected: PKR 500 (Receipt: ${rcptNum})`);

    const chargePostPay = await hmsPrisma.hmsPharmacyCharge.findUnique({
      where: { pharmacyInvoiceNumber: allInvoicesAdm1[0].invoiceNumber },
    });
    console.log(`  Charge status: Paid = ${chargePostPay.patientPaid}, Outstanding = ${chargePostPay.patientOutstanding}`);

    // New dispense arrives: Panadol 2 tablets @ 10 = 20
    const newEventId = `DISP-POST-PAY-${Date.now()}`;
    const newCumulativeTotal = 1150 + 20; // 1170

    await fetch(`${HMS_API}/pharmacy-bridge/callback/dispensed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-key': BRIDGE_SECRET },
      body: JSON.stringify({
        dispenseEventId: newEventId,
        externalAdmissionRef: adm1Num,
        externalRequestRef: `MED-REQ-004-${adm1Num}`,
        pharmacyInvoiceNumber: allInvoicesAdm1[0].invoiceNumber,
        subtotal: newCumulativeTotal,
        taxTotal: 0,
        discountTotal: 0,
        totalAmount: newCumulativeTotal,
        deltaAmount: 20,
        dispensedBy: 'Pharmacist',
        lines: [{ medicineName: 'Panadol', quantity: 2, rate: 10, lineNet: 20, dispenseEventId: newEventId }],
      }),
    });

    // Poll for new dispense callback to commit in HMS
    let chargeAfterNewDispense = null;
    for (let attempt = 0; attempt < 25; attempt++) {
      await new Promise((r) => setTimeout(r, 1000));
      chargeAfterNewDispense = await hmsPrisma.hmsPharmacyCharge.findUnique({
        where: { pharmacyInvoiceNumber: allInvoicesAdm1[0].invoiceNumber },
      });
      if (chargeAfterNewDispense && Number(chargeAfterNewDispense.totalAmount) === 1170) {
        break;
      }
    }

    console.log(`  After New Dispense (PKR 20):`);
    console.log(`    Total Amount: ${chargeAfterNewDispense.totalAmount}`);
    console.log(`    Paid Total:   ${chargeAfterNewDispense.patientPaid}`);
    console.log(`    Outstanding:  ${chargeAfterNewDispense.patientOutstanding}`);

    if (
      Number(chargeAfterNewDispense.patientPaid) === 500 &&
      Number(chargeAfterNewDispense.patientOutstanding) === 670 &&
      Number(chargeAfterNewDispense.totalAmount) === 1170
    ) {
      console.log('✓ PASS: Paid amount preserved at 500! Outstanding increased accurately to 670 (1170 - 500)!\n');
      passed++;
    } else {
      console.error('✗ FAIL: Paid amount was reset or outstanding computed incorrectly!\n');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: Finalized Admission Protection
    // ─────────────────────────────────────────────────────────────────────────
    console.log('-----------------------------------------------------------------------');
    console.log('TEST 6: Finalized / Discharged admission cannot silently accept dispenses');
    console.log('-----------------------------------------------------------------------');

    // Discharge admission 1
    await hmsPrisma.admissionRecord.update({
      where: { id: admission1.id },
      data: { status: 'DISCHARGED', dischargedAt: new Date() },
    });

    const dischargedCallbackRes = await fetch(`${HMS_API}/pharmacy-bridge/callback/dispensed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-key': BRIDGE_SECRET },
      body: JSON.stringify({
        dispenseEventId: `DISP-DISCHARGED-${Date.now()}`,
        externalAdmissionRef: adm1Num,
        pharmacyInvoiceNumber: allInvoicesAdm1[0].invoiceNumber,
        subtotal: 2000,
        taxTotal: 0,
        discountTotal: 0,
        totalAmount: 2000,
        deltaAmount: 830,
        dispensedBy: 'Pharmacist',
        lines: [],
      }),
    });

    const dischargedCallbackData = await dischargedCallbackRes.json();
    console.log(`  Attempt to append to discharged admission status: ${dischargedCallbackRes.status} (${dischargedCallbackData?.error?.message || dischargedCallbackData?.message})`);

    if (dischargedCallbackRes.status === 400 && (dischargedCallbackData?.error?.message || '').includes('discharged')) {
      console.log('✓ PASS: Discharged admission rejected silent invoice appending with ValidationError!\n');
      passed++;
    } else {
      console.error('✗ FAIL: Allowed appending to discharged admission!\n');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7: Same Patient NEW Admission → New Pharmacy Invoice + New Bill
    // ─────────────────────────────────────────────────────────────────────────
    console.log('-----------------------------------------------------------------------');
    console.log('TEST 7: Same patient NEW admission → Brand new invoice and bill generated');
    console.log('-----------------------------------------------------------------------');

    const adm2Num = `ADM-${Date.now().toString().slice(-5)}-NEW`;
    const admission2 = await hmsPrisma.admissionRecord.create({
      data: {
        admissionNumber: adm2Num,
        selfPayEncounterId: patient.id,
        departmentId: dept.id,
        status: 'CONFIRMED',
        admittedAt: new Date(),
        notes: 'Second Admission for Same Patient Ali',
      },
    });

    console.log(`  New Admission 2 created: ${adm2Num} for same patient Ali`);

    // Fulfill a request for Admission 2
    const reqNewRes = await fetch(`${PHARM_API}/hms-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-bridge-key': BRIDGE_SECRET },
      body: JSON.stringify({
        externalAdmissionRef: adm2Num,
        externalRequestRef: `MED-REQ-NEW-${adm2Num}`,
        patientName: 'Ali Architecture Test',
        lines: [{ medicineId: panadol.id, requestedQuantity: 4 }],
      }),
    });
    const reqNewData = await reqNewRes.json();
    const reqNewId = reqNewData.data.id;
    const reqNewLineId = reqNewData.data.lines[0].id;

    await fetch(`${PHARM_API}/hms-requests/${reqNewId}/fulfill`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${pharmToken}` },
      body: JSON.stringify({
        lines: [{ requestLineId: reqNewLineId, dispenseQuantity: 4 }],
      }),
    });

    // Poll for webhook completion in HMS for Admission 2
    let invAdm2 = null;
    let hmsInvoicesAdm2 = [];
    for (let attempt = 0; attempt < 25; attempt++) {
      await new Promise((r) => setTimeout(r, 1000));
      invAdm2 = await pharmPrisma.pharmacyInvoice.findFirst({
        where: { channel: 'HMS_LINKED', externalAdmissionRef: adm2Num },
      });
      hmsInvoicesAdm2 = await hmsPrisma.hospitalInvoice.findMany({
        where: { admissionRecordId: admission2.id },
      });
      if (invAdm2 && hmsInvoicesAdm2.length === 1) {
        break;
      }
    }

    console.log(`  Admission 1 Invoice: ${allInvoicesAdm1[0].invoiceNumber}`);
    console.log(`  Admission 2 Invoice: ${invAdm2?.invoiceNumber}`);
    console.log(`  Admission 2 HMS Invoices: ${hmsInvoicesAdm2.map((i) => i.invoiceNumber).join(', ')}`);

    if (invAdm2 && invAdm2.invoiceNumber !== allInvoicesAdm1[0].invoiceNumber && hmsInvoicesAdm2.length === 1) {
      console.log(`✓ PASS: New Admission received brand new Pharmacy Invoice (${invAdm2.invoiceNumber}) and new HMS Hospital Invoice!\n`);
      passed++;
    } else {
      console.error('✗ FAIL: Did not isolate new admission to a new invoice!\n');
    }

    // ─────────────────────────────────────────────────────────────────────────
    // FINAL RESULTS
    // ─────────────────────────────────────────────────────────────────────────
    console.log('═══════════════════════════════════════════════════════════════════════');
    console.log(`   FINAL VERIFICATION RESULTS: ${passed} / ${total} TESTS PASSED`);
    if (passed === total) {
      console.log('   STATUS: ALL ARCHITECTURAL REQUIREMENTS FULLY MET & VERIFIED!');
    }
    console.log('═══════════════════════════════════════════════════════════════════════\n');

  } catch (err) {
    console.error('Test execution failed:', err);
    process.exit(1);
  } finally {
    await hmsPrisma.$disconnect();
    await pharmPrisma.$disconnect();
  }
}

main();
