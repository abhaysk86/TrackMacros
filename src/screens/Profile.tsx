import { useEffect, useState } from 'react';
import { setApiKey, setGoals } from '../db';
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

  // Load the stored goals into the form once they arrive.
  useEffect(() => {
    setDraft((d) => d ?? (Object.fromEntries(FIELDS.map((f) => [f.key, String(goals[f.key])])) as Record<MacroKey, string>));
  }, [goals]);

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
              Add a Gemini key to log meals from a photo or a description. It is free from{' '}
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

      <section className="rounded-[20px] bg-surface p-4 shadow-sm">
        <h2 className="mb-1 text-[15px] font-bold">About</h2>
        <p className="text-[13px] leading-relaxed text-muted">
          TrackMacros keeps your meals and goals on this device.
          <br />
          Built by{' '}
          <a href="https://theabhayperspective.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink underline">
            Theabhayperspective
          </a>
        </p>
      </section>
    </>
  );
}
