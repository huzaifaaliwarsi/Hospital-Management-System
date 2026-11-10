import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Search,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  RotateCcw,
  Download,
  Filter,
  FileSpreadsheet,
  FileText,
  Printer,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
} from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
  width?: string;
  sortable?: boolean;
}

interface PharmacyDataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  loading?: boolean;
  searchPlaceholder?: string;
  searchFilter?: (row: T, query: string) => boolean;
  onRefresh?: () => void;
  actions?: React.ReactNode;
  filterControls?: React.ReactNode;
  onResetFilters?: () => void;
  onApplyFilters?: () => void;
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  showIndex?: boolean;
  title?: string;
  badge?: string;
  exportFileName?: string;
  minTableWidth?: string;
}

export function PharmacyDataTable<T extends { id?: string | number }>({
  columns,
  data,
  loading = false,
  searchPlaceholder = 'Search records…',
  searchFilter,
  onRefresh,
  actions,
  filterControls,
  onResetFilters,
  onApplyFilters,
  emptyTitle = 'No Records Found',
  emptyDescription = 'There are no items matching your criteria.',
  pageSize: initialPageSize = 15,
  showIndex = true,
  title = 'Registry Records',
  badge = 'Active Records',
  exportFileName = 'hospital_records',
  minTableWidth = '1300px',
}: PharmacyDataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [inResultSearch, setInResultSearch] = useState('');
  const [pageSize, setPageSize] = useState(initialPageSize);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');

  // Dual Synchronized Scrollbars
  const topScrollRef = useRef<HTMLDivElement>(null);
  const bottomScrollRef = useRef<HTMLDivElement>(null);
  const isSyncingScroll = useRef(false);
  const [tableScrollWidth, setTableScrollWidth] = useState(1200);

  const syncTopToBottom = () => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (topScrollRef.current && bottomScrollRef.current) {
      bottomScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  const syncBottomToTop = () => {
    if (isSyncingScroll.current) return;
    isSyncingScroll.current = true;
    if (topScrollRef.current && bottomScrollRef.current) {
      topScrollRef.current.scrollLeft = bottomScrollRef.current.scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  };

  // Filtered dataset
  const filteredData = useMemo(() => {
    let result = data;

    // Main search filter
    if (search.trim()) {
      const q = search.toLowerCase();
      if (searchFilter) {
        result = result.filter((row) => searchFilter(row, q));
      } else {
        result = result.filter((row) =>
          Object.values(row as Record<string, unknown>).some(
            (val) => val != null && String(val).toLowerCase().includes(q)
          )
        );
      }
    }

    // In-results search
    if (inResultSearch.trim()) {
      const q = inResultSearch.toLowerCase();
      result = result.filter((row) =>
        Object.values(row as Record<string, unknown>).some(
          (val) => val != null && String(val).toLowerCase().includes(q)
        )
      );
    }

    // Sorting
    if (sortField) {
      result = [...result].sort((a, b) => {
        const valA = (a as any)[sortField];
        const valB = (b as any)[sortField];
        if (valA == null) return 1;
        if (valB == null) return -1;
        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortOrder === 'asc' ? valA - valB : valB - valA;
        }
        const cmp = String(valA).localeCompare(String(valB));
        return sortOrder === 'asc' ? cmp : -cmp;
      });
    }

    return result;
  }, [data, search, inResultSearch, searchFilter, sortField, sortOrder]);

  // Update dynamic scrollWidth
  useEffect(() => {
    if (bottomScrollRef.current) {
      setTableScrollWidth(bottomScrollRef.current.scrollWidth);
    }
  }, [filteredData, pageSize, currentPage]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, validPage, pageSize]);

  // Handle Sort
  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  // Reset all filters
  const handleReset = () => {
    setSearch('');
    setInResultSearch('');
    setCurrentPage(1);
    setSortField(null);
    if (onResetFilters) {
      onResetFilters();
    }
  };

  // Export to CSV
  const handleExportCsv = () => {
    if (filteredData.length === 0) return;
    const headerCols = columns.map((c) => c.header);
    if (showIndex) headerCols.unshift('#');

    const csvRows = [
      headerCols.map((h) => `"${h}"`).join(','),
      ...filteredData.map((row, idx) => {
        const rowVals = columns.map((col) => {
          const val = (row as any)[col.key];
          return `"${String(val ?? '').replace(/"/g, '""')}"`;
        });
        if (showIndex) rowVals.unshift(String(idx + 1));
        return rowVals.join(',');
      }),
    ];

    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${exportFileName}_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (filteredData.length === 0) return;
    const headerHtml = columns.map((c) => `<th>${c.header}</th>`).join('');
    const rowsHtml = filteredData
      .map(
        (row, idx) => `
        <tr>
          ${showIndex ? `<td>${idx + 1}</td>` : ''}
          ${columns.map((c) => `<td>${(row as any)[c.key] ?? ''}</td>`).join('')}
        </tr>
      `
      )
      .join('');

    const html = `
      <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
      <head><meta charset="utf-8"/></head>
      <body>
        <h2>${title}</h2>
        <table border="1">
          <tr style="background:#0e5944;color:#ffffff;font-weight:bold;">
            ${showIndex ? '<th>#</th>' : ''}
            ${headerHtml}
          </tr>
          ${rowsHtml}
        </table>
      </body>
      </html>
    `;

    const blob = new Blob([html], { type: 'application/vnd.ms-excel' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${exportFileName}_${new Date().toISOString().slice(0, 10)}.xls`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-4">
      {/* ── 1. TOP FILTER & SEARCH TOOLBAR (Compact & Sleek) ── */}
      <div className="bg-white p-3 rounded-xl border border-slate-300/80 shadow-[0_1px_3px_rgba(0,0,0,0.03)] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2.5 flex-1 min-w-[280px]">
          {/* Main search input */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              onKeyDown={(e) => e.key === 'Enter' && onApplyFilters && onApplyFilters()}
              placeholder={searchPlaceholder}
              className="w-full h-8.5 pl-8.5 pr-3 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0e7d5a] focus:border-[#0e7d5a] transition-colors"
            />
          </div>

          {/* Filter Controls Slot */}
          {filterControls}

          {/* Filter & Reset Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onApplyFilters}
              className="px-3.5 py-1.5 bg-[#0e7d5a] hover:bg-[#0c6b50] text-white rounded-lg text-xs font-semibold flex items-center gap-1.5 shadow-xs transition-all cursor-pointer whitespace-nowrap"
            >
              <Filter className="h-3.5 w-3.5" /> Filter
            </button>
            <button
              type="button"
              onClick={handleReset}
              className="px-3 py-1.5 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer whitespace-nowrap"
              title="Reset Filters"
            >
              <RotateCcw className="h-3.5 w-3.5 text-slate-500" /> Reset
            </button>
          </div>
        </div>

        {/* Action Buttons Slot (e.g. Add New Button) */}
        {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
      </div>

      {/* ── 2. TABLE CONTAINER (MATCHES REFERENCE WITH DARK EMERALD HEADER) ── */}
      <div className="bg-white rounded-2xl border border-slate-300/80 shadow-[0_1px_4px_rgba(0,0,0,0.04)] overflow-hidden">
        {/* Dark Emerald Header Strip */}
        <div className="bg-[#0e5944] text-white px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-4 w-4 text-emerald-300" />
            <span className="font-bold text-xs sm:text-sm tracking-tight text-white whitespace-nowrap">
              {title}
            </span>
            <span className="text-[10px] font-semibold bg-emerald-700/60 text-emerald-200 px-2 py-0.5 rounded-full border border-emerald-500/30 whitespace-nowrap">
              {badge}
            </span>
          </div>

          {/* Export Action Buttons */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={handleExportExcel}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#16a34a] hover:bg-[#15803d] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              title="Download Excel Worksheet"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" /> Excel
            </button>
            <button
              type="button"
              onClick={handleExportCsv}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#0284c7] hover:bg-[#0369a1] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              title="Download CSV"
            >
              <Download className="h-3.5 w-3.5" /> CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-[#dc2626] hover:bg-[#b91c1c] text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              title="Export as PDF via Print"
            >
              <FileText className="h-3.5 w-3.5" /> PDF
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold shadow-xs transition-colors cursor-pointer whitespace-nowrap"
              title="Print Table"
            >
              <Printer className="h-3.5 w-3.5" /> Print
            </button>
          </div>
        </div>

        {/* Search In Results Bar */}
        <div className="px-3.5 py-2 bg-slate-50/70 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs">
          <div className="relative w-60 sm:w-68">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              value={inResultSearch}
              onChange={(e) => {
                setInResultSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder="Search in results…"
              className="w-full h-7.5 pl-8 pr-2.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#0e7d5a]"
            />
          </div>

          <div className="flex items-center gap-3 text-slate-500 font-medium text-xs">
            <span className="whitespace-nowrap">
              Showing <strong className="text-slate-800">{paginatedData.length}</strong> of{' '}
              <strong className="text-slate-800">{filteredData.length}</strong> records
            </span>
            <div className="flex items-center gap-1.5 whitespace-nowrap">
              <span>Per page:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-200 rounded-md px-2 py-0.5 text-xs text-slate-700 focus:outline-none"
              >
                <option value={10}>10</option>
                <option value={15}>15</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>
        </div>

        {/* ── TOP HORIZONTAL SCROLLER (Synchronized with bottom table) ── */}
        <div
          ref={topScrollRef}
          onScroll={syncTopToBottom}
          className="overflow-x-auto overflow-y-hidden h-2 bg-slate-100 border-b border-slate-200 scrollbar-thin"
        >
          <div style={{ width: `${tableScrollWidth}px`, height: '1px' }} />
        </div>

        {/* ── MAIN TABLE CONTAINER (Bottom Horizontal Scroller) ── */}
        <div
          ref={bottomScrollRef}
          onScroll={syncBottomToTop}
          className="overflow-x-auto max-h-[calc(100vh-370px)] scrollbar-thin"
        >
          <table
            style={{ minWidth: minTableWidth }}
            className="w-full border-collapse text-left text-xs"
          >
            <thead className="bg-[#f8fafc] text-slate-700 font-bold sticky top-0 z-10 border-b border-slate-200 uppercase tracking-wider select-none text-xs">
              <tr>
                {showIndex && (
                  <th className="py-3 px-3.5 text-center border-r border-slate-200 w-14 whitespace-nowrap">
                    #
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    onClick={() => handleSort(col.key)}
                    className={`py-3 px-4 border-r border-slate-200 last:border-r-0 whitespace-nowrap cursor-pointer hover:bg-slate-100 transition-colors ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    } ${col.headerClassName || ''}`}
                  >
                    <div
                      className={`flex items-center gap-1.5 whitespace-nowrap ${
                        col.align === 'right'
                          ? 'justify-end'
                          : col.align === 'center'
                          ? 'justify-center'
                          : 'justify-start'
                      }`}
                    >
                      <span>{col.header}</span>
                      {sortField === col.key ? (
                        sortOrder === 'asc' ? (
                          <ArrowUp className="h-3 w-3 text-[#0e7d5a]" />
                        ) : (
                          <ArrowDown className="h-3 w-3 text-[#0e7d5a]" />
                        )
                      ) : (
                        <ArrowUpDown className="h-3 w-3 text-slate-400" />
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length + (showIndex ? 1 : 0)}
                    className="py-12 text-center text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-5 w-5 border-2 border-[#0e7d5a] border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs">Loading records from hospital system…</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (showIndex ? 1 : 0)}
                    className="py-12 text-center text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-1.5 max-w-sm mx-auto">
                      <div className="h-8 w-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Search className="h-4 w-4" />
                      </div>
                      <div className="font-semibold text-slate-700 text-xs">{emptyTitle}</div>
                      <p className="text-xs text-slate-500">{emptyDescription}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedData.map((row, idx) => {
                  const globalIdx = (validPage - 1) * pageSize + idx + 1;
                  return (
                    <tr
                      key={row.id || idx}
                      className="hover:bg-slate-50/80 transition-colors group"
                    >
                      {showIndex && (
                        <td className="py-3.5 px-3.5 text-center border-r border-slate-100 text-slate-500 font-semibold text-xs whitespace-nowrap">
                          {globalIdx}
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`py-3.5 px-4 border-r border-slate-100 last:border-r-0 whitespace-nowrap text-xs text-slate-900 ${
                            col.align === 'right'
                              ? 'text-right'
                              : col.align === 'center'
                              ? 'text-center'
                              : 'text-left'
                          } ${col.className || ''}`}
                        >
                          {col.render
                            ? col.render(row, globalIdx)
                            : (row as any)[col.key] ?? '—'}
                        </td>
                      ))}
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* ── 3. PAGINATION FOOTER ── */}
        <div className="px-3.5 py-2.5 bg-white border-t border-slate-200 flex flex-wrap items-center justify-between gap-2.5 text-xs text-slate-500">
          <div className="whitespace-nowrap">
            Showing{' '}
            <strong className="text-slate-800">
              {filteredData.length === 0 ? 0 : (validPage - 1) * pageSize + 1}
            </strong>{' '}
            to{' '}
            <strong className="text-slate-800">
              {Math.min(validPage * pageSize, filteredData.length)}
            </strong>{' '}
            of <strong className="text-slate-800">{filteredData.length}</strong> entries
          </div>

          <div className="flex items-center gap-1.5 whitespace-nowrap">
            <button
              type="button"
              disabled={validPage <= 1}
              onClick={() => setCurrentPage(1)}
              className="p-1 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              title="First Page"
            >
              <ChevronsLeft className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={validPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Previous Page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <span className="px-2.5 py-0.5 text-xs font-semibold bg-emerald-50 text-[#0e7d5a] rounded-md border border-emerald-200/80">
              Page {validPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={validPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Next Page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              disabled={validPage >= totalPages}
              onClick={() => setCurrentPage(totalPages)}
              className="p-1 rounded-md border border-slate-200 hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors cursor-pointer"
              title="Last Page"
            >
              <ChevronsRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
