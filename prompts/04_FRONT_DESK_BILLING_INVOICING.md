# PHASE 4: Front Desk Billing, Appointments & Doctor Share Calculation Engine

```markdown
TASK: Build Front Desk Billing, Appointments, and Invoicing Calculation Engine

Context:
Refer to '16 Client.pdf' Section 7, 8, 22, 35. Front Desk is the ONLY portal collecting hospital patient cash.

Instructions:
1. Appointments Flow:
   - POST /api/v1/appointments: Book appointment for panel or self-pay.
   - POST /api/v1/appointments/:id/advance: Collect advance payment; generates receipt linked to current cashier.
   - POST /api/v1/appointments/:id/check-in: Converts appointment to active OPD/Observation/Emergency encounter.
2. Invoicing & Doctor Commission Calculation Engine:
   - Formula:
     Net Service Amount = Gross Service Amount - Approved Discount
     Doctor Commission = Net Eligible Service Amount * Doctor Commission % (or fixed rate)
     Hospital Remaining Share = Net Service Amount - Doctor Commission
   - Automatically apply Panel discount rules if panel patient.
   - Require Admin approval if discount exceeds threshold.
3. Receipts & Cashier Updates:
   - Adjust prior advance payment against final hospital invoice.
   - Cash payments automatically update current cashier's UserCashBalance.
   - Digital/POS payments tracked separately without inflating physical cash.
   - Refunds and adjustments must link back to original invoice with audit trail (no silent deletion).
```
