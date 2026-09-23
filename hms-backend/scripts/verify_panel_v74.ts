/** Isolated-database integration check. Never inserts fixtures into the configured HMS database. */
import 'dotenv/config';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';

async function main() {
  const originalUrl = process.env.DATABASE_URL;
  if (!originalUrl) throw new Error('DATABASE_URL is required');
  const databaseName = `chss_panel_v74_test_${Date.now()}`;
  const management = new PrismaClient({ datasources: { db: { url: originalUrl } } });
  let testClient: { $disconnect(): Promise<void> } | undefined;
  let created = false;
  try {
    // databaseName is generated here, contains only ASCII letters, digits and underscores.
    await management.$executeRawUnsafe(`CREATE DATABASE "${databaseName}"`);
    created = true;
    const testUrl = new URL(originalUrl);
    testUrl.pathname = `/${databaseName}`;
    process.env.DATABASE_URL = testUrl.toString();
    process.env.NODE_ENV = 'test';
    execFileSync(process.execPath, ['node_modules/prisma/build/index.js', 'migrate', 'deploy'], {
      env: process.env,
      stdio: 'pipe',
    });
    // The legacy migration chain omits existing fields (e.g. departments.floor).
    // Align ONLY this newly created empty test database, never the configured HMS database.
    execFileSync(
      process.execPath,
      ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'],
      { env: process.env, stdio: 'pipe' },
    );
    const { prisma } = await import('../src/db/client');
    testClient = prisma;
    const { setupService } = await import('../src/modules/setup/setup.service');
    const { replaceDiscountRulesSchema } = await import('../src/modules/setup/setup.schemas');
    const { patientsService } = await import('../src/modules/frontdesk/patients.service');
    const { panelBillingService } = await import('../src/modules/frontdesk/panelBilling.service');
    const { invoicesService } = await import('../src/modules/frontdesk/invoices.service');
    const { admissionService } = await import('../src/modules/admission/admission.service');
    const { createPlannedAdmissionSchema } =
      await import('../src/modules/admission/admission.schemas');
    const actor = await prisma.portalUser.create({
      data: {
        username: 'panel-test',
        passwordHash: 'integration-only-no-login',
        role: 'SUPER_ADMIN',
      },
    });
    const category = (await setupService.listPanelCategories())[0]!;
    const company = await setupService.createCorporatePanel(
      {
        code: 'TEST-PANEL',
        organizationName: 'Integration Test Panel',
        category: category.name,
        legalBillingName: 'Test Billing Name',
        contactEmail: 'billing@example.test',
        billingTerms: 'Configured test cycle',
      },
      actor.id,
    );
    const companyId = company.id as string;
    assert.equal(company.billingTerms, 'Configured test cycle');
    const department = await prisma.department.create({
      data: { code: 'TEST-DEPT', name: 'Test Department', departmentType: 'CLINICAL' },
    });
    const service = await prisma.serviceRate.create({
      data: {
        code: 'TEST-SERVICE',
        name: 'Test Service',
        billingUnit: 'PER_UNIT',
        standardRate: 1000,
        departmentId: department.id,
      },
    });
    const patient = await patientsService.createPanelPatient(
      {
        fullName: 'Integration Patient',
        corporatePanelId: companyId,
        panelMemberId: 'EXTERNAL-TEST-1',
        status: 'ACTIVE',
      },
      actor.id,
    );
    const patientId = patient.id as string;
    const savedRules = await setupService.replaceDiscountRules(
      companyId,
      replaceDiscountRulesSchema.parse({
        rules: [
          {
            scope: 'GLOBAL',
            coverageType: 'PERCENTAGE',
            coveragePercent: 50,
            effectiveFrom: '2020-01-01',
          },
          {
            scope: 'DEPARTMENT',
            departmentId: department.id,
            coverageType: 'FULL',
            effectiveFrom: '2020-01-01',
          },
          {
            scope: 'SERVICE',
            serviceRateId: service.id,
            coverageType: 'FIXED_PATIENT_SHARE',
            fixedPatientShare: 100,
            contractRate: 800,
            effectiveFrom: '2020-01-01',
          },
        ],
      }),
      actor.id,
    );
    const preview = await panelBillingService.resolveContract({
      panelPatientId: patientId,
      serviceRateId: service.id,
      quantity: 2,
    });
    assert.equal(preview.contractAmount.toNumber(), 1600);
    assert.equal(preview.patientShare.toNumber(), 100);
    assert.equal(preview.panelReceivable.toNumber(), 1500);
    const invoice = await invoicesService.createEncounter(
      { encounterType: 'OPD', panelPatientId: patientId, departmentId: department.id },
      actor.id,
    );
    const line = await invoicesService.addServiceLine(
      invoice.id,
      { serviceRateId: service.id, quantity: 2 },
      actor.id,
      'SUPER_ADMIN',
    );
    assert.equal(line.patientShare.toNumber(), 100);
    assert.equal(line.panelReceivable.toNumber(), 1500);
    assert.equal(line.lineNet.toNumber(), 1600);
    assert.equal(
      (line.coverageSnapshot as any).ruleId,
      savedRules.find((r) => r.scope === 'SERVICE')!.id,
    );
    await assert.rejects(
      () =>
        invoicesService.collectPayment(
          invoice.id,
          { amount: 1600, paymentMethod: 'CASH' },
          actor.id,
        ),
      /exceeds remaining balance/,
    );
    await invoicesService.collectPayment(
      invoice.id,
      { amount: 100, paymentMethod: 'CASH' },
      actor.id,
    );
    const remittance = await panelBillingService.recordRemittance(
      companyId,
      { amount: 1500, method: 'BANK_TRANSFER' },
      actor.id,
    );
    assert.equal(remittance.allocations[0]!.hospitalInvoiceId, invoice.id);
    const statement = await panelBillingService.getPanelStatement(companyId);
    assert.equal(statement.consolidated.panelReceivableOutstanding.toNumber(), 0);
    const paid = await prisma.hospitalInvoice.findUniqueOrThrow({ where: { id: invoice.id } });
    assert.equal(
      paid.paidTotal.toNumber(),
      100,
      'Company money must not change patient paid total',
    );
    await setupService.replaceDiscountRules(
      companyId,
      replaceDiscountRulesSchema.parse({
        rules: [{ scope: 'GLOBAL', coverageType: 'NOT_COVERED', effectiveFrom: '2020-01-01' }],
      }),
      actor.id,
    );
    assert.equal(
      await prisma.panelDiscountRule.count({
        where: { corporatePanelId: companyId, archivedAt: { not: null } },
      }),
      3,
    );
    const unchanged = await prisma.invoiceLineItem.findUniqueOrThrow({ where: { id: line.id } });
    assert.deepEqual(unchanged.coverageSnapshot, line.coverageSnapshot);
    assert.equal(unchanged.panelReceivable.toNumber(), 1500);
    const next = await panelBillingService.resolveContract({
      panelPatientId: patientId,
      serviceRateId: service.id,
      quantity: 1,
    });
    assert.equal(next.patientShare.toNumber(), 1000);
    const search = await patientsService.listPanelPatients({
      search: 'EXTERNAL-TEST-1',
      page: 1,
      pageSize: 10,
    });
    assert.equal(search.rows.length, 1);
    const ward = await prisma.ward.create({
      data: { departmentId: department.id, name: 'Test Ward', fixedPrice: 500 },
    });
    const stay = await admissionService.createPlannedAdmission(
      createPlannedAdmissionSchema.parse({
        panelPatientId: patientId,
        departmentId: department.id,
        wardId: ward.id,
        estimatedAmount: 90000,
      }),
      actor.id,
    );
    const wardInvoice = await prisma.hospitalInvoice.findUniqueOrThrow({
      where: { id: stay.invoice.id },
      include: { lines: true },
    });
    assert.equal(wardInvoice.total.toNumber(), 500, 'Estimate must not become a charge');
    assert.equal(
      wardInvoice.patientShare.toNumber(),
      500,
      'Ward without coverage is patient payable',
    );
    assert.equal(wardInvoice.panelReceivable.toNumber(), 0);
    assert.equal(wardInvoice.lines.length, 1);
    await assert.rejects(
      () =>
        patientsService.updatePanelPatient(
          patientId,
          { corporatePanelId: '00000000-0000-4000-8000-000000000001' },
          actor.id,
        ),
      /membership history/,
    );
    // Membership edits preserve MRN, create immutable revisions, and never reprice old invoices.
    await setupService.updateCorporatePanel(companyId, { memberIdRequired: true, memberIdLabel: 'Employee ID', membershipValidityRequired: true }, actor.id);
    await assert.rejects(() => patientsService.createPanelPatient({ fullName: 'Missing identity', corporatePanelId: companyId }, actor.id), /Employee ID/);
    await assert.rejects(() => patientsService.createPanelPatient({ fullName: 'Missing dates', corporatePanelId: companyId, panelMemberId: 'MEMBER' }, actor.id), /start and end dates/);
    const renewed = await patientsService.updatePanelPatient(patientId, { membershipValidFrom: new Date('2020-01-01'), membershipValidTo: new Date('2099-12-31'), planName: 'Gold' }, actor.id);
    assert.equal(renewed.mrNumber, patient.mrNumber);
    assert.equal((await panelBillingService.verifyPanelPatient(patientId)).membershipActive, true);
    const { appointmentsService } = await import('../src/modules/frontdesk/appointments.service');
    const booking = await appointmentsService.bookAppointment({ panelPatientId: patientId, departmentId: department.id, serviceRateId: service.id, slotAt: new Date(), paymentMethod: 'CASH' }, actor.id);
    const openEncounter = await invoicesService.createEncounter({ encounterType: 'OPD', panelPatientId: patientId }, actor.id);
    const beforeHistory = await patientsService.membershipHistory(patientId, 1, 10);
    assert.equal(beforeHistory.meta.totalItems, 2);
    await patientsService.updatePanelPatient(patientId, { fullName: 'Corrected name' }, actor.id);
    assert.equal((await patientsService.membershipHistory(patientId, 1, 10)).meta.totalItems, 2);
    await assert.rejects(() => patientsService.updatePanelPatient(patientId, { membershipValidFrom: new Date('2100-01-01') }, actor.id), /end date/);
    assert.equal((await patientsService.membershipHistory(patientId, 1, 10)).meta.totalItems, 2, 'Rejected edits must not create revisions');
    await patientsService.updatePanelPatient(patientId, { membershipValidTo: new Date('2020-01-01') }, actor.id);
    assert.equal((await panelBillingService.verifyPanelPatient(patientId)).membershipActive, false);
    await assert.rejects(() => invoicesService.createEncounter({ encounterType: 'OPD', panelPatientId: patientId }, actor.id), /expired/);
    await assert.rejects(() => invoicesService.addServiceLine(openEncounter.id, { serviceRateId: service.id, quantity: 1 }, actor.id, 'SUPER_ADMIN'), /expired/);
    await assert.rejects(() => admissionService.createPlannedAdmission(createPlannedAdmissionSchema.parse({ panelPatientId: patientId, departmentId: department.id }), actor.id), /expired/);
    await assert.rejects(() => appointmentsService.checkInAppointment(booking.appointment.id, { encounterType: 'OPD' }, actor.id), /expired/);
    await assert.rejects(() => appointmentsService.updateAppointment(booking.appointment.id, { slotAt: new Date() }), /expired/);
    await assert.rejects(() => appointmentsService.bookAppointment({ panelPatientId: patientId, departmentId: department.id, serviceRateId: service.id, slotAt: new Date(), paymentMethod: 'CASH' }, actor.id), /expired/);
    await patientsService.updatePanelPatient(patientId, { membershipValidTo: new Date('2099-12-31'), membershipStatus: 'SUSPENDED' }, actor.id);
    await assert.rejects(() => panelBillingService.resolveContract({ panelPatientId: patientId, serviceRateId: service.id, quantity: 1 }), /suspended/);
    assert.deepEqual((await prisma.invoiceLineItem.findUniqueOrThrow({ where: { id: line.id } })).coverageSnapshot, line.coverageSnapshot);
    const historyPage = await patientsService.membershipHistory(patientId, 2, 2);
    assert.equal(historyPage.meta.totalItems, 4);
    assert.equal(historyPage.rows.length, 2);
    assert.ok(historyPage.rows.every(row => row.recordedByLabel.includes('panel-test')));
    console.log('PASS: membership requirements, immutable paginated history, date validation, expiry gates across intake/booking/admission, suspension, stable MRN and old invoice snapshots.');
    await setupService.updateCorporatePanel(companyId, { isActive: false }, actor.id);
    await assert.rejects(
      () =>
        patientsService.createPanelPatient(
          { fullName: 'Blocked', corporatePanelId: companyId },
          actor.id,
        ),
      /active company/,
    );
    console.log(
      'PASS: isolated PostgreSQL company persistence, coverage precedence/tariff, posting snapshot, patient payment boundary, company remittance, rule archive, external-ID search, ward no-coverage billing, estimate isolation and inactive-company guards.',
    );
  } finally {
    await testClient?.$disconnect();
    process.env.DATABASE_URL = originalUrl;
    if (created) await management.$executeRawUnsafe(`DROP DATABASE "${databaseName}" WITH (FORCE)`);
    await management.$disconnect();
  }
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
