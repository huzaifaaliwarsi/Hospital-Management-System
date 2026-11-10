import React, { useState } from 'react';
import { Wallet, Loader2, AlertTriangle, Send, ShieldAlert } from 'lucide-react';
import { GenericReportView, ReportDatePreset } from '../../../components/reports/GenericReportView';
import { Modal } from '../../../components/common/Modal';
import { SearchableSelect, Select, CurrencyInput, Textarea } from '../../../components/forms/FormControls';
import { useFilterOptions } from '../../../components/reports/reportFilters';
import { useToast } from '../../../context/ToastContext';
import { formatAmount, formatPKR } from '../../../utils/formatters';
import {
  fetchCashCustodyOverview,
  fetchIssuablePettyCashUsers,
  issuePettyCash,
  type CashCustodySheet,
  type FinanceUserSummary,
  type PettyCashIssueType,
} from '../../../services/financeControlService';

const ROLE_LABEL: Record<string, string> = {
  INVENTORY_MANAGEMENT: 'Inventory Store Manager',
  FRONT_DESK_BILLING: 'Front Desk Cashier',
};

const ISSUE_TYPE_OPTIONS: { value: PettyCashIssueType; label: string }[] = [
  { value: 'OPENING_FLOAT', label: 'Opening Float — first cash handed to this user' },
  { value: 'TOP_UP', label: 'Top-Up — additional cash on top of an existing float' },
];

const emptyForm = { portalUserId: '', amount: '', issueType: 'OPENING_FLOAT' as PettyCashIssueType, note: '' };

/**
 * Super Admin "Petty Cash Issuance & Management" (Finance Control) —
 * issues an opening float / top-up to a cash-handling staff user and shows
 * every such user's live physical cash-in-hand, total issued, total spent,
 * and carry-forward liability. Same reporting-table pattern as every other
 * Finance Control screen (`GenericReportView`) — no mock data, every figure
 * traces to a real `UserCashBalance` row (`financeControl.service.ts`).
 * The cash issued here is debited from the Main Cash Fund screen alongside
 * this one (Finance Control → Main Cash Fund).
 */
export const PettyCashIssuanceView: React.FC = () => {
  const toast = useToast();
  const issuableUsers = useFilterOptions(fetchIssuablePettyCashUsers, [] as FinanceUserSummary[]);
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = () => setRefreshKey((k) => k + 1);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openModal = () => {
    setForm(emptyForm);
    setFormError(null);
    setIsModalOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!form.portalUserId) return setFormError('Select the staff user to receive petty cash.');
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return setFormError('Enter an amount greater than zero.');
    if (!form.note.trim()) return setFormError('Purpose / note is required.');

    setIsSubmitting(true);
    try {
      await issuePettyCash({ portalUserId: form.portalUserId, amount, issueType: form.issueType, note: form.note.trim() });
      const recipient = issuableUsers.find((u) => u.id === form.portalUserId);
      toast.success(`${formatPKR(amount)} issued to ${recipient?.fullName || 'staff user'}.`, 'Petty Cash Issued');
      setIsModalOpen(false);
      reload();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to issue petty cash.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const userOptions = issuableUsers.map((u) => ({ value: u.id, label: `${u.fullName} (${ROLE_LABEL[u.role] || u.role})` }));

  return (
    <>
      <GenericReportView<CashCustodySheet>
        key={refreshKey}
        title="Petty Cash Issuance & Management"
        subtitle="Issue opening floats / top-ups and track live cash custody across Inventory and Front Desk."
        icon={Wallet}
        filenamePrefix="Petty_Cash_Custody"
        allTimeOption
        showKpis
        headerActions={
          <button
            type="button"
            onClick={openModal}
            disabled={issuableUsers.length === 0}
            className="h-9 px-4 rounded-lg bg-[#08775A] hover:bg-[#065f46] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-60"
            title={issuableUsers.length === 0 ? 'No eligible staff users found' : undefined}
          >
            <Send className="h-4 w-4" /> Issue Petty Cash
          </button>
        }
        fetchReport={async (range: { preset: ReportDatePreset; fromDate?: string; toDate?: string }) => {
          const overview = await fetchCashCustodyOverview(range);
          const totals = overview.sheets.reduce(
            (acc, s) => ({
              physicalCashInHand: acc.physicalCashInHand + s.physicalCashInHand,
              pettyCashIssued: acc.pettyCashIssued + s.pettyCashIssued,
              cashExpenses: acc.cashExpenses + s.cashExpenses,
              carriedForwardAmount: acc.carriedForwardAmount + s.carriedForwardAmount,
            }),
            { physicalCashInHand: 0, pettyCashIssued: 0, cashExpenses: 0, carriedForwardAmount: 0 },
          );
          return {
            periodLabel: overview.period.label,
            kpis: [
              { label: 'Physical Cash-in-Hand', value: formatPKR(totals.physicalCashInHand), accent: 'default' as const },
              { label: 'Total Issued', value: formatPKR(totals.pettyCashIssued), accent: 'positive' as const },
              { label: 'Total Spent', value: formatPKR(totals.cashExpenses), accent: 'negative' as const },
              { label: 'Carry-Forward Liability', value: formatPKR(totals.carriedForwardAmount), accent: 'warning' as const },
            ],
            rows: overview.sheets,
          };
        }}
        rowKey={(r) => r.portalUserId}
        emptyMessage="No cash custody activity yet — issue petty cash to an Inventory Store Manager or Front Desk Cashier to see it here."
        columns={[
          { header: 'Staff User', cell: (r) => r.user.fullName },
          { header: 'Role', cell: (r) => ROLE_LABEL[r.user.role] || r.user.role },
          { header: 'Physical Cash-in-Hand', align: 'right', cell: (r) => formatAmount(r.physicalCashInHand), excelValue: (r) => r.physicalCashInHand },
          { header: 'Total Issued', align: 'right', cell: (r) => formatAmount(r.pettyCashIssued), excelValue: (r) => r.pettyCashIssued },
          { header: 'Total Spent', align: 'right', cell: (r) => formatAmount(r.cashExpenses), excelValue: (r) => r.cashExpenses },
          { header: 'Carry-Forward Liability', align: 'right', cell: (r) => formatAmount(r.carriedForwardAmount), excelValue: (r) => r.carriedForwardAmount },
          { header: 'Unsettled', align: 'center', cell: (r) => String(r.unsettledCount) },
        ]}
        noTotalColumns={['Unsettled']}
        renderCell={(col, row) => {
          if (col.header === 'Unsettled') {
            return row.unsettledCount > 0 ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 font-bold text-[10px]">
                <ShieldAlert className="h-3 w-3" /> {row.unsettledCount}
              </span>
            ) : (
              <span className="text-slate-300">—</span>
            );
          }
          return col.cell(row);
        }}
      />

      {/* Issue Petty Cash Modal */}
      <Modal
        isOpen={isModalOpen}
        onClose={() => !isSubmitting && setIsModalOpen(false)}
        title="Issue Petty Cash"
        subtitle="Credits the recipient's own cash custody and debits the Main Cash Fund — appears on their Balance Sheet immediately."
        maxWidth="md"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <SearchableSelect
            label="Target Staff User"
            required
            options={userOptions}
            value={form.portalUserId}
            onChange={(val) => setForm((f) => ({ ...f, portalUserId: val }))}
            placeholder="Search Inventory / Front Desk staff…"
          />
          <CurrencyInput
            label="Amount (PKR)"
            required
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            min={1}
          />
          <Select
            label="Category"
            required
            options={ISSUE_TYPE_OPTIONS}
            value={form.issueType}
            onChange={(e) => setForm((f) => ({ ...f, issueType: e.target.value as PettyCashIssueType }))}
          />
          <Textarea
            label="Purpose / Note"
            required
            rows={3}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder="e.g. Weekly opening float for Central Store"
          />

          {formError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">
              <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
              <span>{formError}</span>
            </div>
          )}

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              disabled={isSubmitting}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg disabled:opacity-60 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-[#149E75] hover:bg-[#08775A] text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-60 cursor-pointer flex items-center gap-1.5"
            >
              {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isSubmitting ? 'Issuing…' : 'Issue Petty Cash'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};
