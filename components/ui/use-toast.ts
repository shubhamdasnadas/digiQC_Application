import { createContext, useContext } from 'react';

export interface Toast {
  id: string;
  title: string;
  description: string;
  variant?: 'default' | 'destructive';
  duration?: number;
}

export const ToastContext = createContext<{
  toast: (props: Omit<Toast, 'id'>) => string;
  dismiss: (id: string) => void;
} | null>(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a Toaster provider');
  }
  return context;
};