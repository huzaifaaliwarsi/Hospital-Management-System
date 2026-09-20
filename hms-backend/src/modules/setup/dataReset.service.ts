import { prisma } from '@/db/client';
import { AuthorizationError } from '@/shared/errors/AppError';

export interface ResetSummary {
  appointments: number;
  invoices: number;
  invoiceLines: number;
  paymentReceipts: number;
  userCashBalances: number;
  accountSettlements: number;
  admissions: number;
  selfPayEncounters: number;
  panelPatients: number;
  pharmacyClearances: number;
  pharmacyDispenses: number;
  pharmacyDispenseLines: number;
  resetBeds: number;
}

export const dataResetService = {
  /**
   * Resets all runtime transactional data (appointments, invoices, receipts,
   * cashier ledgers, admissions, patient encounters) while preserving all
   * master setup data (hospital profile, departments, staff, users, services,
   * corporate panels, wards, rooms, beds).
   */
  resetTransactionalData: async (actorId: string, actorRole?: string): Promise<{ success: boolean; summary: ResetSummary }> => {
    if (actorRole && actorRole !== 'SUPER_ADMIN') {
      throw new AuthorizationError('Only Super Admin can reset transactional data.');
    }

    return await prisma.$transaction(async (tx) => {
      // 1. Panel remittances & allocations
      await tx.panelRemittanceAllocation.deleteMany();
      await tx.panelRemittance.deleteMany();

      // 2. Doctor commissions linked to invoices
      await tx.commissionPayout.deleteMany();
      await tx.commissionReversal.deleteMany();
      await tx.doctorCommissionAccrual.deleteMany();

      // 3. Cashier shifts, settlements & payments
      await tx.settlementTransaction.deleteMany();
      const deletedAccountSettlements = await tx.accountSettlement.deleteMany();
      const deletedUserCashBalances = await tx.userCashBalance.deleteMany();
      const deletedPaymentReceipts = await tx.paymentReceipt.deleteMany();

      // 4. Pharmacy dispenses & clearances linked to admissions/patients
      await tx.highCostMedicineAuthorization.deleteMany();
      await tx.pharmacyClearanceLine.deleteMany();
      const deletedPharmacyDispenseLines = await tx.pharmacyDispenseLine.deleteMany();
      const deletedPharmacyDispenses = await tx.pharmacyDispense.deleteMany();
      const deletedPharmacyClearances = await tx.pharmacyClearance.deleteMany();

      // 5. Invoices & line items
      const deletedInvoiceLines = await tx.invoiceLineItem.deleteMany();
      const deletedInvoices = await tx.hospitalInvoice.deleteMany();

      // 6. Appointments
      const deletedAppointments = await tx.appointment.deleteMany();

      // 7. Admissions and clinical discharge
      await tx.dischargeSummary.deleteMany();
      await tx.dualDischargeClearance.deleteMany();
      await tx.admissionPaymentRequest.deleteMany();
      await tx.bedTransferHistory.deleteMany();
      await tx.medicationModeHistory.deleteMany();
      const deletedAdmissions = await tx.admissionRecord.deleteMany();

      // 8. Self-pay encounters & Panel patients
      const deletedSelfPayEncounters = await tx.selfPayEncounter.deleteMany();
      const deletedPanelPatients = await tx.panelPatient.deleteMany();

      // 9. Reset occupied/reserved beds back to AVAILABLE
      const updatedBeds = await tx.bed.updateMany({
        where: {
          status: {
            in: ['OCCUPIED', 'RESERVED'],
          },
        },
        data: {
          status: 'AVAILABLE',
        },
      });

      // 10. Record Audit Log entry
      await tx.auditLog.create({
        data: {
          actorId,
          action: 'RESET_TRANSACTIONAL_DATA',
          entityType: 'SYSTEM',
          entityId: 'ALL',
          afterState: {
            deletedAppointments: deletedAppointments.count,
            deletedInvoices: deletedInvoices.count,
            deletedPaymentReceipts: deletedPaymentReceipts.count,
            deletedAdmissions: deletedAdmissions.count,
            deletedSelfPayEncounters: deletedSelfPayEncounters.count,
            deletedPanelPatients: deletedPanelPatients.count,
            resetBedsCount: updatedBeds.count,
          },
        },
      });

      return {
        success: true,
        summary: {
          appointments: deletedAppointments.count,
          invoices: deletedInvoices.count,
          invoiceLines: deletedInvoiceLines.count,
          paymentReceipts: deletedPaymentReceipts.count,
          userCashBalances: deletedUserCashBalances.count,
          accountSettlements: deletedAccountSettlements.count,
          admissions: deletedAdmissions.count,
          selfPayEncounters: deletedSelfPayEncounters.count,
          panelPatients: deletedPanelPatients.count,
          pharmacyClearances: deletedPharmacyClearances.count,
          pharmacyDispenses: deletedPharmacyDispenses.count,
          pharmacyDispenseLines: deletedPharmacyDispenseLines.count,
          resetBeds: updatedBeds.count,
        },
      };
    });
  },
};
