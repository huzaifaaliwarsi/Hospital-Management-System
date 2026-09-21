import React, { useState, useMemo } from 'react';
import {
  Search,
  Filter,
  Plus,
  RefreshCw,
  MoreVertical,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Columns,
  Eye,
  Edit2,
  Trash2,
  Printer,
  Calendar,
  Check,
  FileSpreadsheet,
} from 'lucide-react';
import { TableColumn } from '../../types';
import { ExportMenu } from './ExportMenu';
import { ImportExcelModal } from './ImportExcelModal';
import { EmptyState, LoadingState, ErrorState } from '../common/StateViews';
import { cn } from '../../utils/formatters';

export interface DataTableProps<T> {
  data: T[];
  columns: TableColumn<T>[];
  keyExtractor: (item: T) => string;
  title?: string;
  description?: string;
  isLoading?: boolean;
  isError?: boolean;
  errorMessage?: string;
  onRefresh?: () => void;
  onAddNew?: () => void;
  addNewLabel?: string;
  onView?: (item: T) => void;
  onEdit?: (item: T) => void;
  onDelete?: (item: T) => void;
  onPrintRow?: (item: T) => void;
  enableSelection?: boolean;
  enableExport?: boolean;
  enableImport?: boolean;
  initialRowsPerPage?: number;
  dateFilterEnabled?: boolean;
  customFilterComponent?: React.ReactNode;
}

export function DataTable<T extends Record<string, any>>({
  data,
  columns,
  keyExtractor,
  title,
  description,
  isLoading = false,
  isError = false,
  errorMessage,
  onRefresh,
  onAddNew,
  addNewLabel = 'Add New',
  onView,
  onEdit,
  onDelete,
  onPrintRow,
  enableSelection = true,
  enableExport = true,
  enableImport = true,
  initialRowsPerPage = 10,
  dateFilterEnabled = true,
  customFilterComponent,
}: DataTableProps<T>) {
  // Search & Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [dateFilter, setDateFilter] = useState('');

  // Sorting state
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');

  // Column visibility state
  const [visibleColumns, setVisibleColumns] = useState<Record<string, boolean>>(
    columns.reduce((acc, col) => ({ ...acc, [col.key]: true }), {})
  );
  const [showColumnMenu, setShowColumnMenu] = useState(false);

  // Selection state
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);

  // Import Modal state
  const [isImportOpen, setIsImportOpen] = useState(false);

  // Filter and sort data
  const filteredData = useMemo(() => {
    let result = [...data];

    // Search filter across all primitive values
    if (searchTerm.trim()) {
      const lowerQuery = searchTerm.toLowerCase();
      result = result.filter((item) =>
        Object.values(item).some((val) =>
          val !== null && val !== undefined && String(val).toLowerCase().includes(lowerQuery)
        )
      );
    }

    // Sorting
    if (sortKey) {
      result.sort((a, b) => {
        const valA = a[sortKey];
        const valB = b[sortKey];

        if (valA === valB) return 0;
        if (valA === null || valA === undefined) return 1;
        if (valB === null || valB === undefined) return -1;

        if (typeof valA === 'number' && typeof valB === 'number') {
          return sortDirection === 'asc' ? valA - valB : valB - valA;
        }

        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        return sortDirection === 'asc' ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return result;
  }, [data, searchTerm, sortKey, sortDirection]);

  // Paginated slice
  const totalPages = Math.max(1, Math.ceil(filteredData.length / rowsPerPage));
  const paginatedData = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredData.slice(start, start + rowsPerPage);
  }, [filteredData, currentPage, rowsPerPage]);

  // Sorting toggle
  const handleSort = (key: string, sortable?: boolean) => {
    if (sortable === false) return;
    if (sortKey === key) {
      if (sortDirection === 'asc') {
        setSortDirection('desc');
      } else {
        setSortKey(null);
        setSortDirection('asc');
      }
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  // Selection handlers
  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      const allCurrentKeys = new Set(paginatedData.map(keyExtractor));
      setSelectedKeys(allCurrentKeys);
    } else {
      setSelectedKeys(new Set());
    }
  };

  const handleToggleRow = (key: string) => {
    const next = new Set(selectedKeys);
    if (next.has(key)) {
      next.delete(key);
    } else {
      next.add(key);
    }
    setSelectedKeys(next);
  };

  const isAllSelected =
    paginatedData.length > 0 && paginatedData.every((item) => selectedKeys.has(keyExtractor(item)));

  // Render visible columns
  const activeColumns = columns.filter((col) => visibleColumns[col.key] !== false);

  return (
    <div className="w-full bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
      {/* Table Header / Toolbar */}
      <div className="p-3.5 sm:p-4 border-b border-slate-200 space-y-3 bg-white">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            {title && <h3 className="text-base font-bold text-slate-900">{title}</h3>}
            {description && <p className="text-xs text-slate-500 mt-0.5">{description}</p>}
          </div>

          {/* Standard Actions: Add New, Import Excel, Export Menu, Refresh */}
          <div className="flex flex-wrap items-center gap-2">
            {onAddNew && (
              <button
                type="button"
                onClick={onAddNew}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-[#129b70] text-white hover:bg-[#0e7d5a] transition-colors shadow-2xs"
              >
                <Plus className="h-3.5 w-3.5" />
                {addNewLabel}
              </button>
            )}

            {enableImport && (
              <button
                type="button"
                onClick={() => setIsImportOpen(true)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 transition-colors shadow-2xs"
                title="Batch Import Excel records"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-emerald-600" />
                <span>Import Excel</span>
              </button>
            )}

            {enableExport && (
              <ExportMenu
                reportTitle={title || 'Hospital Management System Data Export'}
                dataCount={filteredData.length}
                selectedCount={selectedKeys.size}
                activeFilters={searchTerm ? [`Search: "${searchTerm}"`] : ['All Active Records']}
              />
            )}

            {onRefresh && (
              <button
                type="button"
                onClick={onRefresh}
                className="p-1.5 rounded-lg border border-slate-300 text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition-colors shadow-2xs"
                title="Refresh Table Data"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isLoading && 'animate-spin')} />
              </button>
            )}
          </div>
        </div>

        {/* Search, Filter Toggle, Column Selector */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
          <div className="flex items-center gap-2 flex-1 max-w-md">
            <div className="relative w-full">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="Search across all records..."
                className="w-full pl-9 pr-4 py-1.5 text-xs bg-slate-100 border-none rounded-md text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-[#149E75]/20 focus:border-[#149E75] transition-colors"
              />
            </div>

            <button
              type="button"
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border transition-colors shrink-0',
                showFilters
                  ? 'bg-[#effaf5] border-[#c2e7db] text-[#08775A]'
                  : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              <span>Filters</span>
            </button>
          </div>

          {/* Right side controls: Column visibility & Rows per page */}
          <div className="flex items-center gap-2">
            {selectedKeys.size > 0 && (
              <span className="text-xs font-semibold text-[#08775A] bg-[#effaf5] px-2.5 py-1 rounded-md border border-[#c2e7db]">
                {selectedKeys.size} selected
              </span>
            )}

            {/* Column Visibility Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowColumnMenu(!showColumnMenu)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 transition-colors shadow-2xs"
                title="Toggle Columns"
              >
                <Columns className="h-3.5 w-3.5 text-slate-500" />
                <span>Columns</span>
              </button>

              {showColumnMenu && (
                <>
                  <div className="fixed inset-0 z-20" onClick={() => setShowColumnMenu(false)} />
                  <div className="absolute right-0 mt-1.5 w-48 rounded-xl bg-white border border-slate-200 shadow-xl z-30 p-2 text-xs space-y-1">
                    <p className="text-[11px] font-semibold text-slate-400 px-2 py-1 uppercase tracking-wider">
                      Visible Columns
                    </p>
                    {columns.map((col) => {
                      const isVisible = visibleColumns[col.key] !== false;
                      return (
                        <label
                          key={col.key}
                          className="flex items-center gap-2 px-2 py-1 rounded hover:bg-slate-50 cursor-pointer select-none text-slate-700"
                        >
                          <input
                            type="checkbox"
                            checked={isVisible}
                            onChange={() =>
                              setVisibleColumns((prev) => ({
                                ...prev,
                                [col.key]: !isVisible,
                              }))
                            }
                            className="h-3.5 w-3.5 rounded text-[#149E75] focus:ring-[#149E75]"
                          />
                          <span>{col.header}</span>
                        </label>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Collapsible Filter Panel */}
        {showFilters && (
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 flex flex-wrap items-center gap-3 text-xs animate-in fade-in duration-150">
            {dateFilterEnabled && (
              <div className="flex items-center gap-2">
                <span className="text-slate-500 font-medium">Filter by Date:</span>
                <input
                  lang="en-GB" type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="px-2 py-1 bg-white border border-slate-300 rounded text-xs text-slate-800"
                />
              </div>
            )}
            {customFilterComponent}
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setDateFilter('');
              }}
              className="text-slate-500 hover:text-slate-800 underline text-xs ml-auto"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Table Body Area */}
      <div className="overflow-x-auto relative min-h-[220px]">
        {isLoading ? (
          <LoadingState type="skeleton-table" rows={rowsPerPage} />
        ) : isError ? (
          <ErrorState message={errorMessage} onRetry={onRefresh} />
        ) : paginatedData.length === 0 ? (
          <EmptyState
            title="No matching records"
            description="No entries matched your search keywords or filter criteria."
            actionLabel={searchTerm ? 'Clear Search' : undefined}
            onAction={() => setSearchTerm('')}
          />
        ) : (
          <table className="w-full text-left text-xs border-collapse">
            <thead className="bg-slate-50 sticky top-0 border-b border-slate-200 select-none">
              <tr className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
                {enableSelection && (
                  <th className="w-10 px-4 py-2.5 text-center">
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="h-3.5 w-3.5 rounded border-slate-300 text-[#149E75] focus:ring-[#149E75] cursor-pointer"
                      aria-label="Select all rows"
                    />
                  </th>
                )}
                {activeColumns.map((col) => {
                  const isSorted = sortKey === col.key;
                  return (
                    <th
                      key={col.key}
                      style={{ width: col.width }}
                      onClick={() => handleSort(col.key, col.sortable)}
                      className={cn(
                        'px-4 py-2.5 font-semibold text-slate-500 uppercase text-[11px] tracking-wider',
                        col.sortable !== false && 'cursor-pointer hover:bg-slate-100/70',
                        col.align === 'center' && 'text-center',
                        col.align === 'right' && 'text-right'
                      )}
                    >
                      <div
                        className={cn(
                          'inline-flex items-center gap-1.5',
                          col.align === 'right' && 'justify-end',
                          col.align === 'center' && 'justify-center'
                        )}
                      >
                        <span>{col.header}</span>
                        {col.sortable !== false && (
                          <span className="text-slate-400">
                            {isSorted ? (
                              sortDirection === 'asc' ? (
                                <ArrowUp className="h-3 w-3 text-[#149E75]" />
                              ) : (
                                <ArrowDown className="h-3 w-3 text-[#149E75]" />
                              )
                            ) : (
                              <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-100" />
                            )}
                          </span>
                        )}
                      </div>
                    </th>
                  );
                })}
                {(onView || onEdit || onDelete || onPrintRow) && (
                  <th className="w-24 px-4 py-2.5 text-right uppercase text-[11px] font-semibold text-slate-500 tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs">
              {paginatedData.map((item) => {
                const key = keyExtractor(item);
                const isSelected = selectedKeys.has(key);

                return (
                  <tr
                    key={key}
                    className={cn(
                      'hover:bg-slate-50 transition-colors',
                      isSelected && 'bg-[#effaf5]'
                    )}
                  >
                    {enableSelection && (
                      <td className="px-4 py-2 text-center">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleToggleRow(key)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-[#129b70] focus:ring-[#129b70] cursor-pointer"
                        />
                      </td>
                    )}
                    {activeColumns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-4 py-2 text-slate-900 font-medium',
                          col.align === 'center' && 'text-center',
                          col.align === 'right' && 'text-right font-mono'
                        )}
                      >
                        {col.render ? col.render(item) : item[col.key]}
                      </td>
                    ))}
                    {(onView || onEdit || onDelete || onPrintRow) && (
                      <td className="px-4 py-2 text-right">
                        <div className="inline-flex items-center justify-end gap-1">
                          {onView && (
                            <button
                              type="button"
                              onClick={() => onView(item)}
                              className="p-1 rounded text-slate-500 hover:text-[#0e7d5a] hover:bg-[#effaf5] transition-colors"
                              title="View Details"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {onEdit && (
                            <button
                              type="button"
                              onClick={() => onEdit(item)}
                              className="p-1 rounded text-slate-500 hover:text-amber-700 hover:bg-amber-50 transition-colors"
                              title="Edit Record"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {onPrintRow && (
                            <button
                              type="button"
                              onClick={() => onPrintRow(item)}
                              className="p-1 rounded text-slate-500 hover:text-teal-700 hover:bg-teal-50 transition-colors"
                              title="Print Slip"
                            >
                              <Printer className="h-3.5 w-3.5" />
                            </button>
                          )}
                          {onDelete && (
                            <button
                              type="button"
                              onClick={() => onDelete(item)}
                              className="p-1 rounded text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition-colors"
                              title="Delete / Cancel"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Table Pagination Footer */}
      {!isLoading && !isError && filteredData.length > 0 && (
        <div className="px-4 py-3 border-t border-slate-200 bg-slate-50/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-600">
          <div className="flex items-center gap-3">
            <span>
              Showing{' '}
              <strong className="text-slate-900">
                {Math.min(filteredData.length, (currentPage - 1) * rowsPerPage + 1)}
              </strong>{' '}
              to{' '}
              <strong className="text-slate-900">
                {Math.min(filteredData.length, currentPage * rowsPerPage)}
              </strong>{' '}
              of <strong className="text-slate-900">{filteredData.length}</strong> entries
            </span>

            <div className="flex items-center gap-1.5 border-l border-slate-200 pl-3">
              <span className="text-slate-500">Rows per page:</span>
              <select
                value={rowsPerPage}
                onChange={(e) => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border border-slate-300 rounded px-2 py-0.5 text-xs text-slate-800"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          {/* Page controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              disabled={currentPage === 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="p-1.5 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </button>

            <span className="px-3 py-1 font-semibold text-slate-800">
              Page {currentPage} of {totalPages}
            </span>

            <button
              type="button"
              disabled={currentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="p-1.5 rounded-md border border-slate-300 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              aria-label="Next page"
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Reusable Batch Excel Import Modal */}
      <ImportExcelModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        entityName={title || 'Hospital Records'}
      />
    </div>
  );
}
