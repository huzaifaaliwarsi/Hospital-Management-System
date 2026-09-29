import React, { useState } from 'react';
import {
  Search,
  RotateCcw,
  Plus,
  Eye,
  Edit2,
  Trash2,
  CheckCircle2,
  XCircle,
  Building,
  PowerOff,
  Power,
  Filter,
} from 'lucide-react';
import { Room, RoomFilterState, Ward } from '../../../types/wardsRoomsBeds';
import { VALID_ROOM_TYPES } from '../../../services/wardsRoomsBedsService';

interface RoomTabProps {
  rooms: Room[];
  wards: Ward[];
  onAdd: () => void;
  onView: (room: Room) => void;
  onEdit: (room: Room) => void;
  onToggleStatus: (room: Room) => void;
  onDelete: (room: Room) => void;
}

export const RoomTab: React.FC<RoomTabProps> = ({
  rooms,
  wards,
  onAdd,
  onView,
  onEdit,
  onToggleStatus,
  onDelete,
}) => {
  const [filters, setFilters] = useState<RoomFilterState>({
    searchTerm: '',
    wardId: 'All',
    roomType: 'All',
    status: 'All',
  });

  const filteredRooms = rooms.filter((r) => {
    if (filters.searchTerm.trim()) {
      const q = filters.searchTerm.toLowerCase().trim();
      const mCode = r.code.toLowerCase().includes(q);
      const mNum = r.roomNumber.toLowerCase().includes(q);
      const mName = r.name.toLowerCase().includes(q);
      const mWard = r.wardName.toLowerCase().includes(q);
      if (!mCode && !mNum && !mName && !mWard) return false;
    }
    if (filters.wardId === 'STANDALONE' && r.wardId) return false;
    else if (filters.wardId !== 'All' && filters.wardId !== 'STANDALONE' && r.wardId !== filters.wardId) return false;
    if (filters.roomType !== 'All' && r.roomType !== filters.roomType) return false;
    if (filters.status !== 'All' && r.status !== filters.status) return false;
    return true;
  });

  const isFiltered =
    filters.searchTerm.trim() !== '' ||
    filters.wardId !== 'All' ||
    filters.roomType !== 'All' ||
    filters.status !== 'All';

  const resetFilters = () => {
    setFilters({
      searchTerm: '',
      wardId: 'All',
      roomType: 'All',
      status: 'All',
    });
  };

  return (
    <div id="room-tab-content" className="space-y-4">
      {/* Search & Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs">
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              id="room-search-input"
              type="text"
              value={filters.searchTerm}
              onChange={(e) => setFilters((p) => ({ ...p, searchTerm: e.target.value }))}
              placeholder="Search by room code, number, name, or ward..."
              className="w-full pl-9 pr-4 py-2 text-xs bg-slate-50 border border-slate-200 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Ward */}
            <select
              id="room-filter-ward"
              aria-label="Filter by ward"
              value={filters.wardId}
              onChange={(e) => setFilters((p) => ({ ...p, wardId: e.target.value }))}
              className="text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
            >
              <option value="All">All Wards</option>
              <option value="STANDALONE">Standalone (No Ward)</option>
              {wards.map((w) => (
                <option key={w.id} value={w.id}>
                  {w.name} ({w.code})
                </option>
              ))}
            </select>

            {/* Room Type */}
            <select
              id="room-filter-type"
              aria-label="Filter by room type"
              value={filters.roomType}
              onChange={(e) => setFilters((p) => ({ ...p, roomType: e.target.value as any }))}
              className="text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
            >
              <option value="All">All Room Types</option>
              {VALID_ROOM_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>

            {/* Status */}
            <select
              id="room-filter-status"
              aria-label="Filter by status"
              value={filters.status}
              onChange={(e) => setFilters((p) => ({ ...p, status: e.target.value as any }))}
              className="text-xs py-2 px-3 bg-slate-50 border border-slate-200 rounded-lg text-slate-700 font-medium focus:outline-hidden focus:ring-2 focus:ring-[#08775A]/20 focus:border-[#08775A]"
            >
              <option value="All">All Statuses</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
            </select>

            {isFiltered && (
              <button
                id="room-reset-filters-btn"
                onClick={resetFilters}
                className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-2 text-rose-600 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}

            <button
              id="add-room-btn"
              onClick={onAdd}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add Room
            </button>
          </div>
        </div>

        <div className="mt-2.5 pt-2.5 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-slate-400" />
            <span>
              Showing <strong className="text-slate-800 font-semibold">{filteredRooms.length}</strong> of{' '}
              {rooms.length} rooms
            </span>
          </div>
        </div>
      </div>

      {/* Table */}
      {filteredRooms.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200/80 p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#08775A] flex items-center justify-center mx-auto mb-3">
            <Building className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800">No Rooms Found</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-4">
            No inpatient rooms match your filter selection. Try clearing filters or create a new room.
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
            <table id="rooms-master-table" className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#f1f5f9] border-b border-slate-300 text-[11px] font-bold text-slate-800 uppercase tracking-wider select-none sticky top-0 z-10">
                  <th className="py-2.5 px-3 text-center border-r border-slate-300 w-12">#</th>
                  <th className="py-2.5 px-3.5 border-r border-slate-300">Room Code</th>
                  <th className="py-2.5 px-3.5 border-r border-slate-300">Room Number</th>
                  <th className="py-2.5 px-3.5 border-r border-slate-300">Room Name</th>
                  <th className="py-2.5 px-3.5 border-r border-slate-300">Ward</th>
                  <th className="py-2.5 px-3.5 border-r border-slate-300">Department</th>
                  <th className="py-2.5 px-3.5 border-r border-slate-300">Type</th>
                  <th className="py-2.5 px-3 text-center border-r border-slate-300">Capacity</th>
                  <th className="py-2.5 px-3 text-center border-r border-slate-300">Beds Configured</th>
                  <th className="py-2.5 px-3.5 text-right border-r border-slate-300">Daily Rate</th>
                  <th className="py-2.5 px-3 text-center border-r border-slate-300">Status</th>
                  <th className="py-2.5 px-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {filteredRooms.map((r, idx) => {
                  const hasBedsOrAdmissions =
                    (r.bedsConfigured ?? 0) > 0 || (r.admissionLinkageCount ?? 0) > 0;

                  return (
                    <tr
                      key={r.id}
                      id={`room-row-${r.id}`}
                      className="hover:bg-slate-50/90 transition-colors group border-b border-slate-200"
                    >
                      {/* Sequence # */}
                      <td className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-500 font-mono text-[11px] bg-slate-50/60 whitespace-nowrap">
                        {idx + 1}
                      </td>

                      {/* Room Code */}
                      <td className="py-2.5 px-3.5 font-mono font-bold text-slate-900 whitespace-nowrap border-r border-slate-200">
                        {r.code}
                      </td>

                      {/* Room Number */}
                      <td className="py-2.5 px-3.5 font-semibold text-slate-800 whitespace-nowrap border-r border-slate-200">
                        {r.roomNumber}
                      </td>

                      {/* Room Name */}
                      <td className="py-2.5 px-3.5 font-medium text-slate-800 whitespace-nowrap border-r border-slate-200">
                        {r.name}
                      </td>

                      {/* Ward */}
                      <td className="py-2.5 px-3.5 text-slate-700 whitespace-nowrap border-r border-slate-200">
                        {r.wardName || <span className="text-slate-400 italic">Standalone</span>}
                      </td>

                      {/* Department */}
                      <td className="py-2.5 px-3.5 text-slate-600 whitespace-nowrap border-r border-slate-200">
                        {r.departmentName || '—'}
                      </td>

                      {/* Type */}
                      <td className="py-2.5 px-3.5 whitespace-nowrap border-r border-slate-200">
                        <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-700 border border-slate-200">
                          {r.roomType}
                        </span>
                      </td>

                      {/* Capacity */}
                      <td className="py-2.5 px-3 text-center text-slate-700 border-r border-slate-200 whitespace-nowrap">
                        {r.capacity}
                      </td>

                      {/* Beds Configured */}
                      <td className="py-2.5 px-3 text-center border-r border-slate-200 whitespace-nowrap">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full font-bold ${
                            r.bedsConfigured > r.capacity
                              ? 'text-rose-700 bg-rose-50 border border-rose-200'
                              : 'text-slate-800 bg-slate-100'
                          }`}
                        >
                          {r.bedsConfigured}
                        </span>
                      </td>

                      {/* Daily Rate */}
                      <td className="py-2.5 px-3.5 text-right font-bold text-slate-900 whitespace-nowrap border-r border-slate-200 font-mono">
                        PKR {(r.dailyRoomRate ?? 0).toLocaleString('en-PK')}
                      </td>

                      {/* Status */}
                      <td className="py-2.5 px-3 text-center whitespace-nowrap border-r border-slate-200">
                        {r.status === 'Active' ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-[#effaf5] px-2 py-0.5 rounded-full border border-[#c2e7db]">
                            <CheckCircle2 className="w-3 h-3 text-[#08775A]" />
                            Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full border border-slate-200">
                            <XCircle className="w-3 h-3 text-slate-400" />
                            Inactive
                          </span>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-2.5 px-3.5 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            id={`room-view-btn-${r.id}`}
                            onClick={() => onView(r)}
                            title="View Room Details"
                            className="p-1.5 text-slate-500 hover:text-[#08775A] hover:bg-[#effaf5] rounded-md transition-colors"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            id={`room-edit-btn-${r.id}`}
                            onClick={() => onEdit(r)}
                            title="Edit Room"
                            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-md transition-colors"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            id={`room-toggle-status-btn-${r.id}`}
                            onClick={() => onToggleStatus(r)}
                            title={r.status === 'Active' ? 'Deactivate Room' : 'Activate Room'}
                            className={`p-1.5 rounded-md transition-colors ${
                              r.status === 'Active'
                                ? 'text-amber-600 hover:bg-amber-50'
                                : 'text-emerald-600 hover:bg-emerald-50'
                            }`}
                          >
                            {r.status === 'Active' ? (
                              <PowerOff className="w-4 h-4" />
                            ) : (
                              <Power className="w-4 h-4" />
                            )}
                          </button>
                          <button
                            id={`room-delete-btn-${r.id}`}
                            onClick={() => onDelete(r)}
                            title={
                              hasBedsOrAdmissions
                                ? `Cannot delete: contains ${r.bedsConfigured} bed(s)`
                                : 'Delete Room'
                            }
                            className={`p-1.5 rounded-md transition-colors ${
                              hasBedsOrAdmissions
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
