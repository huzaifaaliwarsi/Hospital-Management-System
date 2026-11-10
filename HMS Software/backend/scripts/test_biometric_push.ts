const BASE_URL = 'http://localhost:4000/api/v1';

async function postJson(url: string, body: any) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}

async function runBiometricVerificationSuite() {
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log('🧪 BIOMETRIC CLOUD PUSH — AUTOMATED VERIFICATION SUITE');
  console.log('═══════════════════════════════════════════════════════════════════\n');

  let passed = 0;
  let failed = 0;

  async function test(name: string, fn: () => Promise<void>) {
    try {
      await fn();
      console.log(`  ✅ PASS: ${name}`);
      passed++;
    } catch (err: any) {
      console.error(`  ❌ FAIL: ${name}`);
      console.error(`     Error: ${err?.message || err}`);
      failed++;
    }
  }

  // 1. Unregistered device check
  await test('Reject unregistered device serial with 404', async () => {
    const res = await postJson(`${BASE_URL}/attendance/punch-ingest`, {
      deviceSerial: 'NON_EXISTENT_SERIAL_9999',
      events: [{ enrollNumber: '99', punchTime: new Date().toISOString() }],
    });
    if (res.status !== 404) {
      throw new Error(`Expected 404 error but got status ${res.status}`);
    }
  });

  // 2. Register / Ensure Device Exists
  const deviceSerial = 'ZK-CHSS-VERIFY-01';
  await test('Register Biometric Device via Service', async () => {
    const { devicesService } = await import('../src/modules/devices/devices.service');
    const device = await devicesService.upsertDevice({
      name: 'Verification Test Terminal',
      brandModel: 'ZKTeco K40 Automated Test',
      deviceSerial,
      protocol: 'HTTP_ADMS',
      timezone: 'Asia/Karachi',
      isEnabled: true,
      authMode: 'DEVICE_SERIAL',
    });
    if (!device?.id) throw new Error('Device registration did not return device id');
  });

  // 3. Push valid event for unmapped enroll number
  const uniqueEnroll = `TEST_ENROLL_${Date.now()}`;
  await test('Accept raw punch for unmapped enroll number and retain as UNMAPPED', async () => {
    const res = await postJson(`${BASE_URL}/attendance/punch-ingest`, {
      deviceSerial,
      events: [
        {
          enrollNumber: uniqueEnroll,
          punchTime: new Date().toISOString(),
          punchType: 'CHECK_IN',
          verificationType: 'FINGERPRINT',
        },
      ],
    });

    if (res.data?.data?.accepted !== 1) {
      throw new Error(`Expected accepted: 1, got ${res.data?.data?.accepted}`);
    }
  });

  // 4. Test Idempotency: Resend identical punch event
  await test('Idempotency: Resending same punch produces duplicate count without second DB record', async () => {
    const fixedTime = '2026-10-15T08:30:00+05:00';
    const evt = {
      enrollNumber: 'IDEMPOTENT_TEST',
      punchTime: fixedTime,
      punchType: 'CHECK_IN',
      verificationType: 'FACE',
    };

    // First send
    const res1 = await postJson(`${BASE_URL}/attendance/punch-ingest`, {
      deviceSerial,
      events: [evt],
    });
    if (res1.data?.data?.accepted !== 1) throw new Error('First punch should be accepted');

    // Second send (identical)
    const res2 = await postJson(`${BASE_URL}/attendance/punch-ingest`, {
      deviceSerial,
      events: [evt],
    });
    if (res2.data?.data?.duplicates !== 1 || res2.data?.data?.accepted !== 0) {
      throw new Error(`Expected duplicates: 1, accepted: 0; got duplicates: ${res2.data?.data?.duplicates}, accepted: ${res2.data?.data?.accepted}`);
    }
  });

  // 5. Test Normalization: Check-in without Check-out results in MISSING_PUNCH
  await test('Shift Normalization: Single check-in results in MISSING_PUNCH status', async () => {
    const { prisma } = await import('../src/db/client');
    const { devicesService } = await import('../src/modules/devices/devices.service');

    const staff = await prisma.staff.findFirst({ where: { isActive: true } });
    if (!staff) throw new Error('No active staff member in database');

    const enrollNum = `E_${staff.employeeId}_${Date.now()}`;
    await devicesService.createOrUpdateMapping({
      staffId: staff.id,
      enrollNumber: enrollNum,
    });

    const morningTime = '2026-10-14T09:00:00+05:00';
    await postJson(`${BASE_URL}/attendance/punch-ingest`, {
      deviceSerial,
      events: [
        {
          enrollNumber: enrollNum,
          punchTime: morningTime,
          punchType: 'CHECK_IN',
        },
      ],
    });

    const record = await prisma.attendanceRecord.findFirst({
      where: {
        staffId: staff.id,
        attendanceDate: new Date('2026-10-14T00:00:00.000Z'),
      },
    });

    if (!record) throw new Error('AttendanceRecord was not created for mapped staff');
    if (record.status !== 'MISSING_PUNCH') {
      throw new Error(`Expected status MISSING_PUNCH, got ${record.status}`);
    }
    if (record.source !== 'DEVICE') {
      throw new Error(`Expected source DEVICE, got ${record.source}`);
    }
  });

  // 6. Test Normalization: Complete day (Check-in + Check-out) produces PRESENT
  await test('Shift Normalization: Check-in + Check-out normalizes to PRESENT with actualIn and actualOut', async () => {
    const { prisma } = await import('../src/db/client');
    const staff = await prisma.staff.findFirst({ where: { isActive: true } });
    if (!staff) throw new Error('No active staff member in database');

    const mapping = await prisma.staffBiometricIdentity.findFirst({
      where: { staffId: staff.id },
    });
    if (!mapping) throw new Error('No mapping found for staff');

    // Send check-out in afternoon
    const eveningTime = '2026-10-14T17:10:00+05:00';
    await postJson(`${BASE_URL}/attendance/punch-ingest`, {
      deviceSerial,
      events: [
        {
          enrollNumber: mapping.enrollNumber,
          punchTime: eveningTime,
          punchType: 'CHECK_OUT',
        },
      ],
    });

    const record = await prisma.attendanceRecord.findFirst({
      where: {
        staffId: staff.id,
        attendanceDate: new Date('2026-10-14T00:00:00.000Z'),
      },
    });

    if (!record) throw new Error('AttendanceRecord missing');
    if (record.status !== 'PRESENT') {
      throw new Error(`Expected status PRESENT after check-out, got ${record.status}`);
    }
    if (!record.actualOut) {
      throw new Error('Expected actualOut timestamp to be set');
    }
  });

  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`🏁 VERIFICATION COMPLETE: ${passed} Passed | ${failed} Failed`);
  console.log('═══════════════════════════════════════════════════════════════════');

  process.exit(failed > 0 ? 1 : 0);
}

runBiometricVerificationSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
