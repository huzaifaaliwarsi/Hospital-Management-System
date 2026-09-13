import React, { useState, useEffect, useMemo } from 'react';
import {
  Users,
  Plus,
  FileSpreadsheet,
  Download,
  RotateCw,
  Printer,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Loader2,
} from 'lucide-react';
import {
  StaffUser,
  StaffUserFilterState,
  StaffUserFormValues,
  StaffStatus,
} from '../../../types/staffUser';
import { StaffUserService, fetchStaffUsers } from '../../../services/staffUserService';
import { DepartmentService } from '../../../services/departmentService';
import { Department } from '../../../types/department';
import { useAuth } from '../../../context/AuthContext';
import { StaffUsersKPIBar } from './StaffUsersKPIBar';
import { StaffUsersFilterBar } from './StaffUsersFilterBar';
import { StaffUsersTable } from './StaffUsersTable';
import { StaffUserModal } from './StaffUserModal';
import { StaffUserDetailModal } from './StaffUserDetailModal';
import { StaffUserResetPasswordModal } from './StaffUserResetPasswordModal';
import { StaffUserStatusModal } from './StaffUserStatusModal';
import { StaffUserDeleteModal } from './StaffUserDeleteModal';
import { StaffUserImportModal } from './StaffUserImportModal';
import { StaffUserExportModal } from './StaffUserExportModal';
import { StaffUserDossierModal } from './StaffUserDossierModal';

const DEFAULT_FILTERS: StaffUserFilterState = {
  searchTerm: '',
  departmentId: 'ALL',
  staffCategory: 'ALL',
  accessType: 'ALL',
  assignedPortal: 'ALL',
  status: 'ALL',
  staffRole: 'ALL',
};

export const SuperAdminStaffUsersView: React.FC = () => {
  const { currentUser } = useAuth();
  const [staffList, setStaffList] = useState<StaffUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [filters, setFilters] = useState<StaffUserFilterState>(DEFAULT_FILTERS);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffUser | null>(null);
  const [viewingStaff, setViewingStaff] = useState<StaffUser | null>(null);
  const [resetPasswordStaff, setResetPasswordStaff] = useState<StaffUser | null>(null);
  const [statusTarget, setStatusTarget] = useState<{
    staff: StaffUser;
    status: StaffStatus;
  } | null>(null);
  const [deletingStaff, setDeletingStaff] = useState<StaffUser | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [dossierStaff, setDossierStaff] = useState<StaffUser | null>(null);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState<{
    type: 'success' | 'error';
    text: string;
  } | null>(null);

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setToastMessage({ text, type });
    setTimeout(() => {
      setToastMessage(null);
    }, 4000);
  };

  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load staff and departments
  const refreshData = async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const list = await fetchStaffUsers();
      setStaffList(list);
      const depts = DepartmentService.getDepartments();
      setDepartments(depts);
    } catch (err: any) {
      setLoadError(err?.message || 'Failed to load staff users from the server.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    refreshData();
  }, []);

  // Filtered staff list
  const filteredStaff = useMemo(() => {
    return StaffUserService.filterStaffUsers(staffList, filters);
  }, [staffList, filters]);

  // Handlers for Add/Edit
  const handleSaveStaff = async (values: StaffUserFormValues) => {
    if (editingStaff) {
      // Edit
      const res = await StaffUserService.updateStaffUser(editingStaff.id, values, currentUser);
      if (res.success && res.user) {
        showToast(`Staff member "${res.user.fullName}" updated successfully.`);
        setEditingStaff(null);
        await refreshData();
      } else {
        showToast(res.error || 'Failed to update staff user.', 'error');
      }
    } else {
      // Add
      const res = await StaffUserService.createStaffUser(values, currentUser);
      if (res.success && res.user) {
        showToast(`Staff member "${res.user.fullName}" added successfully.`);
        setIsAddModalOpen(false);
        await refreshData();
      } else {
        showToast(res.error || 'Failed to add staff user.', 'error');
      }
    }
  };

  // Handler for direct print of directory
  const handlePrintDirectory = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-500 gap-2 text-sm">
        <Loader2 className="h-5 w-5 animate-spin" />
        <span>Loading staff users…</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
        <AlertCircle className="h-8 w-8 text-rose-500" />
        <p className="text-sm text-rose-700 font-medium">{loadError}</p>
        <button
          type="button"
          onClick={refreshData}
          className="px-4 py-2 bg-[#129b70] hover:bg-[#0e7d5a] text-white text-xs font-semibold rounded-lg"
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Toast Notification Banner */}
      {toastMessage && (
        <div
          className={`p-4 rounded-xl border flex items-center justify-between transition-all duration-300 ${
            toastMessage.type === 'success'
              ? 'bg-[#e7f6f1] border-[#c2e7db] text-[#0e7d5a]'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <div className="flex items-center gap-2.5 text-xs font-semibold">
            {toastMessage.type === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-[#129b70]" />
            ) : (
              <AlertCircle className="h-4 w-4 text-red-600" />
            )}
            <span>{toastMessage.text}</span>
          </div>
          <button
            onClick={() => setToastMessage(null)}
            className="text-xs opacity-70 hover:opacity-100 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="h-10 w-10 rounded-xl bg-[#e7f6f1] text-[#129b70] flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-[#111827] tracking-tight">
                Staff Users Management
              </h1>
              <p className="text-xs text-[#52665e]">
                Executive management of clinical, operational, and administrative hospital staff & workstation access
              </p>
            </div>
          </div>
        </div>

        {/* Action Header Buttons */}
        <div className="flex items-center flex-wrap gap-2.5">
          <button
            onClick={refreshData}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#52665e] hover:text-[#111827] bg-white border border-[#e2eae5] hover:bg-[#f6f8f7] rounded-lg transition-colors cursor-pointer shadow-xs"
            title="Refresh staff records"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Refresh</span>
          </button>

          <button
            onClick={() => setIsImportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#0e7d5a] bg-[#e7f6f1] hover:bg-[#d0efe5] border border-[#c2e7db] rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <FileSpreadsheet className="h-3.5 w-3.5 text-[#129b70]" />
            <span>Import Excel</span>
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#52665e] hover:text-[#111827] bg-white border border-[#e2eae5] hover:bg-[#f6f8f7] rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Download className="h-3.5 w-3.5 text-[#129b70]" />
            <span>Export Directory</span>
          </button>

          <button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#129b70] hover:bg-[#0e7d5a] rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Plus className="h-4 w-4" />
            <span>Add Staff User</span>
          </button>
        </div>
      </div>

      {/* KPI Summary Bar */}
      <StaffUsersKPIBar staffList={staffList} />

      {/* Filter and Search Bar */}
      <StaffUsersFilterBar
        filters={filters}
        onFilterChange={setFilters}
        departments={departments}
        totalMatches={filteredStaff.length}
        totalRecords={staffList.length}
      />

      {/* Primary Staff Table */}
      <StaffUsersTable
        staffList={filteredStaff}
        onView={(staff) => setViewingStaff(staff)}
        onEdit={(staff) => setEditingStaff(staff)}
        onResetPassword={(staff) => setResetPasswordStaff(staff)}
        onOpenStatusModal={(staff, targetStatus) =>
          setStatusTarget({ staff, status: targetStatus })
        }
        onDelete={(staff) => setDeletingStaff(staff)}
      />

      {/* MODAL 1: Add/Edit Staff Modal */}
      {(isAddModalOpen || editingStaff) && (
        <StaffUserModal
          isOpen={isAddModalOpen || Boolean(editingStaff)}
          onClose={() => {
            setIsAddModalOpen(false);
            setEditingStaff(null);
          }}
          onSave={handleSaveStaff}
          editingStaff={editingStaff}
          departments={departments}
        />
      )}

      {/* MODAL 2: View Staff Detail Drawer */}
      {viewingStaff && (
        <StaffUserDetailModal
          isOpen={Boolean(viewingStaff)}
          onClose={() => setViewingStaff(null)}
          staff={viewingStaff}
          onEdit={(staff) => {
            setViewingStaff(null);
            setEditingStaff(staff);
          }}
          onPrintDossier={(staff) => {
            setViewingStaff(null);
            setDossierStaff(staff);
          }}
        />
      )}

      {/* MODAL 3: Reset Password Modal */}
      {resetPasswordStaff && (
        <StaffUserResetPasswordModal
          isOpen={Boolean(resetPasswordStaff)}
          onClose={() => setResetPasswordStaff(null)}
          staff={resetPasswordStaff}
          onSuccess={() => {
            showToast(`Password reset for ${resetPasswordStaff.fullName}.`);
            refreshData();
          }}
        />
      )}

      {/* MODAL 4: Status Update Modal */}
      {statusTarget && (
        <StaffUserStatusModal
          isOpen={Boolean(statusTarget)}
          onClose={() => setStatusTarget(null)}
          staff={statusTarget.staff}
          targetStatus={statusTarget.status}
          onSuccess={(updatedStaff) => {
            showToast(
              `Status for "${updatedStaff.fullName}" updated to ${updatedStaff.status}.`
            );
            refreshData();
          }}
        />
      )}

      {/* MODAL 5: Safe Deletion Modal */}
      {deletingStaff && (
        <StaffUserDeleteModal
          isOpen={Boolean(deletingStaff)}
          onClose={() => setDeletingStaff(null)}
          staff={deletingStaff}
          onSuccess={() => {
            showToast(`Staff record deleted successfully.`);
            refreshData();
          }}
          onSwitchToDeactivate={(staff) => {
            setDeletingStaff(null);
            setStatusTarget({ staff, status: 'INACTIVE' });
          }}
        />
      )}

      {/* MODAL 6: Excel Import Modal */}
      <StaffUserImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onSuccess={() => {
          showToast('Staff users imported successfully.');
          refreshData();
        }}
        departments={departments}
      />

      {/* MODAL 7: Export Modal */}
      <StaffUserExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        filteredStaff={filteredStaff}
        filters={filters}
        onPrintDirect={handlePrintDirectory}
      />

      {/* MODAL 8: Dossier Printable Modal */}
      {dossierStaff && (
        <StaffUserDossierModal
          isOpen={Boolean(dossierStaff)}
          onClose={() => setDossierStaff(null)}
          staff={dossierStaff}
        />
      )}
    </div>
  );
};
