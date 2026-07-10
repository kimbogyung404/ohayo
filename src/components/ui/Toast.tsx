'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

const typeStyles: Record<ToastType, { bg: string; icon: string }> = {
  success: { bg: 'bg-[var(--color-success)]', icon: '✓' },
  error: { bg: 'bg-[var(--color-error)]', icon: '✕' },
  warning: { bg: 'bg-[var(--color-warning)]', icon: '!' },
  info: { bg: 'bg-[var(--brand-primary)]', icon: 'i' },
};

function ToastItem({ toast, onRemove }: { toast: ToastItem; onRemove: (id: string) => void }) {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), 3000);
    return () => clearTimeout(timer);
  }, [toast.id, onRemove]);

  const style = typeStyles[toast.type];

  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-center gap-2 px-4 py-3 rounded-[var(--radius-md)] text-white text-b2-medium ${style.bg}`}
      style={{ boxShadow: 'var(--shadow-overlay)' }}
    >
      <span
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-xs font-bold"
        aria-hidden="true"
      >
        {style.icon}
      </span>
      <span>{toast.message}</span>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'info') => {
    const id = String(++idRef.current);
    setToasts((prev) => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast 렌더링 영역 */}
      <div
        className="fixed bottom-[calc(var(--nav-height)+16px)] left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[calc(var(--max-width-app)-36px)] pointer-events-none"
        aria-live="polite"
        aria-atomic="false"
      >
        {toasts.map((toast) => (
          <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}
