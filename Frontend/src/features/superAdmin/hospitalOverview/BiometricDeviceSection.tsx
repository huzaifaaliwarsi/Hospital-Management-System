import React, { useState, useEffect } from 'react';
import {
  Cpu,
  Fingerprint,
  Users,
  Copy,
  Check,
  AlertTriangle,
  RefreshCw,
  Settings,
  Link2,
} from 'lucide-react';
import { BiometricDeviceOverview } from '../../../types/device';
import { DeviceService } from '../../../services/deviceService';
import { apiClient } from '../../../services/apiClient';
import { EditBiometricDeviceModal } from './EditBiometricDeviceModal';
import { StaffBiometricMappingModal } from './StaffBiometricMappingModal';
import { UnmappedPunchesModal } from './UnmappedPunchesModal';
import { useToast } from '../../../context/ToastContext';

export const BiometricDeviceSection: React.FC = () => {
  const toast = useToast();
  const [overview, setOverview] = useState<BiometricDeviceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [retrying, setRetrying] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState(false);

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isMappingOpen, setIsMappingOpen] = useState(false);
  const [isUnmappedOpen, setIsUnmappedOpen] = useState(false);

  const loadOverview = async () => {
    setLoading(true);
    try {
      const data = await DeviceService.getDeviceOverview();
      setOverview(data);
    } catch (err: any) {
      toast.error('Failed to load biometric device status.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOverview();
  }, []);

  const device = overview?.device;

  const apiBase = (apiClient.defaults.baseURL || '').replace(/\/$/, '');
  const serverOrigin = new URL(apiBase || '/api/v1', window.location.origin).origin;
  const pushUrl = device?.protocol === 'HTTP_ADMS' ? serverOrigin : `${apiBase}/attendance/punch-ingest`;
  const retryPending = async () => {
    setRetrying(true);
    try { const result = await DeviceService.reprocess(device?.id); toast.success(`Processed ${result.processed}; ${result.failed} need review.`); await loadOverview(); }
    catch { toast.error('Reprocessing failed. Saved punches remain queued.'); }
    finally { setRetrying(false); }
  };

  const handleCopyUrl = () => {
    navigator.clipboard.writeText(pushUrl);
    setCopiedUrl(true);
    toast.success('Device Push Ingest URL copied!');
    setTimeout(() => setCopiedUrl(false), 2500);
  };

  const getStatusBadge = () => {
    if (!overview || !device) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-slate-100 text-slate-600 border border-slate-200">
          <span className="h-2 w-2 rounded-full bg-slate-400"></span>
          Not Configured
        </span>
      );
    }

    switch (overview.derivedStatus) {
      case 'ONLINE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-[#e7f6f1] text-[#08775A] border border-[#c2e7db]">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Online / Active
          </span>
        );
      case 'STALE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
            <span className="h-2 w-2 rounded-full bg-amber-500"></span>
            Stale (No recent push)
          </span>
        );
      case 'DISABLED':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
            <span className="h-2 w-2 rounded-full bg-rose-500"></span>
            Disabled
          </span>
        );
      case 'NEVER_CONNECTED':
      default:
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
            <span className="h-2 w-2 rounded-full bg-blue-500"></span>
            Awaiting First Push
          </span>
        );
    }
  };

  return (
    <>
      <div className="bg-white rounded-2xl border border-[#e2eae5] shadow-2xs overflow-hidden transition-all">
        {/* Header */}
        <div className="px-4 sm:px-6 py-4 border-b border-[#e2eae5] bg-[#effaf5]/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 bg-[#129b70] text-white rounded-xl shadow-xs shrink-0">
              <Fingerprint className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm font-bold text-[#123e2b]">Biometric Attendance Terminal</h3>
                {getStatusBadge()}
              </div>
              <p className="text-xs text-[#52665e] truncate mt-0.5">
                Direct Cloud Push (HTTP/HTTPS ADMS) • Machine pushes punches directly to cloud backend
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto justify-start sm:justify-end">
            <button
              type="button"
              onClick={loadOverview}
              disabled={loading}
              title="Refresh device status"
              className="p-2 text-[#52665e] hover:text-[#111827] hover:bg-[#f6faf8] rounded-lg border border-[#e2eae5] transition-colors cursor-pointer"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => setIsMappingOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#52665e] hover:text-[#111827] bg-white hover:bg-[#f6faf8] border border-[#e2eae5] rounded-lg shadow-2xs transition-colors cursor-pointer"
            >
              <Users className="h-3.5 w-3.5 text-[#149e75]" />
              <span>Staff Mappings ({overview?.counts?.mappedStaff || 0})</span>
            </button>
            <button
              type="button"
              onClick={() => setIsEditOpen(true)}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#129b70] hover:bg-[#08775A] rounded-lg shadow-xs transition-colors cursor-pointer"
            >
              <Settings className="h-3.5 w-3.5" />
              <span>Configure Device</span>
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-4 sm:p-6">
          {!device ? (
            <div className="py-8 text-center bg-[#fbfdfc] rounded-xl border border-dashed border-[#c2e7db]">
              <Cpu className="h-10 w-10 text-slate-300 mx-auto mb-2" />
              <h4 className="text-xs font-bold text-[#123e2b]">No Biometric Terminal Registered Yet</h4>
              <p className="text-xs text-[#52665e] max-w-md mx-auto mt-1 mb-4">
                Register your ZKTeco or compatible push device serial number here so punches sent by the terminal are validated and mapped to employees.
              </p>
              <button
                type="button"
                onClick={() => setIsEditOpen(true)}
                className="px-4 py-2 text-xs font-bold text-white bg-[#129b70] hover:bg-[#08775A] rounded-lg shadow-xs transition inline-flex items-center gap-2 cursor-pointer"
              >
                <Settings className="h-4 w-4" />
                <span>Register Biometric Terminal</span>
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Responsive Device Details Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="p-3.5 bg-[#fbfdfc] rounded-xl border border-[#e2eae5]">
                  <span className="text-[11px] font-semibold text-[#52665e] block">Terminal Name</span>
                  <span className="text-xs font-bold text-[#123e2b] mt-0.5 block truncate">
                    {device.name}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                    {device.brandModel || 'Standard ZK Push Terminal'}
                  </span>
                </div>

                <div className="p-3.5 bg-[#fbfdfc] rounded-xl border border-[#e2eae5]">
                  <span className="text-[11px] font-semibold text-[#52665e] block">Device Serial Number</span>
                  <span className="text-xs font-mono font-bold text-[#08775A] mt-0.5 block truncate select-all">
                    {device.deviceSerial}
                  </span>
                  <span className="text-[10px] text-slate-400 block mt-0.5">
                    Timezone: {device.timezone}
                  </span>
                </div>

                <div className="p-3.5 bg-[#fbfdfc] rounded-xl border border-[#e2eae5]">
                  <span className="text-[11px] font-semibold text-[#52665e] block">Staff Enrollment</span>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-xs font-bold text-[#123e2b]">
                      {overview?.counts?.mappedStaff || 0} / {overview?.counts?.totalStaff || 0}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsMappingOpen(true)}
                      className="text-[11px] font-semibold text-[#149e75] hover:text-[#08775A] hover:underline cursor-pointer"
                    >
                      Manage
                    </button>
                  </div>
                  <div className="w-full bg-[#e2eae5] h-1.5 rounded-full mt-1.5 overflow-hidden">
                    <div
                      className="bg-[#129b70] h-full rounded-full transition-all"
                      style={{
                        width: `${
                          overview?.counts?.totalStaff
                            ? Math.min(100, Math.round(((overview.counts.mappedStaff || 0) / overview.counts.totalStaff) * 100))
                            : 0
                        }%`,
                      }}
                    ></div>
                  </div>
                </div>

                <div className="p-3.5 bg-[#fbfdfc] rounded-xl border border-[#e2eae5]">
                  <span className="text-[11px] font-semibold text-[#52665e] block">Last Device Activity</span>
                  <span className="text-xs font-bold text-[#123e2b] mt-0.5 block">
                    {device.lastPushAt ? new Date(device.lastPushAt).toLocaleTimeString() : 'Never'}
                  </span>
                  <span className="text-[10px] text-slate-400 block truncate mt-0.5">
                    {device.lastPushMessage || 'Awaiting initial push'}
                  </span>
                </div>
              </div>

              {device.authMode === 'DEVICE_SERIAL' && !overview?.connection?.serialIpAllowlistConfigured && (
                <p role="alert" className="p-3 rounded-lg bg-amber-50 text-amber-900 text-xs">Connection pending: configure the hospital network's allowed source IP on the backend.</p>
              )}
              <div className="p-3 rounded-lg border text-xs flex items-center justify-between gap-3">
                <span>Queued: {overview?.counts.pendingPunches ?? 0} | Need review: {overview?.counts.errorPunches ?? 0}</span>
                <button type="button" disabled={retrying} onClick={retryPending} className="text-emerald-700 font-semibold disabled:opacity-50">{retrying ? 'Processing...' : 'Retry Pending Punches'}</button>
              </div>
              {!!overview?.recentPunches.length && <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead><tr><th className="p-2">Enroll ID</th><th className="p-2">Punch time</th><th className="p-2">Processing</th></tr></thead>
                  <tbody>{overview.recentPunches.map(p => <tr key={p.id} className="border-t">
                    <td className="p-2">{p.enrollNumber}</td>
                    <td className="p-2">{new Date(p.punchAt).toLocaleString('en-GB', { timeZone: device.timezone })}</td>
                    <td className="p-2">{p.processingStatus}{p.errorMessage && <div className="text-amber-700 mt-1">{p.errorMessage}</div>}</td>
                  </tr>)}</tbody>
                </table>
              </div>}
              <p className="text-xs text-slate-500">Assign staff enrollment IDs and duty shifts before connecting. For ADMS use the backend hostname, with HTTPS on port 443 where supported. HTTP-only terminals need a hospital gateway.</p>

              {/* Unmapped Punches Warning (if any) */}
              {(overview?.counts?.unmappedPunches || 0) > 0 && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-xs">
                  <div className="flex items-center gap-2 text-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>
                      <strong>{overview?.counts.unmappedPunches} unmapped punch events</strong> received from terminal with unknown enroll numbers.
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsUnmappedOpen(true)}
                    className="px-3 py-1 font-semibold text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-lg transition-colors shrink-0 cursor-pointer w-full sm:w-auto text-center"
                  >
                    View & Link Staff
                  </button>
                </div>
              )}

              {/* Clean Light-Themed Link Box */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-3.5 bg-[#f8fdfb] border border-[#c2e7db] rounded-xl text-xs">
                <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                  <div className="p-1.5 bg-[#e7f6f1] text-[#08775A] rounded-lg shrink-0 mt-0.5 sm:mt-0">
                    <Link2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="font-bold text-[#123e2b]">{device?.protocol === 'HTTP_ADMS' ? 'ADMS Server Address:' : 'JSON Push URL:'}</span>
                      <span className="text-[11px] text-[#52665e]">{device?.protocol === 'HTTP_ADMS' ? '(enter this host in the terminal Cloud Server settings)' : '(for your authenticated JSON client)'}</span>
                    </div>
                    <code className="text-[11px] font-mono text-[#08775A] font-semibold select-all break-all block mt-0.5">
                      {pushUrl}
                    </code>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleCopyUrl}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#effaf5] text-[#08775A] border border-[#c2e7db] text-xs font-semibold rounded-lg shadow-2xs transition-colors shrink-0 cursor-pointer w-full sm:w-auto"
                >
                  {copiedUrl ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy URL</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      <EditBiometricDeviceModal
        device={device || null}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
        onSuccess={loadOverview}
      />

      {device && (
        <StaffBiometricMappingModal
          deviceId={device.id}
          deviceName={device.name}
          isOpen={isMappingOpen}
          onClose={() => setIsMappingOpen(false)}
          onChanged={loadOverview}
        />
      )}

      <UnmappedPunchesModal
        deviceId={device?.id}
        isOpen={isUnmappedOpen}
        onClose={() => setIsUnmappedOpen(false)}
        onOpenMapping={() => setIsMappingOpen(true)}
      />
    </>
  );
};
