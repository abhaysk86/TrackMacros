import { ChevronLeft, ChevronRight } from 'lucide-react';
import { addDays, parseDay, weekOf, weekdayShort } from '../lib/date';
import { useDaysWithMeals } from '../hooks';

interface WeekStripProps {
  day: string;
  today: string;
  onSelect: (day: string) => void;
}

/** A week of dates for moving between days. Future days cannot be selected. */
export function WeekStrip({ day, today, onSelect }: WeekStripProps) {
  const week = weekOf(day);
  const logged = useDaysWithMeals(week[0], week[6]);
  const canGoForward = week[6] < today;

  return (
    <nav className="mb-3 flex items-center gap-1" aria-label="Choose a day">
      <button
        aria-label="Previous week"
        onClick={() => onSelect(addDays(day, -7))}
        className="grid h-10 w-6 shrink-0 place-items-center text-muted"
      >
        <ChevronLeft size={18} />
      </button>
      <div className="grid flex-1 grid-cols-7 gap-1">
        {week.map((d) => {
          const selected = d === day;
          const future = d > today;
          return (
            <button
              key={d}
              disabled={future}
              onClick={() => onSelect(d)}
              aria-current={selected ? 'date' : undefined}
              aria-label={parseDay(d).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' })}
              className={`rounded-[14px] py-1.5 text-center text-[10.5px] disabled:opacity-35 ${
                selected ? 'bg-accent text-white' : d === today ? 'text-muted ring-[1.5px] ring-inset ring-accent' : 'text-muted'
              }`}
            >
              {weekdayShort(d)}
              <b className={`mt-0.5 block text-[15px] ${selected ? 'text-white' : 'text-ink'}`}>{parseDay(d).getDate()}</b>
              <i
                className="mx-auto mt-1 block h-[5px] w-[5px] rounded-full"
                style={{ background: selected ? '#fff' : logged.has(d) ? 'var(--protein)' : 'transparent' }}
              />
            </button>
          );
        })}
      </div>
      <button
        aria-label="Next week"
        disabled={!canGoForward}
        onClick={() => onSelect(addDays(day, 7) > today ? today : addDays(day, 7))}
        className="grid h-10 w-6 shrink-0 place-items-center text-muted disabled:opacity-30"
      >
        <ChevronRight size={18} />
      </button>
    </nav>
  );
}
