import React, { useState, useEffect } from 'react';
import { X, Upload, FileText, CheckCircle2, AlertCircle, Loader2, HardDrive } from 'lucide-react';
import { apiClient } from '../../../services/apiClient';
import { DeviceService } from '../../../services/deviceService';
import { useToast } from '../../../context/ToastContext';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const UploadPunchFileModal: React.FC<Props> = ({ isOpen, onClose, onSuccess }) => {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [deviceSerial, setDeviceSerial] = useState('');
  const [isParsing, setIsParsing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ total: number; accepted: number; duplicates: number } | null>(null);

  useEffect(() => {
    if (isOpen) {
      DeviceService.getDeviceOverview()
        .then((data) => {
          if (data?.device?.deviceSerial) {
            setDeviceSerial(data.device.deviceSerial);
          }
        })
        .catch(() => {});
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setError(null);
      setResult(null);
    }
  };

  const parseAndUpload = async () => {
    if (!file) {
      setError('Please select an attendance log file (.dat, .csv, or .txt).');
      return;
    }

    setIsParsing(true);
    setError(null);
    setResult(null);

    try {
      const text = await file.text();
      const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

      const events: Array<{
        enrollNumber: string;
        punchTime: string;
        punchType?: string;
        verificationType?: string;
      }> = [];

      for (const line of lines) {
        // Handle tab-separated (standard ZK attlog.dat) or comma/space-separated
        const parts = line.split(/[\t,;]+/).map((p) => p.trim());
        if (parts.length >= 2) {
          const enrollNumber = parts[0];
          const rawTime = parts[1];

          // Validate date string
          const d = new Date(rawTime);
          if (!isNaN(d.getTime()) && enrollNumber) {
            events.push({
              enrollNumber,
              punchTime: d.toISOString(),
              punchType: parts[3] === '1' ? 'CHECK_OUT' : 'CHECK_IN',
              verificationType: 'FINGERPRINT',
            });
          }
        }
      }

      if (events.length === 0) {
        throw new Error('No valid attendance punch logs could be parsed from this file. Ensure lines contain [EnrollNumber] and [Timestamp].');
      }

      // Send to public ingest endpoint
      const res = await apiClient.post('/attendance/punch-ingest', {
        deviceSerial,
        events,
      });

      const resData = res.data?.data || {};
      setResult({
        total: events.length,
        accepted: resData.accepted ?? events.length,
        duplicates: resData.duplicates ?? 0,
      });
      toast.success(`Successfully processed ${resData.accepted ?? events.length} punches from USB file!`);
      onSuccess();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to parse punch file.');
    } finally {
      setIsParsing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-800 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <HardDrive className="h-5 w-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Import Biometric Punches (USB Fallback)</h2>
              <p className="text-xs text-emerald-100/80">Offline terminal export (.dat, .csv, or .txt)</p>
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
        <div className="p-6 space-y-4 text-slate-800">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {result && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
              <div className="flex items-center gap-2 font-bold text-emerald-950">
                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                <span>Import Succeeded!</span>
              </div>
              <p>
                Total Parsed: <strong>{result.total}</strong> | Accepted & Normalized: <strong>{result.accepted}</strong> | Duplicates Ignored: <strong>{result.duplicates}</strong>
              </p>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Select Biometric Export File
            </label>
            <div className="border-2 border-dashed border-slate-300 hover:border-emerald-500 rounded-xl p-6 text-center transition cursor-pointer bg-slate-50/50">
              <input
                type="file"
                accept=".dat,.csv,.txt"
                onChange={handleFileChange}
                className="hidden"
                id="punch-file-input"
              />
              <label htmlFor="punch-file-input" className="cursor-pointer space-y-2 block">
                <FileText className="h-8 w-8 text-slate-400 mx-auto" />
                <span className="block text-xs font-bold text-slate-700">
                  {file ? file.name : 'Click to browse or drop attendance file here'}
                </span>
                <span className="block text-[11px] text-slate-400">
                  Supports standard ZKTeco USB exports: <code className="bg-slate-200 px-1 py-0.5 rounded font-mono">1_attlog.dat</code>, CSV, or TXT
                </span>
              </label>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Device Serial Identifier
            </label>
            <input
              type="text"
              value={deviceSerial}
              onChange={(e) => setDeviceSerial(e.target.value)}
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
            <p className="text-[11px] text-slate-400 mt-1">
              The registered serial of the terminal the USB export was extracted from.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg transition"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={parseAndUpload}
            disabled={!file || isParsing}
            className="px-5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm flex items-center gap-2 transition disabled:opacity-50"
          >
            {isParsing ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>Processing File...</span>
              </>
            ) : (
              <>
                <Upload className="h-4 w-4" />
                <span>Ingest & Normalize</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
