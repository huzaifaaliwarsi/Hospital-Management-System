import React from 'react';
import { Modal } from './Modal';
import { AlertTriangle, Info, CheckCircle2, ShieldAlert } from 'lucide-react';
import { cn } from '../../utils/formatters';

export interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: 'danger' | 'warning' | 'primary' | 'success';
  isLoading?: boolean;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  variant = 'primary',
  isLoading = false,
}) => {
  const iconConfig = {
    danger: {
      icon: <ShieldAlert className="h-6 w-6 text-rose-600" />,
      bg: 'bg-rose-50 border-rose-200',
      btn: 'bg-rose-600 hover:bg-rose-700 text-white focus:ring-rose-500',
    },
    warning: {
      icon: <AlertTriangle className="h-6 w-6 text-amber-600" />,
      bg: 'bg-amber-50 border-amber-200',
      btn: 'bg-amber-600 hover:bg-amber-700 text-white focus:ring-amber-500',
    },
    primary: {
      icon: <Info className="h-6 w-6 text-[#149E75]" />,
      bg: 'bg-[#effaf5] border-[#c2e7db]',
      btn: 'bg-[#149E75] hover:bg-[#08775A] text-white focus:ring-[#149E75]',
    },
    success: {
      icon: <CheckCircle2 className="h-6 w-6 text-emerald-600" />,
      bg: 'bg-emerald-50 border-emerald-200',
      btn: 'bg-emerald-600 hover:bg-emerald-700 text-white focus:ring-emerald-500',
    },
  }[variant];

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title}
      maxWidth="md"
      footer={
        <>
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 text-xs font-semibold rounded-lg text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={() => {
              onConfirm();
            }}
            disabled={isLoading}
            className={cn(
              'px-4 py-2 text-xs font-semibold rounded-lg transition-colors inline-flex items-center gap-1.5 shadow-xs',
              iconConfig.btn
            )}
          >
            {isLoading ? 'Processing...' : confirmLabel}
          </button>
        </>
      }
    >
      <div className="flex items-start gap-4 py-2">
        <div
          className={cn(
            'p-2.5 rounded-xl border shrink-0',
            iconConfig.bg
          )}
        >
          {iconConfig.icon}
        </div>
        <div className="flex-1">
          <p className="text-sm text-slate-600 leading-relaxed">{message}</p>
        </div>
      </div>
    </Modal>
  );
};
