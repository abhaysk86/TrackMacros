import { useRef, useState } from 'react';
import { Sheet } from './Sheet';
import { useToast } from './Toast';
import {
  addMeal, addSavedMeal, deleteMeal, deleteSavedMeal, restoreMeal, restoreSavedMeal, updateMeal, updateSavedMeal,
} from '../db';
import { nowTime, shortDate } from '../lib/date';
import { MACRO_META, type MacroKey, type Macros, type Meal, type SavedMeal } from '../types';

export type MealFormTarget =
  | { kind: 'meal'; day: string; meal?: Meal }
  | { kind: 'saved'; saved?: SavedMeal };

const PORTIONS = [
  { value: 0.5, label: '½×' },
  { value: 1, label: '1×' },
  { value: 1.5, label: '1½×' },
  { value: 2, label: '2×' },
];

const KEYS: MacroKey[] = ['calories', 'protein', 'carbs', 'fats', 'sugar'];
const fieldClass =
  'block h-[46px] w-full min-w-0 appearance-none rounded-[14px] border border-line bg-surface px-3.5 text-left text-base font-semibold outline-none focus:border-accent';

/** Add or edit a logged meal, or a frequent meal. */
export function MealForm({ target, today, onClose }: { target: MealFormTarget; today: string; onClose: () => void }) {
  const toast = useToast();
  const existing = target.kind === 'meal' ? target.meal : target.saved;
  const isMeal = target.kind === 'meal';

  const [name, setName] = useState(existing?.name ?? '');
  const [day, setDay] = useState(target.kind === 'meal' ? (target.meal?.day ?? target.day) : today);
  const [time, setTime] = useState(target.kind === 'meal' ? (target.meal?.time ?? nowTime()) : '');
  const [portion, setPortion] = useState(1);
  const [saveAsFrequent, setSaveAsFrequent] = useState(false);

  // `base` holds the values at 1x so switching portions never accumulates rounding drift.
  const base = useRef<Record<MacroKey, number>>({
    calories: existing?.calories ?? 0, protein: existing?.protein ?? 0, carbs: existing?.carbs ?? 0,
    fats: existing?.fats ?? 0, sugar: existing?.sugar ?? 0,
  });
  const [text, setText] = useState<Record<MacroKey, string>>(() =>
    Object.fromEntries(KEYS.map((k) => [k, existing ? String(Math.round(existing[k])) : ''])) as Record<MacroKey, string>,
  );

  const onNumber = (key: MacroKey, raw: string) => {
    const cleaned = raw.replace(/[^\d.]/g, '');
    base.current[key] = (Number(cleaned) || 0) / portion;
    setText((t) => ({ ...t, [key]: cleaned }));
  };

  const onPortion = (next: number) => {
    setPortion(next);
    setText(Object.fromEntries(KEYS.map((k) => [k, String(Math.round(base.current[k] * next))])) as Record<MacroKey, string>);
  };

  const macros = (): Macros =>
    Object.fromEntries(KEYS.map((k) => [k, Math.round(Number(text[k]) || 0)])) as unknown as Macros;

  const canSave = name.trim().length > 0;

  const save = async () => {
    if (!canSave) return;
    const cleanName = name.trim();
    const values = macros();
    if (target.kind === 'meal') {
      if (target.meal) {
        await updateMeal(target.meal.id, { ...values, name: cleanName, day, time });
        toast('Meal updated');
      } else {
        await addMeal({ ...values, name: cleanName, day, time, source: 'manual' });
        if (saveAsFrequent) await addSavedMeal(cleanName, values);
        toast(day === today ? `${cleanName} added` : `${cleanName} added to ${shortDate(day)}`);
      }
    } else if (target.saved) {
      await updateSavedMeal(target.saved.id, { ...values, name: cleanName });
      toast('Frequent meal updated');
    } else {
      await addSavedMeal(cleanName, values);
      toast(`${cleanName} saved`);
    }
    onClose();
  };

  const remove = async () => {
    if (target.kind === 'meal' && target.meal) {
      const meal = target.meal;
      await deleteMeal(meal.id);
      toast(`${meal.name} deleted`, { label: 'Undo', onAction: () => void restoreMeal(meal) });
    } else if (target.kind === 'saved' && target.saved) {
      const saved = target.saved;
      await deleteSavedMeal(saved.id);
      toast(`${saved.name} removed`, { label: 'Undo', onAction: () => void restoreSavedMeal(saved) });
    }
    onClose();
  };

  const title = isMeal ? (existing ? 'Edit meal' : 'Add a meal') : existing ? 'Edit frequent meal' : 'New frequent meal';

  return (
    <Sheet title={title} onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="flex flex-col gap-3"
      >
        <label className="block">
          <span className="mb-1 block text-xs text-muted">Meal</span>
          <input
            className={fieldClass} value={name} onChange={(e) => setName(e.target.value)}
            placeholder={isMeal ? 'e.g. Dal chawal' : 'e.g. Standard Coffee'} maxLength={80}
            name="meal-title" autoComplete="off" enterKeyHint="next"
          />
        </label>

        {isMeal && (
          <div className="grid grid-cols-[1.3fr_1fr] gap-2.5">
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Date</span>
              <input type="date" className={fieldClass} value={day} max={today} onChange={(e) => e.target.value && setDay(e.target.value)} />
            </label>
            <label className="block">
              <span className="mb-1 block text-xs text-muted">Time</span>
              <input type="time" className={fieldClass} value={time} onChange={(e) => e.target.value && setTime(e.target.value)} />
            </label>
          </div>
        )}

        {isMeal && (
          <div className="grid grid-cols-4 rounded-xl bg-line p-[3px] text-center text-[13px] font-semibold" role="group" aria-label="Portion">
            {PORTIONS.map((p) => (
              <button
                key={p.value} type="button" onClick={() => onPortion(p.value)} aria-pressed={portion === p.value}
                className={`rounded-[9px] py-2 ${portion === p.value ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        <div className="rounded-[20px] bg-surface p-3.5 shadow-sm">
          <label className="mb-2.5 flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted">Calories (kcal)</span>
            <input
              inputMode="decimal" value={text.calories} onChange={(e) => onNumber('calories', e.target.value)} placeholder="0"
              className="w-28 rounded-xl border border-line bg-bg px-3 py-1.5 text-right text-2xl font-extrabold tracking-tight outline-none focus:border-accent"
            />
          </label>
          <div className="grid grid-cols-4 gap-2">
            {MACRO_META.map(({ key, label, color }) => (
              <label key={key} className="rounded-xl border border-line bg-bg px-1 py-2 text-center focus-within:border-accent">
                <input
                  inputMode="decimal" value={text[key]} onChange={(e) => onNumber(key, e.target.value)} placeholder="0"
                  aria-label={`${key === 'sugar' ? 'Added sugar' : label} in grams`}
                  className="w-full bg-transparent text-center text-base font-bold outline-none"
                />
                <span className="block text-[10.5px] font-semibold" style={{ color }}>
                  {label} g
                </span>
              </label>
            ))}
          </div>
        </div>

        {isMeal && !existing && (
          <label className="flex items-center justify-between px-0.5 py-1 text-[13.5px] font-semibold">
            Save as a frequent meal
            <input type="checkbox" className="peer sr-only" checked={saveAsFrequent} onChange={(e) => setSaveAsFrequent(e.target.checked)} />
            <span className="relative h-[26px] w-11 rounded-full bg-line transition-colors after:absolute after:left-[3px] after:top-[3px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-[18px] peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
          </label>
        )}

        <div className="sticky bottom-0 -mx-5 bg-bg px-5 pb-1 pt-2">
          <button type="submit" disabled={!canSave} className="w-full rounded-2xl bg-accent py-3.5 text-[15px] font-bold text-white disabled:opacity-45">
            {existing ? 'Save changes' : isMeal ? `Add to ${day === today ? 'today' : shortDate(day)}` : 'Save meal'}
          </button>
        </div>

        {existing && (
          <button type="button" onClick={() => void remove()} className="py-2 text-[13.5px] font-bold text-danger">
            {isMeal ? 'Delete this meal' : 'Remove this frequent meal'}
          </button>
        )}
      </form>
    </Sheet>
  );
}
