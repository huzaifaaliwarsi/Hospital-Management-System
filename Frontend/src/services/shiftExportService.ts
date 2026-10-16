import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';
import { Shift, ShiftFilterState } from '../types/shift';
import { User } from '../types';
import {
  getHospitalProfile,
  getProfileFieldValue,
} from './hospitalProfileService';
import { formatDisplayDate } from '../utils/dateConstants';
import {
  format12HourTime,
  formatMinutesToHours,
} from './shiftService';

export function getDynamicDateString(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function formatFilterSummary(filters: ShiftFilterState): string {
  const parts: string[] = [];
  if (filters.searchTerm) parts.push(`Search: "${filters.searchTerm}"`);
  if (filters.departmentId !== 'ALL') parts.push(`Dept: ${filters.departmentId}`);
  if (filters.shiftType !== 'ALL') parts.push(`Type: ${filters.shiftType}`);
  if (filters.schedule !== 'ALL') parts.push(`Schedule: ${filters.schedule === 'OVERNIGHT' ? 'Overnight' : 'Day Shift'}`);
  if (filters.status !== 'ALL') parts.push(`Status: ${filters.status}`);
  return parts.length > 0 ? parts.join(' | ') : 'All Shift Records';
}

/**
 * Download real .pdf document for Shift Management Directory
 */
export async function downloadShiftsPDF(
  shifts: Shift[],
  filters: ShiftFilterState,
  currentUser: User | null
): Promise<void> {
  if (!currentUser || !currentUser.id || !currentUser.name) {
    throw new Error('Authenticated management user required for export.');
  }

  const profile = getHospitalProfile();
  const now = new Date();
  const dateStr = getDynamicDateString(now);
  const timeStr = now.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
  const generatedOn = `${formatDisplayDate(now)}, ${timeStr}`;
  const generatedByName = currentUser.name;
  const generatedByRole = currentUser.role || 'Authorized User';

  const doc = new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: 'a4',
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Header band (#08775A)
  doc.setFillColor(8, 119, 90);
  doc.rect(0, 0, pageWidth, 4, 'F');

  // Hospital Name & Subtitle
  const hospitalName = profile.name || 'Not configured';
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42); // slate-900
  doc.text(hospitalName, margin, 13);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139); // slate-500
  doc.text(
    'Hospital Information System • Departmental Shift Master & Duty Scheduling Registry',
    margin,
    18
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
    23
  );

  // Right Title Box
  doc.setFillColor(239, 250, 245);
  doc.setDrawColor(194, 231, 219);
  doc.roundedRect(pageWidth - margin - 80, 7, 80, 18, 2, 2, 'FD');

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(8, 119, 90);
  doc.text('SHIFT MANAGEMENT MASTER', pageWidth - margin - 76, 14);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(71, 85, 105);
  doc.text(`Dataset: ${shifts.length} records matching filters`, pageWidth - margin - 76, 20);

  // Metadata strip
  doc.setFillColor(248, 250, 252);
  doc.setDrawColor(226, 232, 240);
  doc.roundedRect(margin, 27, pageWidth - margin * 2, 10, 1.5, 1.5, 'FD');

  doc.setFontSize(7.5);
  doc.setTextColor(51, 65, 85);
  doc.setFont('helvetica', 'bold');
  doc.text('Generated On:', margin + 3, 33.5);
  doc.setFont('helvetica', 'normal');
  doc.text(generatedOn, margin + 24, 33.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Authorized User:', margin + 65, 33.5);
  doc.setFont('helvetica', 'normal');
  doc.text(`${generatedByName} (${generatedByRole})`, margin + 89, 33.5);

  doc.setFont('helvetica', 'bold');
  doc.text('Applied Filters:', margin + 160, 33.5);
  doc.setFont('helvetica', 'normal');
  const filterSummary = formatFilterSummary(filters);
  doc.text(filterSummary.length > 55 ? filterSummary.substring(0, 52) + '...' : filterSummary, margin + 182, 33.5);

  // Table Data
  const tableData = shifts.map((s) => [
    s.code,
    s.name,
    s.departmentName,
    s.shiftType,
    format12HourTime(s.startTime),
    format12HourTime(s.endTime),
    s.isOvernight ? 'Yes (+1 Day)' : 'No (Day)',
    formatMinutesToHours(s.grossDurationMinutes),
    `${s.breakMinutes}m`,
    formatMinutesToHours(s.netWorkingMinutes),
    `${s.defaultArrivalGraceMinutes}m`,
    `${s.defaultEarlyExitToleranceMinutes}m`,
    s.defaultWeeklyOffDays && s.defaultWeeklyOffDays.length > 0 ? s.defaultWeeklyOffDays.join(', ') : 'None',
    s.status,
  ]);

  autoTable(doc, {
    startY: 40,
    margin: { left: margin, right: margin },
    head: [[
      'Shift Code',
      'Shift Name',
      'Department',
      'Type',
      'Start',
      'End',
      'Overnight',
      'Gross Hours',
      'Break',
      'Net Hours',
      'Grace',
      'Tolerance',
      'Weekly Off',
      'Status',
    ]],
    body: tableData,
    theme: 'plain',
    styles: {
      fontSize: 7.5,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [226, 232, 240],
      lineWidth: 0.2,
    },
    headStyles: {
      fillColor: [8, 119, 90],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 7.5,
    },
    alternateRowStyles: {
      fillColor: [248, 250, 252],
    },
    columnStyles: {
      0: { fontStyle: 'bold', cellWidth: 20 },
      1: { cellWidth: 32 },
      2: { cellWidth: 30 },
      3: { cellWidth: 16 },
      4: { cellWidth: 16 },
      5: { cellWidth: 16 },
      6: { cellWidth: 18 },
      7: { cellWidth: 18 },
      8: { cellWidth: 14 },
      9: { cellWidth: 18, fontStyle: 'bold' },
      10: { cellWidth: 14 },
      11: { cellWidth: 16 },
      12: { cellWidth: 26 },
      13: { cellWidth: 15, fontStyle: 'bold' },
    },
    didDrawPage: (data) => {
      const pageCount = (doc.internal as unknown as { getNumberOfPages: () => number }).getNumberOfPages();
      const currentPage = data.pageNumber;

      // Footer divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.line(margin, pageHeight - 10, pageWidth - margin, pageHeight - 10);

      // Footer left: Confidentiality note
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184); // slate-400
      const confidentialInstitution = profile.name ? profile.name.toUpperCase() : 'NOT CONFIGURED';
      doc.text(
        `CONFIDENTIAL • ${confidentialInstitution} • 24/7 OPERATIONAL DUTY SHIFT MASTER RECORD`,
        margin,
        pageHeight - 6
      );

      // Footer right: Page number
      const pageStr = `Page ${currentPage} of ${pageCount}`;
      doc.text(pageStr, pageWidth - margin - 20, pageHeight - 6);
    },
  });

  doc.save(`Shift_Management_Master_${dateStr}.pdf`);
}

/**
 * Download real .xlsx workbook for Shift Management Directory
 */
export function downloadShiftsExcel(
  shifts: Shift[],
  filters: ShiftFilterState,
  currentUser: User | null
): void {
  if (!currentUser || !currentUser.id || !currentUser.name) {
    throw new Error('Authenticated management user required for export.');
  }

  const profile = getHospitalProfile();
  const now = new Date();
  const dateStr = getDynamicDateString(now);
  const timeStr = now.toLocaleTimeString('en-PK', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });

  const shiftRows = shifts.map((s) => ({
    'Shift Code': s.code,
    'Shift Name': s.name,
    'Department': s.departmentName,
    'Department ID': s.departmentId,
    'Shift Type': s.shiftType,
    'Start Time': format12HourTime(s.startTime),
    'End Time': format12HourTime(s.endTime),
    'Overnight': s.isOvernight ? 'Yes' : 'No',
    'Gross Hours': formatMinutesToHours(s.grossDurationMinutes),
    'Gross Minutes': s.grossDurationMinutes,
    'Break Minutes': s.breakMinutes,
    'Net Working Hours': formatMinutesToHours(s.netWorkingMinutes),
    'Net Working Minutes': s.netWorkingMinutes,
    'Arrival Grace (mins)': s.defaultArrivalGraceMinutes,
    'Early Exit Tolerance (mins)': s.defaultEarlyExitToleranceMinutes,
    'Weekly Off Days': s.defaultWeeklyOffDays && s.defaultWeeklyOffDays.length > 0 ? s.defaultWeeklyOffDays.join(', ') : 'None',
    'Status': s.status,
    'Notes': s.notes || '',
    'Created By': `${s.createdByName} (${s.createdByRole})`,
    'Created Date': s.createdAt,
    'Updated By': `${s.updatedByName} (${s.updatedByRole})`,
    'Updated Date': s.updatedAt,
  }));

  const metaRows = [
    { Property: 'Institution', Value: profile.name || 'Not configured' },
    { Property: 'Document', Value: 'Shift Management Master' },
    { Property: 'Generated On', Value: `${formatDisplayDate(now)}, ${timeStr}` },
    { Property: 'Generated By', Value: `${currentUser.name} (${currentUser.role || 'Authorized User'})` },
    { Property: 'Filter Applied', Value: formatFilterSummary(filters) },
    { Property: 'Total Records Exported', Value: shifts.length },
    { Property: 'Registration No', Value: getProfileFieldValue(profile.registrationNumber) },
    { Property: 'NTN / Tax No', Value: getProfileFieldValue(profile.taxNumber) },
    { Property: 'Primary Phone', Value: getProfileFieldValue(profile.primaryPhone) },
  ];

  const wb = XLSX.utils.book_new();

  const wsShifts = XLSX.utils.json_to_sheet(shiftRows);
  wsShifts['!cols'] = [
    { wch: 14 }, // Shift Code
    { wch: 28 }, // Shift Name
    { wch: 26 }, // Department
    { wch: 16 }, // Department ID
    { wch: 14 }, // Shift Type
    { wch: 14 }, // Start
    { wch: 14 }, // End
    { wch: 12 }, // Overnight
    { wch: 14 }, // Gross Hours
    { wch: 14 }, // Gross Mins
    { wch: 14 }, // Break Mins
    { wch: 18 }, // Net Working Hours
    { wch: 18 }, // Net Mins
    { wch: 20 }, // Grace
    { wch: 24 }, // Tolerance
    { wch: 24 }, // Weekly Off
    { wch: 12 }, // Status
    { wch: 30 }, // Notes
    { wch: 28 }, // Created By
    { wch: 22 }, // Created Date
    { wch: 28 }, // Updated By
    { wch: 22 }, // Updated Date
  ];

  const wsMeta = XLSX.utils.json_to_sheet(metaRows);
  wsMeta['!cols'] = [{ wch: 24 }, { wch: 45 }];

  XLSX.utils.book_append_sheet(wb, wsShifts, 'Duty Shifts');
  XLSX.utils.book_append_sheet(wb, wsMeta, 'Audit Metadata');

  XLSX.writeFile(wb, `Shift_Management_Master_${dateStr}.xlsx`);
}

/**
 * Print formatted shifts registry view
 */
export function printShifts(
  shifts: Shift[],
  filters: ShiftFilterState,
  currentUser: User | null
): void {
  if (!currentUser || !currentUser.id || !currentUser.name) {
    throw new Error('Authenticated management user required for export.');
  }

  const profile = getHospitalProfile();
  const now = new Date();
  const generatedOn = `${formatDisplayDate(now)}, ${now.toLocaleTimeString('en-PK', { hour: '2-digit', minute: '2-digit' })}`;
  const userName = currentUser.name;
  const userRole = currentUser.role || 'Authorized User';

  const printWindow = window.open('', '_blank', 'width=1100,height=850');
  if (!printWindow) return;

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <title>Shift Management Master — ${profile.name || 'Not configured'}</title>
        <style>
          @page { size: landscape; margin: 12mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; color: #0f172a; margin: 0; padding: 16px; font-size: 11px; }
          .header { border-bottom: 2px solid #08775A; padding-bottom: 12px; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: flex-start; }
          .hospital-title { font-size: 18px; font-weight: bold; color: #0f172a; margin: 0 0 4px 0; }
          .hospital-subtitle { font-size: 11px; color: #64748b; margin: 0 0 6px 0; }
          .reg-info { font-size: 10px; color: #475569; }
          .badge { background: #effaf5; border: 1px solid #c2e7db; color: #08775A; padding: 6px 12px; border-radius: 6px; font-weight: bold; font-size: 11px; text-align: right; }
          .meta-strip { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px 12px; margin-bottom: 14px; font-size: 10.5px; display: flex; justify-content: space-between; }
          table { width: 100%; border-collapse: collapse; font-size: 10px; }
          th { background: #08775A; color: white; text-align: left; padding: 8px 8px; font-size: 9.5px; text-transform: uppercase; font-weight: 600; border: 1px solid #08775A; }
          td { padding: 6px 8px; border: 1px solid #e2e8f0; vertical-align: middle; }
          tr:nth-child(even) td { background: #f8fafc; }
          .tag { display: inline-block; padding: 2px 6px; border-radius: 4px; font-size: 9px; font-weight: bold; }
          .tag-morning { background: #effaf5; color: #08775A; border: 1px solid #c2e7db; }
          .tag-evening { background: #fef3c7; color: #92400e; border: 1px solid #fde68a; }
          .tag-night { background: #ede9fe; color: #5b21b6; border: 1px solid #ddd6fe; }
          .tag-custom { background: #f1f5f9; color: #334155; border: 1px solid #cbd5e1; }
          .tag-overnight { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
          .status-active { color: #08775A; font-weight: bold; }
          .status-inactive { color: #94a3b8; font-weight: bold; }
          .footer { margin-top: 20px; border-top: 1px solid #e2e8f0; padding-top: 8px; font-size: 9px; color: #94a3b8; display: flex; justify-content: space-between; }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="hospital-title">${profile.name || 'Not configured'}</div>
            <div class="hospital-subtitle">Hospital Information System • Reusable Duty Shifts for 24/7 Operations</div>
            <div class="reg-info">
              Reg: ${getProfileFieldValue(profile.registrationNumber)} | NTN: ${getProfileFieldValue(profile.taxNumber)} | Phone: ${getProfileFieldValue(profile.primaryPhone)}
            </div>
          </div>
          <div class="badge">
            SHIFT MANAGEMENT MASTER<br/>
            <span style="font-weight: normal; font-size: 9px; color: #64748b;">${shifts.length} Configured Shifts</span>
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
              <th>Code</th>
              <th>Shift Name</th>
              <th>Department</th>
              <th>Type</th>
              <th>Timing</th>
              <th>Net Hours</th>
              <th>Break</th>
              <th>Grace</th>
              <th>Tolerance</th>
              <th>Weekly Off</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${shifts.length === 0 ? `
              <tr>
                <td colspan="11" style="text-align: center; padding: 24px; color: #64748b;">
                  No shift records found matching the active filter criteria.
                </td>
              </tr>
            ` : shifts.map((s) => `
              <tr>
                <td style="font-weight: bold; font-family: monospace;">${s.code}</td>
                <td style="font-weight: 600;">${s.name}</td>
                <td>${s.departmentName}</td>
                <td>
                  <span class="tag ${
                    s.shiftType === 'MORNING' ? 'tag-morning' :
                    s.shiftType === 'EVENING' ? 'tag-evening' :
                    s.shiftType === 'NIGHT' ? 'tag-night' : 'tag-custom'
                  }">
                    ${s.shiftType}
                  </span>
                </td>
                <td>
                  <div>${format12HourTime(s.startTime)} – ${format12HourTime(s.endTime)}</div>
                  ${s.isOvernight ? '<span class="tag tag-overnight" style="margin-top:2px;">+1 Day / Overnight</span>' : ''}
                </td>
                <td style="font-weight: bold; color: #08775A;">${formatMinutesToHours(s.netWorkingMinutes)}</td>
                <td>${s.breakMinutes}m</td>
                <td>${s.defaultArrivalGraceMinutes}m</td>
                <td>${s.defaultEarlyExitToleranceMinutes}m</td>
                <td>${s.defaultWeeklyOffDays && s.defaultWeeklyOffDays.length > 0 ? s.defaultWeeklyOffDays.join(', ') : 'None'}</td>
                <td class="${s.status === 'ACTIVE' ? 'status-active' : 'status-inactive'}">
                  ${s.status}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          <div>CONFIDENTIAL • OFFICIAL HOSPITAL DUTY SHIFT DIRECTORY • UNAUTHORIZED MODIFICATION PROHIBITED</div>
          <div>Page 1 • ${profile.name || 'Not configured'}</div>
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
