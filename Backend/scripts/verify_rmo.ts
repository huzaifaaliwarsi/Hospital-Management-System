import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { env } from '../src/config/env';

const prisma = new PrismaClient();
const API_BASE = 'http://localhost:4000/api/v1';

async function request(endpoint: string, options: { method?: string; body?: any; token: string }) {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: options.method || 'GET',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${options.token}`,
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const status = res.status;
  const text = await res.text();
  let json: any = null;
  try {
    json = JSON.parse(text);
  } catch {
    json = { raw: text };
  }
  return { status, data: json };
}

async function main() {
  console.log('=== RMO INTEGRATION END-TO-END VERIFICATION ===\n');

  // 1. Find or create an admin token
  const superAdmin = await prisma.portalUser.findFirst({
    where: { role: 'SUPER_ADMIN', status: 'ACTIVE' },
  });

  if (!superAdmin) {
    throw new Error('No active SUPER_ADMIN user found in database');
  }

  const session = await prisma.refreshToken.create({
    data: {
      portalUserId: superAdmin.id,
      tokenHash: `test-hash-${Date.now()}`,
      expiresAt: new Date(Date.now() + 3600000),
    },
  });

  const token = jwt.sign(
    {
      sub: superAdmin.id,
      role: superAdmin.role,
      staffId: superAdmin.staffId,
      mustResetPassword: false,
      sessionId: session.id,
    },
    env.JWT_ACCESS_SECRET,
    { expiresIn: '1h' }
  );

  // 2. Fetch a clinical department
  const clinicalDept = await prisma.department.findFirst({
    where: { isActive: true },
  });
  if (!clinicalDept) {
    throw new Error('No clinical department found');
  }
  console.log(`[PASS] Using Clinical Department: ${clinicalDept.name} (${clinicalDept.id})`);

  // 3. Create or find an active Doctor
  let doctorStaff = await prisma.staff.findFirst({
    where: { category: 'Doctor', isActive: true },
  });
  if (!doctorStaff) {
    doctorStaff = await prisma.staff.create({
      data: {
        employeeId: `DOC-VERIFY-${Date.now().toString().slice(-4)}`,
        fullName: 'Dr. Test Consultant',
        phone: '03001112233',
        email: `doc.test.${Date.now()}@chss.example`,
        category: 'Doctor',
        departmentId: clinicalDept.id,
        isActive: true,
        availableForOpd: true,
        availableForObservation: true,
        availableForEmergency: true,
        consultationFee: 1500,
      },
    });
  }
  console.log(`[PASS] Doctor record: ${doctorStaff.fullName} (${doctorStaff.id})`);

  // 4. Create RMO via API
  const testRmoPhone = `030${Math.floor(10000000 + Math.random() * 90000000)}`;
  const createRmoPayload = {
    fullName: 'Dr. Zaid Khan (RMO)',
    fatherGuardianName: 'Tariq Khan',
    phone: testRmoPhone,
    email: `rmo.zaid.${Date.now()}@chss.example`,
    cnic: `35201-${Math.floor(1000000 + Math.random() * 9000000)}-1`,
    dateOfBirth: '1993-05-15',
    gender: 'Male',
    address: 'Flat 4B, Doctors Colony, Lahore',
    qualification: 'MBBS, FCPS-I',
    pmdcNumber: '78612-P',
    category: 'RMO',
    departmentId: clinicalDept.id,
    baseSalary: 135000,
    salaryBasis: 'MONTHLY',
    availableForEmergency: true,
  };

  console.log('\n--- 1. Testing RMO Creation via Staff API ---');
  const rmoRes = await request('/staff', { method: 'POST', body: createRmoPayload, token });
  if (rmoRes.status !== 201) {
    throw new Error(`Failed to create RMO: ${rmoRes.status} ${JSON.stringify(rmoRes.data)}`);
  }
  const createdRmo = rmoRes.data.data;
  console.log(`[PASS] RMO created via API: ${createdRmo.fullName} (ID: ${createdRmo.id})`);
  console.log(`       Category: ${createdRmo.category}`);
  console.log(`       PMDC: ${createdRmo.pmdcNumber}`);
  console.log(`       Qualification: ${createdRmo.qualification}`);
  console.log(`       Gender: ${createdRmo.gender}`);
  console.log(`       Address: ${createdRmo.address}`);
  console.log(`       Available for OPD: ${createdRmo.availableForOpd} (Must be false)`);
  console.log(`       Available for Observation: ${createdRmo.availableForObservation} (Must be false)`);
  console.log(`       Available for Emergency: ${createdRmo.availableForEmergency} (Must be true)`);

  if (createdRmo.availableForOpd !== false || createdRmo.availableForObservation !== false) {
    throw new Error('RMO must NOT be available for OPD or Observation!');
  }

  // 5. Verify RMO fetched via GET /staff/:id
  console.log('\n--- 2. Verifying RMO in Staff List & 360 API ---');
  const getRmoRes = await request(`/staff/${createdRmo.id}`, { token });
  const fetchedRmo = getRmoRes.data.data;
  if (fetchedRmo.pmdcNumber !== '78612-P' || fetchedRmo.qualification !== 'MBBS, FCPS-I') {
    throw new Error('Fetched RMO details do not match created PMDC/qualification');
  }
  console.log('[PASS] GET /staff/:id returned accurate PMDC and Qualification details');

  // 6. Test Restriction: Attempt to create OPD encounter with RMO
  console.log('\n--- 3. Testing Encounter Isolation Restrictions ---');
  const opdAttempt = await request('/encounters', {
    method: 'POST',
    token,
    body: {
      encounterType: 'OPD',
      newSelfPayPatient: {
        fullName: 'Test OPD Patient',
        phone: '03009998877',
        gender: 'Male',
      },
      doctorStaffId: doctorStaff.id,
      rmoStaffId: createdRmo.id, // Illegal on OPD!
    },
  });
  if (opdAttempt.status === 400) {
    console.log(`[PASS] OPD encounter with RMO rejected with HTTP 400: ${JSON.stringify(opdAttempt.data)}`);
  } else {
    throw new Error(`FAILED: Backend did not reject rmoStaffId on OPD encounter! Got status: ${opdAttempt.status} ${JSON.stringify(opdAttempt.data)}`);
  }

  // 7. Test Restriction: Attempt to create Observation encounter with RMO
  const obsvAttempt = await request('/encounters', {
    method: 'POST',
    token,
    body: {
      encounterType: 'OBSERVATION',
      newSelfPayPatient: {
        fullName: 'Test Obsv Patient',
        phone: '03009998878',
        gender: 'Female',
      },
      doctorStaffId: doctorStaff.id,
      rmoStaffId: createdRmo.id, // Illegal on Observation!
    },
  });
  if (obsvAttempt.status === 400) {
    console.log(`[PASS] Observation encounter with RMO rejected with HTTP 400: ${JSON.stringify(obsvAttempt.data)}`);
  } else {
    throw new Error(`FAILED: Backend did not reject rmoStaffId on Observation encounter! Got status: ${obsvAttempt.status} ${JSON.stringify(obsvAttempt.data)}`);
  }

  // 8. Test Valid EMERGENCY encounter with Doctor + RMO
  console.log('\n--- 4. Testing Emergency (ER) Encounter with Doctor + RMO ---');
  const erRes = await request('/encounters', {
    method: 'POST',
    token,
    body: {
      encounterType: 'EMERGENCY',
      newSelfPayPatient: {
        fullName: 'ER Acute Trauma Patient',
        guardianName: 'Brother',
        phone: '03009998879',
        gender: 'Male',
      },
      departmentId: clinicalDept.id,
      doctorStaffId: doctorStaff.id,
      rmoStaffId: createdRmo.id,
      notes: 'Severe trauma intake - attended by Doctor + RMO',
    },
  });
  if (erRes.status !== 201) {
    throw new Error(`Failed to create Emergency encounter: ${erRes.status} ${JSON.stringify(erRes.data)}`);
  }
  const erInvoice = erRes.data.data;
  console.log(`[PASS] Emergency encounter created: Invoice #${erInvoice.invoiceNumber} (${erInvoice.id})`);
  console.log(`       Doctor ID on invoice: ${erInvoice.doctorStaffId}`);
  console.log(`       RMO ID on invoice: ${erInvoice.rmoStaffId}`);

  // Fetch invoice to verify populated relations
  const fetchedErInvoiceRes = await request(`/invoices/${erInvoice.id}`, { token });
  const fetchedErInvoice = fetchedErInvoiceRes.data.data;
  console.log(`       Populated Doctor Name: ${fetchedErInvoice.doctor?.fullName}`);
  console.log(`       Populated RMO Name: ${fetchedErInvoice.rmo?.fullName}`);
  if (fetchedErInvoice.rmo?.fullName !== createdRmo.fullName) {
    throw new Error('Emergency invoice RMO relation did not return RMO name!');
  }

  // 9. Test Inpatient Admission with Doctor + RMO
  console.log('\n--- 5. Testing IPD Admission with Doctor + RMO ---');
  const invFromDb = await prisma.hospitalInvoice.findUnique({
    where: { id: erInvoice.id },
  });
  const actualSelfPayEncounterId = invFromDb?.selfPayEncounterId || erInvoice.selfPayEncounterId;

  const admissionRes = await request('/admissions', {
    method: 'POST',
    token,
    body: {
      selfPayEncounterId: actualSelfPayEncounterId,
      departmentId: clinicalDept.id,
      doctorStaffId: doctorStaff.id,
      rmoStaffId: createdRmo.id,
      diagnosis: 'Acute surgical abdomen - planned laparotomy',
      estimatedAmount: 75000,
      advanceAmount: 25000,
      paymentMethod: 'CASH',
      notes: 'Admitted under Dr. Consultant with Dr. Zaid as assigned RMO',
    },
  });
  if (admissionRes.status !== 201) {
    throw new Error(`Failed to create Admission: ${admissionRes.status} ${JSON.stringify(admissionRes.data)}`);
  }
  const createdAdmission = admissionRes.data.data.admission;
  console.log(`[PASS] Admission created: #${createdAdmission.admissionNumber} (${createdAdmission.id})`);
  console.log(`       Primary Doctor ID: ${createdAdmission.doctorStaffId}`);
  console.log(`       Assigned RMO ID: ${createdAdmission.rmoStaffId}`);

  // Fetch admission detail
  const fetchedAdmRes = await request(`/admissions/${createdAdmission.id}`, { token });
  const fetchedAdm = fetchedAdmRes.data.data;
  console.log(`       Populated Doctor Name: ${fetchedAdm.doctor?.fullName}`);
  console.log(`       Populated RMO Name: ${fetchedAdm.rmo?.fullName}`);
  if (fetchedAdm.rmo?.fullName !== createdRmo.fullName) {
    throw new Error('Admission RMO relation did not return RMO name!');
  }

  // 10. Verify DB persistence directly
  console.log('\n--- 6. Verifying Direct Database Persistence ---');
  const dbAdmission = await prisma.admissionRecord.findUnique({
    where: { id: createdAdmission.id },
    include: { doctor: true, rmo: true },
  });
  if (!dbAdmission || dbAdmission.rmoStaffId !== createdRmo.id) {
    throw new Error('Database admission record missing rmoStaffId!');
  }
  console.log(`[PASS] DB Admission verified: Doctor=${dbAdmission.doctor?.fullName}, RMO=${dbAdmission.rmo?.fullName}`);

  const dbInvoice = await prisma.hospitalInvoice.findUnique({
    where: { id: erInvoice.id },
    include: { doctor: true, rmo: true },
  });
  if (!dbInvoice || dbInvoice.rmoStaffId !== createdRmo.id) {
    throw new Error('Database invoice record missing rmoStaffId!');
  }
  console.log(`[PASS] DB Invoice verified: Doctor=${dbInvoice.doctor?.fullName}, RMO=${dbInvoice.rmo?.fullName}`);

  console.log('\n=================================================');
  console.log('ALL RMO END-TO-END VERIFICATIONS PASSED 100%!');
  console.log('=================================================\n');
}

main()
  .catch((e) => {
    console.error('\n[FAIL] Verification error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
