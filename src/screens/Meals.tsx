import { Plus } from 'lucide-react';
import { fmt } from '../lib/macros';
import type { SavedMeal } from '../types';

export function Meals({ savedMeals, onNew, onEdit }: { savedMeals: SavedMeal[]; onNew: () => void; onEdit: (s: SavedMeal) => void }) {
  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[22px] font-bold tracking-tight">Frequent meals</h1>
        <button onClick={onNew} className="flex items-center gap-1 rounded-full bg-accent px-3.5 py-2 text-[13px] font-bold text-white">
          <Plus size={15} strokeWidth={2.6} /> New
        </button>
      </div>

      {savedMeals.length === 0 ? (
        <p className="rounded-2xl border-[1.5px] border-dashed border-line px-4 py-8 text-center text-[13px] leading-relaxed text-muted">
          Save the meals you eat often, like your morning coffee, and log them in one tap from the home screen.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {savedMeals.map((s) => (
            <li key={s.id}>
              <button onClick={() => onEdit(s)} className="flex w-full items-center gap-3 rounded-2xl bg-surface px-3.5 py-3 text-left shadow-sm">
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[14px] font-semibold">{s.name}</span>
                  <span className="mt-0.5 block text-[11.5px] text-muted">
                    P {fmt(s.protein)}g · C {fmt(s.carbs)}g · F {fmt(s.fats)}g · S {fmt(s.sugar)}g
                    {s.uses > 0 && ` · logged ${s.uses}×`}
                  </span>
                </span>
                <span className="shrink-0 text-right text-[14px] font-bold">
                  {fmt(s.calories)}
                  <span className="block text-[10px] font-normal text-muted">kcal</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
