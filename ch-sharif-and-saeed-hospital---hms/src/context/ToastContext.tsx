import React, { createContext, useContext, useState, useCallback } from 'react';
import { ToastMessage } from '../types';
import { CheckCircle2, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { cn } from '../utils/formatters';

interface ToastContextType {
  toasts: ToastMessage[];
  showToast: (toast: Omit<ToastMessage, 'id'>) => void;
  removeToast: (id: string) => void;
  success: (message: string, title?: string) => void;
  error: (message: string, title?: string) => void;
  warning: (message: string, title?: string) => void;
  info: (message: string, title?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ title, message, type, duration = 4500 }: Omit<ToastMessage, 'id'>) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      const newToast: ToastMessage = { id, title, message, type, duration };

      setToasts((prev) => [newToast, ...prev].slice(0, 5));

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }
    },
    [removeToast]
  );

  const success = useCallback((message: string, title = 'Success') => {
    showToast({ type: 'success', title, message });
  }, [showToast]);

  const error = useCallback((message: string, title = 'Error') => {
    showToast({ type: 'error', title, message });
  }, [showToast]);

  const warning = useCallback((message: string, title = 'Attention') => {
    showToast({ type: 'warning', title, message });
  }, [showToast]);

  const info = useCallback((message: string, title = 'Information') => {
    showToast({ type: 'info', title, message });
  }, [showToast]);

  return (
    <ToastContext.Provider
      value={{ toasts, showToast, removeToast, success, error, warning, info }}
    >
      {children}
      {/* Toast floating container */}
      <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-md w-full pointer-events-none px-4 sm:px-0">
        {toasts.map((toast) => {
          const typeConfigs = {
            success: {
              border: 'border-emerald-300',
              bg: 'bg-emerald-50',
              icon: <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />,
              titleColor: 'text-emerald-900',
              textColor: 'text-emerald-800',
            },
            error: {
              border: 'border-rose-300',
              bg: 'bg-rose-50',
              icon: <AlertCircle className="h-5 w-5 text-rose-600 shrink-0 mt-0.5" />,
              titleColor: 'text-rose-900',
              textColor: 'text-rose-800',
            },
            warning: {
              border: 'border-amber-300',
              bg: 'bg-amber-50',
              icon: <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />,
              titleColor: 'text-amber-900',
              textColor: 'text-amber-800',
            },
            info: {
              border: 'border-blue-300',
              bg: 'bg-blue-50',
              icon: <Info className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />,
              titleColor: 'text-blue-900',
              textColor: 'text-blue-800',
            },
          };

          const config = typeConfigs[toast.type];

          return (
            <div
              key={toast.id}
              className={cn(
                'pointer-events-auto flex items-start gap-3 p-3.5 rounded-lg border shadow-lg bg-white transition-all duration-200 animate-in slide-in-from-right-4',
                config.border
              )}
            >
              {config.icon}
              <div className="flex-1 min-w-0 pr-1">
                {toast.title && (
                  <p className={cn('text-sm font-semibold leading-none mb-1', config.titleColor)}>
                    {toast.title}
                  </p>
                )}
                <p className={cn('text-xs leading-relaxed', config.textColor)}>
                  {toast.message}
                </p>
              </div>
              <button
                onClick={() => removeToast(toast.id)}
                className="text-slate-400 hover:text-slate-700 p-1 rounded-md transition-colors shrink-0"
                aria-label="Dismiss toast"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};
