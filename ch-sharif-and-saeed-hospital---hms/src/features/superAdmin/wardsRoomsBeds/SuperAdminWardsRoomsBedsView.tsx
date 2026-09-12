import React, { useState, useEffect, useMemo } from 'react';
import {
  LayoutGrid,
  Building,
  Bed as BedIcon,
  Plus,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  Ward,
  Room,
  Bed,
  WardFormValues,
  RoomFormValues,
  BedFormValues,
} from '../../../types/wardsRoomsBeds';
import { WardsRoomsBedsService } from '../../../services/wardsRoomsBedsService';
import { DepartmentService } from '../../../services/departmentService';
import { WardsRoomsBedsTopSummary } from './WardsRoomsBedsTopSummary';
import { WardTab } from './WardTab';
import { RoomTab } from './RoomTab';
import { BedTab } from './BedTab';
import { WardModal } from './WardModal';
import { RoomModal } from './RoomModal';
import { BedModal } from './BedModal';
import { WardDetailModal } from './WardDetailModal';
import { RoomDetailModal } from './RoomDetailModal';
import { BedDetailModal } from './BedDetailModal';
import { WardsRoomsBedsExportModal } from './WardsRoomsBedsExportModal';
import { WardsRoomsBedsImportModal } from './WardsRoomsBedsImportModal';
import {
  downloadWardsPDF,
  downloadRoomsPDF,
  downloadBedsPDF,
} from '../../../services/wardsRoomsBedsExportService';

interface SuperAdminWardsRoomsBedsViewProps {
  initialTab?: 'wards' | 'rooms' | 'beds';
}

export const SuperAdminWardsRoomsBedsView: React.FC<
  SuperAdminWardsRoomsBedsViewProps
> = ({ initialTab = 'wards' }) => {
  const { currentUser } = useAuth();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'wards' | 'rooms' | 'beds'>(initialTab);

  // Entities
  const [wards, setWards] = useState<Ward[]>([]);
  const [rooms, setRooms] = useState<Room[]>([]);
  const [beds, setBeds] = useState<Bed[]>([]);

  // Modals
  const [isWardModalOpen, setIsWardModalOpen] = useState(false);
  const [selectedWard, setSelectedWard] = useState<Ward | null>(null);

  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);

  const [isBedModalOpen, setIsBedModalOpen] = useState(false);
  const [selectedBed, setSelectedBed] = useState<Bed | null>(null);

  // Detail Modals
  const [isWardDetailOpen, setIsWardDetailOpen] = useState(false);
  const [isRoomDetailOpen, setIsRoomDetailOpen] = useState(false);
  const [isBedDetailOpen, setIsBedDetailOpen] = useState(false);

  // Export / Import Modals
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);

  // Delete Prompt
  const [itemToDelete, setItemToDelete] = useState<{
    type: 'ward' | 'room' | 'bed';
    item: any;
  } | null>(null);

  // Toast
  const [toast, setToast] = useState<{
    type: 'success' | 'warning' | 'error';
    message: string;
  } | null>(null);

  const showToast = (type: 'success' | 'warning' | 'error', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  const loadData = () => {
    setWards(WardsRoomsBedsService.getWards());
    setRooms(WardsRoomsBedsService.getRooms());
    setBeds(WardsRoomsBedsService.getBeds());
  };

  useEffect(() => {
    loadData();
  }, []);

  const departments = useMemo(() => {
    return DepartmentService.getDepartments();
  }, []);

  const summary = useMemo(() => {
    return WardsRoomsBedsService.getTopSummary();
  }, [wards, rooms, beds]);

  // Direct PDF Download handler
  const handleDirectDownloadPDF = async () => {
    try {
      if (activeTab === 'wards') {
        await downloadWardsPDF(wards, currentUser);
        showToast('success', 'Wards Directory PDF downloaded.');
      } else if (activeTab === 'rooms') {
        await downloadRoomsPDF(rooms, currentUser);
        showToast('success', 'Rooms Directory PDF downloaded.');
      } else {
        await downloadBedsPDF(beds, currentUser);
        showToast('success', 'Beds Directory PDF downloaded.');
      }
    } catch (err) {
      showToast('error', 'Failed to generate PDF.');
    }
  };

  // Ward CRUD
  const handleSaveWard = (values: WardFormValues) => {
    try {
      if (selectedWard) {
        WardsRoomsBedsService.updateWard(selectedWard.id, values, currentUser);
        showToast('success', `Ward "${values.name}" updated successfully.`);
      } else {
        WardsRoomsBedsService.createWard(values, currentUser);
        showToast('success', `Ward "${values.name}" created successfully.`);
      }
      setIsWardModalOpen(false);
      setSelectedWard(null);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save ward.');
    }
  };

  const handleToggleWardStatus = (w: Ward) => {
    try {
      const nextStatus = w.status === 'Active' ? 'Inactive' : 'Active';
      WardsRoomsBedsService.changeWardStatus(w.id, nextStatus, currentUser);
      showToast('success', `Ward "${w.name}" marked as ${nextStatus}.`);
      loadData();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleDeleteWardPrompt = (w: Ward) => {
    const hasRooms = (w.roomCount ?? 0) > 0;
    const hasBeds = (w.bedCount ?? 0) > 0;
    const hasHistory = (w.historicalAdmissionCount ?? 0) > 0;

    if (hasRooms || hasBeds || hasHistory) {
      showToast(
        'warning',
        `Cannot delete Ward "${w.name}": Contains ${w.roomCount} room(s), ${w.bedCount} bed(s), or historical admissions. Deactivate it instead.`
      );
      return;
    }
    setItemToDelete({ type: 'ward', item: w });
  };

  // Room CRUD
  const handleSaveRoom = (values: RoomFormValues) => {
    try {
      if (selectedRoom) {
        WardsRoomsBedsService.updateRoom(selectedRoom.id, values, currentUser);
        showToast('success', `Room "${values.name}" updated successfully.`);
      } else {
        WardsRoomsBedsService.createRoom(values, currentUser);
        showToast('success', `Room "${values.name}" created successfully.`);
      }
      setIsRoomModalOpen(false);
      setSelectedRoom(null);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save room.');
    }
  };

  const handleToggleRoomStatus = (r: Room) => {
    try {
      const nextStatus = r.status === 'Active' ? 'Inactive' : 'Active';
      WardsRoomsBedsService.changeRoomStatus(r.id, nextStatus, currentUser);
      showToast('success', `Room "${r.name}" marked as ${nextStatus}.`);
      loadData();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleDeleteRoomPrompt = (r: Room) => {
    const hasBeds = (r.bedsConfigured ?? 0) > 0;
    const hasHistory = (r.admissionLinkageCount ?? 0) > 0;

    if (hasBeds || hasHistory) {
      showToast(
        'warning',
        `Cannot delete Room "${r.name}": Contains ${r.bedsConfigured} configured bed(s) or historical admissions. Deactivate it instead.`
      );
      return;
    }
    setItemToDelete({ type: 'room', item: r });
  };

  // Bed CRUD
  const handleSaveBed = (values: BedFormValues) => {
    try {
      if (selectedBed) {
        WardsRoomsBedsService.updateBed(selectedBed.id, values, currentUser);
        showToast('success', `Bed "${values.bedNumber}" updated successfully.`);
      } else {
        WardsRoomsBedsService.createBed(values, currentUser);
        showToast('success', `Bed "${values.bedNumber}" created successfully.`);
      }
      setIsBedModalOpen(false);
      setSelectedBed(null);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save bed.');
    }
  };

  const handleToggleBedOperational = (b: Bed) => {
    try {
      if (b.occupancyStatus === 'Occupied') {
        showToast('warning', 'Cannot change operational status: Bed is currently occupied.');
        return;
      }
      const nextStatus = b.operationalStatus === 'Active' ? 'Out of Service' : 'Active';
      WardsRoomsBedsService.changeBedOperationalStatus(b.id, nextStatus, currentUser);
      showToast('success', `Bed "${b.bedNumber}" is now ${nextStatus}.`);
      loadData();
    } catch (err: any) {
      showToast('error', err.message);
    }
  };

  const handleDeleteBedPrompt = (b: Bed) => {
    if (b.occupancyStatus === 'Occupied') {
      showToast('warning', `Cannot delete Bed "${b.bedNumber}": Currently occupied.`);
      return;
    }
    if ((b.historicalAdmissionCount ?? 0) > 0) {
      showToast(
        'warning',
        `Cannot delete Bed "${b.bedNumber}": Has historical patient admissions. Decommission instead.`
      );
      return;
    }
    setItemToDelete({ type: 'bed', item: b });
  };

  // Confirm delete
  const handleConfirmDelete = () => {
    if (!itemToDelete) return;
    const { type, item } = itemToDelete;

    if (type === 'ward') {
      const res = WardsRoomsBedsService.deleteWard(item.id);
      if (res.success) {
        showToast('success', `Ward "${item.name}" deleted.`);
      } else {
        showToast('error', res.message || 'Failed to delete ward.');
      }
    } else if (type === 'room') {
      const res = WardsRoomsBedsService.deleteRoom(item.id);
      if (res.success) {
        showToast('success', `Room "${item.name}" deleted.`);
      } else {
        showToast('error', res.message || 'Failed to delete room.');
      }
    } else if (type === 'bed') {
      const res = WardsRoomsBedsService.deleteBed(item.id);
      if (res.success) {
        showToast('success', `Bed "${item.bedNumber}" deleted.`);
      } else {
        showToast('error', res.message || 'Failed to delete bed.');
      }
    }

    setItemToDelete(null);
    loadData();
  };

  return (
    <div id="super-admin-wards-rooms-beds-view" className="p-6 max-w-7xl mx-auto">
      {/* Toast */}
      {toast && (
        <div
          id="wrb-toast-banner"
          className={`mb-4 p-4 rounded-xl border flex items-center justify-between shadow-xs transition-all ${
            toast.type === 'success'
              ? 'bg-[#effaf5] border-[#c2e7db] text-[#08775A]'
              : toast.type === 'warning'
              ? 'bg-amber-50 border-amber-200 text-amber-800'
              : 'bg-rose-50 border-rose-200 text-rose-800'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {toast.type === 'success' && <CheckCircle2 className="w-4 h-4 shrink-0" />}
            {toast.type === 'warning' && <AlertTriangle className="w-4 h-4 shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 shrink-0" />}
            <span>{toast.message}</span>
          </div>
          <button
            onClick={() => setToast(null)}
            className="text-xs font-bold opacity-70 hover:opacity-100"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Inpatient Facility: Wards, Rooms & Beds
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
              Capacity Master
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Hierarchical inpatient management, synchronized bed census, daily tariffs, and operational governance
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick PDF Download */}
          <button
            id="wrb-quick-pdf-btn"
            onClick={handleDirectDownloadPDF}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Download PDF
          </button>

          {/* Export Options */}
          <button
            id="wrb-export-menu-btn"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export Options...
          </button>

          {/* Import Excel */}
          <button
            id="wrb-import-excel-btn"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 shadow-xs transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            Import Excel
          </button>

          {/* Add item for current tab */}
          <button
            id="wrb-add-primary-btn"
            onClick={() => {
              if (activeTab === 'wards') {
                setSelectedWard(null);
                setIsWardModalOpen(true);
              } else if (activeTab === 'rooms') {
                setSelectedRoom(null);
                setIsRoomModalOpen(true);
              } else {
                setSelectedBed(null);
                setIsBedModalOpen(true);
              }
            }}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg shadow-xs transition-colors"
          >
            <Plus className="w-4 h-4" />
            {activeTab === 'wards'
              ? 'Add Ward'
              : activeTab === 'rooms'
              ? 'Add Room'
              : 'Add Bed'}
          </button>
        </div>
      </div>

      {/* Top Reconciled Summary */}
      <WardsRoomsBedsTopSummary summary={summary} />

      {/* Navigation Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200 mb-5">
        <button
          id="wrb-tab-wards"
          onClick={() => setActiveTab('wards')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'wards'
              ? 'border-[#08775A] text-[#08775A] bg-[#effaf5]/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>Wards</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'wards'
                ? 'bg-[#08775A] text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {wards.length}
          </span>
        </button>

        <button
          id="wrb-tab-rooms"
          onClick={() => setActiveTab('rooms')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'rooms'
              ? 'border-[#08775A] text-[#08775A] bg-[#effaf5]/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <Building className="w-4 h-4" />
          <span>Rooms</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'rooms'
                ? 'bg-[#08775A] text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {rooms.length}
          </span>
        </button>

        <button
          id="wrb-tab-beds"
          onClick={() => setActiveTab('beds')}
          className={`flex items-center gap-2 py-3 px-4 text-xs font-bold border-b-2 transition-colors ${
            activeTab === 'beds'
              ? 'border-[#08775A] text-[#08775A] bg-[#effaf5]/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BedIcon className="w-4 h-4" />
          <span>Beds</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] ${
              activeTab === 'beds'
                ? 'bg-[#08775A] text-white'
                : 'bg-slate-100 text-slate-600'
            }`}
          >
            {beds.length}
          </span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'wards' && (
        <WardTab
          wards={wards}
          departments={departments}
          onAdd={() => {
            setSelectedWard(null);
            setIsWardModalOpen(true);
          }}
          onView={(w) => {
            setSelectedWard(w);
            setIsWardDetailOpen(true);
          }}
          onEdit={(w) => {
            setSelectedWard(w);
            setIsWardModalOpen(true);
          }}
          onToggleStatus={handleToggleWardStatus}
          onDelete={handleDeleteWardPrompt}
        />
      )}

      {activeTab === 'rooms' && (
        <RoomTab
          rooms={rooms}
          wards={wards}
          onAdd={() => {
            setSelectedRoom(null);
            setIsRoomModalOpen(true);
          }}
          onView={(r) => {
            setSelectedRoom(r);
            setIsRoomDetailOpen(true);
          }}
          onEdit={(r) => {
            setSelectedRoom(r);
            setIsRoomModalOpen(true);
          }}
          onToggleStatus={handleToggleRoomStatus}
          onDelete={handleDeleteRoomPrompt}
        />
      )}

      {activeTab === 'beds' && (
        <BedTab
          beds={beds}
          wards={wards}
          rooms={rooms}
          onAdd={() => {
            setSelectedBed(null);
            setIsBedModalOpen(true);
          }}
          onView={(b) => {
            setSelectedBed(b);
            setIsBedDetailOpen(true);
          }}
          onEdit={(b) => {
            setSelectedBed(b);
            setIsBedModalOpen(true);
          }}
          onToggleOperational={handleToggleBedOperational}
          onDelete={handleDeleteBedPrompt}
        />
      )}

      {/* Modals */}
      <WardModal
        isOpen={isWardModalOpen}
        onClose={() => {
          setIsWardModalOpen(false);
          setSelectedWard(null);
        }}
        onSave={handleSaveWard}
        ward={selectedWard}
        departments={departments}
      />

      <RoomModal
        isOpen={isRoomModalOpen}
        onClose={() => {
          setIsRoomModalOpen(false);
          setSelectedRoom(null);
        }}
        onSave={handleSaveRoom}
        room={selectedRoom}
        wards={wards}
      />

      <BedModal
        isOpen={isBedModalOpen}
        onClose={() => {
          setIsBedModalOpen(false);
          setSelectedBed(null);
        }}
        onSave={handleSaveBed}
        bed={selectedBed}
        wards={wards}
        rooms={rooms}
      />

      <WardDetailModal
        isOpen={isWardDetailOpen}
        onClose={() => {
          setIsWardDetailOpen(false);
          setSelectedWard(null);
        }}
        ward={selectedWard}
        rooms={rooms}
        onEdit={(w) => {
          setSelectedWard(w);
          setIsWardModalOpen(true);
        }}
        onToggleStatus={handleToggleWardStatus}
      />

      <RoomDetailModal
        isOpen={isRoomDetailOpen}
        onClose={() => {
          setIsRoomDetailOpen(false);
          setSelectedRoom(null);
        }}
        room={selectedRoom}
        beds={beds}
        onEdit={(r) => {
          setSelectedRoom(r);
          setIsRoomModalOpen(true);
        }}
        onToggleStatus={handleToggleRoomStatus}
      />

      <BedDetailModal
        isOpen={isBedDetailOpen}
        onClose={() => {
          setIsBedDetailOpen(false);
          setSelectedBed(null);
        }}
        bed={selectedBed}
        onEdit={(b) => {
          setSelectedBed(b);
          setIsBedModalOpen(true);
        }}
        onToggleOperational={handleToggleBedOperational}
      />

      <WardsRoomsBedsExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        activeTab={activeTab}
        wards={wards}
        rooms={rooms}
        beds={beds}
        currentUser={currentUser}
      />

      <WardsRoomsBedsImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        activeTab={activeTab}
        wards={wards}
        rooms={rooms}
        beds={beds}
        currentUser={currentUser}
        onImportComplete={(entity, count) => {
          setIsImportModalOpen(false);
          showToast('success', `Imported ${count} ${entity} records successfully.`);
          loadData();
        }}
      />

      {/* Delete Confirmation Modal */}
      {itemToDelete && (
        <div
          id="wrb-delete-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
        >
          <div className="bg-white max-w-md w-full rounded-2xl p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-800">
                Confirm {itemToDelete.type.toUpperCase()} Deletion
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to permanently delete{' '}
                <strong className="text-slate-700">
                  {itemToDelete.item.code || itemToDelete.item.bedNumber} —{' '}
                  {itemToDelete.item.name || itemToDelete.item.bedNumber}
                </strong>
                ?
              </p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              This action cannot be undone. Only unlinked records with zero child items and zero admission records can be deleted.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setItemToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                id="wrb-confirm-delete-btn"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
              >
                Delete Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
