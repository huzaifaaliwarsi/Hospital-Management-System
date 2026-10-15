import React, { useState, useEffect } from 'react';
import { X, AlertTriangle, Fingerprint, Loader2, Link2, RefreshCw } from 'lucide-react';
import { BiometricRawPunchItem } from '../../../types/device';
import { DeviceService } from '../../../services/deviceService';
import { useToast } from '../../../context/ToastContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onOpenMapping: () => void;
}

export const UnmappedPunchesModal: React.FC<Props> = ({ isOpen, onClose, onOpenMapping }) => {
  const toast = useToast();
  const [punches, setPunches] = useState<BiometricRawPunchItem[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUnmapped = async () => {
    setLoading(true);
    try {
      const data = await DeviceService.getUnmappedPunches();
      setPunches(data);
    } catch (err: any) {
      toast.error('Failed to load unmapped punches.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadUnmapped();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-xl border border-slate-200 overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-amber-700 to-orange-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-amber-200" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Unmapped Device Punches</h2>
              <p className="text-xs text-amber-100/80">Punches received from terminal with no staff link</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4 text-slate-800">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600 font-medium">
              Found {punches.length} unassigned punch events.
            </span>
            <button
              onClick={loadUnmapped}
              disabled={loading}
              className="text-amber-700 hover:text-amber-900 font-semibold flex items-center gap-1.5 transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>

          {loading ? (
            <div className="py-12 flex items-center justify-center text-xs text-slate-500 gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-amber-600" />
              <span>Loading unmapped punches...</span>
            </div>
          ) : punches.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl">
              <Fingerprint className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold text-slate-700">No unmapped punches found!</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                All punch events received from biometric machines are mapped to active staff.
              </p>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
                  <tr>
                    <th className="py-2.5 px-3">Enroll Number</th>
                    <th className="py-2.5 px-3">Punch Timestamp</th>
                    <th className="py-2.5 px-3">Type</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {punches.map((p) => (
                    <tr key={p.id} className="hover:bg-amber-50/50 transition">
                      <td className="py-2 px-3">
                        <span className="font-mono font-bold text-amber-900 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded text-[11px]">
                          {p.enrollNumber || 'Unknown'}
                        </span>
                      </td>
                      <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                        {new Date(p.punchAt).toLocaleString()}
                      </td>
                      <td className="py-2 px-3 text-slate-500 text-[11px]">
                        {p.punchType || 'AUTO'}
                      </td>
                      <td className="py-2 px-3 text-right">
                        <button
                          type="button"
                          onClick={() => {
                            onClose();
                            onOpenMapping();
                          }}
                          className="px-2.5 py-1 text-[11px] font-semibold text-amber-800 bg-amber-100 hover:bg-amber-200 rounded-lg flex items-center gap-1 ml-auto transition"
                        >
                          <Link2 className="h-3 w-3" />
                          <span>Link Staff</span>
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
