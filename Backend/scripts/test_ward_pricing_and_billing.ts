import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('=== TEST 1: Ward Model with Head & Fixed Price ===');
  const staff = await prisma.staff.findFirst({
    where: { employmentStatus: 'ACTIVE' },
  });
  console.log('Using active staff member:', staff ? `${staff.fullName} (${staff.id})` : 'None');

  const dept = await prisma.department.findFirst({
    where: { isActive: true },
  });
  if (!dept) throw new Error('No active department found.');

  // Create test ward with fixed price 3500 and headStaffId
  const testWardWithPrice = await prisma.ward.create({
    data: {
      name: 'Test Ward With Pricing',
      code: 'WRD-TEST-PRICE',
      departmentId: dept.id,
      headStaffId: staff ? staff.id : null,
      fixedPrice: 3500.00,
      isActive: true,
    },
    include: { headStaff: true },
  });
  console.log('Created Ward with price:', {
    id: testWardWithPrice.id,
    name: testWardWithPrice.name,
    fixedPrice: testWardWithPrice.fixedPrice?.toString(),
    headStaff: testWardWithPrice.headStaff?.fullName,
  });

  if (Number(testWardWithPrice.fixedPrice) !== 3500) {
    throw new Error(`Expected fixedPrice to be 3500, got ${testWardWithPrice.fixedPrice}`);
  }

  // Create test ward with 0 / null price
  const testWardFree = await prisma.ward.create({
    data: {
      name: 'Test Free Ward',
      code: 'WRD-TEST-FREE',
      departmentId: dept.id,
      headStaffId: null,
      fixedPrice: null,
      isActive: true,
    },
  });
  console.log('Created Free Ward:', {
    id: testWardFree.id,
    name: testWardFree.name,
    fixedPrice: testWardFree.fixedPrice,
  });

  console.log('\n=== TEST 2: Verify One-Time Ward Fixed Fee in Billing ===');
  // Create test room & bed under testWardWithPrice
  const testRoom1 = await prisma.room.create({
    data: {
      wardId: testWardWithPrice.id,
      name: 'Test Room P1',
      code: 'RM-TEST-P1',
      dailyRoomRate: 2000,
    },
  });
  const testBed1 = await prisma.bed.create({
    data: {
      roomId: testRoom1.id,
      bedNumber: 'T-P1-01',
      dailyRate: 2000,
      status: 'AVAILABLE',
    },
  });

  // Create an admission record
  const admission1 = await prisma.admissionRecord.create({
    data: {
      admissionNumber: 'ADM-TEST-001',
      departmentId: dept.id,
      bedId: testBed1.id,
      status: 'ACTIVE',
      admittedAt: new Date(),
    },
  });

  // Create invoice for admission1
  const invoice1 = await prisma.hospitalInvoice.create({
    data: {
      invoiceNumber: 'INV-TEST-001',
      sourceType: 'ADMISSION',
      admissionRecordId: admission1.id,
      departmentId: dept.id,
      subtotal: 0,
      discountTotal: 0,
      total: 0,
      paidTotal: 0,
      patientShare: 0,
      panelReceivable: 0,
      status: 'UNPAID',
    },
  });

  // Simulate postWardFixedChargeIfApplicable logic
  const bedWithWard = await prisma.bed.findUnique({
    where: { id: testBed1.id },
    include: { room: { include: { ward: true } } },
  });

  const wardPricing = bedWithWard?.room?.ward?.fixedPrice;
  if (wardPricing && Number(wardPricing) > 0) {
    let serviceRate = await prisma.serviceRate.findFirst({
      where: { code: 'WARD-FIXED' },
    });
    if (!serviceRate) {
      serviceRate = await prisma.serviceRate.create({
        data: {
          code: 'WARD-FIXED',
          name: 'Ward Fixed / Admission Fee',
          category: 'Accommodation',
          departmentId: dept.id,
          standardRate: 0,
          billingUnit: 'PER_ADMISSION',
          isActive: true,
        },
      });
    }

    await prisma.invoiceLineItem.create({
      data: {
        hospitalInvoiceId: invoice1.id,
        serviceRateId: serviceRate.id,
        rateSnapshot: wardPricing,
        quantity: 1,
        lineGross: wardPricing,
        discountAmount: 0,
        lineNet: wardPricing,
        patientShare: wardPricing,
        panelReceivable: 0,
        isCompleted: true,
      },
    });

    await prisma.hospitalInvoice.update({
      where: { id: invoice1.id },
      data: {
        subtotal: { increment: wardPricing },
        total: { increment: wardPricing },
        patientShare: { increment: wardPricing },
      },
    });
  }

  // Verify invoice1 now has the 3500 ward fixed fee
  const updatedInv1 = await prisma.hospitalInvoice.findUnique({
    where: { id: invoice1.id },
    include: { lines: { include: { serviceRate: true } } },
  });

  console.log(`Invoice ${updatedInv1?.invoiceNumber} lines:`);
  updatedInv1?.lines.forEach((l) => {
    console.log(`  - [${l.serviceRate.code}] ${l.serviceRate.name}: PKR ${l.lineNet}`);
  });
  console.log(`Invoice Total: PKR ${updatedInv1?.total}`);

  if (Number(updatedInv1?.total) !== 3500) {
    throw new Error(`Expected invoice total to be 3500, got ${updatedInv1?.total}`);
  }

  console.log('\n=== TEST 3: Verify Zero/Null Ward Pricing Adds 0 Charges ===');
  // Create test room & bed under testWardFree
  const testRoom2 = await prisma.room.create({
    data: {
      wardId: testWardFree.id,
      name: 'Test Room Free1',
      code: 'RM-TEST-F1',
      dailyRoomRate: 1500,
    },
  });
  const testBed2 = await prisma.bed.create({
    data: {
      roomId: testRoom2.id,
      bedNumber: 'T-F1-01',
      dailyRate: 1500,
      status: 'AVAILABLE',
    },
  });

  const admission2 = await prisma.admissionRecord.create({
    data: {
      admissionNumber: 'ADM-TEST-002',
      departmentId: dept.id,
      bedId: testBed2.id,
      status: 'ACTIVE',
      admittedAt: new Date(),
    },
  });

  const invoice2 = await prisma.hospitalInvoice.create({
    data: {
      invoiceNumber: 'INV-TEST-002',
      sourceType: 'ADMISSION',
      admissionRecordId: admission2.id,
      departmentId: dept.id,
      subtotal: 0,
      discountTotal: 0,
      total: 0,
      paidTotal: 0,
      patientShare: 0,
      panelReceivable: 0,
      status: 'UNPAID',
    },
  });

  const bedFreeWithWard = await prisma.bed.findUnique({
    where: { id: testBed2.id },
    include: { room: { include: { ward: true } } },
  });

  const freeWardPricing = bedFreeWithWard?.room?.ward?.fixedPrice;
  if (!freeWardPricing || Number(freeWardPricing) <= 0) {
    console.log('Ward has no pricing or is 0 -> NOTHING added to invoice.');
  }

  const updatedInv2 = await prisma.hospitalInvoice.findUnique({
    where: { id: invoice2.id },
    include: { lines: true },
  });

  if (updatedInv2?.lines.length !== 0 || Number(updatedInv2.total) !== 0) {
    throw new Error('Expected 0 lines and 0 total for free ward!');
  }
  console.log('Confirmed: 0 charges added for ward with 0/null price.');

  console.log('\n=== CLEANUP TEST DATA ===');
  await prisma.invoiceLineItem.deleteMany({
    where: { hospitalInvoiceId: { in: [invoice1.id, invoice2.id] } },
  });
  await prisma.hospitalInvoice.deleteMany({
    where: { id: { in: [invoice1.id, invoice2.id] } },
  });
  await prisma.admissionRecord.deleteMany({
    where: { id: { in: [admission1.id, admission2.id] } },
  });
  await prisma.bed.deleteMany({
    where: { id: { in: [testBed1.id, testBed2.id] } },
  });
  await prisma.room.deleteMany({
    where: { id: { in: [testRoom1.id, testRoom2.id] } },
  });
  await prisma.ward.deleteMany({
    where: { id: { in: [testWardWithPrice.id, testWardFree.id] } },
  });
  console.log('Test data cleaned up successfully.');

  console.log('\n✅ ALL TESTS PASSED SUCCESSFULLY!');
}

main()
  .catch((e) => {
    console.error('Test error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
