import { MACRO_META, type Goals, type Macros } from '../types';
import { fmt, progress } from '../lib/macros';

const R = 52;
const CIRC = 2 * Math.PI * R;

/** The calorie ring, four macro bars and the "eaten" line. */
export function Summary({ totals, goals }: { totals: Macros; goals: Goals }) {
  const remaining = goals.calories - totals.calories;
  const over = remaining < 0;
  const filled = progress(totals.calories, goals.calories) * CIRC;

  return (
    <section className="rounded-[20px] bg-surface px-4 py-3.5 shadow-sm" aria-label="Daily summary">
      <div className="flex items-center gap-4">
        <div className="relative h-[104px] w-[104px] shrink-0">
          <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden="true">
            <circle cx="60" cy="60" r={R} fill="none" stroke="var(--line)" strokeWidth="10" />
            {totals.calories > 0 && (
              <circle
                cx="60" cy="60" r={R} fill="none" strokeWidth="10" strokeLinecap="round"
                stroke={over ? 'var(--danger)' : 'var(--accent)'}
                strokeDasharray={`${filled} ${CIRC}`}
                transform="rotate(-90 60 60)"
              />
            )}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-[23px] font-extrabold leading-tight tracking-tight">{fmt(Math.abs(remaining))}</span>
            <span className="text-[10.5px] text-muted">{over ? 'kcal over' : 'kcal left'}</span>
          </div>
        </div>

        <div className="flex flex-1 flex-col gap-2">
          {MACRO_META.map(({ key, label, color }) => (
            <div key={key}>
              <div className="mb-0.5 flex justify-between text-[11px]">
                <span>{label}</span>
                <span className="text-muted">
                  {fmt(totals[key])} / {fmt(goals[key])} g
                </span>
              </div>
              <div
                className="h-1.5 overflow-hidden rounded-full bg-line"
                role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={goals[key]} aria-valuenow={Math.round(totals[key])}
              >
                <div className="h-full rounded-full" style={{ width: `${progress(totals[key], goals[key]) * 100}%`, background: color }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      <p className="mt-3 flex items-center gap-2 border-t border-line pt-2.5 text-xs text-muted">
        <span className="inline-block h-[5px] w-3.5 rounded-full" style={{ background: over ? 'var(--danger)' : 'var(--accent)' }} />
        <span>
          <b className="text-ink">{fmt(totals.calories)}</b> of {fmt(goals.calories)} kcal eaten
        </span>
      </p>
    </section>
  );
}
