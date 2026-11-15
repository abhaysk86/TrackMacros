import { useCallback, useEffect, useState } from 'react';
import { BottomNav, type Tab } from './components/BottomNav';
import { LogSheet } from './components/LogSheet';
import { MealForm, type MealFormTarget } from './components/MealForm';
import { useToast } from './components/Toast';
import { logSavedMeal, undoLogSavedMeal } from './db';
import { useApiKey, useOnboarded, useSavedMeals, useToday } from './hooks';
import { shortDate } from './lib/date';
import { fmt } from './lib/macros';
import { Meals } from './screens/Meals';
import { Profile } from './screens/Profile';
import { Today } from './screens/Today';
import { Trends } from './screens/Trends';
import { Welcome } from './screens/Welcome';
import type { SavedMeal } from './types';

// 'saved' opens the sheet to create a frequent meal instead of logging one.
type SheetState = { type: 'log'; purpose?: 'saved' } | { type: 'form'; target: MealFormTarget } | null;

export default function App() {
  const today = useToday();
  const toast = useToast();
  const savedMeals = useSavedMeals();
  const apiKey = useApiKey();
  const onboarded = useOnboarded();
  const [tab, setTab] = useState<Tab>('today');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [sheet, setSheet] = useState<SheetState>(null);

  // A null selection means "follow today", so the view rolls over at midnight.
  const day = selectedDay ?? today;
  // Logging from another tab always targets today; from the Today tab it targets the day in view.
  const logDay = tab === 'today' ? day : today;

  const closeSheet = useCallback(() => setSheet(null), []);

  // A fresh start (first run, or after deleting all data) always opens on Today.
  useEffect(() => {
    if (onboarded === false) {
      setTab('today');
      setSelectedDay(null);
      setSheet(null);
    }
  }, [onboarded]);

  const openProfile = () => {
    setSheet(null);
    setTab('profile');
  };

  const quickAdd = async (saved: SavedMeal, targetDay: string) => {
    const meal = await logSavedMeal(saved, targetDay);
    setSheet(null);
    const where = targetDay === today ? '' : ` to ${shortDate(targetDay)}`;
    toast(`${saved.name} added${where} · ${fmt(saved.calories)} kcal`, {
      label: 'Undo',
      onAction: () => void undoLogSavedMeal(meal, saved),
    });
  };

  if (onboarded === undefined) return null;
  if (!onboarded) return <Welcome />;

  return (
    <div className="mx-auto min-h-dvh max-w-md px-4 pb-28 pt-[max(0.9rem,env(safe-area-inset-top))]">
      {tab === 'today' && (
        <Today
          day={day}
          today={today}
          savedMeals={savedMeals}
          onSelectDay={(d) => setSelectedDay(d === today ? null : d)}
          onQuickAdd={(s) => void quickAdd(s, day)}
          onEditMeal={(meal) => setSheet({ type: 'form', target: { kind: 'meal', day: meal.day, meal } })}
          onLog={() => setSheet({ type: 'log' })}
          onAllMeals={() => setTab('meals')}
        />
      )}
      {tab === 'trends' && <Trends today={today} />}
      {tab === 'meals' && (
        <Meals
          savedMeals={savedMeals}
          onNew={() => setSheet({ type: 'log', purpose: 'saved' })}
          onEdit={(saved) => setSheet({ type: 'form', target: { kind: 'saved', saved } })}
        />
      )}
      {tab === 'profile' && <Profile />}

      <BottomNav tab={tab} onTab={setTab} onLog={() => setSheet({ type: 'log' })} />

      {sheet?.type === 'log' && sheet.purpose !== 'saved' && (
        <LogSheet
          day={logDay}
          today={today}
          apiKey={apiKey}
          savedMeals={savedMeals}
          onManual={() => setSheet({ type: 'form', target: { kind: 'meal', day: logDay } })}
          onEstimate={(draft) => setSheet({ type: 'form', target: { kind: 'meal', day: draft.day, draft } })}
          onOpenProfile={openProfile}
          onQuickAdd={(s) => void quickAdd(s, logDay)}
          onClose={closeSheet}
        />
      )}
      {sheet?.type === 'log' && sheet.purpose === 'saved' && (
        <LogSheet
          title="New frequent meal"
          hideFrequent
          day={today}
          today={today}
          apiKey={apiKey}
          savedMeals={savedMeals}
          onManual={() => setSheet({ type: 'form', target: { kind: 'saved' } })}
          onEstimate={(draft) => setSheet({ type: 'form', target: { kind: 'saved', draft } })}
          onOpenProfile={openProfile}
          onQuickAdd={() => {}}
          onClose={closeSheet}
        />
      )}
      {sheet?.type === 'form' && (
        <MealForm target={sheet.target} today={today} apiKey={apiKey} savedMeals={savedMeals} onClose={closeSheet} />
      )}
    </div>
  );
}
