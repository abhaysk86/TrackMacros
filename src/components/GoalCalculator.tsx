import { useState } from 'react';
import { ACTIVITY_OPTIONS, AIM_OPTIONS, isValidProfile, suggestGoals, type Activity, type Aim, type Sex } from '../lib/goals';
import { fmt } from '../lib/macros';
import { MACRO_META, type Goals } from '../types';

const inputClass =
  'w-full min-w-0 rounded-[14px] border border-line bg-surface px-3 py-[10px] text-center text-base font-semibold outline-none focus:border-accent';
const seg = (on: boolean) => `rounded-[9px] py-2 ${on ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`;

/** Asks a few questions and suggests daily goals. The answers are used once and not stored. */
export function GoalCalculator({ submitLabel, onDone }: { submitLabel: string; onDone: (goals: Goals) => void }) {
  const [sex, setSex] = useState<Sex>('male');
  const [age, setAge] = useState('');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [activity, setActivity] = useState<Activity>('light');
  const [aim, setAim] = useState<Aim>('maintain');

  const profile = { sex, age: Number(age), heightCm: Number(height), weightKg: Number(weight), activity, aim };
  const valid = isValidProfile(profile);
  const goals = valid ? suggestGoals(profile) : null;
  const digits = (set: (v: string) => void) => (e: React.ChangeEvent<HTMLInputElement>) => set(e.target.value.replace(/[^\d.]/g, ''));

  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 rounded-xl bg-line p-[3px] text-center text-[13.5px] font-semibold" role="group" aria-label="Sex">
        <button type="button" onClick={() => setSex('male')} aria-pressed={sex === 'male'} className={seg(sex === 'male')}>Male</button>
        <button type="button" onClick={() => setSex('female')} aria-pressed={sex === 'female'} className={seg(sex === 'female')}>Female</button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <label className="text-center text-[11.5px] text-muted">
          <input inputMode="numeric" value={age} onChange={digits(setAge)} placeholder="Age" aria-label="Age in years" className={inputClass} />
          years
        </label>
        <label className="text-center text-[11.5px] text-muted">
          <input inputMode="decimal" value={height} onChange={digits(setHeight)} placeholder="Height" aria-label="Height in centimetres" className={inputClass} />
          cm
        </label>
        <label className="text-center text-[11.5px] text-muted">
          <input inputMode="decimal" value={weight} onChange={digits(setWeight)} placeholder="Weight" aria-label="Weight in kilograms" className={inputClass} />
          kg
        </label>
      </div>

      <label className="block">
        <span className="mb-1 block text-xs text-muted">How active are you?</span>
        <select value={activity} onChange={(e) => setActivity(e.target.value as Activity)} className={`${inputClass} text-left`}>
          {ACTIVITY_OPTIONS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}, {a.hint}
            </option>
          ))}
        </select>
      </label>

      <div>
        <span className="mb-1 block text-xs text-muted">What is your aim?</span>
        <div className="grid grid-cols-3 rounded-xl bg-line p-[3px] text-center text-[13px] font-semibold" role="group" aria-label="Aim">
          {AIM_OPTIONS.map((a) => (
            <button key={a.value} type="button" onClick={() => setAim(a.value)} aria-pressed={aim === a.value} className={seg(aim === a.value)}>
              {a.label}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl bg-accent-soft px-4 py-3" aria-live="polite">
        {goals ? (
          <>
            <p className="text-[13px]">
              Suggested daily goal: <b className="text-[17px]">{fmt(goals.calories)} kcal</b>
            </p>
            <p className="mt-1 flex flex-wrap gap-x-3 gap-y-0.5 text-[12.5px] text-muted">
              {MACRO_META.map(({ key, label }) => (
                <span key={key}>
                  {key === 'sugar' ? 'Added sugar' : label} <b className="text-ink">{fmt(goals[key])}g</b>
                </span>
              ))}
            </p>
          </>
        ) : (
          <p className="text-[13px] text-muted">Enter your age, height and weight to see suggested goals.</p>
        )}
      </div>

      <button
        type="button" disabled={!goals} onClick={() => goals && onDone(goals)}
        className="w-full rounded-2xl bg-accent py-3 text-[15px] font-bold text-white disabled:opacity-45"
      >
        {submitLabel}
      </button>
      <p className="text-center text-[11.5px] leading-snug text-muted">
        A general starting point, not medical advice. Your answers are used once and not saved. You can change any goal later.
      </p>
    </div>
  );
}
