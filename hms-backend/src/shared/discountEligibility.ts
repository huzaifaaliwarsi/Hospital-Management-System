/**
 * Front Desk discretionary discounts are strictly restricted to Hospital
 * Services — Outsourced Lab / Radiology / Pharmacy charges can never be
 * discounted this way (those departments bill the hospital at cost; a
 * discount here would just move the loss onto the hospital's margin on
 * someone else's service). Shared by `invoices.service.ts` (OPD/encounter
 * invoices) and `admissionBilling.service.ts` (admission invoices) so the
 * eligibility rule can't drift between the two call sites.
 */
export function isEligibleHospitalService(serviceRate: any): boolean {
  if (!serviceRate) return true;
  if (serviceRate.discountAllowed === false) return false;
  if (serviceRate.serviceStream === 'LAB') return false;

  const cat = (serviceRate.category || '').toLowerCase();
  if (
    cat.includes('lab') ||
    cat.includes('pathology') ||
    cat.includes('pharmacy') ||
    cat.includes('radiology') ||
    cat.includes('diagnostic')
  ) {
    return false;
  }

  const dept = serviceRate.department;
  if (dept) {
    if (dept.fulfillmentOwnership === 'OUTSOURCED') return false;
    if (Boolean(dept.outsourcedProviderId)) return false;
    if (dept.pharmacyRelated) return false;
    const deptName = (dept.name || '').toLowerCase();
    const deptCode = (dept.code || '').toLowerCase();
    if (
      deptName.includes('lab') ||
      deptName.includes('pathology') ||
      deptName.includes('pharmacy') ||
      deptName.includes('radiology') ||
      deptName.includes('imaging') ||
      deptCode.includes('lab') ||
      deptCode.includes('pharm') ||
      deptCode.includes('rad')
    ) {
      return false;
    }
  }

  return true;
}

export const DISCOUNT_APPROVAL_PERCENT_THRESHOLD = 15; // > 15% requires Admin approval
export const DISCOUNT_APPROVAL_AMOUNT_THRESHOLD = 1500; // > PKR 1,500 requires Admin approval
