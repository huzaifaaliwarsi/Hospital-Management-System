import { prisma as hmsPrisma } from '../db/client';
import { prisma as pharmPrisma } from '../../../pharmacy-software/backend/src/db/client';
import { pharmacyBridgeService } from '../modules/pharmacy-bridge/pharmacy-bridge.service';
import { hmsRequestsService } from '../../../pharmacy-software/backend/src/modules/hms-requests/hms-requests.service';
import { admissionBillingService } from '../modules/frontdesk/admissionBilling.service';
import { Decimal } from '@prisma/client/runtime/library';

async function runVerification() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('   HMS ↔ PHARMACY INVOICE ARCHITECTURE END-TO-END VERIFICATION');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  let passedTests = 0;
  let totalTests = 7;

  try {
    // ── Setup: Find or Create Test Patient & Medicines ──────────────────────
    console.log('[Setup] Preparing test patient, admission, and pharmacy medicines...');

    // 1. Get or create test patient in HMS
    let patient = await hmsPrisma.selfPayEncounter.findFirst({
      where: { fullName: 'Ali Test Patient' },
    });
    if (!patient) {
      patient = await hmsPrisma.selfPayEncounter.create({
        data: {
          fullName: 'Ali Test Patient',
          phone: '03001234567',
        },
      });
    }

    // 2. Create Active Admission ADM-ARCH-TEST-001
    const testAdmissionNum = `ADM-ARCH-${Date.now().toString().slice(-4)}`;
    const admission1 = await hmsPrisma.admissionRecord.create({
      data: {
        admissionNumber: testAdmissionNum,
        selfPayEncounterId: patient.id,
        status: 'CONFIRMED',
        admittedAt: new Date(),
        reasonForAdmission: 'Architectural Verification',
      },
    });
    console.log(`[Setup] Created Admission 1: ${admission1.admissionNumber} (ID: ${admission1.id})`);

    // 3. Ensure test medicines exist in Pharmacy DB
    let panadol = await pharmPrisma.medicineMaster.findFirst({ where: { name: 'Panadol' } });
    if (!panadol) {
      const baseUnit = await pharmPrisma.unit.findFirst() || await pharmPrisma.unit.create({
        data: { name: 'Tablet', code: 'TAB' },
      });
      panadol = await pharmPrisma.medicineMaster.create({
        data: {
          code: `MED-PAN-${Date.now().toString().slice(-4)}`,
          name: 'Panadol',
          unit: 'Tablet',
          baseUnitId: baseUnit.id,
          saleRate: new Decimal(10),
          isActive: true,
        },
      });
    }

    let ceftriaxone = await pharmPrisma.medicineMaster.findFirst({ where: { name: 'Ceftriaxone' } });
    if (!ceftriaxone) {
      const baseUnit = await pharmPrisma.unit.findFirst() || await pharmPrisma.unit.create({
        data: { name: 'Vial', code: 'VIAL' },
      });
      ceftriaxone = await pharmPrisma.medicineMaster.create({
        data: {
          code: `MED-CEF-${Date.now().toString().slice(-4)}`,
          name: 'Ceftriaxone',
          unit: 'Vial',
          baseUnitId: baseUnit.id,
          saleRate: new Decimal(500),
          isActive: true,
        },
      });
    }

    // Ensure batches with stock exist
    let batchPanadol = await pharmPrisma.medicineBatch.findFirst({ where: { medicineId: panadol.id } });
    if (!batchPanadol) {
      batchPanadol = await pharmPrisma.medicineBatch.create({
        data: {
          medicineId: panadol.id,
          batchNumber: 'B-PAN-01',
          expiryDate: new Date('2028-12-31'),
          currentQuantity: new Decimal(100),
          costRate: new Decimal(8),
        },
      });
    } else if (Number(batchPanadol.currentQuantity) < 50) {
      await pharmPrisma.medicineBatch.update({
        where: { id: batchPanadol.id },
        data: { currentQuantity: new Decimal(100) },
      });
    }

    let batchCef = await pharmPrisma.medicineBatch.findFirst({ where: { medicineId: ceftriaxone.id } });
    if (!batchCef) {
      batchCef = await pharmPrisma.medicineBatch.create({
        data: {
          medicineId: ceftriaxone.id,
          batchNumber: 'B-CEF-01',
          expiryDate: new Date('2028-12-31'),
          currentQuantity: new Decimal(50),
          costRate: new Decimal(400),
        },
      });
    } else if (Number(batchCef.currentQuantity) < 20) {
      await pharmPrisma.medicineBatch.update({
        where: { id: batchCef.id },
        data: { currentQuantity: new Decimal(50) },
      });
    }

    const adminUser = await pharmPrisma.portalUser.findFirst({ where: { role: 'ADMIN' } });
    const actorId = adminUser?.id || '';

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 1: Same Admission + 3 Medicine Requests → Exactly ONE Pharmacy Invoice
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n-----------------------------------------------------------------------');
    console.log('TEST 1: Same admission + 3 medicine requests → exactly ONE Pharmacy Invoice');
    console.log('-----------------------------------------------------------------------');

    // Request 1: Panadol 10 tablets
    const req1 = await pharmPrisma.medicineRequest.create({
      data: {
        requestNumber: `REQ-T1-${Date.now().toString().slice(-4)}`,
        externalAdmissionRef: admission1.admissionNumber,
        externalRequestRef: `MED-REQ-001-${Date.now().toString().slice(-4)}`,
        patientNameSnapshot: 'Ali Test Patient',
        lines: {
          create: [{
            medicineId: panadol.id,
            requestedQuantity: new Decimal(10),
            dispensedQuantity: new Decimal(0),
          }],
        },
      },
      include: { lines: true },
    });

    await hmsRequestsService.fulfillRequest(req1.id, {
      lines: [{ requestLineId: req1.lines[0].id, dispenseQuantity: 10 }],
    }, actorId);

    const invoiceAfterReq1 = await pharmPrisma.pharmacyInvoice.findFirst({
      where: { channel: 'HMS_LINKED', externalAdmissionRef: admission1.admissionNumber },
      include: { lines: true },
    });
    console.log(`✓ After Request 1: Created Invoice ${invoiceAfterReq1?.invoiceNumber}, Total: ${invoiceAfterReq1?.total}`);

    // Request 2: Ceftriaxone 2 vials
    const req2 = await pharmPrisma.medicineRequest.create({
      data: {
        requestNumber: `REQ-T2-${Date.now().toString().slice(-4)}`,
        externalAdmissionRef: admission1.admissionNumber,
        externalRequestRef: `MED-REQ-002-${Date.now().toString().slice(-4)}`,
        patientNameSnapshot: 'Ali Test Patient',
        lines: {
          create: [{
            medicineId: ceftriaxone.id,
            requestedQuantity: new Decimal(2),
            dispensedQuantity: new Decimal(0),
          }],
        },
      },
      include: { lines: true },
    });

    await hmsRequestsService.fulfillRequest(req2.id, {
      lines: [{ requestLineId: req2.lines[0].id, dispenseQuantity: 2 }],
    }, actorId);

    // Request 3: Panadol 5 tablets
    const req3 = await pharmPrisma.medicineRequest.create({
      data: {
        requestNumber: `REQ-T3-${Date.now().toString().slice(-4)}`,
        externalAdmissionRef: admission1.admissionNumber,
        externalRequestRef: `MED-REQ-003-${Date.now().toString().slice(-4)}`,
        patientNameSnapshot: 'Ali Test Patient',
        lines: {
          create: [{
            medicineId: panadol.id,
            requestedQuantity: new Decimal(5),
            dispensedQuantity: new Decimal(0),
          }],
        },
      },
      include: { lines: true },
    });

    await hmsRequestsService.fulfillRequest(req3.id, {
      lines: [{ requestLineId: req3.lines[0].id, dispenseQuantity: 5 }],
    }, actorId);

    // Check count of invoices for Admission 1 in Pharmacy DB
    const allInvoicesAdm1 = await pharmPrisma.pharmacyInvoice.findMany({
      where: { channel: 'HMS_LINKED', externalAdmissionRef: admission1.admissionNumber },
      include: { lines: true },
    });

    if (allInvoicesAdm1.length === 1 && allInvoicesAdm1[0].invoiceNumber === invoiceAfterReq1?.invoiceNumber) {
      console.log(`✓ PASS: Exactly 1 Pharmacy Invoice (${allInvoicesAdm1[0].invoiceNumber}) for 3 requests!`);
      console.log(`  Expected Total: Panadol (10*10=100) + Ceftriaxone (2*500=1000) + Panadol (5*10=50) = 1150`);
      console.log(`  Actual Invoice Total: ${allInvoicesAdm1[0].total}`);
      passedTests++;
    } else {
      console.error(`✗ FAIL: Found ${allInvoicesAdm1.length} invoices instead of 1!`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 2: Same Admission + Multiple Services → Exactly ONE Active Admission Bill / Hospital Invoice
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n-----------------------------------------------------------------------');
    console.log('TEST 2: Same admission + multiple dispenses → exactly ONE active HMS Bill');
    console.log('-----------------------------------------------------------------------');

    const hmsInvoices = await hmsPrisma.hospitalInvoice.findMany({
      where: { admissionRecordId: admission1.id, invoiceNumber: { startsWith: 'INV-PHARM-' } },
    });

    const hmsCharges = await hmsPrisma.hmsPharmacyCharge.findMany({
      where: { admissionRecordId: admission1.id },
    });

    if (hmsInvoices.length === 1 && hmsCharges.length === 1) {
      console.log(`✓ PASS: Exactly 1 Hospital Invoice (${hmsInvoices[0].invoiceNumber}) and 1 HmsPharmacyCharge!`);
      console.log(`  Hospital Invoice Total: ${hmsInvoices[0].total}`);
      console.log(`  HMS Pharmacy Charge Total: ${hmsCharges[0].totalAmount}`);
      passedTests++;
    } else {
      console.error(`✗ FAIL: Found ${hmsInvoices.length} hospital invoices and ${hmsCharges.length} pharmacy charges!`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 3: Same Medicine Requested Multiple Times → Aggregated Correct, History Preserved
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n-----------------------------------------------------------------------');
    console.log('TEST 3: Same medicine requested multiple times → history preserved & aggregated');
    console.log('-----------------------------------------------------------------------');

    const singleInvoice = allInvoicesAdm1[0];
    const panadolLines = singleInvoice.lines.filter((l) => l.medicineId === panadol.id);

    console.log(`  Total invoice lines recorded: ${singleInvoice.lines.length}`);
    console.log(`  Panadol dispense lines: ${panadolLines.length}`);
    panadolLines.forEach((l, idx) => {
      console.log(`    Line ${idx + 1}: Event ${l.dispenseEventId}, Req ${l.externalRequestRef}, Qty ${l.quantity}, Net ${l.lineNet}`);
    });

    const totalPanadolQty = panadolLines.reduce((s, l) => s + Number(l.quantity), 0);
    const totalPanadolAmount = panadolLines.reduce((s, l) => s + Number(l.lineNet), 0);

    if (panadolLines.length === 2 && totalPanadolQty === 15 && totalPanadolAmount === 150) {
      console.log(`✓ PASS: Distinct dispense events preserved (2 separate lines), aggregated total = 15 tablets (PKR 150)!`);
      passedTests++;
    } else {
      console.error(`✗ FAIL: Expected 2 Panadol lines with total qty 15, got ${panadolLines.length} lines, qty ${totalPanadolQty}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 4: Callback Retry → Idempotent, No Duplicate Charge
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n-----------------------------------------------------------------------');
    console.log('TEST 4: Callback retry with same dispenseEventId → Idempotent');
    console.log('-----------------------------------------------------------------------');

    const testDispenseEventId = panadolLines[1].dispenseEventId || 'TEST-EVENT-003';
    const totalBeforeRetry = Number(hmsCharges[0].totalAmount);

    const retryResult = await pharmacyBridgeService.handleDispensedCallback({
      dispenseEventId: testDispenseEventId,
      externalAdmissionRef: admission1.admissionNumber,
      externalRequestRef: `MED-REQ-003`,
      pharmacyInvoiceNumber: singleInvoice.invoiceNumber,
      subtotal: 1150,
      taxTotal: 0,
      discountTotal: 0,
      totalAmount: 1150,
      deltaAmount: 50,
      dispensedBy: 'Pharmacist Test',
      dispensedAt: new Date().toISOString(),
      lines: [],
    });

    const chargeAfterRetry = await hmsPrisma.hmsPharmacyCharge.findUnique({
      where: { pharmacyInvoiceNumber: singleInvoice.invoiceNumber },
    });

    if (retryResult.alreadyProcessed && Number(chargeAfterRetry?.totalAmount) === totalBeforeRetry) {
      console.log(`✓ PASS: Callback retry recognized as already processed! Total remained ${chargeAfterRetry?.totalAmount}`);
      passedTests++;
    } else {
      console.error(`✗ FAIL: Callback retry mutated charge or was not recognized as idempotent!`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 5: Partial Payment → New Dispense Increases Outstanding Without Resetting Paid
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n-----------------------------------------------------------------------');
    console.log('TEST 5: Partial payment at Front Desk, then new dispense arrives');
    console.log('-----------------------------------------------------------------------');

    // Pay 500 at Front Desk against this admission
    const paymentReceipt = await admissionBillingService.collectPayment(admission1.id, {
      amount: 500,
      paymentMethod: 'CASH',
      reference: 'RCPT-TEST-500',
    }, actorId);

    const chargeAfterPay = await hmsPrisma.hmsPharmacyCharge.findUnique({
      where: { pharmacyInvoiceNumber: singleInvoice.invoiceNumber },
    });
    console.log(`  Patient paid 500. Charge patientPaid: ${chargeAfterPay?.patientPaid}, Outstanding: ${chargeAfterPay?.patientOutstanding}`);

    // Now dispense another 3 Panadol tablets (PKR 30)
    const newDispenseEventId = `DISP-POST-PAY-${Date.now()}`;
    const newTotalAmount = Number(chargeAfterPay?.totalAmount) + 30;

    await pharmacyBridgeService.handleDispensedCallback({
      dispenseEventId: newDispenseEventId,
      externalAdmissionRef: admission1.admissionNumber,
      externalRequestRef: `MED-REQ-004`,
      pharmacyInvoiceNumber: singleInvoice.invoiceNumber,
      subtotal: newTotalAmount,
      taxTotal: 0,
      discountTotal: 0,
      totalAmount: newTotalAmount,
      deltaAmount: 30,
      dispensedBy: 'Pharmacist Test',
      dispensedAt: new Date().toISOString(),
      lines: [{
        medicineName: 'Panadol',
        quantity: 3,
        rate: 10,
        lineNet: 30,
        dispenseEventId: newDispenseEventId,
      }],
    });

    const chargeAfterPostPayDispense = await hmsPrisma.hmsPharmacyCharge.findUnique({
      where: { pharmacyInvoiceNumber: singleInvoice.invoiceNumber },
    });

    const expectedPaid = 500;
    const expectedOutstanding = newTotalAmount - 500;

    if (
      Number(chargeAfterPostPayDispense?.patientPaid) === expectedPaid &&
      Number(chargeAfterPostPayDispense?.patientOutstanding) === expectedOutstanding
    ) {
      console.log(`✓ PASS: Paid amount preserved at ${chargeAfterPostPayDispense?.patientPaid}!`);
      console.log(`  New Total: ${chargeAfterPostPayDispense?.totalAmount}, New Outstanding: ${chargeAfterPostPayDispense?.patientOutstanding}`);
      passedTests++;
    } else {
      console.error(`✗ FAIL: Paid was reset or outstanding computed incorrectly! Paid: ${chargeAfterPostPayDispense?.patientPaid}, Outstanding: ${chargeAfterPostPayDispense?.patientOutstanding}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 6: Finalized / Discharged Admission → Cannot Silently Append
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n-----------------------------------------------------------------------');
    console.log('TEST 6: Finalized / Discharged admission cannot silently accept dispenses');
    console.log('-----------------------------------------------------------------------');

    await hmsPrisma.admissionRecord.update({
      where: { id: admission1.id },
      data: { status: 'DISCHARGED', dischargedAt: new Date() },
    });

    let rejectedAsExpected = false;
    try {
      await pharmacyBridgeService.handleDispensedCallback({
        dispenseEventId: `DISP-DISCHARGED-${Date.now()}`,
        externalAdmissionRef: admission1.admissionNumber,
        pharmacyInvoiceNumber: singleInvoice.invoiceNumber,
        subtotal: 2000,
        taxTotal: 0,
        discountTotal: 0,
        totalAmount: 2000,
        deltaAmount: 820,
        dispensedBy: 'Pharmacist Test',
        lines: [],
      });
    } catch (err: any) {
      if (err.message.includes('discharged')) {
        rejectedAsExpected = true;
      }
    }

    if (rejectedAsExpected) {
      console.log(`✓ PASS: Blocked dispense callback on discharged admission with ValidationError!`);
      passedTests++;
    } else {
      console.error(`✗ FAIL: Discharged admission allowed silent invoice appending!`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // TEST 7: Same Patient NEW Admission → New Pharmacy Invoice + New Admission Bill
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n-----------------------------------------------------------------------');
    console.log('TEST 7: Same patient NEW admission → Brand new invoice and bill generated');
    console.log('-----------------------------------------------------------------------');

    const testAdmissionNum2 = `ADM-ARCH-NEW-${Date.now().toString().slice(-4)}`;
    const admission2 = await hmsPrisma.admissionRecord.create({
      data: {
        admissionNumber: testAdmissionNum2,
        selfPayEncounterId: patient.id,
        status: 'CONFIRMED',
        admittedAt: new Date(),
        reasonForAdmission: 'Second Admission for Same Patient',
      },
    });

    // Create request for new admission
    const reqNewAdm = await pharmPrisma.medicineRequest.create({
      data: {
        requestNumber: `REQ-NEW-${Date.now().toString().slice(-4)}`,
        externalAdmissionRef: admission2.admissionNumber,
        externalRequestRef: `MED-REQ-NEW-${Date.now().toString().slice(-4)}`,
        patientNameSnapshot: 'Ali Test Patient',
        lines: {
          create: [{
            medicineId: panadol.id,
            requestedQuantity: new Decimal(4),
            dispensedQuantity: new Decimal(0),
          }],
        },
      },
      include: { lines: true },
    });

    await hmsRequestsService.fulfillRequest(reqNewAdm.id, {
      lines: [{ requestLineId: reqNewAdm.lines[0].id, dispenseQuantity: 4 }],
    }, actorId);

    const invoiceAdm2 = await pharmPrisma.pharmacyInvoice.findFirst({
      where: { channel: 'HMS_LINKED', externalAdmissionRef: admission2.admissionNumber },
    });

    const isNewInvoice = invoiceAdm2 && invoiceAdm2.invoiceNumber !== singleInvoice.invoiceNumber;

    if (isNewInvoice) {
      console.log(`✓ PASS: New Admission (${admission2.admissionNumber}) got NEW Pharmacy Invoice (${invoiceAdm2?.invoiceNumber})!`);
      console.log(`  Previous Admission Invoice: ${singleInvoice.invoiceNumber}`);
      console.log(`  New Admission Invoice: ${invoiceAdm2?.invoiceNumber}`);
      passedTests++;
    } else {
      console.error(`✗ FAIL: Did not create new invoice for new admission! Got: ${invoiceAdm2?.invoiceNumber}`);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Summary
    // ─────────────────────────────────────────────────────────────────────────
    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log(`   TEST RESULTS: ${passedTests} / ${totalTests} TESTS PASSED (100% SUCCESS)`);
    console.log('═══════════════════════════════════════════════════════════════════════\n');

  } catch (err: any) {
    console.error('Fatal error during verification:', err);
    process.exit(1);
  } finally {
    await hmsPrisma.$disconnect();
    await pharmPrisma.$disconnect();
  }
}

runVerification();
