import { useRef, useState } from 'react';
import { ArrowRight, Camera, Image as ImageIcon, KeyRound, Loader2, PencilLine, Plus } from 'lucide-react';
import { Sheet } from './Sheet';
import { AiError, estimateMeal } from '../lib/ai';
import type { MealDraft } from './MealForm';
import { nowTime, shortDate } from '../lib/date';
import { prepareImage } from '../lib/image';
import { searchFoods, type Food } from '../lib/foods';
import { fmt } from '../lib/macros';
import type { SavedMeal } from '../types';

interface LogSheetProps {
  day: string;
  today: string;
  apiKey: string;
  savedMeals: SavedMeal[];
  onManual: () => void;
  onQuickAdd: (saved: SavedMeal) => void;
  onEstimate: (draft: MealDraft) => void;
  onOpenProfile: () => void;
  onClose: () => void;
}

/** The single entry point for logging: photo, text, a frequent meal, or manual entry. */
export function LogSheet({ day, today, apiKey, savedMeals, onManual, onQuickAdd, onEstimate, onOpenProfile, onClose }: LogSheetProps) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState<{ thumb?: string } | null>(null);
  const [error, setError] = useState('');
  const [needsKey, setNeedsKey] = useState(false);
  const cameraInput = useRef<HTMLInputElement>(null);
  const galleryInput = useRef<HTMLInputElement>(null);

  const query = text.trim().toLowerCase();
  const matches = query ? savedMeals.filter((s) => s.name.toLowerCase().includes(query)) : savedMeals;
  const foods = searchFoods(text);

  // A food from the built-in list opens the review form with its standard serving; no AI is used.
  const pickFood = (food: Food) =>
    onEstimate({
      name: food.brand && !food.name.includes(food.brand) ? `${food.brand} ${food.name}` : food.name,
      calories: food.calories, protein: food.protein, carbs: food.carbs, fats: food.fats, sugar: food.sugar,
      day, time: nowTime(), source: 'library',
      note: `${food.serving}. Standard values from ${food.source}.${food.sugarApprox ? ' Added sugar is approximate.' : ''} Use the portion buttons for more or less.`,
    });

  const estimate = async (description: string, file?: File) => {
    if (!apiKey) {
      setNeedsKey(true);
      return;
    }
    setError('');
    try {
      const image = file ? await prepareImage(file) : undefined;
      setBusy({ thumb: image?.thumb });
      const result = await estimateMeal({ apiKey, text: description, imageBase64: image?.base64, today, now: nowTime() });
      // With no date in the text, the meal belongs to the day being viewed.
      const draftDay = day !== today && result.day === today ? day : result.day;
      onEstimate({ ...result, day: draftDay, thumb: image?.thumb });
    } catch (e) {
      setBusy(null);
      setError(e instanceof AiError || e instanceof Error ? e.message : 'Something went wrong. Please try again.');
    }
  };

  const submitText = () => {
    if (!query) return;
    // An exact frequent-meal name logs instantly, with no AI call.
    const exact = savedMeals.find((s) => s.name.toLowerCase() === query);
    if (exact) onQuickAdd(exact);
    else void estimate(text);
  };

  const onFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) void estimate(text, file);
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
    <Sheet title={day === today ? 'Log a meal' : `Log a meal for ${shortDate(day)}`} onClose={onClose}>
      <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFile} />
      <input ref={galleryInput} type="file" accept="image/*" className="hidden" onChange={onFile} data-testid="gallery-input" />

      <div className="grid grid-cols-2 gap-2.5">
        <button onClick={() => (apiKey ? cameraInput.current?.click() : setNeedsKey(true))} className="rounded-[18px] bg-accent px-3 py-3.5 text-center text-[13.5px] font-bold text-white">
          <Camera className="mx-auto mb-1" size={24} />
          Take a photo
        </button>
        <button onClick={() => (apiKey ? galleryInput.current?.click() : setNeedsKey(true))} className="rounded-[18px] border border-line bg-surface px-3 py-3.5 text-center text-[13.5px] font-bold">
          <ImageIcon className="mx-auto mb-1 text-accent-ink" size={24} />
          Choose a photo
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

      {error && <p role="alert" className="mt-2.5 rounded-xl bg-accent-soft px-3.5 py-2.5 text-[13px] font-medium text-accent-ink">{error}</p>}

      {needsKey && (
        <div role="alert" className="mt-2.5 flex items-center gap-3 rounded-xl bg-accent-soft px-3.5 py-2.5 text-[13px]">
          <KeyRound size={18} className="shrink-0 text-accent-ink" />
          <span className="flex-1">Photo and text logging need a Gemini key.</span>
          <button onClick={onOpenProfile} className="shrink-0 font-bold text-accent-ink underline">Add key</button>
        </div>
      )}

      {foods.length > 0 && (
        <section aria-label="Food list matches">
          <h3 className="mb-1 mt-4 text-sm font-bold">From the food list</h3>
          <ul>
            {foods.map((f) => (
              <li key={f.id} className="border-b border-line last:border-0">
                <button onClick={() => pickFood(f)} className="flex w-full items-center gap-2 py-2 text-left">
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

      <div className="mb-1 mt-4 flex items-baseline justify-between">
        <h3 className="text-sm font-bold">Frequent meals</h3>
        <button onClick={onManual} className="flex items-center gap-1 text-xs font-semibold text-accent-ink">
          <PencilLine size={13} /> Enter numbers yourself
        </button>
      </div>
      {savedMeals.length === 0 ? (
        <p className="py-2 text-[13px] leading-relaxed text-muted">
          Meals you save appear here, ready to log in one tap.
        </p>
      ) : matches.length === 0 ? (
        <p className="py-2 text-[13px] text-muted">
          No frequent meal matches.{foods.length === 0 && ' Tap the arrow to estimate it.'}
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
