import { useEffect, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** A bottom sheet that slides over the current screen. */
export function Sheet({ title, onClose, children }: SheetProps) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = previous;
    };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={title}>
      <div className="absolute inset-0 bg-black/45" onClick={onClose} />
      <div className="sheet-in relative max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-[26px] bg-bg px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
        <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-line" />
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="-mr-2 grid h-10 w-10 place-items-center rounded-full text-muted">
            <X size={20} />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
