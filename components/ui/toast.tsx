'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { XCircle } from 'lucide-react';
import { ToastContext, type Toast } from '@/components/ui/use-toast';

const TOAST_LIMIT = 1;

const useToaster = () => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const dismiss = (id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  const toast = ({ title, description, variant = 'default', duration = 5000 }: Omit<Toast, 'id'>) => {
    const id = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const nextToast: Toast = { id, title, description, variant, duration };

    setToasts((current) => [...current, nextToast].slice(-TOAST_LIMIT));

    if (duration > 0) {
      window.setTimeout(() => dismiss(id), duration);
    }

    return id;
  };

  return { toasts, dismiss, toast };
};

export default function Toaster({ children }: { children: ReactNode }) {
  const { toasts, dismiss, toast } = useToaster();

  const contextValue = useMemo(
    () => ({
      toast,
      dismiss,
    }),
    [toast, dismiss]
  );

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
        {toasts.map((toastItem) => (
          <div
            key={toastItem.id}
            className={`p-4 rounded-lg max-w-xs text-left ${
              toastItem.variant === 'destructive'
                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                : 'bg-teal-500/10 text-teal-400 border border-teal-500/20'
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-sm">{toastItem.title}</p>
                <p className="text-xs opacity-80">{toastItem.description}</p>
              </div>
              <button
                onClick={() => dismiss(toastItem.id)}
                className="opacity-70 hover:opacity-100 transition-opacity text-xs"
                aria-label="Dismiss toast"
              >
                <XCircle size={14} className="text-current/80" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export { useToaster };