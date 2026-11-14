import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';

interface ToastState {
  id: number;
  message: string;
  actionLabel?: string;
  onAction?: () => void;
}

type ShowToast = (message: string, action?: { label: string; onAction: () => void }) => void;

const ToastContext = createContext<ShowToast>(() => {});

export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timer = useRef<number | undefined>(undefined);

  const show = useCallback<ShowToast>((message, action) => {
    window.clearTimeout(timer.current);
    setToast({ id: Date.now(), message, actionLabel: action?.label, onAction: action?.onAction });
    timer.current = window.setTimeout(() => setToast(null), 5000);
  }, []);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-24 z-[35] mx-auto flex max-w-md justify-center px-4">
        {toast && (
          <div
            key={toast.id}
            className="sheet-in pointer-events-auto flex w-full items-center justify-between gap-3 rounded-2xl bg-toast px-4 py-3 text-sm text-toast-ink shadow-lg"
          >
            <span>{toast.message}</span>
            {toast.actionLabel && (
              <button
                className="shrink-0 px-1 font-bold text-accent"
                onClick={() => {
                  toast.onAction?.();
                  window.clearTimeout(timer.current);
                  setToast(null);
                }}
              >
                {toast.actionLabel}
              </button>
            )}
          </div>
        )}
      </div>
    </ToastContext.Provider>
  );
}
