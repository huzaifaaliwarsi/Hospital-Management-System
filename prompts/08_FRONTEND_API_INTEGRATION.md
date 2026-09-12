# PHASE 8: Frontend Refactoring (Removing LocalStorage & Connecting Real Express APIs)

```markdown
TASK: Refactor React Frontend to Remove LocalStorage Mock Data and Connect to Live Express Backend

Context:
Frontend in 'ch-sharif-and-saeed-hospital---hms' uses localStorage (hms_patient_registry_v1, etc.) and ModulePlaceholderView.
Connect it to the backend running at http://localhost:5000/api/v1.

Instructions:
1. Create Axios client in src/services/api/apiClient.ts:
   - Base URL from VITE_API_URL or http://localhost:5000/api/v1.
   - Request interceptor: Attach JWT Bearer token from AuthContext.
   - Response interceptor: Handle 401 (redirect to /login), 403, and toast notifications.
2. Refactor services in src/services/:
   - Replace adminUserService.ts, patientRegistryService.ts, departmentService.ts, etc., with real async HTTP calls.
   - Remove hardcoded mock arrays and localStorage keys.
3. Replace ModulePlaceholderView.tsx with real working components:
   - Front Desk Invoicing & Payment Collection screen.
   - Cashier Balance Sheet & Account Settlement modal.
   - Admission Bed Allocation & Dual Clearance screen.
   - Inventory Requisition & Stock Ledger screen.
   - Standalone Pharmacy Queue & Dispensing screen.
```
