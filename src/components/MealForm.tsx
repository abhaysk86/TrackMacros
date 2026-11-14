import { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Sheet } from './Sheet';
import { useToast } from './Toast';
import {
  addMeal, addSavedMeal, deleteMeal, deleteSavedMeal, restoreMeal, restoreSavedMeal, updateMeal, updateSavedMeal,
} from '../db';
import { nowTime, shortDate } from '../lib/date';
import { MACRO_META, type MacroKey, type Macros, type Meal, type SavedMeal } from '../types';

/** Values from an AI estimate, shown for review before anything is logged. */
export interface MealDraft extends Macros {
  name: string;
  day: string;
  time: string;
  thumb?: string;
}

export type MealFormTarget =
  | { kind: 'meal'; day: string; meal?: Meal; draft?: MealDraft }
  | { kind: 'saved'; saved?: SavedMeal };

const PORTIONS = [
  { value: 0.5, label: '½×' },
  { value: 1, label: '1×' },
  { value: 1.5, label: '1½×' },
  { value: 2, label: '2×' },
];

const KEYS: MacroKey[] = ['calories', 'protein', 'carbs', 'fats', 'sugar'];
const fieldClass =
  'block w-full min-w-0 appearance-none rounded-[14px] border border-line bg-surface px-3.5 py-[10px] text-left text-base font-semibold leading-6 outline-none focus:border-accent';

/** Add or edit a logged meal, or a frequent meal. */
export function MealForm({ target, today, onClose }: { target: MealFormTarget; today: string; onClose: () => void }) {
  const toast = useToast();
  const existing = target.kind === 'meal' ? target.meal : target.saved;
  const draft = target.kind === 'meal' ? target.draft : undefined;
  const initial = existing ?? draft;
  const isMeal = target.kind === 'meal';

  const [name, setName] = useState(initial?.name ?? '');
  const [day, setDay] = useState(target.kind === 'meal' ? (target.meal?.day ?? draft?.day ?? target.day) : today);
  const [time, setTime] = useState(target.kind === 'meal' ? (target.meal?.time ?? draft?.time ?? nowTime()) : '');
  const [portion, setPortion] = useState(1);
  const [saveAsFrequent, setSaveAsFrequent] = useState(false);

  // `base` holds the values at 1x so switching portions never accumulates rounding drift.
  const base = useRef<Record<MacroKey, number>>({
    calories: initial?.calories ?? 0, protein: initial?.protein ?? 0, carbs: initial?.carbs ?? 0,
    fats: initial?.fats ?? 0, sugar: initial?.sugar ?? 0,
  });
  const [text, setText] = useState<Record<MacroKey, string>>(() =>
    Object.fromEntries(KEYS.map((k) => [k, initial ? String(Math.round(initial[k])) : ''])) as Record<MacroKey, string>,
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
        await addMeal({ ...values, name: cleanName, day, time, source: draft ? 'ai' : 'manual', thumb: draft?.thumb });
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

  const title = isMeal ? (existing ? 'Edit meal' : draft ? 'Review meal' : 'Add a meal') : existing ? 'Edit frequent meal' : 'New frequent meal';

  const cells: { key: MacroKey; label: string; color?: string; aria: string }[] = [
    { key: 'calories', label: 'kcal', aria: 'Calories (kcal)' },
    ...MACRO_META.map(({ key, label, color }) => ({
      key, label, color, aria: `${key === 'sugar' ? 'Added sugar' : label} in grams`,
    })),
  ];

  // The form is kept short enough to fit above a phone keyboard without scrolling.
  return (
    <Sheet
      title={title}
      onClose={onClose}
      action={
        existing && (
          <button
            type="button" onClick={() => void remove()}
            aria-label={isMeal ? 'Delete this meal' : 'Remove this frequent meal'}
            className="grid h-10 w-10 place-items-center rounded-full text-danger"
          >
            <Trash2 size={19} />
          </button>
        )
      }
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
        className="flex flex-col gap-2.5"
      >
        {draft && (
          <p className="flex items-center gap-3 rounded-xl bg-accent-soft px-3 py-2 text-[12.5px] leading-snug">
            {draft.thumb && <img src={draft.thumb} alt="" className="h-11 w-11 shrink-0 rounded-lg object-cover" />}
            <span>
              <b>AI estimate.</b> Check the portion and numbers, then add it. Nothing is logged until you do.
            </span>
          </p>
        )}
        <input
          className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} aria-label="Meal name"
          placeholder={isMeal ? 'Meal name, e.g. Dal chawal' : 'Meal name, e.g. Standard Coffee'} maxLength={80}
          name="meal-title" autoComplete="off" enterKeyHint="done"
        />

        {isMeal && (
          <div className="grid grid-cols-[1.3fr_1fr] gap-2.5">
            <input
              type="date" aria-label="Date" className={fieldClass} value={day} max={today}
              onChange={(e) => e.target.value && setDay(e.target.value)}
            />
            <input
              type="time" aria-label="Time" className={fieldClass} value={time}
              onChange={(e) => e.target.value && setTime(e.target.value)}
            />
          </div>
        )}

        {isMeal && (
          <div className="grid grid-cols-4 rounded-xl bg-line p-[3px] text-center text-[13px] font-semibold" role="group" aria-label="Portion">
            {PORTIONS.map((p) => (
              <button
                key={p.value} type="button" onClick={() => onPortion(p.value)} aria-pressed={portion === p.value}
                className={`rounded-[9px] py-1.5 ${portion === p.value ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-[1.3fr_1fr_1fr_1fr_1fr] gap-1.5">
          {cells.map(({ key, label, color, aria }) => (
            <label
              key={key}
              className={`rounded-xl border bg-surface px-0.5 py-1.5 text-center focus-within:border-accent ${
                key === 'calories' ? 'border-accent/50' : 'border-line'
              }`}
            >
              <input
                inputMode="decimal" value={text[key]} onChange={(e) => onNumber(key, e.target.value)} placeholder="0"
                aria-label={aria} enterKeyHint="done"
                className={`w-full bg-transparent text-center font-bold outline-none ${key === 'calories' ? 'text-[17px]' : 'text-base'}`}
              />
              <span className="block text-[10.5px] font-semibold text-muted" style={color ? { color } : undefined}>
                {label}
              </span>
            </label>
          ))}
        </div>

        {isMeal && !existing && (
          <label className="flex items-center justify-between px-0.5 text-[13.5px] font-semibold">
            Save as a frequent meal
            <input type="checkbox" className="peer sr-only" checked={saveAsFrequent} onChange={(e) => setSaveAsFrequent(e.target.checked)} />
            <span className="relative h-[26px] w-11 rounded-full bg-line transition-colors after:absolute after:left-[3px] after:top-[3px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-[18px] peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
          </label>
        )}

        <div className="sticky bottom-0 -mx-5 bg-bg px-5 pt-0.5">
          <button type="submit" disabled={!canSave} className="w-full rounded-2xl bg-accent py-3 text-[15px] font-bold text-white disabled:opacity-45">
            {existing ? 'Save changes' : isMeal ? `Add to ${day === today ? 'today' : shortDate(day)}` : 'Save meal'}
          </button>
        </div>
      </form>
    </Sheet>
  );
}
