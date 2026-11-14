import { useEffect, useState, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

/** The visible area of the page, which shrinks when the on-screen keyboard opens. */
function useVisibleArea() {
  const read = () => {
    const v = window.visualViewport;
    return v ? { top: v.offsetTop, height: v.height } : null;
  };
  const [area, setArea] = useState(read);
  useEffect(() => {
    const v = window.visualViewport;
    if (!v) return;
    const update = () => setArea(read());
    v.addEventListener('resize', update);
    v.addEventListener('scroll', update);
    return () => {
      v.removeEventListener('resize', update);
      v.removeEventListener('scroll', update);
    };
  }, []);
  return area;
}

/** A bottom sheet that slides over the current screen and stays above the keyboard. */
export function Sheet({ title, onClose, children }: SheetProps) {
  const area = useVisibleArea();
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
    <div
      className="fixed inset-x-0 z-40 flex items-end justify-center"
      style={area ? { top: area.top, height: area.height } : { top: 0, height: '100dvh' }}
      role="dialog" aria-modal="true" aria-label={title}
    >
      <div className="absolute inset-x-0 -top-[100vh] -bottom-[100vh] bg-black/45" onClick={onClose} />
      <div className="sheet-in relative max-h-[94%] w-full max-w-md overflow-y-auto overscroll-contain rounded-t-[26px] bg-bg px-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-3">
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
