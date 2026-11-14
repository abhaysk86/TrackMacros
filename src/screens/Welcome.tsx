import { useState } from 'react';
import { Camera, Heart, Target } from 'lucide-react';
import { GoalCalculator } from '../components/GoalCalculator';
import { LegalLinks, LegalSheet, type LegalDoc } from '../components/Legal';
import { Logo } from '../components/Logo';
import { setGoals, setOnboarded } from '../db';
import type { Goals } from '../types';

const POINTS = [
  { Icon: Camera, title: 'Snap or type a meal', text: 'Get calories, protein, carbs, fats and added sugar in seconds.' },
  { Icon: Heart, title: 'One tap for regulars', text: 'Save the meals you eat often and log them instantly.' },
  { Icon: Target, title: 'See where you stand', text: 'Track every day against goals that fit you.' },
];

/** First-run screen: what the app does, then goal setup. */
export function Welcome() {
  const [step, setStep] = useState<'intro' | 'goals'>('intro');
  const [legal, setLegal] = useState<LegalDoc | null>(null);

  const finish = async (goals?: Goals) => {
    if (goals) await setGoals(goals);
    await setOnboarded();
  };

  if (step === 'goals') {
    return (
      <div className="mx-auto min-h-dvh max-w-md px-5 pb-8 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <h1 className="text-[22px] font-bold tracking-tight">Set your daily goals</h1>
        <p className="mb-4 mt-1 text-[13.5px] text-muted">Answer a few questions and we'll suggest targets.</p>
        <GoalCalculator submitLabel="Use these goals" onDone={(goals) => void finish(goals)} />
        <button onClick={() => void finish()} className="mt-3 w-full py-2 text-[13.5px] font-semibold text-muted">
          Skip and use standard goals
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh max-w-md flex-col px-6 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-[max(3rem,env(safe-area-inset-top))]">
      <Logo size={64} />
      <h1 className="mt-5 text-[30px] font-extrabold leading-tight tracking-tight">TrackMacros</h1>
      <p className="mt-1 text-[16px] text-muted">Snap a photo, get your macros.</p>

      <ul className="mt-8 flex flex-col gap-5">
        {POINTS.map(({ Icon, title, text }) => (
          <li key={title} className="flex gap-3.5">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-accent-soft text-accent-ink">
              <Icon size={21} />
            </span>
            <span>
              <b className="block text-[15px]">{title}</b>
              <span className="text-[13.5px] leading-snug text-muted">{text}</span>
            </span>
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-8">
        <button onClick={() => setStep('goals')} className="w-full rounded-2xl bg-accent py-3.5 text-[16px] font-bold text-white">
          Get started
        </button>
        <p className="mt-4 text-center text-[11.5px] leading-relaxed text-muted">
          Your meals are stored on this device. Photos and descriptions you send for an estimate go to Google's AI and are
          not kept. Figures are estimates, not medical advice.
          <br />
          By continuing you agree to the <LegalLinks onOpen={setLegal} />.
          <br />
          Built by{' '}
          <a href="https://theabhayperspective.com" target="_blank" rel="noopener noreferrer" className="font-semibold text-accent-ink underline">
            Theabhayperspective
          </a>
        </p>
      </div>
      {legal && <LegalSheet doc={legal} onClose={() => setLegal(null)} />}
    </div>
  );
}
