import React, { useState, useMemo, useEffect } from 'react';
import {
  Plus,
  Download,
  Upload,
  FileCheck,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
} from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import {
  HospitalService,
  ServiceFilterState,
  ServiceFormValues,
} from '../../../types/serviceRates';
import { ServiceRatesService } from '../../../services/serviceRatesService';
import { DepartmentService } from '../../../services/departmentService';
import { ServicesKPIBar } from './ServicesKPIBar';
import { ServicesFilterBar } from './ServicesFilterBar';
import { ServicesTable } from './ServicesTable';
import { ServiceModal } from './ServiceModal';
import { ServiceDetailModal } from './ServiceDetailModal';
import { ServiceExportModal } from './ServiceExportModal';
import { ServiceImportModal } from './ServiceImportModal';
import { downloadServicesPDF } from '../../../services/serviceRatesExportService';

export const SuperAdminServicesRatesView: React.FC = () => {
  const { currentUser } = useAuth();

  // Master State
  const [services, setServices] = useState<HospitalService[]>([]);
  const [filters, setFilters] = useState<ServiceFilterState>({
    searchTerm: '',
    departmentId: 'All',
    category: 'All',
    panelEligible: 'All',
    status: 'All',
  });

  // Modal States
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<HospitalService | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [serviceToDelete, setServiceToDelete] = useState<HospitalService | null>(null);

  // Toast State
  const [toast, setToast] = useState<{
    type: 'success' | 'error' | 'warning';
    message: string;
  } | null>(null);

  const showToast = (type: 'success' | 'error' | 'warning', message: string) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 4500);
  };

  const loadData = () => {
    const list = ServiceRatesService.getServices();
    setServices(list);
  };

  useEffect(() => {
    loadData();
  }, []);

  const departments = useMemo(() => {
    return DepartmentService.getDepartments();
  }, []);

  const filteredServices = useMemo(() => {
    return ServiceRatesService.filterServices(services, filters);
  }, [services, filters]);

  const handleFilterChange = (newFilters: Partial<ServiceFilterState>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const handleResetFilters = () => {
    setFilters({
      searchTerm: '',
      departmentId: 'All',
      category: 'All',
      panelEligible: 'All',
      status: 'All',
    });
  };

  // CRUD Handlers
  const handleOpenAdd = () => {
    setSelectedService(null);
    setIsAddEditModalOpen(true);
  };

  const handleOpenEdit = (service: HospitalService) => {
    setSelectedService(service);
    setIsAddEditModalOpen(true);
  };

  const handleOpenView = (service: HospitalService) => {
    setSelectedService(service);
    setIsDetailModalOpen(true);
  };

  const handleSaveService = (values: ServiceFormValues) => {
    try {
      if (selectedService) {
        ServiceRatesService.updateService(selectedService.id, values, currentUser);
        showToast('success', `Service "${values.name}" updated successfully.`);
      } else {
        ServiceRatesService.createService(values, currentUser);
        showToast('success', `Service "${values.name}" created successfully.`);
      }
      setIsAddEditModalOpen(false);
      setSelectedService(null);
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to save service.');
    }
  };

  const handleToggleStatus = (service: HospitalService) => {
    try {
      const nextStatus = service.status === 'Active' ? 'Inactive' : 'Active';
      ServiceRatesService.changeServiceStatus(service.id, nextStatus, currentUser);
      showToast(
        'success',
        `Service "${service.name}" is now marked as ${nextStatus}.`
      );
      loadData();
    } catch (err: any) {
      showToast('error', err.message || 'Failed to update status.');
    }
  };

  const handleDeletePrompt = (service: HospitalService) => {
    const isLinked =
      (service.linkedInvoiceCount ?? 0) > 0 ||
      (service.linkedPanelRuleCount ?? 0) > 0;

    if (isLinked) {
      showToast(
        'warning',
        `Cannot delete "${service.name}": It has ${service.linkedInvoiceCount ?? 0} billing invoice(s) and ${service.linkedPanelRuleCount ?? 0} panel agreement(s). Deactivate it instead.`
      );
      return;
    }
    setServiceToDelete(service);
  };

  const handleConfirmDelete = () => {
    if (!serviceToDelete) return;
    const res = ServiceRatesService.deleteService(serviceToDelete.id);
    if (res.success) {
      showToast('success', `Service "${serviceToDelete.name}" deleted from master catalog.`);
      loadData();
    } else {
      showToast('error', res.message || 'Failed to delete service.');
    }
    setServiceToDelete(null);
  };

  const handleDirectDownloadPDF = async () => {
    try {
      await downloadServicesPDF(filteredServices, filters, currentUser);
      showToast('success', 'PDF directory downloaded successfully.');
    } catch (err) {
      showToast('error', 'Failed to generate PDF.');
    }
  };

  return (
    <div id="super-admin-services-rates-view" className="p-6 max-w-7xl mx-auto">
      {/* Toast Notification Banner */}
      {toast && (
        <div
          id="services-toast-banner"
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

      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl font-bold text-slate-900 tracking-tight">
              Services & Rates Master Catalog
            </h1>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#effaf5] text-[#08775A] border border-[#c2e7db]">
              Charge Master
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Centralized tariff registry, billing units, clinical categorization, and panel insurance eligibility
          </p>
        </div>

        {/* Global Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick PDF Download */}
          <button
            id="services-quick-pdf-btn"
            onClick={handleDirectDownloadPDF}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
            title="Direct Download PDF with active filters"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Download PDF
          </button>

          {/* Export Options Modal */}
          <button
            id="services-export-menu-btn"
            onClick={() => setIsExportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Download className="w-3.5 h-3.5 text-slate-500" />
            Export Options...
          </button>

          {/* Import Excel */}
          <button
            id="services-import-excel-btn"
            onClick={() => setIsImportModalOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition-colors shadow-xs"
          >
            <Upload className="w-3.5 h-3.5 text-slate-500" />
            Import Excel
          </button>

          {/* Add Service (Primary) */}
          <button
            id="services-add-btn"
            onClick={handleOpenAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-[#08775A] hover:bg-[#065f46] rounded-lg transition-colors shadow-xs"
          >
            <Plus className="w-4 h-4" />
            Add Billable Service
          </button>
        </div>
      </div>

      {/* KPI Bar */}
      <ServicesKPIBar services={services} />

      {/* Filter Bar */}
      <ServicesFilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onResetFilters={handleResetFilters}
        departments={departments}
        totalResults={filteredServices.length}
      />

      {/* Master Table */}
      <ServicesTable
        services={filteredServices}
        onView={handleOpenView}
        onEdit={handleOpenEdit}
        onToggleStatus={handleToggleStatus}
        onDelete={handleDeletePrompt}
        onResetFilters={handleResetFilters}
      />

      {/* Add / Edit Modal */}
      <ServiceModal
        isOpen={isAddEditModalOpen}
        onClose={() => {
          setIsAddEditModalOpen(false);
          setSelectedService(null);
        }}
        onSave={handleSaveService}
        service={selectedService}
        departments={departments}
      />

      {/* Detail Modal */}
      <ServiceDetailModal
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedService(null);
        }}
        service={selectedService}
        onEdit={handleOpenEdit}
        onToggleStatus={handleToggleStatus}
      />

      {/* Export Modal */}
      <ServiceExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        services={filteredServices}
        filters={filters}
        currentUser={currentUser}
      />

      {/* Import Modal */}
      <ServiceImportModal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        onImportComplete={(count) => {
          setIsImportModalOpen(false);
          showToast('success', `Successfully imported ${count} service record(s) to master catalog.`);
          loadData();
        }}
        existingServices={services}
        currentUser={currentUser}
      />

      {/* Delete Confirmation Modal */}
      {serviceToDelete && (
        <div
          id="services-delete-confirm-modal"
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4"
        >
          <div className="bg-white max-w-md w-full rounded-2xl p-6 border border-slate-200 shadow-xl space-y-4">
            <div className="w-10 h-10 rounded-full bg-rose-50 text-rose-600 flex items-center justify-center mx-auto">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div className="text-center">
              <h3 className="text-base font-bold text-slate-800">
                Confirm Service Deletion
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Are you sure you want to permanently remove{' '}
                <strong className="text-slate-700">
                  {serviceToDelete.code} — {serviceToDelete.name}
                </strong>{' '}
                from the master catalog?
              </p>
            </div>
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
              This action cannot be undone. Only services with zero linked invoices and zero panel agreements can be deleted.
            </div>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setServiceToDelete(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                id="services-confirm-delete-btn"
                onClick={handleConfirmDelete}
                className="px-4 py-2 text-xs font-semibold text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-xs"
              >
                Delete Service
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
