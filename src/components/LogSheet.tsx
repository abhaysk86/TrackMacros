import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Camera, History, Image as ImageIcon, KeyRound, Loader2, PencilLine, Plus, ScanLine } from 'lucide-react';
import { Sheet } from './Sheet';
import { AiError, PROXY_URL, estimateMeal, fetchQuota, type Quota } from '../lib/ai';
import type { MealDraft } from './MealForm';
import { usePastMeals } from '../hooks';
import { nowTime, shortDate } from '../lib/date';
import { prepareImage } from '../lib/image';
import { matchFood, parseQuery, searchFoods, type Food } from '../lib/foods';
import { fmt } from '../lib/macros';
import { searchPast, type PastMeal } from '../lib/memory';
import type { SavedMeal } from '../types';

interface LogSheetProps {
  day: string;
  today: string;
  apiKey: string;
  savedMeals: SavedMeal[];
  /** Heading for the sheet; defaults to "Log a meal". */
  title?: string;
  /** Leave out the frequent meals list, e.g. when creating a new frequent meal. */
  hideFrequent?: boolean;
  /** Shows the "Enter numbers yourself" link when given. */
  onManual?: () => void;
  onQuickAdd: (saved: SavedMeal) => void;
  onEstimate: (draft: MealDraft) => void;
  /** Shows an "Add key" link when AI logging is unavailable. */
  onOpenProfile?: () => void;
  onClose: () => void;
}

/**
 * The single entry point for adding food: a meal photo, a nutrition label, text,
 * the food list, something logged before, a frequent meal, or manual entry.
 * It is also used to pick an extra item for a combined meal.
 */
export function LogSheet({
  day, today, apiKey, savedMeals, title, hideFrequent, onManual, onQuickAdd, onEstimate, onOpenProfile, onClose,
}: LogSheetProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<{ thumb?: string } | null>(null);
  const [error, setError] = useState('');
  const [needsKey, setNeedsKey] = useState(false);
  const [quota, setQuota] = useState<Quota | null>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  // AI logging works with the user's own key, or through the free service when it is set up.
  const aiAvailable = Boolean(apiKey || PROXY_URL);

  useEffect(() => {
    if (apiKey || !PROXY_URL) return;
    let live = true;
    void fetchQuota().then((q) => live && setQuota(q));
    return () => {
      live = false;
    };
  }, [apiKey]);

  const galleryInput = useRef<HTMLInputElement>(null);
  const labelInput = useRef<HTMLInputElement>(null);
  const past = searchPast(usePastMeals(savedMeals), text);

  const query = text.trim().toLowerCase();
  const matches = query ? savedMeals.filter((s) => s.name.toLowerCase().includes(query)) : savedMeals;
  const foods = searchFoods(text);

  // A food from the built-in list opens the review form with its standard serving; no AI is used.
  const pickFood = (food: Food, quantity = 1) => {
    // Amounts the portion buttons cover are preselected; others are multiplied in.
    const onButtons = [0.5, 1, 1.5, 2, 3].includes(quantity);
    const times = onButtons ? 1 : quantity;
    onEstimate({
      name: food.brand && !food.name.includes(food.brand) ? `${food.brand} ${food.name}` : food.name,
      calories: food.calories * times, protein: food.protein * times, carbs: food.carbs * times,
      fats: food.fats * times, sugar: food.sugar * times,
      day, time: nowTime(), source: 'library', portion: onButtons ? quantity : 1,
      note: `${onButtons ? '1×' : `${quantity} ×`} ${food.serving}. Standard values from ${food.source}, not an AI estimate.${food.sugarApprox ? ' Added sugar is approximate.' : ''}`,
    });
  };

  // Something logged before comes back with the numbers confirmed last time; no AI is used.
  const pickPast = (meal: PastMeal) =>
    onEstimate({
      name: meal.name, calories: meal.calories, protein: meal.protein, carbs: meal.carbs, fats: meal.fats, sugar: meal.sugar,
      day, time: nowTime(), source: 'memory',
      note: `Your numbers from ${shortDate(meal.day)}, not a new estimate. Change anything that was different this time.`,
    });

  const estimate = async (description: string, file?: File, mode: 'meal' | 'label' = 'meal') => {
    if (!aiAvailable) {
      setNeedsKey(true);
      return;
    }
    setError('');
    try {
      const image = file ? await prepareImage(file) : undefined;
      setBusy({ thumb: image?.thumb });
      const result = await estimateMeal({ apiKey, mode, text: description, imageBase64: image?.base64, today, now: nowTime() });
      // With no date in the text, the meal belongs to the day being viewed.
      const draftDay = day !== today && result.day === today ? day : result.day;
      if (mode === 'label') {
        onEstimate({
          ...result, day, time: nowTime(), thumb: image?.thumb, source: 'label',
          note: `Read from the label${result.serving ? `: values are ${result.serving}` : ''}. Check them against the pack, and use the portion buttons if you had more or less.`,
        });
      } else {
        onEstimate({ ...result, day: draftDay, thumb: image?.thumb });
      }
    } catch (e) {
      setBusy(null);
      setError(e instanceof AiError || e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    }
  };

  const submitText = () => {
    if (!query) return;
    // An exact frequent-meal name logs instantly, with no AI call.
    const exact = savedMeals.find((s) => s.name.toLowerCase() === query);
    if (exact) return onQuickAdd(exact);
    // A single clear food from the built-in list is used as is, also with no AI call.
    const known = matchFood(text);
    if (known) pickFood(known.food, known.quantity);
    else void estimate(text);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void estimate(text, file);
  };

  const onLabelFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void estimate(text, file, 'label');
  };

  if (busy) {
    return (
      <Sheet title="Estimating your meal" onClose={onClose}>
        <div className="flex flex-col items-center gap-4 py-8 text-center" role="status">
          {busy.thumb && <img src={busy.thumb} alt="" className="h-24 w-24 rounded-2xl object-cover" />}
          <Loader2 className="animate-spin text-accent" size={28} />
          <p className="text-[13px] text-muted">Working out the calories and macros. This takes a few seconds.</p>
        </div>
      </Sheet>
    );
  }

  return (
    <Sheet title={title ?? (day === today ? 'Log a meal' : `Log a meal for ${shortDate(day)}`)} onClose={onClose}>
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <input ref={galleryInput} type="file" accept="image/*" className="hidden" onChange={onFile} data-testid="gallery-input" />
      <input ref={labelInput} type="file" accept="image/*" className="hidden" onChange={onLabelFile} data-testid="label-input" />

      <div className="grid grid-cols-3 gap-2">
        <button onClick={() => (aiAvailable ? cameraInput.current?.click() : setNeedsKey(true))} className="rounded-[18px] bg-accent px-2 py-3 text-center text-[13px] font-bold text-white">
          <Camera className="mx-auto mb-1" size={23} />
          Take photo
        </button>
        <button onClick={() => (aiAvailable ? galleryInput.current?.click() : setNeedsKey(true))} className="rounded-[18px] border border-line bg-surface px-2 py-3 text-center text-[13px] font-bold">
          <ImageIcon className="mx-auto mb-1 text-accent-ink" size={23} />
          Choose photo
        </button>
        <button onClick={() => (aiAvailable ? labelInput.current?.click() : setNeedsKey(true))} className="rounded-[18px] border border-line bg-surface px-2 py-3 text-center text-[13px] font-bold">
          <ScanLine className="mx-auto mb-1 text-accent-ink" size={23} />
          Scan label
        </button>
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submitText();
        }}
        className="mt-2.5 flex items-center gap-2 rounded-[14px] border border-line bg-surface pl-3.5 pr-1.5 focus-within:border-accent"
      >
        <input
          value={text} onChange={(e) => setText(e.target.value)} aria-label="Describe your meal"
          placeholder="Type a food or describe a meal" autoComplete="off" enterKeyHint="send" maxLength={300}
          className="min-w-0 flex-1 bg-transparent py-3 text-base outline-none placeholder:text-muted"
        />
        <button type="submit" disabled={!query} aria-label="Estimate this meal" className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-white disabled:opacity-35">
          <ArrowRight size={18} />
        </button>
      </form>

      {quota && !error && (
        <p className="mt-2 text-center text-[11.5px] text-muted">
          {quota.paused
            ? 'Free AI logging is paused for now. The food list and frequent meals still work.'
            : `${quota.remaining} of ${quota.limit} free AI logs left today · the food list and frequent meals are unlimited`}
        </p>
      )}

      {error && <p role="alert" className="mt-2.5 rounded-xl bg-accent-soft px-3.5 py-2.5 text-[13px] font-medium text-accent-ink">{error}</p>}

      {needsKey && (
        <div role="alert" className="mt-2.5 flex items-center gap-3 rounded-xl bg-accent-soft px-3.5 py-2.5 text-[13px]">
          <KeyRound size={18} className="shrink-0 text-accent-ink" />
          <span className="flex-1">Photo and text logging need a Gemini key.</span>
          {onOpenProfile && (
            <button onClick={onOpenProfile} className="shrink-0 font-bold text-accent-ink underline">Add key</button>
          )}
        </div>
      )}

      {foods.length > 0 && (
        <section aria-label="Food list matches">
          <h3 className="mb-1 mt-4 text-sm font-bold">From the food list</h3>
          <ul>
            {foods.map((f) => (
              <li key={f.id} className="border-b border-line last:border-0">
                <button onClick={() => pickFood(f, parseQuery(text).quantity)} className="flex w-full items-center gap-2 py-2 text-left">
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">
                      {f.name}
                      {f.brand && !f.name.includes(f.brand) && <span className="font-normal text-muted"> · {f.brand}</span>}
                    </span>
                    <span className="block text-[11.5px] text-muted">{f.serving}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{fmt(f.calories)} kcal</span>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
                    <Plus size={17} strokeWidth={2.4} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {past.length > 0 && (
        <section aria-label="Meals you have logged before">
          <h3 className="mb-1 mt-4 text-sm font-bold">You've logged before</h3>
          <ul>
            {past.map((m) => (
              <li key={m.name} className="border-b border-line last:border-0">
                <button onClick={() => pickPast(m)} className="flex w-full items-center gap-2 py-2 text-left">
                  <History size={15} className="shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-semibold">{m.name}</span>
                    <span className="block text-[11.5px] text-muted">Last logged {shortDate(m.day)}</span>
                  </span>
                  <span className="shrink-0 text-xs text-muted">{fmt(m.calories)} kcal</span>
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-accent-ink">
                    <Plus size={17} strokeWidth={2.4} />
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="mb-1 mt-4 flex items-baseline justify-between">
        <h3 className="text-sm font-bold">{hideFrequent ? '' : 'Frequent meals'}</h3>
        {onManual && (
          <button onClick={onManual} className="flex items-center gap-1 text-xs font-semibold text-accent-ink">
            <PencilLine size={13} /> Enter numbers yourself
          </button>
        )}
      </div>
      {hideFrequent ? null : savedMeals.length === 0 ? (
        <p className="py-2 text-[13px] leading-relaxed text-muted">
          Meals you save appear here, ready to log in one tap.
        </p>
      ) : matches.length === 0 ? (
        <p className="py-2 text-[13px] text-muted">
          No frequent meal matches.{foods.length === 0 && past.length === 0 && ' Tap the arrow to estimate it.'}
        </p>
      ) : (
        <ul>
          {matches.map((s) => (
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
