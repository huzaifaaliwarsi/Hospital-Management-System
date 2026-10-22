import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '../../utils/formatters';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | '5xl';
  showCloseButton?: boolean;
  closeOnBackdropClick?: boolean;
  zIndexClass?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  children,
  footer,
  maxWidth = 'lg',
  showCloseButton = true,
  closeOnBackdropClick = false,
  zIndexClass = 'z-50',
}) => {
  const mouseDownTargetRef = React.useRef<EventTarget | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const maxWidthClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md',
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '3xl': 'max-w-3xl',
    '4xl': 'max-w-4xl',
    '5xl': 'max-w-5xl',
  }[maxWidth];

  const modalContent = (
    <div
      role="dialog"
      aria-modal="true"
      className={cn(
        'fixed inset-0 overflow-y-auto bg-slate-900/65 flex items-center justify-center p-4 text-left',
        zIndexClass
      )}
      onMouseDown={(e) => {
        mouseDownTargetRef.current = e.target;
      }}
      onClick={(e) => {
        if (
          closeOnBackdropClick &&
          e.target === e.currentTarget &&
          mouseDownTargetRef.current === e.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <div
        className={cn(
          'relative w-full bg-white rounded-xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150 text-left',
          maxWidthClasses
        )}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between px-6 sm:px-8 pt-6 pb-5 border-b border-slate-200/90 bg-slate-50/70 text-left">
          <div className="flex-1 min-w-0 pr-4">
            <div className="text-base font-bold text-slate-900 leading-snug">{title}</div>
            {subtitle && <div className="text-xs text-slate-500 mt-1.5">{subtitle}</div>}
          </div>
          {showCloseButton && (
            <button
              onClick={onClose}
              className="rounded-xl p-2 -mr-1.5 -mt-0.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/70 transition-colors shrink-0 cursor-pointer"
              aria-label="Close dialog"
            >
              <X className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Modal Body with prominent, visible custom scrollbar */}
        <div className="px-6 py-4 overflow-y-auto flex-1 text-sm text-slate-700 [scrollbar-width:thin] [scrollbar-color:#94a3b8_#f1f5f9] [&::-webkit-scrollbar]:w-2.5 [&::-webkit-scrollbar-track]:bg-slate-100/90 [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-500 [&::-webkit-scrollbar-thumb]:rounded-full">
          {children}
        </div>

        {/* Modal Footer */}
        {footer && (
          <div className="px-6 py-3 border-t border-slate-200 bg-slate-50 flex items-center justify-end gap-2.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return typeof document !== 'undefined' ? createPortal(modalContent, document.body) : modalContent;
};
