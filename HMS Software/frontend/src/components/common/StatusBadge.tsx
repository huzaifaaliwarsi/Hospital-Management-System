import React from 'react';
import { StatusType } from '../../types';
import { cn } from '../../utils/formatters';

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
  size?: 'sm' | 'md';
  showDot?: boolean;
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  className,
  size = 'md',
  showDot = true,
}) => {
  const normalized = status as StatusType;

  // Visual style mappings adhering strictly to hospital enterprise standards
  let style = {
    bg: 'bg-slate-100',
    text: 'text-slate-800',
    border: 'border-slate-200',
    dot: 'bg-slate-500',
  };

  switch (normalized) {
    // Medical Positive / Success (Green)
    case 'Active':
    case 'Paid':
    case 'In Stock':
      style = {
        bg: 'bg-green-50',
        text: 'text-green-700',
        border: 'border-green-200',
        dot: 'bg-green-600',
      };
      break;

    // Admitted (Clinical active state - soft mint & emerald)
    case 'Admitted':
      style = {
        bg: 'bg-[#effaf5]',
        text: 'text-[#08775A]',
        border: 'border-[#c2e7db]',
        dot: 'bg-[#149E75]',
      };
      break;

    // Warnings / Pending / Low Stock (Amber)
    case 'Pending':
    case 'Partially Paid':
    case 'Low Stock':
    case 'Near Expiry':
      style = {
        bg: 'bg-amber-50',
        text: 'text-amber-700',
        border: 'border-amber-200',
        dot: 'bg-amber-600',
      };
      break;

    // Danger / Critical / Cancelled / Unpaid / Expired / Out of stock (Red)
    case 'Unpaid':
    case 'Cancelled':
    case 'Out of Stock':
    case 'Expired':
      style = {
        bg: 'bg-rose-50',
        text: 'text-rose-700',
        border: 'border-rose-200',
        dot: 'bg-rose-600',
      };
      break;

    // Inactive / Discharged / Refunded (Neutral gray/slate)
    case 'Inactive':
    case 'Discharged':
    case 'Refunded':
      style = {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
      };
      break;

    default:
      style = {
        bg: 'bg-slate-100',
        text: 'text-slate-600',
        border: 'border-slate-200',
        dot: 'bg-slate-400',
      };
      break;
  }

  const sizeClasses =
    size === 'sm'
      ? 'px-1.5 py-0.5 text-[11px] font-medium'
      : 'px-2 py-0.5 text-xs font-medium';

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md border whitespace-nowrap tracking-tight transition-colors',
        style.bg,
        style.text,
        style.border,
        sizeClasses,
        className
      )}
      title={`Status: ${status}`}
    >
      {showDot && (
        <span
          className={cn(
            'inline-block h-1.5 w-1.5 rounded-full shrink-0',
            style.dot,
            (normalized === 'Admitted' || normalized === 'Low Stock' || normalized === 'Expired') && 'animate-pulse'
          )}
        />
      )}
      <span>{status}</span>
    </span>
  );
};
