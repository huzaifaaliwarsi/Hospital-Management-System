import React from 'react';
import { cn } from '../../utils/formatters';

interface PanelBadgeProps {
  /** Defaults to "Panel"; pass the full payer-type string where a call site already showed it verbatim (e.g. "Corporate / Panel"). */
  label?: string;
  className?: string;
}

/**
 * Panel payer-type pill — formalizes the purple-100/purple-800 convention
 * every Front Desk screen already used inline (NewAdmissionView,
 * AppointmentsView, Admission Payment Requests) into one shared component
 * instead of a hand-copied `bg-purple-100 text-purple-800` string per file.
 */
export const PanelBadge: React.FC<PanelBadgeProps> = ({ label = 'Panel', className }) => (
  <span className={cn('px-1.5 py-0.5 rounded text-[9px] font-bold bg-purple-100 text-purple-800', className)}>
    {label}
  </span>
);
