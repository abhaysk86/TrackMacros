import { PencilLine, Plus } from 'lucide-react';
import { Sheet } from './Sheet';
import { fmt } from '../lib/macros';
import { shortDate } from '../lib/date';
import type { SavedMeal } from '../types';

interface LogSheetProps {
  day: string;
  today: string;
  savedMeals: SavedMeal[];
  onManual: () => void;
  onQuickAdd: (saved: SavedMeal) => void;
  onClose: () => void;
}

/** The single entry point for logging: opened by the Log meal button. */
export function LogSheet({ day, today, savedMeals, onManual, onQuickAdd, onClose }: LogSheetProps) {
  return (
    <Sheet title={day === today ? 'Log a meal' : `Log a meal for ${shortDate(day)}`} onClose={onClose}>
      <button onClick={onManual} className="flex w-full items-center gap-3 rounded-[18px] bg-accent px-4 py-4 text-left text-white">
        <PencilLine size={22} />
        <span>
          <span className="block text-[15px] font-bold">Enter it yourself</span>
          <span className="block text-xs opacity-90">Type the name and numbers</span>
        </span>
      </button>

      <h3 className="mb-1 mt-5 text-sm font-bold">Frequent meals</h3>
      {savedMeals.length === 0 ? (
        <p className="py-3 text-[13px] leading-relaxed text-muted">
          Meals you save appear here, ready to log in one tap. Switch on "Save as a frequent meal" when you add one.
        </p>
      ) : (
        <ul>
          {savedMeals.map((s) => (
            <li key={s.id} className="border-b border-line last:border-0">
              <button onClick={() => onQuickAdd(s)} className="flex w-full items-center py-2.5 text-left text-[14px] font-semibold">
                <span className="truncate">{s.name}</span>
                <span className="ml-2 shrink-0 text-xs font-normal text-muted">{fmt(s.calories)} kcal</span>
                <span className="ml-auto grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
                  <Plus size={17} strokeWidth={2.4} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Sheet>
  );
}
