import React, { useState, useEffect } from 'react';
import { X, Users, Plus, Trash2, Search, Loader2, AlertCircle, Fingerprint } from 'lucide-react';
import { StaffBiometricMapping } from '../../../types/device';
import { DeviceService } from '../../../services/deviceService';
import { apiClient } from '../../../services/apiClient';
import { fetchStaffUsers } from '../../../services/staffUserService';
import { StaffUser } from '../../../types/staffUser';
import { useToast } from '../../../context/ToastContext';

interface Props {
  deviceId: string;
  deviceName: string;
  isOpen: boolean;
  onClose: () => void;
  onChanged: () => void;
}

export const StaffBiometricMappingModal: React.FC<Props> = ({
  deviceId,
  deviceName,
  isOpen,
  onClose,
  onChanged,
}) => {
  const toast = useToast();
  const [mappings, setMappings] = useState<StaffBiometricMapping[]>([]);
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');

  // Add form state
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [enrollNumber, setEnrollNumber] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [mapsRes, staffRes] = await Promise.allSettled([
        DeviceService.getMappings(deviceId),
        apiClient.get('/staff', { params: { pageSize: 100 } }),
      ]);

      if (mapsRes.status === 'fulfilled') {
        setMappings(mapsRes.value || []);
      } else {
        console.error('Failed to load device mappings:', mapsRes.reason);
      }

      if (staffRes.status === 'fulfilled') {
        const rawStaff = staffRes.value.data?.data || [];
        setStaffList(
          rawStaff.map((s: any) => ({
            id: s.id,
            fullName: s.fullName,
            employeeCode: s.employeeId || s.employeeCode || '—',
            departmentName: s.department?.name || '',
            designation: s.designation || '',
          } as any))
        );
      } else {
        console.error('Failed to load staff list directly, falling back:', staffRes.reason);
        const fallback = await fetchStaffUsers().catch(() => []);
        setStaffList(fallback);
      }
    } catch (err: any) {
      console.error('Error loading data in mapping modal:', err);
      toast.error('Failed to load biometric staff mapping data.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen, deviceId]);

  if (!isOpen) return null;

  const handleAddMapping = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedStaffId) {
      setError('Please select a staff member.');
      return;
    }
    if (!enrollNumber.trim()) {
      setError('Biometric Enroll Number is required.');
      return;
    }

    setIsSubmitting(true);
    setError(null);
    try {
      await DeviceService.createMapping({
        staffId: selectedStaffId,
        enrollNumber: enrollNumber.trim(),
        deviceId,
      });
      toast.success('Staff biometric enroll mapping created!');
      setSelectedStaffId('');
      setEnrollNumber('');
      onChanged();
      loadData();
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.message || 'Failed to create mapping.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string, staffName?: string) => {
    if (!window.confirm(`Are you sure you want to remove biometric mapping for ${staffName || 'this staff member'}?`)) {
      return;
    }
    try {
      await DeviceService.deleteMapping(id);
      toast.info('Mapping removed.');
      setMappings((prev) => prev.filter((m) => m.id !== id));
      onChanged();
    } catch (err: any) {
      toast.error('Failed to delete mapping.');
    }
  };

  const filteredMappings = mappings.filter((m) => {
    const q = search.toLowerCase();
    const staffObj = m.staff as any;
    const name = (staffObj?.fullName || `${staffObj?.firstName || ''} ${staffObj?.lastName || ''}`).toLowerCase();
    const code = (staffObj?.employeeId || staffObj?.employeeCode || '').toLowerCase();
    const enroll = m.enrollNumber.toLowerCase();
    return name.includes(q) || code.includes(q) || enroll.includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[88vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-teal-800 to-emerald-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white/10 rounded-xl">
              <Users className="h-5 w-5 text-emerald-200" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">Staff Biometric Enroll Mapping</h2>
              <p className="text-xs text-emerald-100/80">Device: {deviceName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-5 text-slate-800">
          {/* Add Mapping Card */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-4">
            <h3 className="text-xs font-bold text-emerald-950 uppercase tracking-wider mb-2 flex items-center gap-2">
              <Fingerprint className="h-4 w-4 text-emerald-700" />
              <span>Link Staff to Device Enroll Number</span>
            </h3>

            {error && (
              <div className="mb-3 p-2 bg-rose-50 border border-rose-200 rounded-lg text-xs text-rose-700 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleAddMapping} className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
              <div className="md:col-span-7">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Select Staff Member
                </label>
                <select
                  required
                  value={selectedStaffId}
                  onChange={(e) => setSelectedStaffId(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                >
                  <option value="">-- Choose Staff Member --</option>
                  {staffList.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.fullName} ({s.employeeCode}) {s.departmentName ? `• ${s.departmentName}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="md:col-span-3">
                <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                  Machine User ID / Enroll #
                </label>
                <input
                  type="text"
                  required
                  value={enrollNumber}
                  onChange={(e) => setEnrollNumber(e.target.value)}
                  placeholder="e.g. 101"
                  className="w-full px-3 py-2 text-xs font-mono font-bold text-emerald-900 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 bg-white"
                />
              </div>

              <div className="md:col-span-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2 px-3 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-lg shadow-sm flex items-center justify-center gap-1 transition disabled:opacity-50"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="h-3.5 w-3.5" />
                      <span>Link</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>

          {/* Search and Table */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="text-xs font-bold text-slate-700">
                Mapped Staff ({mappings.length} total)
              </span>
              <div className="relative w-64">
                <Search className="h-3.5 w-3.5 absolute left-3 top-2.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search staff, code, or enroll #..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>
            </div>

            {loading ? (
              <div className="py-12 flex items-center justify-center text-xs text-slate-500 gap-2">
                <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
                <span>Loading mappings...</span>
              </div>
            ) : filteredMappings.length === 0 ? (
              <div className="py-12 text-center border border-dashed border-slate-200 rounded-xl">
                <Fingerprint className="h-8 w-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-medium text-slate-600">No staff mappings found</p>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  Link an employee above with their terminal user ID / enroll number.
                </p>
              </div>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-60 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 uppercase text-[10px] tracking-wider font-semibold">
                    <tr>
                      <th className="py-2.5 px-3">Staff Name</th>
                      <th className="py-2.5 px-3">Employee Code</th>
                      <th className="py-2.5 px-3">Enroll Number</th>
                      <th className="py-2.5 px-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredMappings.map((m) => {
                      const staffObj = m.staff as any;
                      const displayName = staffObj?.fullName || `${staffObj?.firstName || ''} ${staffObj?.lastName || ''}`.trim() || 'Unknown Staff';
                      const displayCode = staffObj?.employeeId || staffObj?.employeeCode || '—';
                      return (
                        <tr key={m.id} className="hover:bg-slate-50/70 transition">
                          <td className="py-2 px-3 font-semibold text-slate-900">
                            {displayName}
                            {m.staff?.designation && (
                              <span className="block text-[10px] text-slate-400 font-normal">
                                {m.staff.designation}
                              </span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-slate-600 font-mono text-[11px]">
                            {displayCode}
                          </td>
                          <td className="py-2 px-3">
                            <span className="inline-flex items-center gap-1 font-mono font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 text-[11px]">
                              <Fingerprint className="h-3 w-3 text-emerald-600" />
                              {m.enrollNumber}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleDelete(m.id, displayName)}
                              title="Remove mapping"
                              className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <span>Unmapped punches are automatically assigned when a staff member is linked.</span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-slate-700 hover:bg-slate-200 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
