'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Icon from './Icon';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastAction {
  label: string;
  onClick: () => void;
}

interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  action?: ToastAction;
}

interface ToastContextValue {
  // action은 선택 인자이므로 기존 showToast(message)/showToast(message, type) 호출부는 그대로 동작한다.
  showToast: (message: string, type?: ToastType, action?: ToastAction) => void;
}

const ToastContext = createContext<ToastContextValue>({
  showToast: () => {},
});

export function useToast() {
  return useContext(ToastContext);
}

// 배경은 모든 타입이 동일한 Gray 700(--gray-700, Tooltip과 같은 토큰)을 쓰고,
// 타입 구분은 아이콘 배지로 표시한다. info만 문자 "i" 대신 디자인 시스템의
// 정보 아이콘(Icon name="info", Figma node 93:589)을 그대로 재사용한다.
const typeStyles: Record<ToastType, { bg: string; icon: string | null }> = {
  success: { bg: 'bg-[var(--gray-700)]', icon: '✓' },
  error: { bg: 'bg-[var(--gray-700)]', icon: '✕' },
  warning: { bg: 'bg-[var(--gray-700)]', icon: '!' },
  info: { bg: 'bg-[var(--gray-700)]', icon: null },
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
      className={`flex items-center gap-2 px-4 py-3 rounded-[var(--radius-md)] text-[var(--text-inverse)] text-b2-medium ${style.bg}`}
      style={{ boxShadow: 'var(--shadow-overlay)' }}
    >
      <span
        className="flex-shrink-0 w-5 h-5 flex items-center justify-center rounded-full bg-white/20 text-xs font-bold"
        aria-hidden="true"
      >
        {toast.type === 'info' ? <Icon name="info" size={14} /> : style.icon}
      </span>
      <span className="flex-1">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action!.onClick();
            onRemove(toast.id);
          }}
          className="flex-shrink-0 pointer-events-auto underline underline-offset-2 font-semibold hover:opacity-80 transition-opacity"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'info', action?: ToastAction) => {
    const id = String(++idRef.current);
    setToasts((prev) => [...prev, { id, message, type, action }]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {/* Toast 렌더링 영역 */}
      <div
        className="fixed bottom-[calc(var(--nav-height)+16px)] left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-[calc(100vw-36px)] max-w-[calc(var(--max-width-app)-36px)] pointer-events-none"
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
