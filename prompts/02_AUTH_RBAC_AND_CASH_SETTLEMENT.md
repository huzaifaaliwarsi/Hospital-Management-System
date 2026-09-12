# PHASE 2: Authentication, Protected Account Governance & Cashier Account Settlement

```markdown
TASK: Implement Authentication, Protected Account Governance, and Universal User Cash Settlement API

Context:
Per '16 Client.pdf', two critical financial and security rules must be strictly enforced on backend:
1. Protected Governance: Admin cannot edit, demote, delete, or reset password of Super Admin.
2. Universal Cash Accountability: Admission portal never receives cash. Every cash user (Billing, funded Inventory, Pharmacy cashier) has their own UserCashBalance and submits their own AccountSettlement.

Instructions:
1. Implement JWT Auth:
   - POST /api/v1/auth/login (Validate role against allowed portal)
   - GET /api/v1/auth/me
   - POST /api/v1/auth/refresh
2. Create Middleware:
   - authenticate: Verify JWT Bearer token and attach currentUser to req.user.
   - authorizeRoles(...roles): Restrict routes strictly by role enum.
3. In User Management controller, enforce protected account rules:
   - If requesting user role is ADMIN and target user is SUPER_ADMIN -> return 403 Forbidden.
   - Super Admin cannot delete their own currently logged-in account or delete the last remaining Super Admin.
4. Universal Cash Accountability Endpoints:
   - GET /api/v1/finance/my-balance-sheet:
     Returns logged-in cashier's opening float, cash collections, advances received, cash refunds, and authorized petty cash expenses.
     Calculates Expected Physical Cash = Opening Float + Collections - Refunds - Expenses.
   - POST /api/v1/finance/settlements/submit:
     Cashier submits physical cash count and remarks.
     System calculates Variance = Physical Cash - Expected Cash.
     Locks included transactions from being submitted again in another settlement.
   - GET /api/v1/finance/settlements/pending:
     For Super Admin / Admin to review submitted settlements.
   - POST /api/v1/finance/settlements/:id/action:
     Reviewer accepts, partially accepts, or returns settlement. Acceptance transfers custody of cash.
```
