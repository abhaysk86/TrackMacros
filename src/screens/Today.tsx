import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { Logo } from '../components/Logo';
import { Summary } from '../components/Summary';
import { useGoals, useMealsForDay } from '../hooks';
import { addDays, formatTime, longDate, relativeLabel, shortDate } from '../lib/date';
import { fmt, sumMacros } from '../lib/macros';
import type { Meal, SavedMeal } from '../types';

interface TodayProps {
  day: string;
  today: string;
  savedMeals: SavedMeal[];
  onSelectDay: (day: string) => void;
  onQuickAdd: (saved: SavedMeal) => void;
  onEditMeal: (meal: Meal) => void;
  onLog: () => void;
  onAllMeals: () => void;
}

const DOTS = [
  { key: 'protein', color: 'var(--protein)' },
  { key: 'carbs', color: 'var(--carbs)' },
  { key: 'fats', color: 'var(--fats)' },
] as const;

export function Today({ day, today, savedMeals, onSelectDay, onQuickAdd, onEditMeal, onLog, onAllMeals }: TodayProps) {
  const meals = useMealsForDay(day);
  const goals = useGoals();
  const totals = sumMacros(meals);
  const isToday = day === today;

  return (
    <>
      <header className="mb-3 flex items-center gap-2 text-[17px] font-extrabold tracking-tight">
        <Logo />
        TrackMacros
      </header>

      <div className="mb-3 flex items-center justify-between gap-2">
        <label className="relative flex min-w-0 items-center gap-2.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-ink">
            <CalendarDays size={19} />
          </span>
          <span className="min-w-0">
            <h1 className="flex items-center gap-1 text-[19px] font-bold leading-tight tracking-tight">
              {relativeLabel(day, today)}
              <ChevronDown size={16} className="text-muted" />
            </h1>
            <span className="block truncate text-[12.5px] text-muted">{longDate(day)}</span>
          </span>
          {/* The native date picker sits invisibly over the label so one tap opens the calendar. */}
          <input
            type="date" value={day} max={today} aria-label="Choose a date"
            onChange={(e) => e.target.value && e.target.value <= today && onSelectDay(e.target.value)}
            onClick={(e) => {
              try {
                e.currentTarget.showPicker?.();
              } catch {
                /* the picker opens on its own where showPicker is unavailable */
              }
            }}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>

        <div className="flex shrink-0 items-center gap-1">
          {!isToday && (
            <button onClick={() => onSelectDay(today)} aria-label="Back to today" className="mr-1 rounded-full bg-accent-soft px-3 py-2 text-xs font-bold text-accent-ink">
              Today
            </button>
          )}
          <button
            aria-label="Previous day" onClick={() => onSelectDay(addDays(day, -1))}
            className="grid h-10 w-10 place-items-center rounded-full bg-surface text-ink shadow-sm"
          >
            <ChevronLeft size={19} />
          </button>
          <button
            aria-label="Next day" disabled={isToday} onClick={() => onSelectDay(addDays(day, 1))}
            className="grid h-10 w-10 place-items-center rounded-full bg-surface text-ink shadow-sm disabled:opacity-35"
          >
            <ChevronRight size={19} />
          </button>
        </div>
      </div>

      <Summary totals={totals} goals={goals} />

      {savedMeals.length > 0 && (
        <section aria-label="Quick add">
          <div className="mx-0.5 mb-1.5 mt-3.5 flex items-baseline justify-between">
            <h2 className="text-[13.5px] font-bold">Quick add</h2>
            <button onClick={onAllMeals} className="text-[11.5px] font-semibold text-accent-ink">All meals</button>
          </div>
          <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
            {savedMeals.map((s) => (
              <button
                key={s.id} onClick={() => onQuickAdd(s)}
                className="shrink-0 whitespace-nowrap rounded-full border border-line bg-surface px-3 py-2 text-xs font-semibold"
              >
                <span className="mr-1 font-extrabold text-accent-ink">+</span>
                {s.name} <span className="font-medium text-muted">· {fmt(s.calories)} kcal</span>
              </button>
            ))}
          </div>
        </section>
      )}

      <section aria-label="Logged meals">
        <div className="mx-0.5 mb-1.5 mt-3.5 flex items-baseline justify-between">
          <h2 className="text-[13.5px] font-bold">{isToday ? 'Logged today' : `Logged on ${shortDate(day)}`}</h2>
          {meals.length > 0 && (
            <span className="text-[11.5px] font-semibold text-muted">
              {meals.length} {meals.length === 1 ? 'meal' : 'meals'}
            </span>
          )}
        </div>

        {meals.length === 0 && isToday && (
          <p className="rounded-2xl border-[1.5px] border-dashed border-line px-4 py-6 text-center text-[13px] leading-relaxed text-muted">
            Nothing logged yet today.
            <br />
            Tap <b className="text-accent-ink">Log meal</b> to add your first.
          </p>
        )}

        <ul className="flex flex-col gap-2">
          {meals.map((m) => (
            <li key={m.id}>
              <button onClick={() => onEditMeal(m)} className="flex w-full items-center gap-3 rounded-2xl bg-surface px-3.5 py-3 text-left shadow-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-semibold">{m.name}</span>
                  <span className="mt-0.5 block text-[11px] text-muted">
                    {formatTime(m.time)}
                    {DOTS.map((d) => (
                      <span key={d.key}>
                        <i className="mb-px ml-1.5 mr-1 inline-block h-1.5 w-1.5 rounded-full" style={{ background: d.color }} />
                        {fmt(m[d.key])}g
                      </span>
                    ))}
                  </span>
                </span>
                <span className="shrink-0 text-right text-[13.5px] font-bold">
                  {fmt(m.calories)}
                  <span className="block text-[10px] font-normal text-muted">kcal</span>
                </span>
              </button>
            </li>
          ))}
        </ul>

        {!isToday && (
          <button
            onClick={onLog}
            className="mt-2 flex w-full items-center justify-center gap-1.5 rounded-2xl border-[1.5px] border-dashed border-line py-3.5 text-[13px] font-bold text-accent-ink"
          >
            <Plus size={15} strokeWidth={2.6} /> Add a missed meal to {shortDate(day)}
          </button>
        )}
      </section>
    </>
  );
}
