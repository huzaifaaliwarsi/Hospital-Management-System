import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { AdminUser, AdminUserFilterState } from '../types/adminUser';
import { User } from '../types';
import {
  getHospitalProfile,
  getProfileFieldValue,
  formatHospitalAddress,
} from './hospitalProfileService';
import { formatDisplayDate } from '../utils/dateConstants';

export function getDynamicDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatFilterSummary(filters: AdminUserFilterState): string {
  const parts: string[] = [];
  if (filters.searchTerm) parts.push(`Search: "${filters.searchTerm}"`);
  if (filters.role !== 'ALL') parts.push(`Role: ${filters.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}`);
  if (filters.status !== 'ALL') parts.push(`Status: ${filters.status}`);
  return parts.length > 0 ? parts.join(' | ') : 'All Active & Inactive Administrative Records';
}

/**
 * Download real .pdf document for Admin Users Directory
 */
export async function downloadAdminUsersPDF(
  users: AdminUser[],
  filters: AdminUserFilterState,
  currentUser: User | null
): Promise<void> {
  const profile = getHospitalProfile();
  const now = new Date();
  const dateStr = getDynamicDateString(now);
  const timeStr = now.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const generatedOn = `${formatDisplayDate(now)}, ${timeStr}`;
  const generatedByName = currentUser?.name || 'Unauthenticated Session';
  const generatedByRole = currentUser?.role || 'No Active Role';

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 14;

  // Header band
  doc.setFillColor(8, 119, 90); // #08775A
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Hospital Name & Subtitle
  const hospitalName = profile.name || 'CH Sharif and Saeed Hospital';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(hospitalName, margin, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(
    'Executive Hospital Information System • Administrative Governance & User Directory',
    margin,
    19
  );

  // Profile Badges
  const regNo = getProfileFieldValue(profile.registrationNumber);
  const taxNo = getProfileFieldValue(profile.taxNumber);
  const phone = getProfileFieldValue(profile.primaryPhone);

  doc.setFontSize(8);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Reg No: ${regNo}   |   NTN/Tax: ${taxNo}   |   Phone: ${phone}`,
    margin,
    24
  );

  // Right Title Box
  doc.setFillColor(239, 250, 245);
  doc.setDrawColor(194, 231, 219);
  doc.roundedRect(pageWidth - margin - 80, 8, 80, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(8, 119, 90);
  doc.text('ADMIN USERS DIRECTORY', pageWidth - margin - 75, 15);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(`Official Governance Roll • ${users.length} Users`, pageWidth - margin - 75, 21);

  // Divider line
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.4);
  doc.line(margin, 28, pageWidth - margin, 28);

  // Metadata Strip
  doc.setFontSize(8.5);
  doc.setTextColor(15, 23, 42);
  doc.setFont('helvetica', 'bold');
  doc.text('Generated On:', margin, 34);
  doc.setFont('helvetica', 'normal');
  doc.text(generatedOn, margin + 24, 34);

  doc.setFont('helvetica', 'bold');
  doc.text('Authorized By:', margin + 80, 34);
  doc.setFont('helvetica', 'normal');
  doc.text(`${generatedByName} (${generatedByRole})`, margin + 104, 34);

  doc.setFont('helvetica', 'bold');
  doc.text('Filters:', margin + 180, 34);
  doc.setFont('helvetica', 'normal');
  doc.text(formatFilterSummary(filters), margin + 194, 34);

  // Table Data Preparation (STRICT: NO PASSWORDS EVER)
  const tableData = users.map((u) => [
    u.id,
    u.employeeCode || '—',
    u.fullName + (u.role === 'SUPER_ADMIN' ? ' [Super Admin]' : ''),
    u.username,
    u.email,
    u.phone || '—',
    u.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin',
    u.status,
    u.lastLoginAt || 'Never',
    u.createdAt || '—',
  ]);

  autoTable(doc, {
    startY: 38,
    margin: { left: margin, right: margin, bottom: 16 },
    head: [
      [
        'User ID',
        'Emp Code',
        'Admin Name',
        'Username',
        'Email Address',
        'Phone',
        'Role',
        'Status',
        'Last Login',
        'Created Date',
      ],
    ],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: [8, 119, 90], // #08775A
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: 'bold',
      halign: 'left',
      cellPadding: 2.2,
    },
    bodyStyles: {
      fontSize: 7.5,
      textColor: [30, 41, 59],
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252], // slate-50
    },
    columnStyles: {
      0: { cellWidth: 20, fontStyle: 'bold' },
      1: { cellWidth: 22 },
      2: { cellWidth: 42, fontStyle: 'bold' },
      3: { cellWidth: 26 },
      4: { cellWidth: 46 },
      5: { cellWidth: 28 },
      6: { cellWidth: 24, fontStyle: 'bold' },
      7: { cellWidth: 20 },
      8: { cellWidth: 32 },
      9: { cellWidth: 26 },
    },
    didDrawPage: (data) => {
      const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
      const currentPage = data.pageNumber;

      // Footer divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

      // Footer left: Confidentiality note
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // slate-400
      doc.text(
        'CONFIDENTIAL • CH SHARIF & SAEEED HOSPITAL • EXECUTIVE ADMINISTRATIVE GOVERNANCE RECORD',
        margin,
        pageHeight - 7
      );

      // Footer right: Page number
      const pageStr = `Page ${currentPage} of ${pageCount}`;
      doc.text(pageStr, pageWidth - margin - 22, pageHeight - 7);
    },
  });

  doc.save(`Admin_Users_Directory_${dateStr}.pdf`);
}

/**
 * Download real .xlsx workbook with two structured sheets
 */
export function downloadAdminUsersExcel(
  users: AdminUser[],
  filters: AdminUserFilterState,
  currentUser: User | null
): void {
  const profile = getHospitalProfile();
  const now = new Date();
  const dateStr = getDynamicDateString(now);
  const timeStr = now.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  // Sheet 1: Admin Users (NO PASSWORDS)
  const usersRows = users.map((u) => ({
    'User ID': u.id,
    'Employee Code': u.employeeCode || '',
    'Full Name': u.fullName,
    'Username': u.username,
    'Email Address': u.email,
    'Contact Phone': u.phone || '',
    'System Role': u.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin',
    'Account Status': u.status,
    'Protected Super Admin': u.isProtectedSuperAdmin ? 'Yes' : 'No',
    'Last Login': u.lastLoginAt || 'Never',
    'Created By': u.createdBy || '',
    'Created Date': u.createdAt || '',
    'Updated By': u.updatedBy || '',
    'Updated Date': u.updatedAt || '',
  }));

  const wsUsers = XLSX.utils.json_to_sheet(usersRows);

  // Set column widths for readability
  wsUsers['!cols'] = [
    { wch: 14 }, // User ID
    { wch: 16 }, // Employee Code
    { wch: 28 }, // Full Name
    { wch: 18 }, // Username
    { wch: 32 }, // Email Address
    { wch: 18 }, // Phone
    { wch: 16 }, // System Role
    { wch: 14 }, // Status
    { wch: 22 }, // Protected Super Admin
    { wch: 22 }, // Last Login
    { wch: 30 }, // Created By
    { wch: 22 }, // Created Date
    { wch: 30 }, // Updated By
    { wch: 22 }, // Updated Date
  ];

  // Sheet 2: Export Information
  const infoRows = [
    { Property: 'Hospital Name', Value: profile.name || 'CH Sharif and Saeed Hospital' },
    { Property: 'Hospital Address', Value: formatHospitalAddress(profile) },
    { Property: 'Registration Number', Value: getProfileFieldValue(profile.registrationNumber) },
    { Property: 'Tax/NTN Number', Value: getProfileFieldValue(profile.taxNumber) },
    { Property: 'Primary Phone', Value: getProfileFieldValue(profile.primaryPhone) },
    { Property: 'Emergency Phone', Value: getProfileFieldValue(profile.emergencyPhone) },
    { Property: 'Report Document', Value: 'Hospital Administrative Users Master Catalog' },
    { Property: 'Export Date & Time', Value: `${formatDisplayDate(now)}, ${timeStr}` },
    { Property: 'Exported By', Value: currentUser ? `${currentUser.name} (${currentUser.role})` : 'Unauthenticated Session' },
    { Property: 'Total Records Exported', Value: users.length },
    { Property: 'Applied Filter - Role', Value: filters.role === 'ALL' ? 'All Roles' : filters.role },
    { Property: 'Applied Filter - Status', Value: filters.status === 'ALL' ? 'All Statuses' : filters.status },
    { Property: 'Applied Filter - Search', Value: filters.searchTerm ? filters.searchTerm : 'None' },
  ];

  const wsInfo = XLSX.utils.json_to_sheet(infoRows);
  wsInfo['!cols'] = [{ wch: 28 }, { wch: 55 }];

  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, wsUsers, 'Admin Users');
  XLSX.utils.book_append_sheet(workbook, wsInfo, 'Export Information');

  XLSX.writeFile(workbook, `Admin_Users_Directory_${dateStr}.xlsx`);
}

/**
 * Print formatted admin directory
 */
export function printAdminUsers(
  users: AdminUser[],
  filters: AdminUserFilterState,
  currentUser: User | null
): void {
  const profile = getHospitalProfile();
  const now = new Date();
  const generatedOn = `${formatDisplayDate(now)}, ${now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}`;
  const userName = currentUser?.name || 'Unauthenticated Session';
  const userRole = currentUser?.role || 'No Active Role';

  const printWindow = window.open('', '_blank', 'width=1100,height=800');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Admin Users Directory — ${profile.name || 'CH Sharif and Saeed Hospital'}</title>
        <style>
          @page { size: landscape; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 16px; font-size: 11px; }
          .header { border-bottom: 2px solid #08775A; padding-bottom: 12px; margin-bottom: 16px; display: flex; justify-content: space-between; align-items: flex-start; }
          .hospital-title { font-size: 18px; font-weight: bold; color: #0f172a; margin: 0 0 4px 0; }
          .hospital-subtitle { font-size: 11px; color: #64748b; margin: 0 0 6px 0; }
          .reg-info { font-size: 10px; color: #475569; }
          .badge { background: #effaf5; border: 1px solid #c2e7db; color: #08775A; padding: 4px 10px; border-radius: 6px; font-weight: bold; font-size: 11px; text-align: right; }
          .meta-strip { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px; font-size: 10.5px; display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; font-size: 10.5px; }
          th { background: #08775A; color: white; text-align: left; padding: 8px 10px; font-size: 10px; text-transform: uppercase; font-weight: 600; border: 1px solid #08775A; }
          td { padding: 7px 10px; border: 1px solid #e2e8f0; }
          tr:nth-child(even) td { background: #f8fafc; }
          .role-badge { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9.5px; font-weight: bold; }
          .role-super { background: #effaf5; color: #08775A; border: 1px solid #c2e7db; }
          .role-admin { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
          .status-active { color: #08775A; font-weight: bold; }
          .status-suspended { color: #dc2626; font-weight: bold; }
          .status-inactive { color: #64748b; }
          .footer { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="hospital-title">${profile.name || 'CH Sharif and Saeed Hospital'}</div>
            <div class="hospital-subtitle">Central Hospital Management & Administrative Governance System</div>
            <div class="reg-info">
              Reg: ${getProfileFieldValue(profile.registrationNumber)} | NTN: ${getProfileFieldValue(profile.taxNumber)} | Phone: ${getProfileFieldValue(profile.primaryPhone)}
            </div>
          </div>
          <div class="badge">
            ADMIN USERS DIRECTORY<br/>
            <span style="font-weight: normal; font-size: 9px; color: #64748b;">${users.length} Active & Inactive Accounts</span>
          </div>
        </div>

        <div class="meta-strip">
          <div><strong>Printed:</strong> ${generatedOn}</div>
          <div><strong>Authorized Officer:</strong> ${userName} (${userRole})</div>
          <div><strong>Applied Filters:</strong> ${formatFilterSummary(filters)}</div>
        </div>

        <table>
          <thead>
            <tr>
              <th>User ID</th>
              <th>Emp Code</th>
              <th>Admin Name</th>
              <th>Username</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Role</th>
              <th>Status</th>
              <th>Last Login</th>
            </tr>
          </thead>
          <tbody>
            ${users
              .map(
                (u) => `
              <tr>
                <td style="font-weight: bold; font-family: monospace;">${u.id}</td>
                <td>${u.employeeCode || '—'}</td>
                <td style="font-weight: 600;">${u.fullName}${u.role === 'SUPER_ADMIN' ? ' <span style="color:#08775A; font-size:9px;">★</span>' : ''}</td>
                <td style="font-family: monospace;">${u.username}</td>
                <td>${u.email}</td>
                <td>${u.phone || '—'}</td>
                <td>
                  <span class="role-badge ${u.role === 'SUPER_ADMIN' ? 'role-super' : 'role-admin'}">
                    ${u.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Admin'}
                  </span>
                </td>
                <td class="${u.status === 'ACTIVE' ? 'status-active' : u.status === 'SUSPENDED' ? 'status-suspended' : 'status-inactive'}">
                  ${u.status}
                </td>
                <td>${u.lastLoginAt || 'Never'}</td>
              </tr>
            `
              )
              .join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>CONFIDENTIAL • OFFICIAL HOSPITAL GOVERNANCE RECORD • UNAUTHORIZED REPRODUCTION FORBIDDEN</div>
          <div>Report generated from Executive HMS Portal</div>
        </div>
      </body>
    </html>
  `;

  printWindow.document.write(html);
  printWindow.document.close();
  printWindow.focus();
  setTimeout(() => {
    printWindow.print();
  }, 250);
}
