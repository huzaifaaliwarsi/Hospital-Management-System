import React, { useState } from 'react';
import { Landmark, ArrowDownCircle, ArrowUpCircle, Loader2, AlertCircle } from 'lucide-react';
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

  const handleAmountChange = (val: string) => {
    setForm((f) => ({ ...f, amount: val }));
    if (formError) setFormError(null);
  };

  const handleNoteChange = (val: string) => {
    setForm((f) => ({ ...f, note: val }));
    if (formError) setFormError(null);
  };

  const addQuickAmount = (delta: number) => {
    const current = Number(form.amount) || 0;
    const next = current + delta;
    setForm((f) => ({ ...f, amount: String(next) }));
    if (formError) setFormError(null);
  };

  const submitTx = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    const amount = Number(form.amount);
    if (!amount || amount <= 0) return setFormError('Please enter a valid amount greater than zero.');
    if (!form.note.trim()) return setFormError('Audit note is required (enter description or bank slip reference).');
    if (txKind === 'withdraw' && liveBalance != null && amount > liveBalance) {
      return setFormError(`Insufficient funds: withdrawal amount (${formatPKR(amount)}) exceeds current balance (${formatPKR(liveBalance)}).`);
    }

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
          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={() => openTx('withdraw')}
              className="h-9 px-4 rounded-xl bg-white border border-rose-200/90 hover:bg-rose-50/70 hover:border-rose-300 text-rose-700 text-xs font-bold inline-flex items-center gap-2 shadow-2xs hover:shadow-xs active:scale-[0.98] transition-all cursor-pointer"
            >
              <ArrowUpCircle className="h-4 w-4 text-rose-600" />
              <span>Withdraw</span>
            </button>
            <button
              type="button"
              onClick={() => openTx('deposit')}
              className="h-9 px-4.5 rounded-xl bg-gradient-to-r from-[#08775A] to-[#0d946d] hover:from-[#065f46] hover:to-[#08775A] text-white text-xs font-bold inline-flex items-center gap-2 shadow-xs hover:shadow-sm active:scale-[0.98] transition-all cursor-pointer"
            >
              <ArrowDownCircle className="h-4 w-4" />
              <span>Deposit Funds</span>
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

      {/* Deposit / Withdraw Modal */}
      <Modal
        isOpen={txKind !== null}
        onClose={() => !isSaving && setTxKind(null)}
        title={txKind === 'deposit' ? 'Deposit Funds into Main Cash' : 'Withdraw Funds from Main Cash'}
        subtitle={
          txKind === 'deposit'
            ? 'Record physical bank cash withdrawal deposited into the hospital central cash reserve.'
            : 'Record physical cash withdrawal from the central reserve back to bank or emergency reserve.'
        }
        maxWidth="md"
      >
        <form onSubmit={submitTx} className="space-y-4 sm:space-y-5">
          {/* Reserve Balance Callout Banner */}
          <div className="flex items-center justify-between p-3.5 rounded-xl border border-slate-200/90 bg-gradient-to-r from-slate-50 to-slate-100/60 shadow-2xs">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-2xs flex items-center justify-center text-[#08775A]">
                <Landmark className="w-5 h-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                  Current Main Cash Fund Balance
                </p>
                <p className="text-base font-extrabold text-slate-900 font-mono tracking-tight">
                  {liveBalance != null ? formatPKR(liveBalance) : 'PKR 0'}
                </p>
              </div>
            </div>
            <span className="text-[10.5px] font-bold px-2.5 py-1 rounded-full border bg-emerald-50 text-emerald-700 border-emerald-200/80 shadow-2xs">
              Live Vault
            </span>
          </div>

          {/* Amount Section */}
          <div className="space-y-2">
            <CurrencyInput
              label="Amount (PKR)"
              required
              value={form.amount}
              onChange={(e) => handleAmountChange(e.target.value)}
              min={1}
              autoFocus
            />

            {/* Quick Amount Chips */}
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              <span className="text-[11px] font-medium text-slate-400 mr-1">Quick add:</span>
              {[5000, 10000, 25000, 50000, 100000, 500000].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => addQuickAmount(amt)}
                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-[#effaf5] hover:text-[#08775A] hover:border-[#c2e7db] text-slate-600 border border-slate-200/80 transition-all cursor-pointer shadow-2xs active:scale-95"
                >
                  +{amt >= 100000 ? `${amt / 100000} Lakh` : `${amt / 1000}k`}
                </button>
              ))}
              {form.amount && Number(form.amount) > 0 && (
                <button
                  type="button"
                  onClick={() => handleAmountChange('')}
                  className="px-2 py-1 rounded-lg text-[11px] font-medium text-slate-400 hover:text-rose-600 transition-colors cursor-pointer"
                >
                  Clear
                </button>
              )}
            </div>

            {/* Formatted Amount Display */}
            {form.amount && Number(form.amount) > 0 && (
              <div className="flex items-center justify-between text-xs px-3 py-1.5 rounded-lg bg-emerald-50/60 border border-emerald-100 text-emerald-800 animate-in fade-in">
                <span className="font-medium text-slate-600">Total Transaction Value:</span>
                <span className="font-extrabold font-mono text-emerald-800 text-sm">
                  {formatPKR(Number(form.amount))}
                </span>
              </div>
            )}
          </div>

          {/* Note Section */}
          <div className="space-y-1">
            <Textarea
              label="Audit Note & Reference"
              required
              rows={3}
              value={form.note}
              onChange={(e) => handleNoteChange(e.target.value)}
              placeholder={
                txKind === 'deposit'
                  ? 'e.g. Bank withdrawal slip #BR-4921 / replenishment for hospital physical cash reserve'
                  : 'e.g. Surplus cash banked into Hospital Current Account #9821'
              }
            />
            <p className="text-[11px] text-slate-400">
              Provide a clear description or bank slip reference for accounting audit verification.
            </p>
          </div>

          {/* Error Banner */}
          {formError && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold animate-in fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{formError}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setTxKind(null)}
              disabled={isSaving}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl transition-colors disabled:opacity-60 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className={`px-5 py-2 text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md disabled:opacity-60 cursor-pointer flex items-center gap-2 transition-all active:scale-95 ${
                txKind === 'deposit'
                  ? 'bg-gradient-to-r from-[#08775A] to-[#0a8d6b] hover:from-[#065f46] hover:to-[#08775A]'
                  : 'bg-gradient-to-r from-rose-600 to-rose-700 hover:from-rose-700 hover:to-rose-800'
              }`}
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Recording…</span>
                </>
              ) : txKind === 'deposit' ? (
                <>
                  <ArrowDownCircle className="h-4 w-4" />
                  <span>Confirm Deposit</span>
                </>
              ) : (
                <>
                  <ArrowUpCircle className="h-4 w-4" />
                  <span>Confirm Withdrawal</span>
                </>
              )}
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
};
