import React, { useState } from 'react';
import {
  Eye,
  Edit2,
  RefreshCw,
  UserCheck,
  ChevronLeft,
  ChevronRight,
  Shield,
  Building,
  UserX,
  Phone,
  Calendar,
  AlertCircle,
} from 'lucide-react';
import { Patient, PatientStatus } from '../../../types/patient';

interface PatientTableProps {
  patients: Patient[];
  totalUnfilteredCount: number;
  onViewPatient: (patient: Patient) => void;
  onEditPatient: (patient: Patient) => void;
  onChangeStatus: (patient: Patient) => void;
  onRegisterNew: () => void;
  onResetFilters: () => void;
}

export const PatientTable: React.FC<PatientTableProps> = ({
  patients,
  totalUnfilteredCount,
  onViewPatient,
  onEditPatient,
  onChangeStatus,
  onRegisterNew,
  onResetFilters,
}) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const totalPages = Math.ceil(patients.length / rowsPerPage) || 1;
  const startIndex = (currentPage - 1) * rowsPerPage;
  const currentRows = patients.slice(startIndex, startIndex + rowsPerPage);

  // Status badge styling
  // ACTIVE: green, INACTIVE: neutral gray, DECEASED: respectful neutral/dark styling
  const renderStatusBadge = (status: PatientStatus) => {
    switch (status) {
      case 'ACTIVE':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Active
          </span>
        );
      case 'INACTIVE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600 border border-slate-200">
            Inactive
          </span>
        );
      case 'DECEASED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-800 text-slate-100 border border-slate-700">
            Deceased
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  // Empty state handling
  if (patients.length === 0) {
    if (totalUnfilteredCount === 0) {
      return (
        <div className="bg-white border border-[#e2eae5] rounded-xl p-12 text-center shadow-xs">
          <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#08775A] flex items-center justify-center mx-auto mb-3">
            <UserCheck className="w-6 h-6" />
          </div>
          <h3 className="text-base font-semibold text-slate-800 mb-1">No patients registered</h3>
          <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">
            The master patient registry is currently empty. Register a patient to assign a permanent MR number.
          </p>
          <button
            onClick={onRegisterNew}
            className="inline-flex items-center gap-2 px-4 py-2 bg-[#08775A] hover:bg-[#07664d] text-white rounded-lg text-sm font-medium transition-colors shadow-xs"
          >
            Register New Patient
          </button>
        </div>
      );
    }

    return (
      <div className="bg-white border border-[#e2eae5] rounded-xl p-12 text-center shadow-xs">
        <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-500 flex items-center justify-center mx-auto mb-3">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-base font-semibold text-slate-800 mb-1">No patients match the selected filters</h3>
        <p className="text-sm text-slate-500 max-w-md mx-auto mb-5">
          Try clearing your search query or adjusting active filters to see matching patient records.
        </p>
        <button
          onClick={onResetFilters}
          className="inline-flex items-center gap-2 px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-sm font-medium transition-colors"
        >
          Reset Filters
        </button>
      </div>
    );
  }

  return (
    <div className="bg-white border border-[#e2eae5] rounded-xl shadow-xs overflow-hidden flex flex-col">
      {/* Table responsive container */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm border-collapse min-w-[1100px]">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase tracking-wider">
              <th className="py-3 px-3.5 whitespace-nowrap">MR Number</th>
              <th className="py-3 px-3.5 whitespace-nowrap">Patient Name</th>
              <th className="py-3 px-3.5 whitespace-nowrap">Contact</th>
              <th className="py-3 px-3.5 whitespace-nowrap">Age / Gender</th>
              <th className="py-3 px-3.5 whitespace-nowrap">CNIC</th>
              <th className="py-3 px-3.5 whitespace-nowrap">Payer Type</th>
              <th className="py-3 px-3.5 whitespace-nowrap">Panel</th>
              <th className="py-3 px-3.5 whitespace-nowrap">Last Visit</th>
              <th className="py-3 px-3.5 whitespace-nowrap">Reg Date</th>
              <th className="py-3 px-3.5 whitespace-nowrap text-center">Status</th>
              <th className="py-3 px-3.5 whitespace-nowrap">Updated By</th>
              <th className="py-3 px-3.5 whitespace-nowrap text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {currentRows.map((patient) => (
              <tr
                key={patient.id}
                className="hover:bg-slate-50/60 transition-colors group text-[13px]"
              >
                {/* MR Number */}
                <td className="py-3 px-3.5 whitespace-nowrap font-mono font-semibold text-[#08775A]">
                  {patient.mrNumber}
                </td>

                {/* Patient Name */}
                <td className="py-3 px-3.5">
                  <div className="font-medium text-slate-900 group-hover:text-[#08775A] transition-colors">
                    {patient.fullName}
                  </div>
                  {patient.fatherGuardianName && (
                    <div className="text-xs text-slate-400 truncate max-w-[180px]">
                      {patient.guardianRelation || 'S/O, D/O, W/O'}: {patient.fatherGuardianName}
                    </div>
                  )}
                </td>

                {/* Contact */}
                <td className="py-3 px-3.5 whitespace-nowrap">
                  <div className="font-mono text-slate-800 text-xs">
                    {patient.primaryPhone}
                  </div>
                  {patient.email && (
                    <div className="text-[11px] text-slate-400 truncate max-w-[140px]">
                      {patient.email}
                    </div>
                  )}
                </td>

                {/* Age / Gender */}
                <td className="py-3 px-3.5 whitespace-nowrap">
                  <span className="font-medium text-slate-800">{patient.age}y</span>
                  {patient.ageIsEstimated && (
                    <span className="text-[10px] text-amber-600 ml-1 font-medium">(est)</span>
                  )}
                  <span className="text-slate-400 mx-1">•</span>
                  <span className="text-slate-600">
                    {patient.gender === 'Other / Not Specified' ? 'Other' : patient.gender}
                  </span>
                  {patient.bloodGroup && patient.bloodGroup !== 'Unknown' && (
                    <span className="ml-1.5 px-1.5 py-0.5 rounded-sm bg-rose-50 text-rose-700 border border-rose-100 text-[10px] font-semibold">
                      {patient.bloodGroup}
                    </span>
                  )}
                </td>

                {/* CNIC */}
                <td className="py-3 px-3.5 whitespace-nowrap font-mono text-xs text-slate-600">
                  {patient.cnic || <span className="text-slate-300 font-sans">—</span>}
                </td>

                {/* Payer Type */}
                <td className="py-3 px-3.5 whitespace-nowrap">
                  {patient.payerType === 'Corporate / Panel' ? (
                    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
                      <Building className="w-3 h-3" />
                      Panel
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                      Self Pay
                    </span>
                  )}
                </td>

                {/* Panel Details */}
                <td className="py-3 px-3.5 max-w-[180px]">
                  {patient.payerType === 'Corporate / Panel' ? (
                    <div className="truncate">
                      <span className="text-xs font-medium text-slate-800" title={patient.panelName}>
                        {patient.panelName || 'Corporate Panel'}
                      </span>
                      {patient.panelMemberId && (
                        <div className="text-[11px] font-mono text-slate-500 truncate" title={patient.panelMemberId}>
                          ID: {patient.panelMemberId}
                        </div>
                      )}
                    </div>
                  ) : (
                    <span className="text-slate-300">—</span>
                  )}
                </td>

                {/* Last Visit */}
                <td className="py-3 px-3.5 whitespace-nowrap text-xs text-slate-600">
                  {patient.lastVisitDate ? (
                    <span className="font-mono text-slate-700">{patient.lastVisitDate}</span>
                  ) : (
                    <span className="text-slate-400 italic">Never visited</span>
                  )}
                </td>

                {/* Reg Date */}
                <td className="py-3 px-3.5 whitespace-nowrap font-mono text-xs text-slate-600">
                  {patient.registrationDate}
                </td>

                {/* Status */}
                <td className="py-3 px-3.5 whitespace-nowrap text-center">
                  {renderStatusBadge(patient.status)}
                </td>

                {/* Updated By */}
                <td className="py-3 px-3.5 whitespace-nowrap text-xs text-slate-500">
                  <div className="truncate max-w-[120px]" title={patient.updatedBy}>
                    {patient.updatedBy}
                  </div>
                </td>

                {/* Actions (View, Edit, Status Change) */}
                <td className="py-3 px-3.5 whitespace-nowrap text-right">
                  <div className="inline-flex items-center gap-1">
                    <button
                      onClick={() => onViewPatient(patient)}
                      className="p-1.5 text-slate-600 hover:text-[#08775A] hover:bg-[#effaf5] rounded-md transition-colors"
                      title="View Patient Record & Clinical Summary"
                    >
                      <Eye className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEditPatient(patient)}
                      className="p-1.5 text-slate-600 hover:text-blue-700 hover:bg-blue-50 rounded-md transition-colors"
                      title="Edit Patient Demographics & Payer Details"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onChangeStatus(patient)}
                      className="p-1.5 text-slate-600 hover:text-amber-700 hover:bg-amber-50 rounded-md transition-colors"
                      title="Change Patient Status (Active, Inactive, Deceased)"
                    >
                      <RefreshCw className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-200 bg-slate-50/50 text-xs text-slate-600">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            value={rowsPerPage}
            onChange={(e) => {
              setRowsPerPage(Number(e.target.value));
              setCurrentPage(1);
            }}
            className="px-2 py-1 bg-white border border-slate-200 rounded-md text-xs text-slate-700 focus:outline-hidden focus:border-[#08775A]"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
          <span className="text-slate-400 ml-2">
            Showing {startIndex + 1}–{Math.min(startIndex + rowsPerPage, patients.length)} of {patients.length} patients
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Previous page"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span className="px-2 font-medium text-slate-700">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            className="p-1.5 rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            title="Next page"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
