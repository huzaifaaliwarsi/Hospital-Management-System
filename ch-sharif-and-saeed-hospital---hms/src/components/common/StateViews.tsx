import React from 'react';
import { AlertCircle, FolderSearch, RefreshCw } from 'lucide-react';
import { cn } from '../../utils/formatters';

interface EmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode;
  actionLabel?: string;
  onAction?: () => void;
  className?: string;
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title = 'No records found',
  description = 'There is currently no data to display matching your criteria.',
  icon,
  actionLabel,
  onAction,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-slate-200 bg-slate-50/50 my-4',
        className
      )}
    >
      <div className="p-3 rounded-full bg-slate-100 text-slate-400 mb-3">
        {icon || <FolderSearch className="h-6 w-6" />}
      </div>
      <h4 className="text-sm font-semibold text-slate-800 mb-1">{title}</h4>
      <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed">{description}</p>
      {actionLabel && onAction && (
        <button
          type="button"
          onClick={onAction}
          className="px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-[#149E75] text-white hover:bg-[#08775A] transition-colors shadow-xs"
        >
          {actionLabel}
        </button>
      )}
    </div>
  );
};

interface LoadingStateProps {
  message?: string;
  type?: 'spinner' | 'skeleton-table' | 'skeleton-cards';
  rows?: number;
  className?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({
  message = 'Loading hospital records...',
  type = 'spinner',
  rows = 5,
  className,
}) => {
  if (type === 'skeleton-table') {
    return (
      <div className={cn('w-full animate-pulse space-y-3 p-4', className)}>
        <div className="h-9 bg-slate-100 rounded-lg w-full" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="h-12 bg-slate-50 rounded-lg w-full flex items-center px-4 gap-4">
            <div className="h-4 bg-slate-200 rounded w-1/4" />
            <div className="h-4 bg-slate-200 rounded w-1/3" />
            <div className="h-4 bg-slate-200 rounded w-1/6" />
            <div className="h-4 bg-slate-200 rounded w-1/6 ml-auto" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'skeleton-cards') {
    return (
      <div className={cn('grid grid-cols-1 md:grid-cols-4 gap-4 animate-pulse', className)}>
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="p-4 rounded-xl border border-slate-200 bg-white h-28 space-y-3">
            <div className="h-3.5 bg-slate-200 rounded w-1/2" />
            <div className="h-7 bg-slate-200 rounded w-3/4" />
            <div className="h-3 bg-slate-100 rounded w-1/3" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center text-slate-500',
        className
      )}
    >
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#149E75] border-t-transparent mb-3" />
      <p className="text-xs font-medium text-slate-600">{message}</p>
    </div>
  );
};

interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = 'Unable to load data',
  message = 'An unexpected error occurred while communicating with the hospital subsystem.',
  onRetry,
  className,
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 text-center rounded-xl border border-rose-200 bg-rose-50/50 my-4',
        className
      )}
    >
      <div className="p-3 rounded-full bg-rose-100 text-rose-600 mb-3">
        <AlertCircle className="h-6 w-6" />
      </div>
      <h4 className="text-sm font-semibold text-rose-900 mb-1">{title}</h4>
      <p className="text-xs text-rose-700 max-w-sm mb-4 leading-relaxed">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold rounded-lg bg-rose-600 text-white hover:bg-rose-700 transition-colors shadow-xs"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry Request
        </button>
      )}
    </div>
  );
};
