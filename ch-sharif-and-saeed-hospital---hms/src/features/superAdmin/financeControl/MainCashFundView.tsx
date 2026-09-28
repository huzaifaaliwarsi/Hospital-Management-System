import React, { useState } from 'react';
import { Landmark, ArrowDownCircle, ArrowUpCircle, Loader2 } from 'lucide-react';
import { GenericReportView, ReportDatePreset } from '../../../components/reports/GenericReportView';
import { Modal } from '../../../components/common/Modal';
import { CurrencyInput, Textarea } from '../../../components/forms/FormControls';
import { useReportFilters, FilterSelect, opts } from '../../../components/reports/reportFilters';
import { useToast } from '../../../context/ToastContext';
import { formatAmount, formatPKR } from '../../../utils/formatters';
import {
  fetchMainFundSummary,
  fetchMainFundEntries,
  depositMainFund,
  withdrawMainFund,
  MainFundEntry,
  MainFundEntryType,
} from '../../../services/financeControlService';

const TYPE_LABEL: Record<MainFundEntryType, string> = {
  DEPOSIT: 'Deposit',
  WITHDRAWAL: 'Withdrawal',
  PETTY_CASH_ISSUE: 'Petty Cash Issued',
  SETTLEMENT_RETURN: 'Settlement Handover',
};

const TYPE_OPTIONS = opts(
  ['DEPOSIT', 'Deposit'],
  ['WITHDRAWAL', 'Withdrawal'],
  ['PETTY_CASH_ISSUE', 'Petty Cash Issued'],
  ['SETTLEMENT_RETURN', 'Settlement Handover'],
);

type TxKind = 'deposit' | 'withdraw' | null;

const emptyForm = { amount: '', note: '' };

/**
 * Main Cash Fund — the hospital's central physical cash reserve that
 * Super Admin deposits into (from the bank) and petty cash is issued FROM.
 * Every "Issue Petty Cash" action (Finance Control → Petty Cash Issuance)
 * automatically debits this fund; this screen is its own ledger/statement,
 * same reporting-table pattern as every other Finance Control screen.
 */
export const MainCashFundView: React.FC = () => {
  const toast = useToast();
  const { filters, bind, reset } = useReportFilters({ type: '' });
  const [refreshKey, setRefreshKey] = useState(0);
  const reload = () => setRefreshKey((k) => k + 1);

  const [txKind, setTxKind] = useState<TxKind>(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [liveBalance, setLiveBalance] = useState<number | null>(null);

  const openTx = (kind: TxKind) => {
    setTxKind(kind);
    setForm(emptyForm);
    setFormError(null);
  };

  const submitTx = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return setFormError('Enter an amount greater than zero.');
    if (!form.note.trim()) return setFormError('Note is required.');

    setIsSaving(true);
    try {
      const payload = { amount, note: form.note.trim() };
      if (txKind === 'deposit') {
        await depositMainFund(payload);
        toast.success(`${formatPKR(amount)} deposited into the Main Cash Fund.`, 'Deposit Recorded');
      } else {
        await withdrawMainFund(payload);
        toast.success(`${formatPKR(amount)} withdrawn from the Main Cash Fund.`, 'Withdrawal Recorded');
      }
      setTxKind(null);
      reload();
    } catch (err: any) {
      setFormError(err?.message || 'Failed to record transaction.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <>
      <GenericReportView<MainFundEntry>
        key={refreshKey}
        title="Main Cash Fund"
        subtitle="Hospital's central physical cash reserve — deposit from the bank, an accepted Account Settlement hands cash back in, and every petty cash issuance is debited from here automatically."
        icon={Landmark}
        filenamePrefix="Main_Cash_Fund"
        allTimeOption
        showKpis
        headerActions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openTx('withdraw')}
              className="h-9 px-4 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <ArrowUpCircle className="h-4 w-4 text-rose-600" /> Withdraw
            </button>
            <button
              type="button"
              onClick={() => openTx('deposit')}
              className="h-9 px-4 rounded-lg bg-[#08775A] hover:bg-[#065f46] text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <ArrowDownCircle className="h-4 w-4" /> Deposit Funds
            </button>
          </div>
        }
        fetchReport={async (range: { preset: ReportDatePreset; fromDate?: string; toDate?: string }) => {
          const [summary, ledger] = await Promise.all([
            fetchMainFundSummary(),
            fetchMainFundEntries(range, (filters.type as MainFundEntryType) || undefined),
          ]);
          setLiveBalance(summary.currentBalance);

          let periodDeposited = 0;
          let periodIssued = 0;
          let periodWithdrawn = 0;
          let periodSettlementReturns = 0;
          for (const r of ledger.rows) {
            if (r.type === 'DEPOSIT') periodDeposited += r.amount;
            else if (r.type === 'PETTY_CASH_ISSUE') periodIssued += r.amount;
            else if (r.type === 'WITHDRAWAL') periodWithdrawn += r.amount;
            else if (r.type === 'SETTLEMENT_RETURN' && r.direction === 'IN') periodSettlementReturns += r.amount;
          }

          return {
            periodLabel: ledger.periodLabel,
            kpis: [
              { label: 'Current Balance (Live)', value: formatPKR(summary.currentBalance), accent: summary.currentBalance > 0 ? 'positive' : 'default' },
              { label: 'Deposited (Period)', value: formatPKR(periodDeposited), accent: 'positive' },
              { label: 'Returned via Settlement (Period)', value: formatPKR(periodSettlementReturns), accent: 'positive' },
              { label: 'Issued as Petty Cash (Period)', value: formatPKR(periodIssued), accent: 'negative' },
              { label: 'Withdrawn (Period)', value: formatPKR(periodWithdrawn), accent: 'warning' },
            ],
            rows: ledger.rows,
          };
        }}
        onResetExtraFilters={reset}
        extraFilters={<FilterSelect label="Type" options={TYPE_OPTIONS} {...bind('type')} />}
        rowKey={(r) => r.id}
        emptyMessage="No Main Fund transactions for these filters."
        columns={[
          { header: 'Date', cell: (r) => r.occurredAt },
          { header: 'Type', cell: (r) => TYPE_LABEL[r.type] },
          { header: 'Direction', cell: (r) => (r.direction === 'IN' ? 'IN' : 'OUT') },
          { header: 'Amount (PKR)', align: 'right', cell: (r) => formatAmount(r.amount), excelValue: (r) => r.amount },
          { header: 'Note', cell: (r) => r.note || '—' },
          { header: 'Performed By', cell: (r) => `${r.performedByUser.fullName}` },
        ]}
        renderCell={(col, row) => {
          if (col.header === 'Direction') {
            return row.direction === 'IN' ? (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border bg-emerald-50 text-emerald-700 border-emerald-200">
                <ArrowDownCircle className="h-3 w-3" /> IN
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10.5px] font-bold border bg-rose-50 text-rose-700 border-rose-200">
                <ArrowUpCircle className="h-3 w-3" /> OUT
              </span>
            );
          }
          if (col.header === 'Amount (PKR)') {
            return <span className={row.direction === 'IN' ? 'text-emerald-700' : 'text-rose-700'}>{row.direction === 'IN' ? '+' : '-'}{formatAmount(row.amount)}</span>;
          }
          return col.cell(row);
        }}
      />

      {/* Deposit / Withdraw */}
      <Modal
        isOpen={txKind !== null}
        onClose={() => !isSaving && setTxKind(null)}
        title={txKind === 'deposit' ? 'Deposit Funds' : 'Withdraw Funds'}
        subtitle={
          txKind === 'deposit'
            ? 'Money brought into the Main Cash Fund (e.g. a bank withdrawal into hospital cash reserve).'
            : `Money taken back out of the fund. Current balance: ${liveBalance != null ? formatPKR(liveBalance) : '—'}.`
        }
        maxWidth="sm"
      >
        <form onSubmit={submitTx} className="space-y-4">
          <CurrencyInput
            label="Amount (PKR)"
            required
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
            min={1}
          />
          <Textarea
            label="Note"
            required
            rows={3}
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
            placeholder={txKind === 'deposit' ? 'e.g. Weekly bank withdrawal for hospital cash reserve' : 'e.g. Surplus cash banked back'}
          />

          {formError && (
            <div className="px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium">{formError}</div>
          )}

          <div className="pt-3 border-t border-slate-100 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setTxKind(null)}
              disabled={isSaving}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg disabled:opacity-60 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`px-4 py-2 text-white text-xs font-semibold rounded-lg shadow-xs disabled:opacity-60 cursor-pointer flex items-center gap-1.5 ${
                txKind === 'deposit' ? 'bg-[#08775A] hover:bg-[#065f46]' : 'bg-rose-600 hover:bg-rose-700'
              }`}
            >
              {isSaving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              <span>{isSaving ? 'Saving…' : txKind === 'deposit' ? 'Deposit Funds' : 'Confirm Withdrawal'}</span>
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};
