import React, { useState, useMemo } from 'react';
import {
  Search,
  RotateCcw,
  Plus,
  Eye,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Bed as BedIcon,
  PowerOff,
  Power,
  Filter,
  User,
  AlertTriangle,
  Clock,
} from 'lucide-react';
import { Bed, BedFilterState, Ward, Room } from '../../../types/wardsRoomsBeds';
import { VALID_BED_TYPES } from '../../../services/wardsRoomsBedsService';

interface BedTabProps {
  beds: Bed[];
  wards: Ward[];
  rooms: Room[];
  onAdd: () => void;
  onView: (bed: Bed) => void;
  onEdit: (bed: Bed) => void;
  onToggleOperational: (bed: Bed) => void;
  onDelete: (bed: Bed) => void;
}

export const BedTab: React.FC<BedTabProps> = ({
  beds,
  wards,
  rooms,
  onAdd,
  onView,
  onEdit,
  onToggleOperational,
  onDelete,
}) => {
  const [filters, setFilters] = useState<BedFilterState>({
    searchTerm: '',
    wardId: 'All',
    roomId: 'All',
    bedType: 'All',
    occupancyStatus: 'All',
    operationalStatus: 'All',
  });

  const availableRoomsForFilter = useMemo(() => {
    if (filters.wardId === 'All') return rooms;
    return rooms.filter((r) => r.wardId === filters.wardId);
  }, [rooms, filters.wardId]);

  const filteredBeds = beds.filter((b) => {
    if (filters.searchTerm.trim()) {
      const q = filters.searchTerm.toLowerCase().trim();
      const mCode = b.code.toLowerCase().includes(q);
      const mNum = b.bedNumber.toLowerCase().includes(q);
      const mRoom = b.roomNumber.toLowerCase().includes(q);
      const mWard = b.wardName.toLowerCase().includes(q);
      const mPat = b.currentPatientName?.toLowerCase().includes(q) ?? false;
      const mMrn = b.currentPatientMrn?.toLowerCase().includes(q) ?? false;
      if (!mCode && !mNum && !mRoom && !mWard && !mPat && !mMrn) return false;
    }
    if (filters.wardId !== 'All' && b.wardId !== filters.wardId) return false;
    if (filters.roomId !== 'All' && b.roomId !== filters.roomId) return false;
    if (filters.bedType !== 'All' && b.bedType !== filters.bedType) return false;
    if (filters.occupancyStatus !== 'All' && b.occupancyStatus !== filters.occupancyStatus)
      return false;
    if (filters.operationalStatus !== 'All' && b.operationalStatus !== filters.operationalStatus)
      return false;
    return true;
  });

  const isFiltered =
    filters.searchTerm.trim() !== '' ||
    filters.wardId !== 'All' ||
    filters.roomId !== 'All' ||
    filters.bedType !== 'All' ||
    filters.occupancyStatus !== 'All' ||
    filters.operationalStatus !== 'All';

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      wardId: 'All',
      roomId: 'All',
      bedType: 'All',
      occupancyStatus: 'All',
      operationalStatus: 'All',
    });
  };

  const getOccupancyBadge = (status: Bed['occupancyStatus']) => {
    switch (status) {
      case 'Available':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <CheckCircle2 className="w-3 h-3 text-emerald-600" />
            Available
          </span>
        );
      case 'Occupied':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded-full border border-indigo-200">
            <User className="w-3 h-3 text-indigo-600" />
            Occupied
          </span>
        );
      case 'Reserved':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
            <Clock className="w-3 h-3 text-amber-600" />
            Reserved
          </span>
        );
      case 'Maintenance':
        return (
          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200">
            <AlertTriangle className="w-3 h-3 text-rose-600" />
            Maintenance
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div id="bed-tab-content" className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="bed-search-input"
              type="text"
              value={filters.searchTerm}
              onChange={(e) => setFilters((p) => ({ ...p, searchTerm: e.target.value }))}
              placeholder="Search by bed code, number, room, patient, or MRN..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Ward */}
            <select
              id="bed-filter-ward"
              aria-label="Filter by ward"
              value={filters.wardId}
              onChange={(e) =>
                setFilters((p) => ({ ...p, wardId: e.target.value, roomId: 'All' }))
              }
              className="text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
            >
              <option value="All">All Wards</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name}
                </option>
              ))}
            </select>

            {/* Room */}
            <select
              id="bed-filter-room"
              aria-label="Filter by room"
              value={filters.roomId}
              onChange={(e) => setFilters((p) => ({ ...p, roomId: e.target.value }))}
              className="text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
            >
              <option value="All">All Rooms</option>
              {availableRoomsForFilter.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.roomNumber} - {r.name}
                </option>
              ))}
            </select>

            {/* Bed Type */}
            <select
              id="bed-filter-type"
              aria-label="Filter by bed type"
              value={filters.bedType}
              onChange={(e) => setFilters((p) => ({ ...p, bedType: e.target.value as any }))}
              className="text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
            >
              <option value="All">All Bed Types</option>
              {VALID_BED_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* Occupancy Status */}
            <select
              id="bed-filter-occupancy"
              aria-label="Filter by occupancy status"
              value={filters.occupancyStatus}
              onChange={(e) =>
                setFilters((p) => ({ ...p, occupancyStatus: e.target.value as any }))
              }
              className="text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
            >
              <option value="All">Occupancy: All</option>
              <option value="Available">Available</option>
              <option value="Occupied">Occupied</option>
              <option value="Reserved">Reserved</option>
              <option value="Maintenance">Maintenance</option>
            </select>

            {/* Operational Status */}
            <select
              id="bed-filter-operational"
              aria-label="Filter by operational status"
              value={filters.operationalStatus}
              onChange={(e) =>
                setFilters((p) => ({ ...p, operationalStatus: e.target.value as any }))
              }
              className="text-xs py-2 px-2.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
            >
              <option value="All">Operational: All</option>
              <option value="Active">Active In Service</option>
              <option value="Out of Service">Out of Service</option>
              <option value="Decommissioned">Decommissioned</option>
            </select>

            {isFiltered && (
              <button
                id="bed-reset-filters-btn"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}

            <button
              id="add-bed-btn"
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Bed
            </button>
          </div>
        </div>

        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Showing <strong className="text-slate-800 font-semibold">{filteredBeds.length}</strong> of{' '}
              {beds.length} configured beds
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      {filteredBeds.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#08775A] flex items-center justify-center mx-auto mb-3">
            <BedIcon className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No Beds Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            No hospital beds match your filter selection. Try clearing filters or create a new bed.
          </p>
          <button
            onClick={resetFilters}
            className="px-3.5 py-1.5 text-xs font-semibold text-[#08775A] bg-[#effaf5] border border-[#c2e7db] rounded-lg"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden flex flex-col">
          <div className="overflow-x-auto">
            <table id="beds-master-table" className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f1f5f9] border-b border-slate-300 text-[11px] font-bold text-slate-800 uppercase tracking-wider select-none sticky top-0 z-10">
                  <th className="py-2.5 px-3 text-center border-r border-slate-300 w-12">#</th>
                  <th className="py-2.5 px-3.5 border-r border-slate-300">Bed Code</th>
                  <th className="py-2.5 px-3.5 border-r border-slate-300">Bed Number</th>
                  <th className="py-2.5 px-3.5 border-r border-slate-300">Room</th>
                  <th className="py-2.5 px-3.5 border-r border-slate-300">Ward</th>
                  <th className="py-2.5 px-3.5 border-r border-slate-300">Bed Type</th>
                  <th className="py-2.5 px-3.5 text-center border-r border-slate-300">Occupancy Status</th>
                  <th className="py-2.5 px-3.5 text-center border-r border-slate-300">Operational Status</th>
                  <th className="py-2.5 px-3.5 border-r border-slate-300">Current Admitted Patient</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredBeds.map((b, idx) => {
                  const isOccupied = b.occupancyStatus === 'Occupied';
                  const hasHistory = (b.historicalAdmissionCount ?? 0) > 0;

                  return (
                    <tr
                      key={b.id}
                      id={`bed-row-${b.id}`}
                      className="hover:bg-slate-50/90 transition-colors group border-b border-slate-200"
                    >
                      {/* Sequence # */}
                      <td className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50/60 whitespace-nowrap">
                        {idx + 1}
                      </td>

                      {/* Bed Code */}
                      <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900 whitespace-nowrap border-r border-slate-200">
                        {b.code}
                      </td>

                      {/* Bed Number */}
                      <td className="py-2.5 px-3.5 font-semibold text-slate-800 whitespace-nowrap border-r border-slate-200">
                        {b.bedNumber}
                      </td>

                      {/* Room */}
                      <td className="py-2.5 px-3.5 text-slate-700 whitespace-nowrap border-r border-slate-200">
                        {b.roomId ? `${b.roomNumber} - ${b.roomName}` : <span className="text-slate-400 italic">Direct Ward Bed</span>}
                      </td>

                      {/* Ward */}
                      <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap border-r border-slate-200">
                        {b.wardName || <span className="text-slate-400 italic">Standalone</span>}
                      </td>

                      {/* Bed Type */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap border-r border-slate-200">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {b.bedType}
                        </span>
                      </td>

                      {/* Occupancy Status */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap border-r border-slate-200">
                        {getOccupancyBadge(b.occupancyStatus)}
                      </td>

                      {/* Operational Status */}
                      <td className="py-2.5 px-3.5 text-center whitespace-nowrap border-r border-slate-200">
                        {b.operationalStatus === 'Active' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-[#effaf5] px-2.5 py-0.5 rounded-full border border-[#c2e7db]">
                            <CheckCircle2 className="w-3 h-3 text-[#08775A]" />
                            In Service
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
                            <AlertTriangle className="w-3 h-3 text-amber-600" />
                            {b.operationalStatus}
                          </span>
                        )}
                      </td>

                      {/* Current Admitted Patient */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap border-r border-slate-200">
                        {isOccupied && b.currentPatientName ? (
                          <span className="font-semibold text-indigo-900 whitespace-nowrap" title={`MRN: ${b.currentPatientMrn || 'N/A'} • Adm: ${b.admissionDate || 'N/A'}`}>
                            {b.currentPatientName} <span className="text-[10px] text-indigo-600 font-mono font-normal">({b.currentPatientMrn || 'N/A'})</span>
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            id={`bed-view-btn-${b.id}`}
                            onClick={() => onView(b)}
                            title="View Bed Details"
                            className="p-1.5 text-slate-500 hover:text-[#08775A] hover:bg-[#effaf5] rounded-md transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            id={`bed-edit-btn-${b.id}`}
                            onClick={() => onEdit(b)}
                            title="Edit Bed"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            id={`bed-toggle-status-btn-${b.id}`}
                            onClick={() => onToggleOperational(b)}
                            disabled={isOccupied}
                            title={
                              isOccupied
                                ? 'Cannot take bed out of service: Bed is currently occupied by admitted patient.'
                                : b.operationalStatus === 'Active'
                                ? 'Take Bed Out of Service'
                                : 'Return Bed to Active Service'
                            }
                            className={`p-1.5 rounded-md transition-colors ${
                              isOccupied
                                ? 'text-slate-300 cursor-not-allowed'
                                : b.operationalStatus === 'Active'
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {b.operationalStatus === 'Active' ? (
                              <PowerOff className="w-4 h-4" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            id={`bed-delete-btn-${b.id}`}
                            onClick={() => onDelete(b)}
                            disabled={isOccupied || hasHistory}
                            title={
                              isOccupied
                                ? 'Cannot delete: Bed is currently occupied.'
                                : hasHistory
                                ? 'Cannot delete: Bed has historical admissions. Decommission instead.'
                                : 'Delete Bed'
                            }
                            className={`p-1.5 rounded-md transition-colors ${
                              isOccupied || hasHistory
                                ? 'text-slate-300 cursor-not-allowed'
                                : 'text-rose-500 hover:text-rose-700 hover:bg-rose-50'
                            }`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
