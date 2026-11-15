import { useEffect, useRef, useState } from 'react';
import { GoalCalculator } from '../components/GoalCalculator';
import { CONTACT_EMAIL, LegalLinks, LegalSheet, type LegalDoc } from '../components/Legal';
import { Sheet } from '../components/Sheet';
import { parseBackup } from '../lib/backup';
import { dayKey } from '../lib/date';
import { deleteAllData, exportBackup, importBackup, setApiKey, setGoals } from '../db';
import { useApiKey, useGoals, useTheme } from '../hooks';
import { useToast } from '../components/Toast';
import type { Goals, MacroKey, ThemePref } from '../types';

const FIELDS: { key: MacroKey; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calories', unit: 'kcal' },
  { key: 'protein', label: 'Protein', unit: 'g' },
  { key: 'carbs', label: 'Carbs', unit: 'g' },
  { key: 'fats', label: 'Fats', unit: 'g' },
  { key: 'sugar', label: 'Added sugar', unit: 'g' },
];

const THEMES: { value: ThemePref; label: string }[] = [
  { value: 'system', label: 'Auto' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

export function Profile() {
  const goals = useGoals();
  const [theme, setTheme] = useTheme();
  const apiKey = useApiKey();
  const toast = useToast();
  const [keyDraft, setKeyDraft] = useState('');
  const [draft, setDraft] = useState<Record<MacroKey, string> | null>(null);

  const [calculating, setCalculating] = useState(false);
  const [legal, setLegal] = useState<LegalDoc | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const importInput = useRef<HTMLInputElement>(null);

  // Keep the form in step with the stored goals (first load, calculator, import).
  const goalsKey = JSON.stringify(goals);
  useEffect(() => {
    setDraft(Object.fromEntries(FIELDS.map((f) => [f.key, String(goals[f.key])])) as Record<MacroKey, string>);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [goalsKey]);

  const exportData = async () => {
    const backup = await exportBackup();
    const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `mealglimpse-backup-${dayKey()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast(`Backup saved: ${backup.meals.length} meals`);
  };

  const importData = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const backup = parseBackup(await file.text());
      await importBackup(backup);
      toast(`Imported ${backup.meals.length} meals and ${backup.savedMeals.length} frequent meals`);
    } catch (err) {
      toast(err instanceof Error ? err.message : 'That file could not be imported.');
    }
  };

  const commit = (key: MacroKey) => {
    if (!draft) return;
    const value = Math.max(0, Math.round(Number(draft[key]) || 0));
    setDraft({ ...draft, [key]: String(value) });
    void setGoals({ ...goals, [key]: value } as Goals);
  };

  return (
    <>
      <h1 className="mb-4 text-[22px] font-bold tracking-tight">Profile</h1>

      <section className="mb-4 rounded-[20px] bg-surface p-4 shadow-sm">
        <h2 className="mb-1 text-[15px] font-bold">Daily goals</h2>
        <p className="mb-3 text-xs text-muted">Changes are saved as you go.</p>
        <div className="flex flex-col gap-2.5">
          {FIELDS.map(({ key, label, unit }) => (
            <label key={key} className="flex items-center justify-between gap-3 text-[14px] font-semibold">
              {label}
              <span className="flex items-center gap-2">
                <input
                  inputMode="numeric" value={draft?.[key] ?? ''}
                  onChange={(e) => draft && setDraft({ ...draft, [key]: e.target.value.replace(/\D/g, '') })}
                  onBlur={() => commit(key)}
                  className="w-24 rounded-xl border border-line bg-bg px-3 py-2 text-right text-base font-bold outline-none focus:border-accent"
                />
                <span className="w-7 text-xs font-normal text-muted">{unit}</span>
              </span>
            </label>
          ))}
        </div>
        <button onClick={() => setCalculating(true)} className="mt-3.5 w-full rounded-xl border border-line py-2.5 text-[13.5px] font-bold text-accent-ink">
          Work out my goals for me
        </button>
      </section>

      <section className="mb-4 rounded-[20px] bg-surface p-4 shadow-sm">
        <h2 className="mb-1 text-[15px] font-bold">Photo and text logging</h2>
        {apiKey ? (
          <>
            <p className="mb-3 text-[13px] leading-relaxed text-muted">
              Your Gemini key is saved on this device (ending {apiKey.slice(-4)}). Estimates run on your own Google quota.
            </p>
            <button
              onClick={() => {
                void setApiKey('');
                toast('Gemini key removed');
              }}
              className="rounded-xl border border-line px-3.5 py-2 text-[13px] font-bold text-danger"
            >
              Remove key
            </button>
          </>
        ) : (
          <>
            <p className="mb-3 text-[13px] leading-relaxed text-muted">
              Add your own Gemini key for unlimited photo and text logging. It is free from{' '}
              <a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink underline">
                Google AI Studio
              </a>{' '}
              and is stored only on this device.
            </p>
            <form
              className="flex gap-2"
              onSubmit={(e) => {
                e.preventDefault();
                const key = keyDraft.trim();
                if (!key) return;
                void setApiKey(key);
                setKeyDraft('');
                toast('Gemini key saved');
              }}
            >
              <input
                type="password" value={keyDraft} onChange={(e) => setKeyDraft(e.target.value)} aria-label="Gemini API key"
                placeholder="Paste your key" autoComplete="off"
                className="min-w-0 flex-1 rounded-xl border border-line bg-bg px-3 py-2 text-base outline-none focus:border-accent"
              />
              <button type="submit" disabled={!keyDraft.trim()} className="rounded-xl bg-accent px-4 text-[13.5px] font-bold text-white disabled:opacity-45">
                Save
              </button>
            </form>
          </>
        )}
      </section>

      <section className="mb-4 rounded-[20px] bg-surface p-4 shadow-sm">
        <h2 className="mb-3 text-[15px] font-bold">Appearance</h2>
        <div className="grid grid-cols-3 rounded-xl bg-line p-[3px] text-center text-[13px] font-semibold" role="group" aria-label="Theme">
          {THEMES.map((t) => (
            <button
              key={t.value} onClick={() => setTheme(t.value)} aria-pressed={theme === t.value}
              className={`rounded-[9px] py-2 ${theme === t.value ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </section>

      <section className="mb-4 rounded-[20px] bg-surface p-4 shadow-sm">
        <h2 className="mb-1 text-[15px] font-bold">Your data</h2>
        <p className="mb-3 text-[13px] leading-relaxed text-muted">
          Everything is stored on this device only. Save a backup file before changing phones or clearing your browser.
        </p>
        <input ref={importInput} type="file" accept="application/json,.json" className="hidden" onChange={(e) => void importData(e)} data-testid="import-input" />
        <div className="grid grid-cols-2 gap-2">
          <button onClick={() => void exportData()} className="rounded-xl border border-line py-2.5 text-[13.5px] font-bold">Save a backup</button>
          <button onClick={() => importInput.current?.click()} className="rounded-xl border border-line py-2.5 text-[13.5px] font-bold">Restore a backup</button>
        </div>
        <button
          onClick={() => {
            if (!confirmDelete) return setConfirmDelete(true);
            void deleteAllData();
          }}
          onBlur={() => setConfirmDelete(false)}
          className={`mt-2 w-full rounded-xl py-2.5 text-[13.5px] font-bold ${confirmDelete ? 'bg-danger text-white' : 'text-danger'}`}
        >
          {confirmDelete ? 'Tap again to delete everything on this device' : 'Delete all my data'}
        </button>
      </section>

      <section className="rounded-[20px] bg-surface p-4 shadow-sm">
        <h2 className="mb-1 text-[15px] font-bold">About</h2>
        <p className="text-[13px] leading-relaxed text-muted">
          MealGlimpse keeps your meals and goals on this device. Food list values come from{' '}
          <a href="https://fdc.nal.usda.gov/" target="_blank" rel="noopener noreferrer" className="underline">USDA FoodData Central</a>,{' '}
          the{' '}
          <a href="https://github.com/lindsayjaacks/Indian-Nutrient-Databank-INDB-" target="_blank" rel="noopener noreferrer" className="underline">Indian Nutrient Databank (INDB)</a>{' '}
          and{' '}
          <a href="https://world.openfoodfacts.org/" target="_blank" rel="noopener noreferrer" className="underline">Open Food Facts</a>{' '}
          (Open Database Licence).
          <br />
          Built by{' '}
          <a href="https://theabhayperspective.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink underline">
            Theabhayperspective
          </a>
        </p>
        <p className="mt-2 text-[13px] text-muted">
          <LegalLinks onOpen={setLegal} />
          {' · '}
          <a href={`mailto:${CONTACT_EMAIL}?subject=MealGlimpse%20feedback`} className="font-semibold text-accent-ink underline">
            Send feedback
          </a>
        </p>
      </section>

      {legal && <LegalSheet doc={legal} onClose={() => setLegal(null)} />}

      {calculating && (
        <Sheet title="Work out my goals" onClose={() => setCalculating(false)}>
          <GoalCalculator
            submitLabel="Use these goals"
            onDone={(suggested) => {
              void setGoals(suggested);
              setCalculating(false);
              toast('Goals updated');
            }}
          />
        </Sheet>
      )}
    </>
  );
}
