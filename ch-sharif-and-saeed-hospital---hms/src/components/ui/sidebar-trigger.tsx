import * as React from 'react';
import { PanelLeft, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { cn } from '../../utils/formatters';

interface SidebarTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  isCollapsed?: boolean;
  onToggle?: () => void;
  className?: string;
  showTooltip?: boolean;
}

/**
 * Shadcn-style Sidebar Trigger / Closer component
 * Provides a clean, tactile collapse/expand button with smooth panel-left icon
 */
export const SidebarTrigger = React.forwardRef<HTMLButtonElement, SidebarTriggerProps>(
  ({ isCollapsed = false, onToggle, className, showTooltip = true, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        onClick={onToggle}
        className={cn(
          'inline-flex items-center justify-center h-8 w-8 rounded-lg text-slate-500 hover:text-slate-900 hover:bg-slate-100 border border-transparent hover:border-slate-200 transition-all duration-150 cursor-pointer active:scale-95 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-emerald-500',
          className
        )}
        title={showTooltip ? (isCollapsed ? 'Expand sidebar' : 'Collapse sidebar') : undefined}
        aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        {...props}
      >
        {isCollapsed ? (
          <PanelLeftOpen className="h-4 w-4" />
        ) : (
          <PanelLeftClose className="h-4 w-4" />
        )}
      </button>
    );
  }
);

SidebarTrigger.displayName = 'SidebarTrigger';
