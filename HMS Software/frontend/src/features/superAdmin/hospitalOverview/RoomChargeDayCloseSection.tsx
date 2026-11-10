import React, { useEffect, useState } from 'react';
import { CalendarClock, Loader2, AlertTriangle, History } from 'lucide-react';
import { HospitalProfile } from '../../../types/hospital';
import { closeHospitalDay, fetchDayCloseHistory, HospitalDayCloseRecord } from '../../../services/admissionService';
import { formatPKR } from '../../../utils/formatters';
import { useToast } from '../../../context/ToastContext';

interface RoomChargeDayCloseSectionProps {
  profile: HospitalProfile;
}

const todayIso = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Karachi' }).format(new Date());

/**
 * Super Admin "Close Day" action — posts one room/bed accommodation charge
 * to every currently ACTIVE, bed-assigned admission for the chosen date, so
 * the daily room rate keeps re-billing for as long as a patient stays
 * admitted. The rate always comes from the occupied Room/Bed's own
 * configured daily rate (never hardcoded); `profile.ipdDailyRoomBedPostingTime` here is
 * shown only as a reference for WHEN staff should run it.
 */
export const RoomChargeDayCloseSection: React.FC<RoomChargeDayCloseSectionProps> = ({ profile }) => {
  const toast = useToast();
  const [history, setHistory] = useState<HospitalDayCloseRecord[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);
  const [businessDate, setBusinessDate] = useState(todayIso());
  const [isConfirming, setIsConfirming] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadHistory = async () => {
    setIsLoadingHistory(true);
    try {
      setHistory(await fetchDayCloseHistory(5));
    } catch {
      // Non-fatal — the action button below still works without history.
    } finally {
      setIsLoadingHistory(false);
    }
  };

  useEffect(() => {
    loadHistory();
  }, []);

  const lastClosed = history[0];
  const alreadyClosedForDate = false; // Existing daily lines are skipped on retry.

  const handleConfirmClose = async () => {
    setIsClosing(true);
    setError(null);
    try {
      const result = await closeHospitalDay(businessDate);
      toast.success(
        result.admissionsCharged > 0
          ? `Room charges posted for ${result.admissionsCharged} admission(s) — ${formatPKR(result.totalAmountPosted)} total.`
          : 'No additional room charges were needed.',
      );
      setIsConfirming(false);
      await loadHistory();
    } catch (err: any) {
      setError(err?.message || 'Failed to close the hospital day.');
    } finally {
      setIsClosing(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-[#e2eae5] p-5 shadow-2xs">
      <div className="flex items-center justify-between pb-4 mb-4 border-b border-[#e2eae5]">
        <div className="flex items-center gap-2.5">
          <div className="h-8 w-8 rounded-lg bg-[#effaf5] text-[#08775A] flex items-center justify-center border border-[#c2e7db]">
            <CalendarClock className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#111827]">Room / Bed Charge — Close Day</h3>
            <p className="text-[11px] text-[#52665e]">
              Automatically posts one daily charge per active or discharge-pending admission. Manual retry is available after the posting time.
              {profile.ipdDailyRoomBedPostingTime ? ` Automatic posting (Asia/Karachi): ${profile.ipdDailyRoomBedPostingTime}.` : ''}
            </p>
          </div>
        </div>
        {lastClosed && (
          <span className="text-[11px] text-[#52665e] bg-[#f6faf8] px-2.5 py-1 rounded-md border border-[#e2eae5] self-start sm:self-auto">
            Last closed: <strong className="text-[#111827]">{lastClosed.businessDate}</strong>
          </span>
        )}
      </div>

      {error && (
        <div className="mb-3 p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-medium flex items-center gap-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" /> {error}
        </div>
      )}

      {!isConfirming ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs">
            <label className="text-[#52665e] font-semibold" htmlFor="room-charge-business-date">
              Business Date
            </label>
            <input
              id="room-charge-business-date"
              lang="en-GB" type="date"
              value={businessDate}
              min={todayIso()}
              max={todayIso()}
              onChange={(e) => setBusinessDate(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-[#111827] focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
            />
            {alreadyClosedForDate && (
              <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                Already closed
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsConfirming(true)}
            disabled={alreadyClosedForDate}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#129b70] hover:bg-[#08775A] disabled:opacity-50 disabled:cursor-not-allowed text-white text-xs font-semibold rounded-lg shadow-xs transition-colors cursor-pointer"
          >
            <CalendarClock className="h-4 w-4" />
            <span>Retry Today's Room Charges</span>
          </button>
        </div>
      ) : (
        <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-3">
          <div className="flex items-center gap-1.5 text-xs font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>Confirm: post room/bed charges for {businessDate}?</span>
          </div>
          <p className="text-[11px] text-amber-800">
            Every currently ACTIVE or DISCHARGE PENDING, bed-assigned admission with a configured daily room rate will get one
            charge line for this date if it has not already been posted. Repeating this action is safe.
          </p>
          <div className="flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={() => setIsConfirming(false)}
              disabled={isClosing}
              className="px-4 py-1.5 bg-white hover:bg-[#f6faf8] text-[#52665e] border border-[#e2eae5] text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleConfirmClose}
              disabled={isClosing}
              className="inline-flex items-center gap-2 px-4 py-1.5 bg-[#129b70] hover:bg-[#08775A] disabled:opacity-60 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              {isClosing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CalendarClock className="h-3.5 w-3.5" />}
              <span>{isClosing ? 'Posting…' : 'Post Missing Charges'}</span>
            </button>
          </div>
        </div>
      )}

      {!isLoadingHistory && history.length > 0 && (
        <div className="mt-4 pt-3 border-t border-[#e2eae5]">
          <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#52665e] uppercase tracking-wider mb-2">
            <History className="h-3.5 w-3.5" /> Recent Closures
          </span>
          <div className="space-y-1.5">
            {history.map((h) => (
              <div key={h.id} className="flex items-center justify-between text-[11px] px-3 py-1.5 rounded-lg bg-[#f6faf8] border border-[#e2eae5]">
                <span className="font-semibold text-[#111827]">{h.businessDate}</span>
                <span className="text-[#52665e]">{h.admissionsCharged} admission(s)</span>
                <span className="font-mono font-semibold text-[#08775A]">{formatPKR(h.totalAmountPosted)}</span>
                <span className="text-[#8b9e95]">{h.closedByLabel} • {h.closedAt}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
