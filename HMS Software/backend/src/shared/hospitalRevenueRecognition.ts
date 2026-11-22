/** The existing M04 recognition rule, shared by Hospital earnings reports.
 * Patient billing and collection allocation deliberately retain all streams.
 */
export const financialDepartmentSelect = { id: true, name: true, fulfillmentOwnership: true } as const;

type Department = { id: string; name: string; fulfillmentOwnership?: string };
type Invoice = {
  status: string;
  department?: Department | null;
  appointment?: { department?: Department | null } | null;
  admissionRecord?: { department?: Department | null } | null;
};
type Line = {
  billingSource: string;
  isCompleted: boolean;
  serviceRate?: { providerType?: string; department?: Department | null } | null;
};

export function hospitalServiceDepartment(line: Line, invoice: Invoice) {
  return line.serviceRate?.department ?? invoice.department ?? invoice.appointment?.department ?? invoice.admissionRecord?.department;
}

export function isOutsourcedService(line: Line, invoice: Invoice): boolean {
  return hospitalServiceDepartment(line, invoice)?.fulfillmentOwnership === 'OUTSOURCED'
    || line.serviceRate?.providerType === 'OUTSOURCED'
    || line.billingSource === 'OUTSOURCED_SERVICE';
}

export function isInternalHospitalEarning(line: Line, invoice: Invoice): boolean {
  return invoice.status !== 'VOID' && line.isCompleted === true
    && line.billingSource !== 'PHARMACY' && !isOutsourcedService(line, invoice);
}
