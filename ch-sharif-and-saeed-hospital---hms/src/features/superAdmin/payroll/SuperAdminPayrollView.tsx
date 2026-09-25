import React, { useState, useEffect, useMemo } from 'react';
import {
  Wallet,
  Loader2,
  CheckCircle2,
  ClipboardList,
  History,
  PlayCircle,
  Banknote,
} from 'lucide-react';
import {
  previewPayrollRun,
  generatePayrollRun,
  listPayrollRuns,
  getPayrollRun,
  approvePayrollRun,
  paySalarySlip,
} from '../../../services/payrollService';
import { fetchDepartments } from '../../../services/departmentService';
import { Department } from '../../../types/department';
import { PayrollFilters, PayrollPeriodType, PayrollPreview, PayrollRun, SalarySlip } from '../../../types/payroll';
import { STAFF_CATEGORIES, SALARY_BASIS_OPTIONS } from '../../../types/staffUser';
import { useToast } from '../../../context/ToastContext';
import { formatPKR } from '../../../utils/formatters';
import { formatDisplayDate } from '../../../utils/dateConstants';

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}
function firstOfMonthISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
}

const STATUS_STYLES: Record<string, string> = {
  DRAFT: 'bg-slate-100 text-slate-600 border-slate-200',
  GENERATED: 'bg-amber-50 text-amber-800 border-amber-200',
  APPROVED: 'bg-blue-50 text-blue-700 border-blue-200',
  PARTIALLY_PAID: 'bg-purple-50 text-purple-700 border-purple-200',
  PAID: 'bg-[#e7f6f1] text-[#0e7d5a] border-[#c2e7db]',
};

export const SuperAdminPayrollView: React.FC = () => {
  const toast = useToast();
  const [tab, setTab] = useState<'generate' | 'runs'>('generate');
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null);

  useEffect(() => {
    fetchDepartments().then(setDepartments).catch(() => {});
  }, []);

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="h-10 w-10 rounded-xl bg-[#e7f6f1] text-[#129b70] flex items-center justify-center">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Salary Payroll</h1>
            <p className="text-xs text-slate-500">Attendance-driven, Daily/Monthly/Custom — every figure traces to a real Salary Profile and approved Attendance record.</p>
          </div>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-1">
          <button
            onClick={() => { setTab('generate'); setSelectedRunId(null); }}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${tab === 'generate' ? 'bg-white text-[#08775A] shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <PlayCircle className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" /> Generate Run
          </button>
          <button
            onClick={() => setTab('runs')}
            className={`px-3.5 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${tab === 'runs' ? 'bg-white text-[#08775A] shadow-xs' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <History className="h-3.5 w-3.5 inline mr-1.5 -mt-0.5" /> Runs &amp; Payments
          </button>
        </div>
      </div>

      {tab === 'generate' ? (
        <GenerateTab departments={departments} toast={toast} onGenerated={(id) => { setSelectedRunId(id); setTab('runs'); }} />
      ) : (
        <RunsTab departments={departments} toast={toast} selectedRunId={selectedRunId} setSelectedRunId={setSelectedRunId} />
      )}
    </div>
  );
};

const GenerateTab: React.FC<{ departments: Department[]; toast: ReturnType<typeof useToast>; onGenerated: (id: string) => void }> = ({ departments, toast, onGenerated }) => {
  const [periodType, setPeriodType] = useState<PayrollPeriodType>('MONTHLY');
  const [periodStart, setPeriodStart] = useState(firstOfMonthISO());
  const [periodEnd, setPeriodEnd] = useState(todayISO());
  const [departmentId, setDepartmentId] = useState('');
  const [category, setCategory] = useState('');
  const [preview, setPreview] = useState<PayrollPreview | null>(null);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);

  const filters: PayrollFilters = useMemo(() => ({
    periodType,
    periodStart,
    periodEnd,
    departmentId: departmentId || undefined,
    category: category || undefined,
  }), [periodType, periodStart, periodEnd, departmentId, category]);

  const handlePreview = async () => {
    setIsPreviewing(true);
    setPreview(null);
    try {
      const result = await previewPayrollRun(filters);
      setPreview(result);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to preview payroll.', 'Preview Error');
    } finally {
      setIsPreviewing(false);
    }
  };

  const handleGenerate = async () => {
    if (!preview || preview.eligible.length === 0) {
      toast.error('Run a preview first — nothing eligible to generate.', 'Nothing to Generate');
      return;
    }
    setIsGenerating(true);
    try {
      const run = await generatePayrollRun(filters);
      toast.success(`Payroll run generated for ${run.staffCount} staff member${run.staffCount === 1 ? '' : 's'}.`, 'Run Generated');
      onGenerated(run.id);
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to generate payroll run.', 'Generate Error');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-wrap items-end gap-3">
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Period Type</label>
          <select value={periodType} onChange={(e) => setPeriodType(e.target.value as PayrollPeriodType)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white">
            <option value="DAILY">Daily</option>
            <option value="MONTHLY">Monthly</option>
            <option value="CUSTOM">Custom</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">From</label>
          <input lang="en-GB" type="date" value={periodStart} onChange={(e) => setPeriodStart(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">To</label>
          <input lang="en-GB" type="date" value={periodEnd} onChange={(e) => setPeriodEnd(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white" />
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Department</label>
          <select value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white">
            <option value="">All Departments</option>
            {departments.filter((d) => d.status === 'Active').map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-[11px] font-semibold text-slate-600 mb-1">Category</label>
          <select value={category} onChange={(e) => setCategory(e.target.value)} className="px-3 py-1.5 border border-slate-200 rounded-lg text-xs bg-white">
            <option value="">All Categories</option>
            {STAFF_CATEGORIES.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        </div>
        <div className="flex-1" />
        <button
          type="button"
          onClick={handlePreview}
          disabled={isPreviewing}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-[#08775A] bg-[#e7f6f1] hover:bg-[#d0efe5] border border-[#c2e7db] rounded-lg cursor-pointer disabled:opacity-50"
        >
          {isPreviewing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ClipboardList className="h-3.5 w-3.5" />}
          Preview
        </button>
        <button
          type="button"
          onClick={handleGenerate}
          disabled={!preview || preview.eligible.length === 0 || isGenerating}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#149E75] hover:bg-[#08775A] rounded-lg shadow-xs cursor-pointer disabled:opacity-50"
        >
          {isGenerating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PlayCircle className="h-3.5 w-3.5" />}
          Generate Payroll Run
        </button>
      </div>

      {preview && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold border bg-[#e7f6f1] text-[#0e7d5a] border-[#c2e7db]">
              Eligible: {preview.staffCount}
            </span>
            <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold border bg-slate-100 text-slate-700 border-slate-200">
              Skipped: {preview.skipped.length}
            </span>
            <span className="px-2.5 py-1 rounded-md text-[11px] font-semibold border bg-blue-50 text-blue-700 border-blue-200">
              Total Net: {formatPKR(Number(preview.totalAmount))}
            </span>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Staff</th>
                    <th className="py-2.5 px-4">Basis</th>
                    <th className="py-2.5 px-4">Scheduled Days</th>
                    <th className="py-2.5 px-4">Equivalent Days</th>
                    <th className="py-2.5 px-4">Base</th>
                    <th className="py-2.5 px-4">Deduction</th>
                    <th className="py-2.5 px-4">Tax</th>
                    <th className="py-2.5 px-4">Net</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {preview.eligible.map((r) => (
                    <tr key={r.staffId} className="hover:bg-slate-50/80">
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{r.fullName} <span className="text-slate-400 font-normal">({r.employeeId})</span></td>
                      <td className="py-2.5 px-4">{SALARY_BASIS_OPTIONS.find((o) => o.value === r.salaryBasis)?.label || r.salaryBasis}</td>
                      <td className="py-2.5 px-4">{r.scheduledPayableDays}</td>
                      <td className="py-2.5 px-4">{r.attendanceEquivalentDays}</td>
                      <td className="py-2.5 px-4">{formatPKR(Number(r.periodBaseAmount))}</td>
                      <td className="py-2.5 px-4 text-red-600">-{formatPKR(Number(r.attendanceDeductions))}</td>
                      <td className="py-2.5 px-4 text-amber-700">-{formatPKR(Number(r.tax))}</td>
                      <td className="py-2.5 px-4 font-bold text-[#08775A]">{formatPKR(Number(r.netAmount))}</td>
                    </tr>
                  ))}
                  {preview.eligible.length === 0 && (
                    <tr><td colSpan={8} className="py-10 text-center text-slate-500">No eligible staff for this period.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {preview.skipped.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
              <p className="font-bold mb-1.5">Skipped ({preview.skipped.length}) — never silently dropped:</p>
              <ul className="space-y-1">
                {preview.skipped.map((s) => (
                  <li key={s.staffId}>• {s.fullName} ({s.employeeId}) — {s.reason}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const RunsTab: React.FC<{
  departments: Department[];
  toast: ReturnType<typeof useToast>;
  selectedRunId: string | null;
  setSelectedRunId: (id: string | null) => void;
}> = ({ toast, selectedRunId, setSelectedRunId }) => {
  const [runs, setRuns] = useState<PayrollRun[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<PayrollRun | null>(null);
  const [payingSlip, setPayingSlip] = useState<SalarySlip | null>(null);
  const [payAmount, setPayAmount] = useState<number | ''>('');
  const [payMethod, setPayMethod] = useState('BANK');
  const [payReference, setPayReference] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const loadRuns = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      setRuns(await listPayrollRuns());
    } catch (err: any) {
      setLoadError(err?.response?.data?.error?.message || err?.message || 'Failed to load payroll runs.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadRuns();
  }, []);

  useEffect(() => {
    if (!selectedRunId) {
      setDetail(null);
      return;
    }
    getPayrollRun(selectedRunId).then(setDetail).catch(() => {});
  }, [selectedRunId]);

  const handleApprove = async () => {
    if (!detail) return;
    try {
      await approvePayrollRun(detail.id);
      toast.success('Payroll run approved — slips are now payable.');
      const refreshed = await getPayrollRun(detail.id);
      setDetail(refreshed);
      await loadRuns();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to approve run.', 'Approve Error');
    }
  };

  const openPay = (slip: SalarySlip) => {
    const paid = slip.payments.reduce((sum, p) => sum + Number(p.amount), 0);
    setPayingSlip(slip);
    setPayAmount(Number(slip.generatedAmount) - paid);
    setPayMethod('BANK');
    setPayReference('');
  };

  const submitPay = async () => {
    if (!payingSlip || payAmount === '' || Number(payAmount) <= 0) return;
    setIsSubmitting(true);
    try {
      await paySalarySlip(payingSlip.id, { amount: Number(payAmount), method: payMethod, reference: payReference || undefined });
      toast.success(`Payment recorded for ${payingSlip.staff.fullName}.`);
      setPayingSlip(null);
      if (detail) setDetail(await getPayrollRun(detail.id));
      await loadRuns();
    } catch (err: any) {
      toast.error(err?.response?.data?.error?.message || err?.message || 'Failed to record payment.', 'Payment Error');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="lg:col-span-1 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Payroll Runs</h3>
        </div>
        {isLoading ? (
          <div className="flex items-center justify-center py-10 text-slate-500 gap-2 text-sm"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</div>
        ) : loadError ? (
          <div className="p-4 text-xs text-rose-700">{loadError}</div>
        ) : runs.length === 0 ? (
          <div className="p-8 text-center text-slate-500 text-xs">No payroll runs generated yet.</div>
        ) : (
          <div className="divide-y divide-slate-100 max-h-[560px] overflow-y-auto">
            {runs.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRunId(r.id)}
                className={`w-full text-left px-4 py-3 text-xs hover:bg-slate-50 cursor-pointer ${selectedRunId === r.id ? 'bg-[#effaf5]' : ''}`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-900">{formatDisplayDate(new Date(r.periodStart))} – {formatDisplayDate(new Date(r.periodEnd))}</span>
                  <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${STATUS_STYLES[r.status]}`}>{r.status}</span>
                </div>
                <div className="text-slate-500 mt-0.5">{r.staffCount} staff · {formatPKR(Number(r.totalAmount))}</div>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="lg:col-span-2 bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        {!detail ? (
          <div className="flex items-center justify-center py-20 text-slate-400 text-sm">Select a run to view its salary slips.</div>
        ) : (
          <div>
            <div className="px-4 py-3 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{formatDisplayDate(new Date(detail.periodStart))} – {formatDisplayDate(new Date(detail.periodEnd))}</h3>
                <p className="text-[11px] text-slate-500">{detail.periodType} · Generated by {detail.generatedByUser?.username || 'System'}</p>
              </div>
              {detail.status === 'GENERATED' ? (
                <button type="button" onClick={handleApprove} className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#149E75] hover:bg-[#08775A] rounded-lg cursor-pointer">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Approve Run
                </button>
              ) : (
                <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#08775A]"><CheckCircle2 className="h-4 w-4" /> Approved</span>
              )}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    <th className="py-2.5 px-4">Staff</th>
                    <th className="py-2.5 px-4">Net Amount</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {detail.lines.map((slip) => {
                    const paid = slip.payments.reduce((sum, p) => sum + Number(p.amount), 0);
                    const canPay = slip.status === 'APPROVED' || slip.status === 'PARTIALLY_PAID';
                    return (
                      <tr key={slip.id} className="hover:bg-slate-50/80">
                        <td className="py-2.5 px-4 font-semibold text-slate-900">{slip.staff.fullName} <span className="text-slate-400 font-normal">({slip.staff.employeeId})</span></td>
                        <td className="py-2.5 px-4 font-bold">{formatPKR(Number(slip.generatedAmount))}{paid > 0 && <div className="text-[10px] font-normal text-slate-400">Paid: {formatPKR(paid)}</div>}</td>
                        <td className="py-2.5 px-4">
                          <span className={`px-2 py-0.5 rounded-md text-[11px] font-semibold border ${STATUS_STYLES[slip.status]}`}>{slip.status.replace('_', ' ')}</span>
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          {canPay && (
                            <button type="button" onClick={() => openPay(slip)} className="inline-flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold text-white bg-[#149E75] hover:bg-[#08775A] rounded-md cursor-pointer">
                              <Banknote className="h-3 w-3" /> Pay
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {detail.skippedStaff.length > 0 && (
              <div className="p-4 border-t border-slate-200 bg-amber-50 text-[11px] text-amber-800">
                <p className="font-bold mb-1">Skipped at generation:</p>
                {detail.skippedStaff.map((s) => (
                  <div key={s.staffId}>• {s.fullName} — {s.reason}</div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {payingSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200">
              <h3 className="font-bold text-slate-900 text-sm">Record Salary Payment</h3>
              <p className="text-[11px] text-slate-500">{payingSlip.staff.fullName} ({payingSlip.staff.employeeId})</p>
            </div>
            <div className="p-5 space-y-3.5">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Amount (PKR)</label>
                <input type="number" onWheel={(e) => e.currentTarget.blur()} min={0} value={payAmount} onChange={(e) => setPayAmount(e.target.value === '' ? '' : Number(e.target.value))} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs font-mono bg-white" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Method</label>
                <select value={payMethod} onChange={(e) => setPayMethod(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white">
                  <option value="CASH">Cash</option>
                  <option value="CARD">Card</option>
                  <option value="BANK">Bank Transfer</option>
                  <option value="ONLINE">Online</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Reference (optional)</label>
                <input type="text" value={payReference} onChange={(e) => setPayReference(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-xs bg-white" />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button type="button" onClick={() => setPayingSlip(null)} className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg cursor-pointer">Cancel</button>
                <button type="button" disabled={isSubmitting} onClick={submitPay} className="px-3.5 py-1.5 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg cursor-pointer disabled:opacity-50">
                  {isSubmitting ? 'Saving…' : 'Record Payment'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
