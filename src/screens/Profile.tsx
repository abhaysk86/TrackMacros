import { useEffect, useState } from 'react';
import { setGoals } from '../db';
import { useGoals, useTheme } from '../hooks';
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
