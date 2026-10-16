import React, { useState } from 'react';
import { X, Cpu, Check, AlertCircle, Loader2 } from 'lucide-react';
import { BiometricDevice } from '../../../types/device';
import { DeviceService } from '../../../services/deviceService';
import { useToast } from '../../../context/ToastContext';

interface Props {
  device: BiometricDevice | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const EditBiometricDeviceModal: React.FC<Props> = ({
  device,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const toast = useToast();
  const [name, setName] = useState(device?.name || '');
  const [brandModel, setBrandModel] = useState(device?.brandModel || '');
  const [deviceSerial, setDeviceSerial] = useState(device?.deviceSerial || '');
  const [protocol, setProtocol] = useState(device?.protocol || 'HTTP_ADMS');
  const [timezone, setTimezone] = useState(device?.timezone || 'Asia/Karachi');
  const [isEnabled, setIsEnabled] = useState(device ? device.isEnabled : true);
  const [authMode, setAuthMode] = useState(device?.authMode || 'DEVICE_SERIAL');
  const [sharedSecret, setSharedSecret] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  React.useEffect(() => {
    if (isOpen) {
      setName(device?.name || '');
      setBrandModel(device?.brandModel || '');
      setDeviceSerial(device?.deviceSerial || '');
      setProtocol(device?.protocol || 'HTTP_ADMS');
      setTimezone(device?.timezone || 'Asia/Karachi');
      setIsEnabled(device ? device.isEnabled : true);
      setAuthMode(device?.authMode || 'DEVICE_SERIAL');
      setSharedSecret('');
      setError(null);
    }
  }, [isOpen, device]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!deviceSerial.trim()) {
      setError('Device Serial Number is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await DeviceService.upsertDevice({
        id: device?.id,
        name,
        brandModel,
        authMode: protocol === 'CLOUD_SERVER' ? 'SHARED_SECRET' : authMode,
        sharedSecret: sharedSecret || undefined,
        deviceSerial: deviceSerial.trim(),
        protocol,
        timezone,
        isEnabled,
      });
      toast.success('Biometric device configuration saved successfully!');
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to save device settings.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-emerald-700 to-teal-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm">
              <Cpu className="h-5 w-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Configure Biometric Terminal</h2>
              <p className="text-xs text-emerald-100/80">Direct Cloud Push (HTTP/HTTPS ADMS Mode)</p>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto flex-1 text-slate-800">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start gap-2.5 text-xs text-rose-700">
              <AlertCircle className="h-4 w-4 shrink-0 text-rose-500 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Terminal / Device Name <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Main Entrance Biometric Gate"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Brand & Model (Hardware)
            </label>
            <input
              type="text"
              value={brandModel}
              onChange={(e) => setBrandModel(e.target.value)}
              placeholder="e.g. ZKTeco K40, uFace800, Hikvision DS-K1T804"
              className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Device Serial Number <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              required
              value={deviceSerial}
              onChange={(e) => setDeviceSerial(e.target.value)}
              placeholder="e.g. ZK-89237401 (Found in Machine Settings/Sticker)"
              className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition"
            />
            <p className="text-[11px] text-slate-500 mt-1">
              The physical biometric terminal sends this exact serial number in its HTTP push payload for validation.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Push Protocol
              </label>
              <select
                value={protocol}
                onChange={(e) => { setProtocol(e.target.value); if (e.target.value === 'CLOUD_SERVER') setAuthMode('SHARED_SECRET'); }}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white"
              >
                <option value="HTTP_ADMS">HTTP/HTTPS ADMS (Push)</option>
                <option value="CLOUD_SERVER">Authenticated JSON Push / Gateway</option>

              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Hospital Timezone
              </label>
              <select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition bg-white"
              >
                <option value="Asia/Karachi">Asia/Karachi (PKT +05:00)</option>
                <option value="UTC">UTC</option>
              </select>
            </div>
          </div>

          <div className="space-y-2 border-t border-slate-100 pt-3">
            <label className="block text-xs font-semibold text-slate-700" htmlFor="device-auth">Connection authentication</label>
            <select id="device-auth" value={authMode} onChange={e => setAuthMode(e.target.value)} disabled={protocol === 'CLOUD_SERVER'} className="w-full border rounded-lg px-3 py-2 text-xs">
              <option value="DEVICE_SERIAL">ADMS: registered serial + approved source IP</option>
              <option value="SHARED_SECRET">Shared secret (JSON client / trusted gateway)</option>
            </select>
            {authMode === 'SHARED_SECRET' && <>
              <label htmlFor="device-secret" className="block text-xs text-slate-700">Shared secret {device?.hasSharedSecret ? '(leave blank to retain)' : '(required)'}</label>
              <input id="device-secret" type="password" autoComplete="new-password" minLength={24} value={sharedSecret} onChange={e => setSharedSecret(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-xs" />
              <button type="button" className="text-xs text-emerald-700 underline" onClick={() => setSharedSecret(Array.from(crypto.getRandomValues(new Uint8Array(24)), b => b.toString(16).padStart(2, '0')).join(''))}>Generate secret</button>
              {sharedSecret && <button type="button" className="ml-3 text-xs text-emerald-700 underline" onClick={async () => { try { await navigator.clipboard.writeText(sharedSecret); toast.success('Secret copied. Save it in your gateway configuration.'); } catch { setError('Clipboard unavailable. Enter a known secure secret.'); } }}>Copy new secret</button>}
            </>}
            <p className="text-xs text-slate-500">{authMode === 'DEVICE_SERIAL' ? 'The hospital network public IP must be approved on the backend before the terminal can connect.' : 'Send this secret as Authorization: Bearer from your JSON client or gateway. It is not the terminal communication password.'}</p>
          </div>

          <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold text-slate-800 block">Device Status</span>
              <span className="text-[11px] text-slate-500">Allow incoming punches from this device</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={isEnabled}
                onChange={(e) => setIsEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>

          <div className="bg-slate-50 border border-slate-200/80 rounded-xl p-3 text-[11px] text-slate-600 space-y-1">
            <span className="font-semibold text-slate-700 block">Terminal Cloud Settings (Enter on physical machine):</span>
            <div className="font-mono text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 select-all">
              Server Domain: {window.location.hostname}
            </div>
            <div className="font-mono text-slate-800 bg-white px-2 py-1 rounded border border-slate-200 select-all">
              Server Port: {window.location.port || (window.location.protocol === 'https:' ? '443' : '80')}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 text-xs font-semibold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm flex items-center gap-2 transition disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <Check className="h-4 w-4" />
                  <span>Save Configuration</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
