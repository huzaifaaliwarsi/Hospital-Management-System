import React from 'react';
import { cn } from '../../utils/formatters';

export interface HospitalLoaderProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  message?: string;
  submessage?: string;
  className?: string;
  fullscreen?: boolean;
}

/**
 * Hospital-wide Theme-Aligned Green Circular Loader
 * Styled with the hospital's primary green theme (#129b70 / #08775A).
 * Features an outer track, active emerald spinner, center pulse dot, and ambient glow.
 */
export const HospitalLoader: React.FC<HospitalLoaderProps> = ({
  size = 'md',
  message,
  submessage,
  className,
  fullscreen = false,
}) => {
  const spinnerSizes = {
    sm: 'h-5 w-5 border-2',
    md: 'h-8 w-8 border-[2.5px]',
    lg: 'h-12 w-12 border-3',
    xl: 'h-16 w-16 border-4',
  };

  const glowSizes = {
    sm: 'h-8 w-8',
    md: 'h-12 w-12',
    lg: 'h-16 w-16',
    xl: 'h-24 w-24',
  };

  const centerDotSizes = {
    sm: 'h-1.5 w-1.5',
    md: 'h-2 w-2',
    lg: 'h-3 w-3',
    xl: 'h-4 w-4',
  };

  const content = (
    <div className={cn('flex flex-col items-center justify-center text-center p-6', className)}>
      <div className="relative flex items-center justify-center mb-3">
        {/* Ambient soft green pulse glow */}
        <div className={cn('absolute rounded-full bg-emerald-100/70 animate-pulse', glowSizes[size])} />

        {/* Circular green themed spinner */}
        <div
          className={cn(
            'rounded-full border-emerald-100 border-t-[#129b70] border-r-[#08775A] animate-spin',
            spinnerSizes[size]
          )}
        />

        {/* Inner center pulse dot */}
        <div className={cn('absolute rounded-full bg-[#129b70]', centerDotSizes[size])} />
      </div>

      {message && <p className="text-xs font-semibold text-slate-800 tracking-tight">{message}</p>}
      {submessage && <p className="text-[11px] text-slate-500 mt-1 max-w-xs">{submessage}</p>}
    </div>
  );

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-white/80 backdrop-blur-xs flex items-center justify-center">
        {content}
      </div>
    );
  }

  return content;
};
