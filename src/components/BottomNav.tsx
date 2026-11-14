import { BarChart3, Heart, Home, Plus, User, type LucideIcon } from 'lucide-react';

export type Tab = 'today' | 'trends' | 'meals' | 'profile';

const ITEMS: { tab: Tab; label: string; Icon: LucideIcon }[] = [
  { tab: 'today', label: 'Today', Icon: Home },
  { tab: 'trends', label: 'Trends', Icon: BarChart3 },
  { tab: 'meals', label: 'Meals', Icon: Heart },
  { tab: 'profile', label: 'Profile', Icon: User },
];

export function BottomNav({ tab, onTab, onLog }: { tab: Tab; onTab: (t: Tab) => void; onLog: () => void }) {
  const item = ({ tab: t, label, Icon }: (typeof ITEMS)[number]) => (
    <button
      key={t}
      onClick={() => onTab(t)}
      aria-current={tab === t ? 'page' : undefined}
      className={`flex w-14 flex-col items-center gap-0.5 text-[10.5px] ${tab === t ? 'font-bold text-accent-ink' : 'text-muted'}`}
    >
      <Icon size={21} strokeWidth={1.8} />
      {label}
    </button>
  );

  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-30 mx-auto flex max-w-md items-end justify-around border-t border-line bg-surface px-2 pb-[max(0.6rem,env(safe-area-inset-bottom))] pt-2"
    >
      {ITEMS.slice(0, 2).map(item)}
      <button onClick={onLog} className="flex w-16 flex-col items-center gap-0.5 text-[11px] font-extrabold text-accent-ink">
        <span className="-mt-9 grid h-14 w-14 place-items-center rounded-full border-4 border-bg bg-accent text-white">
          <Plus size={26} strokeWidth={2.2} />
        </span>
        Log meal
      </button>
      {ITEMS.slice(2).map(item)}
    </nav>
  );
}
