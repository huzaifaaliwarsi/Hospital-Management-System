# PHASE 6: General Inventory & Standalone Pharmacy Integration Engine

```markdown
TASK: Implement General Inventory Ledgers and Standalone Pharmacy Integration

Context:
Refer to '16 Client.pdf' Sections 13, 14, 16, 17, 33, 34.
HMS Inventory is non-medicine; Standalone Pharmacy owns medicine stock and FEFO dispensing.

Instructions:
1. General Inventory:
   - Supplier Master & Supplier Ledger (track purchases, returns, payments, credits, outstanding).
   - Fund Request: Inventory staff requests petty cash advance -> Admin approves -> credited to user cash balance.
   - Purchase/Receipt: Posts stock IN into StockLedger; cash payment reduces user cash balance.
   - Department Issue/Return: Requisition -> Issue stock -> Deduct StockLedger with department tag.
2. Standalone Pharmacy Integration:
   - Medicine Master, Batches, Expiry, Cost, Sale Price.
   - FEFO Engine: Auto-allocate nearest non-expired batch upon dispensing.
   - Dispensing: Retail walk-in sale + HMS Inpatient Request queue.
   - Dispensing creates Pharmacy Invoice and updates Pharmacy Clearance callback to HMS Admission.
```
