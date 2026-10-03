import { prisma } from '../src/db/client';
import { pharmacyBridgeService } from '../src/modules/pharmacy-bridge/pharmacy-bridge.service';
import { Decimal } from '@prisma/client/runtime/library';

async function runExactScenario() {
  console.log('═══════════════════════════════════════════════════════════════════════');
  console.log('   EXACT TEST SCENARIO: ONE ACTIVE ADMISSION = ONE PATIENT INVOICE');
  console.log('═══════════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let total = 0;

  function assert(condition: boolean, msg: string) {
    total++;
    if (condition) {
      console.log(`  ✓ [PASS] ${msg}`);
      passed++;
    } else {
      console.error(`  ✗ [FAIL] ${msg}`);
      throw new Error(`Assertion failed: ${msg}`);
    }
  }

  const suffix = Date.now().toString().slice(-4);
  const mrNumber = `MR-TEST-${suffix}`;
  const admNumber1 = `ADM-TEST-5001-${suffix}`;
  const admNumber2 = `ADM-TEST-6002-${suffix}`;

  try {
    // 1. Setup Patient
    console.log('[Step 1] Creating Patient with MR Number:', mrNumber);
    const patient = await prisma.selfPayEncounter.create({
      data: {
        fullName: 'Scenario Test Patient',
        phone: '03001234567',
        mrNumber,
      },
    });

    // Ensure clinical department exists
    let dept = await prisma.department.findFirst({ where: { departmentType: 'CLINICAL' } });
    if (!dept) {
      dept = await prisma.department.create({
        data: { code: `DEPT-${suffix}`, name: 'General Ward', departmentType: 'CLINICAL' },
      });
    }

    // 2. Setup Admission 1
    console.log('[Step 2] Creating Admission 1:', admNumber1);
    const admission1 = await prisma.admissionRecord.create({
      data: {
        admissionNumber: admNumber1,
        selfPayEncounterId: patient.id,
        departmentId: dept.id,
        status: 'CONFIRMED',
        admittedAt: new Date(),
        diagnosis: 'Billing Bug Verification',
      },
    });

    // 3. Create Existing Hospital Invoice with Room & Doctor Charges = 5,000
    // And partially pay 2,000 to verify payment preservation
    console.log('[Step 3] Creating Existing Hospital Invoice with 5,000 hospital charges...');
    let dummyRate = await prisma.serviceRate.findFirst({
      where: { code: 'SRV-ROOM-TEST' },
    });
    if (!dummyRate) {
      dummyRate = await prisma.serviceRate.create({
        data: {
          code: 'SRV-ROOM-TEST',
          name: 'Hospital Room Charges',
          departmentId: dept.id,
          category: 'ACCOMMODATION',
          billingUnit: 'Day',
          standardRate: new Decimal(2500),
        },
      });
    }

    const invoice1 = await prisma.hospitalInvoice.create({
      data: {
        invoiceNumber: `HINV-TEST-9001-${suffix}`,
        sourceType: 'ADMISSION',
        admissionRecordId: admission1.id,
        selfPayEncounterId: patient.id,
        subtotal: new Decimal(5000),
        discountTotal: new Decimal(0),
        total: new Decimal(5000),
        patientShare: new Decimal(5000),
        panelReceivable: new Decimal(0),
        paidTotal: new Decimal(2000), // Pre-existing partial payment of 2,000
        status: 'PARTIALLY_PAID',
        lines: {
          create: [
            {
              serviceRateId: dummyRate.id,
              quantity: new Decimal(2),
              rateSnapshot: new Decimal(2500),
              lineGross: new Decimal(5000),
              discountAmount: new Decimal(0),
              lineNet: new Decimal(5000),
              patientShare: new Decimal(5000),
              panelReceivable: new Decimal(0),
            },
          ],
        },
      },
      include: { lines: true },
    });

    assert(Number(invoice1.total) === 5000, `Initial invoice total is 5,000 (got ${invoice1.total})`);
    assert(Number(invoice1.paidTotal) === 2000, `Initial invoice paid is 2,000 (got ${invoice1.paidTotal})`);
    console.log(`  Initial Invoice: ${invoice1.invoiceNumber} | Total: ${invoice1.total} | Paid: ${invoice1.paidTotal}\n`);

    // 4. Pharmacy Request 1: MED-REQ-01 with Medicine amount 1,000
    console.log('[Step 4] Pharmacy Request 1: MED-REQ-01 (Amount: 1,000)...');
    const req1Result = await pharmacyBridgeService.handleDispensedCallback({
      patientMrNumber: mrNumber,
      externalAdmissionRef: admission1.admissionNumber,
      pharmacyInvoiceNumber: `PHI-TEST-01-${suffix}`,
      externalRequestRef: 'MED-REQ-01',
      dispenseEventId: `EVT-01-${suffix}`,
      subtotal: 1000,
      taxTotal: 0,
      discountTotal: 0,
      totalAmount: 1000,
      dispensedBy: 'Pharmacist A',
      lines: [
        {
          medicineName: 'Panadol 500mg',
          quantity: 10,
          rate: 100,
          discountAmount: 0,
          lineNet: 1000,
          batchNumber: 'B-PAN-01',
          externalRequestRef: 'MED-REQ-01',
        },
      ],
    });

    assert(req1Result.alreadyProcessed === false, 'Request 1 processed successfully (not already processed)');
    assert(req1Result.hospitalInvoice.id === invoice1.id, 'Request 1 updated the SAME invoice (did NOT create new invoice)');
    assert(Number(req1Result.hospitalInvoice.total) === 6000, `Invoice total is now 6,000 (5,000 + 1,000) (got ${req1Result.hospitalInvoice.total})`);
    assert(Number(req1Result.hospitalInvoice.paidTotal) === 2000, `Payment of 2,000 PRESERVED (got ${req1Result.hospitalInvoice.paidTotal})`);

    // Verify invoice count for admission 1 is exactly 1
    const invoiceCountAfterReq1 = await prisma.hospitalInvoice.count({
      where: { admissionRecordId: admission1.id },
    });
    assert(invoiceCountAfterReq1 === 1, `Exactly ONE invoice exists for Admission 1 (count: ${invoiceCountAfterReq1})`);
    console.log(`  Updated Invoice: ${req1Result.hospitalInvoice.invoiceNumber} | Total: ${req1Result.hospitalInvoice.total} | Paid: ${req1Result.hospitalInvoice.paidTotal}\n`);

    // 5. Pharmacy Request 2: MED-REQ-02 with Cumulative Medicine amount 3,000 (1,000 + 2,000)
    console.log('[Step 5] Pharmacy Request 2: MED-REQ-02 (Added Amount: 2,000 | Cumulative Pharmacy: 3,000)...');
    const req2Result = await pharmacyBridgeService.handleDispensedCallback({
      patientMrNumber: mrNumber,
      externalAdmissionRef: admission1.admissionNumber,
      pharmacyInvoiceNumber: `PHI-TEST-01-${suffix}`,
      externalRequestRef: 'MED-REQ-02',
      dispenseEventId: `EVT-02-${suffix}`,
      subtotal: 3000,
      taxTotal: 0,
      discountTotal: 0,
      totalAmount: 3000,
      dispensedBy: 'Pharmacist A',
      lines: [
        {
          medicineName: 'Panadol 500mg',
          quantity: 10,
          rate: 100,
          discountAmount: 0,
          lineNet: 1000,
          batchNumber: 'B-PAN-01',
          externalRequestRef: 'MED-REQ-01',
        },
        {
          medicineName: 'Ceftriaxone 1g',
          quantity: 2,
          rate: 1000,
          discountAmount: 0,
          lineNet: 2000,
          batchNumber: 'B-CEF-01',
          externalRequestRef: 'MED-REQ-02',
        },
      ],
    });

    assert(req2Result.alreadyProcessed === false, 'Request 2 processed successfully');
    assert(req2Result.hospitalInvoice.id === invoice1.id, 'Request 2 updated the SAME invoice');
    assert(Number(req2Result.hospitalInvoice.total) === 8000, `Invoice total is now 8,000 (5,000 + 3,000) (got ${req2Result.hospitalInvoice.total})`);
    assert(Number(req2Result.hospitalInvoice.paidTotal) === 2000, `Payment of 2,000 still PRESERVED (got ${req2Result.hospitalInvoice.paidTotal})`);

    const invoiceCountAfterReq2 = await prisma.hospitalInvoice.count({
      where: { admissionRecordId: admission1.id },
    });
    assert(invoiceCountAfterReq2 === 1, `Still exactly ONE invoice exists for Admission 1 (count: ${invoiceCountAfterReq2})`);
    console.log(`  Updated Invoice: ${req2Result.hospitalInvoice.invoiceNumber} | Total: ${req2Result.hospitalInvoice.total} | Paid: ${req2Result.hospitalInvoice.paidTotal}\n`);

    // 6. Retry MED-REQ-02 callback (Idempotency test)
    console.log('[Step 6] Retry MED-REQ-02 callback (Idempotency Test)...');
    const retryResult = await pharmacyBridgeService.handleDispensedCallback({
      patientMrNumber: mrNumber,
      externalAdmissionRef: admission1.admissionNumber,
      pharmacyInvoiceNumber: `PHI-TEST-01-${suffix}`,
      externalRequestRef: 'MED-REQ-02',
      dispenseEventId: `EVT-02-${suffix}`,
      subtotal: 3000,
      taxTotal: 0,
      discountTotal: 0,
      totalAmount: 3000,
      dispensedBy: 'Pharmacist A',
      lines: [
        {
          medicineName: 'Panadol 500mg',
          quantity: 10,
          rate: 100,
          discountAmount: 0,
          lineNet: 1000,
          batchNumber: 'B-PAN-01',
        },
        {
          medicineName: 'Ceftriaxone 1g',
          quantity: 2,
          rate: 1000,
          discountAmount: 0,
          lineNet: 2000,
          batchNumber: 'B-CEF-01',
        },
      ],
    });

    assert(retryResult.alreadyProcessed === true, 'Retry was detected as already processed (idempotency)');
    assert(retryResult.hospitalInvoice.id === invoice1.id, 'Retry referenced the SAME invoice');
    assert(Number(retryResult.hospitalInvoice.total) === 8000, `Invoice total is STILL 8,000 (NOT 10,000 or duplicate) (got ${retryResult.hospitalInvoice.total})`);
    assert(Number(retryResult.hospitalInvoice.paidTotal) === 2000, `Paid total is STILL 2,000 (got ${retryResult.hospitalInvoice.paidTotal})`);
    console.log(`  Idempotent Check Passed: Total remains ${retryResult.hospitalInvoice.total}, alreadyProcessed: ${retryResult.alreadyProcessed}\n`);

    // 7. Discharge Admission 1
    console.log('[Step 7] Discharging Admission 1...');
    await prisma.admissionRecord.update({
      where: { id: admission1.id },
      data: {
        status: 'DISCHARGED',
        dischargedAt: new Date(),
      },
    });
    console.log('  Admission 1 is now DISCHARGED.\n');

    // 8. New Admission for SAME Patient: ADM-TEST-6002
    console.log('[Step 8] New Admission 2 for SAME Patient:', admNumber2);
    const admission2 = await prisma.admissionRecord.create({
      data: {
        admissionNumber: admNumber2,
        selfPayEncounterId: patient.id,
        departmentId: dept.id,
        status: 'CONFIRMED',
        admittedAt: new Date(),
        diagnosis: 'Second Admission for Same Patient',
      },
    });

    // Create admission invoice for Admission 2
    const invoice2 = await prisma.hospitalInvoice.create({
      data: {
        invoiceNumber: `HINV-TEST-6002-${suffix}`,
        sourceType: 'ADMISSION',
        admissionRecordId: admission2.id,
        selfPayEncounterId: patient.id,
        subtotal: new Decimal(4000),
        discountTotal: new Decimal(0),
        total: new Decimal(4000),
        patientShare: new Decimal(4000),
        panelReceivable: new Decimal(0),
        paidTotal: new Decimal(0),
        status: 'UNPAID',
        lines: {
          create: [
            {
              serviceRateId: dummyRate.id,
              quantity: new Decimal(1),
              rateSnapshot: new Decimal(4000),
              lineGross: new Decimal(4000),
              discountAmount: new Decimal(0),
              lineNet: new Decimal(4000),
              patientShare: new Decimal(4000),
              panelReceivable: new Decimal(0),
            },
          ],
        },
      },
    });

    assert(invoice2.id !== invoice1.id, 'New Admission created a completely NEW invoice (different ID)');
    assert(invoice2.invoiceNumber !== invoice1.invoiceNumber, `New invoice has distinct invoiceNumber (${invoice2.invoiceNumber} vs ${invoice1.invoiceNumber})`);

    // 9. Pharmacy Request for Admission 2
    console.log('[Step 9] Pharmacy dispenses for Admission 2 (Amount: 500)...');
    const req3Result = await pharmacyBridgeService.handleDispensedCallback({
      patientMrNumber: mrNumber,
      externalAdmissionRef: admission2.admissionNumber,
      pharmacyInvoiceNumber: `PHI-TEST-02-${suffix}`,
      externalRequestRef: 'MED-REQ-03',
      dispenseEventId: `EVT-03-${suffix}`,
      subtotal: 500,
      taxTotal: 0,
      discountTotal: 0,
      totalAmount: 500,
      dispensedBy: 'Pharmacist B',
      lines: [
        {
          medicineName: 'Amoxicillin 250mg',
          quantity: 5,
          rate: 100,
          discountAmount: 0,
          lineNet: 500,
          batchNumber: 'B-AMX-01',
          externalRequestRef: 'MED-REQ-03',
        },
      ],
    });

    assert(req3Result.hospitalInvoice.id === invoice2.id, 'Admission 2 callback updated Admission 2 invoice');
    assert(req3Result.hospitalInvoice.id !== invoice1.id, 'Admission 2 callback did NOT touch Admission 1 invoice');
    assert(Number(req3Result.hospitalInvoice.total) === 4500, `Admission 2 invoice total is 4,500 (4,000 + 500) (got ${req3Result.hospitalInvoice.total})`);

    // Verify Admission 1 invoice total was completely untouched
    const checkInvoice1 = await prisma.hospitalInvoice.findUnique({
      where: { id: invoice1.id },
    });
    assert(Number(checkInvoice1?.total) === 8000, `Admission 1 invoice total remained 8,000 unchanged (got ${checkInvoice1?.total})`);

    console.log('\n═══════════════════════════════════════════════════════════════════════');
    console.log(`   ALL ${passed}/${total} ASSERTIONS PASSED!`);
    console.log('   "ONE ACTIVE ADMISSION = ONE PATIENT BILL / INVOICE LEDGER" VERIFIED');
    console.log('═══════════════════════════════════════════════════════════════════════\n');
  } catch (err: any) {
    console.error('\nVerification Error:', err.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runExactScenario();
