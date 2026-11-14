import { useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useGoals, useMealsInRange } from '../hooks';
import { addDays, parseDay, shortDate, weekdayShort } from '../lib/date';
import { fmt, progress, sumMacros } from '../lib/macros';
import { MACRO_META, type Macros } from '../types';

const RANGES = [
  { days: 7, label: '7 days' },
  { days: 30, label: '30 days' },
];

// Chart geometry, in SVG units.
const W = 320;
const H = 170;
const TOP = 16;
const BOTTOM = 22;
const PLOT_H = H - TOP - BOTTOM;

export function Trends({ today }: { today: string }) {
  const [range, setRange] = useState(7);
  const [picked, setPicked] = useState<string | null>(null);
  const goals = useGoals();
  const from = addDays(today, -(range - 1));
  const meals = useMealsInRange(from, today);

  const days = Array.from({ length: range }, (_, i) => addDays(from, i));
  const byDay = new Map<string, Macros>();
  for (const day of days) {
    const dayMeals = meals.filter((m) => m.day === day);
    if (dayMeals.length > 0) byDay.set(day, sumMacros(dayMeals));
  }
  const logged = [...byDay.values()];
  const total = sumMacros(logged);
  const avg = (value: number) => (logged.length ? value / logged.length : 0);

  const loggedDays = days.filter((d) => byDay.has(d));
  const selected = picked && byDay.has(picked) ? picked : (loggedDays[loggedDays.length - 1] ?? null);

  const peak = Math.max(goals.calories, ...logged.map((d) => d.calories));
  const yMax = peak * 1.12 || 1;
  const y = (value: number) => TOP + PLOT_H * (1 - value / yMax);
  const slot = W / range;
  const barW = Math.max(3, Math.min(26, slot - 2));
  const goalY = y(goals.calories);
  const tickEvery = range === 7 ? 1 : 7;

  return (
    <>
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-[22px] font-bold tracking-tight">Trends</h1>
        <div className="grid grid-cols-2 rounded-xl bg-line p-[3px] text-center text-[13px] font-semibold" role="group" aria-label="Period">
          {RANGES.map((r) => (
            <button
              key={r.days} onClick={() => setRange(r.days)} aria-pressed={range === r.days}
              className={`rounded-[9px] px-3 py-1.5 ${range === r.days ? 'bg-surface text-ink shadow-sm' : 'text-muted'}`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {logged.length === 0 ? (
        <div className="rounded-2xl border-[1.5px] border-dashed border-line px-4 py-10 text-center text-[13px] leading-relaxed text-muted">
          <BarChart3 className="mx-auto mb-3 text-accent" size={28} />
          Nothing logged in the last {range} days.
          <br />
          Your chart appears as soon as you log a meal.
        </div>
      ) : (
        <>
          <section className="mb-3 rounded-[20px] bg-surface p-4 shadow-sm" aria-label="Daily calories">
            <div className="mb-1 flex items-baseline justify-between">
              <h2 className="text-[15px] font-bold">Daily calories</h2>
              <span className="text-xs text-muted">
                {logged.length} of {range} days logged
              </span>
            </div>
            <p className="mb-2 text-[13px] text-muted" aria-live="polite">
              {selected && (
                <>
                  <b className="text-ink">{fmt(byDay.get(selected)!.calories)} kcal</b> on {weekdayShort(selected)} {shortDate(selected)}
                </>
              )}
            </p>

            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label={`Calories per day for the last ${range} days`}>
              <line x1="0" x2={W} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeWidth="1" />
              {days.map((d, i) => {
                const value = byDay.get(d)?.calories ?? 0;
                const cx = slot * i + slot / 2;
                const top = y(value);
                const r = Math.min(4, barW / 2, (y(0) - top) / 2);
                const x0 = cx - barW / 2;
                const active = d === selected;
                return (
                  <g key={d}>
                    {value > 0 && (
                      <path
                        d={`M${x0},${y(0)} V${top + r} Q${x0},${top} ${x0 + r},${top} H${x0 + barW - r} Q${x0 + barW},${top} ${x0 + barW},${top + r} V${y(0)} Z`}
                        fill="var(--accent)" opacity={active ? 1 : 0.45}
                      />
                    )}
                    {i % tickEvery === (range === 7 ? 0 : (range - 1) % tickEvery) && (
                      <text x={cx} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--muted)">
                        {range === 7 ? weekdayShort(d) : parseDay(d).getDate()}
                      </text>
                    )}
                    {value > 0 && (
                      <rect
                        x={slot * i} y={TOP} width={slot} height={PLOT_H} fill="transparent" className="cursor-pointer"
                        onClick={() => setPicked(d)} onMouseEnter={() => setPicked(d)}
                      >
                        <title>{`${weekdayShort(d)} ${shortDate(d)}: ${fmt(value)} kcal`}</title>
                      </rect>
                    )}
                  </g>
                );
              })}
              <line x1="0" x2={W} y1={goalY} y2={goalY} stroke="var(--ink)" strokeWidth="1" strokeDasharray="3 4" opacity="0.55" />
              <text x={W} y={goalY - 4} textAnchor="end" fontSize="10" fill="var(--muted)">
                Goal {fmt(goals.calories)}
              </text>
            </svg>
          </section>

          <section className="rounded-[20px] bg-surface p-4 shadow-sm" aria-label="Daily averages">
            <h2 className="text-[15px] font-bold">Daily average</h2>
            <p className="mb-3 text-xs text-muted">Across the days you logged, against your goals.</p>
            <div className="mb-3 flex items-baseline justify-between border-b border-line pb-3">
              <span className="text-[13.5px] font-semibold">Calories</span>
              <span className="text-[13px] text-muted">
                <b className="text-[17px] text-ink">{fmt(avg(total.calories))}</b> / {fmt(goals.calories)} kcal
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {MACRO_META.map(({ key, label, color }) => (
                <div key={key}>
                  <div className="mb-1 flex justify-between text-[13px]">
                    <span className="font-semibold">{key === 'sugar' ? 'Added sugar' : label}</span>
                    <span className="text-muted">
                      <b className="text-ink">{fmt(avg(total[key]))}</b> / {fmt(goals[key])} g
                    </span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-line">
                    <div className="h-full rounded-full" style={{ width: `${progress(avg(total[key]), goals[key]) * 100}%`, background: color }} />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </>
  );
}
