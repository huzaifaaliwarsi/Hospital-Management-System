# PHASE 5: Inpatient Admission, Bed Lifecycle & Dual Clearance Discharge Workflow

```markdown
TASK: Implement Inpatient Admission (IPD), Bed Allocation, and Dual Clearance Discharge

Context:
Refer to '16 Client.pdf' Sections 9, 10, 11, 12, 13, 23.
Crucial: Admission NEVER collects cash. Final discharge requires Dual Clearance.

Instructions:
1. Planned Admission & Billing Hand-off:
   - POST /api/v1/admissions/planned: Create planned admission.
   - POST /api/v1/admissions/:id/request-advance: Sends payment request to Billing queue. Admission reads status as "Advance Received" but never handles cash.
2. Bed Lifecycle:
   - POST /api/v1/admissions/:id/check-in: Assign bed -> Bed status becomes Occupied.
   - POST /api/v1/admissions/:id/bed-transfer: Transfer patient bed; log from_bed, to_bed, timestamp, actor.
   - POST /api/v1/admissions/:id/add-service: Append running hospital services and bed day charges.
3. Medication Mode:
   - POST /api/v1/admissions/:id/medication-mode: Toggle SELF vs HOSPITAL_MANAGED with reason and actor.
   - In HOSPITAL_MANAGED mode, allow sending medicine requests to Standalone Pharmacy queue.
4. Dual Clearance Discharge Gate:
   - Clinical Ready = Doctor clinical sign-off.
   - Hospital Clearance = Billing confirms all hospital bills paid.
   - Pharmacy Clearance = Pharmacy confirms all medicine dues cleared.
   - POST /api/v1/admissions/:id/discharge: Allowed ONLY when all 3 clearances are approved. Automatically frees bed to Available.
```
