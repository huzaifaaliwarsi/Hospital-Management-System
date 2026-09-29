import React, { useState, useMemo } from 'react';
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
} from 'lucide-react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (row: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
  className?: string;
  headerClassName?: string;
  width?: string;
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
  emptyTitle?: string;
  emptyDescription?: string;
  pageSize?: number;
  showIndex?: boolean;
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
  emptyTitle = 'No Records Found',
  emptyDescription = 'There are no items matching your criteria.',
  pageSize = 15,
  showIndex = true,
}: PharmacyDataTableProps<T>) {
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  // Filtered dataset
  const filteredData = useMemo(() => {
    if (!search.trim()) return data;
    const q = search.toLowerCase();
    if (searchFilter) {
      return data.filter((row) => searchFilter(row, q));
    }
    // Fallback automatic search on row string values
    return data.filter((row) =>
      Object.values(row as Record<string, unknown>).some(
        (val) => val != null && String(val).toLowerCase().includes(q)
      )
    );
  }, [data, search, searchFilter]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredData.length / pageSize));
  const validPage = Math.min(currentPage, totalPages);

  const paginatedData = useMemo(() => {
    const start = (validPage - 1) * pageSize;
    return filteredData.slice(start, start + pageSize);
  }, [filteredData, validPage, pageSize]);

  return (
    <div className="space-y-3">
      {/* Table Toolbar */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-3 flex-1 min-w-[280px]">
          {/* Search Bar */}
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              placeholder={searchPlaceholder}
              className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 hover:bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-[#08775A] focus:border-[#08775A] transition-colors"
            />
          </div>

          {/* Filter Controls Slot */}
          {filterControls}

          {/* Refresh Button */}
          {onRefresh && (
            <button
              type="button"
              onClick={onRefresh}
              className="p-2 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-600 transition-colors"
              title="Refresh Records"
            >
              <RotateCcw className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Action Buttons Slot */}
        {actions && <div className="flex items-center gap-2">{actions}</div>}
      </div>

      {/* Hospital Table Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-2xs overflow-hidden">
        <div className="overflow-x-auto max-h-[calc(100vh-320px)]">
          <table className="w-full text-left border-collapse">
            <thead className="bg-[#f1f5f9] select-none sticky top-0 z-10 border-b border-slate-300">
              <tr>
                {showIndex && (
                  <th className="py-2.5 px-3 text-center border-r border-slate-300 text-[11px] font-bold text-slate-800 uppercase tracking-wider w-12 bg-[#f1f5f9]">
                    #
                  </th>
                )}
                {columns.map((col) => (
                  <th
                    key={col.key}
                    style={{ width: col.width }}
                    className={`py-2.5 px-3.5 border-r border-slate-300 last:border-r-0 text-[11px] font-bold text-slate-800 uppercase tracking-wider whitespace-nowrap bg-[#f1f5f9] ${
                      col.align === 'right'
                        ? 'text-right'
                        : col.align === 'center'
                        ? 'text-center'
                        : 'text-left'
                    } ${col.headerClassName || ''}`}
                  >
                    {col.header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-800">
              {loading ? (
                <tr>
                  <td
                    colSpan={columns.length + (showIndex ? 1 : 0)}
                    className="py-14 text-center text-slate-500"
                  >
                    <div className="flex flex-col items-center justify-center gap-2">
                      <div className="h-7 w-7 border-2 border-emerald-600 border-t-transparent rounded-full animate-spin" />
                      <span className="text-xs font-medium">Loading hospital records…</span>
                    </div>
                  </td>
                </tr>
              ) : paginatedData.length === 0 ? (
                <tr>
                  <td
                    colSpan={columns.length + (showIndex ? 1 : 0)}
                    className="py-14 text-center text-slate-400"
                  >
                    <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto">
                      <div className="h-10 w-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
                        <Search className="h-5 w-5" />
                      </div>
                      <div className="font-bold text-slate-700 text-sm">{emptyTitle}</div>
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
                      className="hover:bg-emerald-50/40 transition-colors group"
                    >
                      {showIndex && (
                        <td className="py-2.5 px-3 text-center border-r border-slate-200 text-slate-400 font-mono text-[11px] bg-slate-50/50 whitespace-nowrap group-hover:bg-emerald-50/30">
                          {globalIdx}
                        </td>
                      )}
                      {columns.map((col) => (
                        <td
                          key={col.key}
                          className={`py-2.5 px-3.5 border-r border-slate-200 last:border-r-0 whitespace-nowrap font-medium ${
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

        {/* Table Footer with Pagination */}
        <div className="px-4 py-3 bg-[#f8fafc] border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>Showing</span>
            <strong className="text-slate-900 font-semibold">
              {filteredData.length === 0 ? 0 : (validPage - 1) * pageSize + 1}
            </strong>
            <span>to</span>
            <strong className="text-slate-900 font-semibold">
              {Math.min(validPage * pageSize, filteredData.length)}
            </strong>
            <span>of</span>
            <strong className="text-slate-900 font-semibold">{filteredData.length}</strong>
            <span>entries</span>
            {search && (
              <span className="text-slate-400 text-[11px] ml-1">
                (filtered from {data.length} total)
              </span>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => setCurrentPage(1)}
              disabled={validPage <= 1}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="First Page"
            >
              <ChevronsLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={validPage <= 1}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="Previous Page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>

            <span className="px-3 py-1 font-semibold text-slate-800 bg-white border border-slate-200 rounded">
              Page {validPage} of {totalPages}
            </span>

            <button
              type="button"
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={validPage >= totalPages}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="Next Page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setCurrentPage(totalPages)}
              disabled={validPage >= totalPages}
              className="p-1 rounded border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none transition-colors"
              title="Last Page"
            >
              <ChevronsRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
