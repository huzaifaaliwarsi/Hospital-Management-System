# PHASE 7: Biometric Attendance, Salary Payroll & Doctor Commission Engines

```markdown
TASK: Implement Attendance Normalization, Staff Salary Payroll, and Doctor Commission Streams

Context:
Refer to '16 Client.pdf' Sections 18, 19, 20, 21, 25, 26, 35.
Crucial: Salary Payroll (attendance-driven) and Doctor Commission (service-driven) are independent liabilities!

Instructions:
1. Biometric Attendance Engine:
   - POST /api/v1/attendance/punch-ingest: Receive raw device punch logs (API, SDK, or CSV/Excel import).
   - Map punches against assigned shift (grace period, late-in, early-exit, absent).
   - Admin Attendance Correction: PUT /api/v1/attendance/:id/correct (log original, corrected, reason, user).
2. Salary Payroll Engine:
   - Formula:
     Generated Salary = Base Salary + Approved Allowances - Attendance Deductions - Other Deductions +/- Adjustments
   - Lifecycle: Generated -> Approved -> Paid (Full, Partial, or Later).
3. Doctor Commission Engine:
   - Accrues from completed eligible service lines.
   - Single-inclusion rule: A service line can only be included in ONE generated commission statement.
   - Generation -> Approval -> Independent payout and outstanding tracking.
```
