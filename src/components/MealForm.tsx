import { useRef, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { LogSheet } from './LogSheet';
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
  /** Where the values came from; defaults to an AI estimate. */
  source?: 'ai' | 'library' | 'label' | 'memory';
  /** Shown above the form in place of the AI-estimate notice. */
  note?: string;
  /** Portion to preselect; the values given are for one portion. */
  portion?: number;
}

export type MealFormTarget =
  | { kind: 'meal'; day: string; meal?: Meal; draft?: MealDraft }
  | { kind: 'saved'; saved?: SavedMeal; draft?: MealDraft };

/** One component of a combined meal, such as the sachet in a coffee. */
interface Part {
  name: string;
  macros: Macros;
}

const TITLES: Record<NonNullable<MealDraft['source']>, string> = {
  ai: 'Review meal',
  library: 'Add from food list',
  label: 'Review label',
  memory: 'Log again',
};

const PORTIONS = [
  { value: 0.5, label: '½×' },
  { value: 1, label: '1×' },
  { value: 1.5, label: '1½×' },
  { value: 2, label: '2×' },
  { value: 3, label: '3×' },
];

const KEYS: MacroKey[] = ['calories', 'protein', 'carbs', 'fats', 'sugar'];
const fieldClass =
  'block w-full min-w-0 appearance-none rounded-[14px] border border-line bg-surface px-3.5 py-[10px] text-left text-base font-semibold leading-6 outline-none focus:border-accent';

/** Add or edit a logged meal, or a frequent meal. */
interface MealFormProps {
  target: MealFormTarget;
  today: string;
  apiKey: string;
  savedMeals: SavedMeal[];
  onClose: () => void;
}

export function MealForm({ target, today, apiKey, savedMeals, onClose }: MealFormProps) {
  const toast = useToast();
  const existing = target.kind === 'meal' ? target.meal : target.saved;
  const draft = target.draft;
  const initial = existing ?? draft;
  const isMeal = target.kind === 'meal';

  const [name, setName] = useState(initial?.name ?? '');
  const [day, setDay] = useState(target.kind === 'meal' ? (target.meal?.day ?? draft?.day ?? target.day) : today);
  const [time, setTime] = useState(target.kind === 'meal' ? (target.meal?.time ?? draft?.time ?? nowTime()) : '');
  const startPortion = draft?.portion && PORTIONS.some((p) => p.value === draft.portion) ? draft.portion : 1;
  const [portion, setPortion] = useState(startPortion);
  const [saveAsFrequent, setSaveAsFrequent] = useState(false);

  // `base` holds the values at 1x so switching portions never accumulates rounding drift.
  const base = useRef<Record<MacroKey, number>>({
    calories: initial?.calories ?? 0, protein: initial?.protein ?? 0, carbs: initial?.carbs ?? 0,
    fats: initial?.fats ?? 0, sugar: initial?.sugar ?? 0,
  });
  const [text, setText] = useState<Record<MacroKey, string>>(() =>
    Object.fromEntries(KEYS.map((k) => [k, initial ? String(Math.round(initial[k] * startPortion)) : ''])) as Record<MacroKey, string>,
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

  // Combining items: each added item's values go into the totals, and it is listed so it can be taken out again.
  const [parts, setParts] = useState<Part[]>([]);
  const [picking, setPicking] = useState(false);
  const autoName = (list: Part[]) => list.map((p) => p.name).join(' + ').slice(0, 80);
  const showTotals = () =>
    setText(Object.fromEntries(KEYS.map((k) => [k, String(Math.round(base.current[k] * portion))])) as Record<MacroKey, string>);

  const addPart = (item: { name: string; portion?: number } & Macros) => {
    const times = item.portion ?? 1;
    const added: Part = {
      name: item.name,
      macros: Object.fromEntries(KEYS.map((k) => [k, item[k] * times])) as unknown as Macros,
    };
    // The first time, what is already on the form becomes the first listed item.
    const current: Part[] =
      parts.length === 0 && name.trim() && KEYS.some((k) => base.current[k] > 0)
        ? [{ name: name.trim(), macros: Object.fromEntries(KEYS.map((k) => [k, base.current[k] * portion])) as unknown as Macros }]
        : parts;
    const next = [...current, added];
    for (const k of KEYS) base.current[k] += added.macros[k] / portion;
    if (!name.trim() || name === autoName(current)) setName(autoName(next));
    setParts(next);
    showTotals();
    setPicking(false);
  };

  const removePart = (index: number) => {
    const gone = parts[index];
    const next = parts.filter((_, i) => i !== index);
    for (const k of KEYS) base.current[k] = Math.max(0, base.current[k] - gone.macros[k] / portion);
    if (name === autoName(parts)) setName(autoName(next));
    setParts(next.length > 1 ? next : []);
    showTotals();
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
        await addMeal({ ...values, name: cleanName, day, time, source: draft ? (draft.source ?? 'ai') : 'manual', thumb: draft?.thumb });
        if (saveAsFrequent) await addSavedMeal(cleanName, values);
        toast(day === today ? `${cleanName} added` : `${cleanName} added to ${shortDate(day)}`);
      }
    } else if (target.kind === 'saved' && target.saved) {
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

  const title = isMeal
    ? existing ? 'Edit meal' : draft ? TITLES[draft.source ?? 'ai'] : 'Add a meal'
    : existing ? 'Edit frequent meal' : 'New frequent meal';

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
              {draft.note ?? (
                <>
                  <b>AI estimate.</b> Check the portion and numbers, then add it. Nothing is logged until you do.
                </>
              )}
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

        {(isMeal || !existing) && (
          <div className="grid grid-cols-5 rounded-xl bg-line p-[3px] text-center text-[13px] font-semibold" role="group" aria-label="Portion">
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

        {parts.length > 0 && (
          <ul className="flex flex-wrap gap-1.5" aria-label="Items in this meal">
            {parts.map((p, i) => (
              <li key={i} className="flex items-center gap-1 rounded-full border border-line bg-surface py-1 pl-2.5 pr-1 text-[12px] font-semibold">
                {p.name} <span className="font-normal text-muted">· {Math.round(p.macros.calories)} kcal</span>
                <button type="button" onClick={() => removePart(i)} aria-label={`Remove ${p.name}`} className="grid h-6 w-6 place-items-center rounded-full text-muted">
                  <X size={13} />
                </button>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center justify-between gap-3 px-0.5 text-[13.5px] font-semibold">
          <button type="button" onClick={() => setPicking(true)} className="flex items-center gap-1 text-accent-ink">
            <Plus size={15} strokeWidth={2.6} /> Add another item
          </button>
          {isMeal && !existing && (
            <label className="flex items-center gap-2.5">
              Save as frequent
              <input type="checkbox" className="peer sr-only" checked={saveAsFrequent} onChange={(e) => setSaveAsFrequent(e.target.checked)} />
              <span className="relative h-[26px] w-11 rounded-full bg-line transition-colors after:absolute after:left-[3px] after:top-[3px] after:h-5 after:w-5 after:rounded-full after:bg-white after:shadow after:transition-transform peer-checked:bg-accent peer-checked:after:translate-x-[18px] peer-focus-visible:ring-2 peer-focus-visible:ring-accent" />
            </label>
          )}
        </div>

        <div className="sticky bottom-0 -mx-5 bg-bg px-5 pt-0.5">
          <button type="submit" disabled={!canSave} className="w-full rounded-2xl bg-accent py-3 text-[15px] font-bold text-white disabled:opacity-45">
            {existing ? 'Save changes' : isMeal ? `Add to ${day === today ? 'today' : shortDate(day)}` : 'Save meal'}
          </button>
        </div>
      </form>

      {picking && (
        <LogSheet
          title="Add another item"
          day={day}
          today={today}
          apiKey={apiKey}
          savedMeals={savedMeals}
          onQuickAdd={addPart}
          onEstimate={addPart}
          onClose={() => setPicking(false)}
        />
      )}
    </Sheet>
  );
}
