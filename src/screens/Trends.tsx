import { BarChart3 } from 'lucide-react';

export function Trends() {
  return (
    <>
      <h1 className="mb-4 text-[22px] font-bold tracking-tight">Trends</h1>
      <div className="rounded-2xl border-[1.5px] border-dashed border-line px-4 py-10 text-center text-[13px] leading-relaxed text-muted">
        <BarChart3 className="mx-auto mb-3 text-accent" size={28} />
        Your 7-day and 30-day charts will appear here.
      </div>
    </>
  );
}
