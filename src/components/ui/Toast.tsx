'use client';

import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import { X, AlertTriangle, CheckCircle2, Info, AlertCircle } from 'lucide-react';
import { clsx } from 'clsx';

// ─── Types ─────────────────────────────────────────────────────

export type ToastType = 'error' | 'success' | 'info' | 'warning';

interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

interface ConfirmOptions {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface ToastContextType {
  showToast: (message: string, type?: ToastType, durationMs?: number) => void;
  confirm: (options: ConfirmOptions) => Promise<boolean>;
}

const ToastContext = createContext<ToastContextType | null>(null);

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}

// ─── Toast Item Component ──────────────────────────────────────

const ICON_MAP = {
  error: AlertCircle,
  success: CheckCircle2,
  info: Info,
  warning: AlertTriangle,
};

const COLOR_MAP = {
  error: 'bg-white border-red-200 text-red-900 shadow-crisp-sm',
  success: 'bg-white border-emerald-200 text-emerald-900 shadow-crisp-sm',
  info: 'bg-white border-cyan-200 text-cyan-950 shadow-crisp-sm',
  warning: 'bg-white border-amber-200 text-amber-950 shadow-crisp-sm',
};

function ToastItemComponent({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  const Icon = ICON_MAP[toast.type];
  const iconColor = toast.type === 'error' ? 'text-red-600' : toast.type === 'success' ? 'text-emerald-600' : toast.type === 'warning' ? 'text-amber-600' : 'text-cyan-600';

  return (
    <div
      className={clsx(
        'flex items-center gap-3 px-4 py-3 rounded-xl border backdrop-blur-xs',
        'animate-in slide-in-from-right-5 fade-in duration-300',
        COLOR_MAP[toast.type]
      )}
    >
      <Icon className={clsx("w-4 h-4 shrink-0", iconColor)} />
      <span className="text-sm font-medium flex-1 text-slate-800">{toast.message}</span>
      <button
        onClick={() => onDismiss(toast.id)}
        className="p-0.5 rounded text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

// ─── Confirm Dialog Component ──────────────────────────────────

function ConfirmDialog({
  options,
  onConfirm,
  onCancel,
}: {
  options: ConfirmOptions;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-in zoom-in-95 duration-200">
        <div className="flex items-center gap-3 mb-3">
          <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <h3 className="font-semibold text-slate-900 text-base">{options.title}</h3>
        </div>
        <p className="text-sm text-slate-600 mb-6 leading-relaxed">{options.message}</p>
        <div className="flex justify-end gap-3">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white hover:bg-slate-50 rounded-lg border border-slate-200 shadow-crisp-xs transition-colors"
          >
            {options.cancelLabel || 'Cancel'}
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-600 hover:bg-rose-700 rounded-lg shadow-crisp-xs transition-colors"
          >
            {options.confirmLabel || 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Toast Provider ────────────────────────────────────────────

let nextToastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [confirmState, setConfirmState] = useState<{
    options: ConfirmOptions;
    resolve: (value: boolean) => void;
  } | null>(null);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const showToast = useCallback((message: string, type: ToastType = 'info', durationMs = 4000) => {
    const id = nextToastId++;
    setToasts(prev => [...prev, { id, message, type }]);

    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, durationMs);
  }, []);

  const confirmFn = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise<boolean>((resolve) => {
      setConfirmState({ options, resolve });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    confirmState?.resolve(true);
    setConfirmState(null);
  }, [confirmState]);

  const handleCancel = useCallback(() => {
    confirmState?.resolve(false);
    setConfirmState(null);
  }, [confirmState]);

  return (
    <ToastContext.Provider value={{ showToast, confirm: confirmFn }}>
      {children}

      {/* Toast Container */}
      <div className="fixed top-4 right-4 z-[150] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map(toast => (
          <div key={toast.id} className="pointer-events-auto">
            <ToastItemComponent toast={toast} onDismiss={dismissToast} />
          </div>
        ))}
      </div>

      {/* Confirm Dialog */}
      {confirmState && (
        <ConfirmDialog
          options={confirmState.options}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ToastContext.Provider>
  );
}