import { useEffect, useState, useSyncExternalStore } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db, getApiKey, getGoals, isOnboarded } from './db';
import { dayKey } from './lib/date';
import { DEFAULT_GOALS, type Goals, type Meal, type SavedMeal, type ThemePref } from './types';

/** Today's day key, refreshed when the app comes back into view (so it rolls over at midnight). */
export function useToday(): string {
  const [today, setToday] = useState(() => dayKey());
  useEffect(() => {
    const refresh = () => setToday(dayKey());
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('focus', refresh);
    const timer = window.setInterval(refresh, 60_000);
    return () => {
      document.removeEventListener('visibilitychange', refresh);
      window.removeEventListener('focus', refresh);
      window.clearInterval(timer);
    };
  }, []);
  return today;
}

/** Meals for one day, latest first. */
export function useMealsForDay(day: string): Meal[] {
  return (
    useLiveQuery(async () => {
      const meals = await db.meals.where('day').equals(day).toArray();
      return meals.sort((a, b) => b.time.localeCompare(a.time) || b.createdAt - a.createdAt);
    }, [day]) ?? []
  );
}

/** All meals from `from` to `to` inclusive. */
export function useMealsInRange(from: string, to: string): Meal[] {
  return useLiveQuery(() => db.meals.where('day').between(from, to, true, true).toArray(), [from, to]) ?? [];
}

/** Frequent meals, most used first. */
export function useSavedMeals(): SavedMeal[] {
  return (
    useLiveQuery(async () => {
      const all = await db.savedMeals.toArray();
      return all.sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name));
    }, []) ?? []
  );
}

export function useGoals(): Goals {
  return useLiveQuery(getGoals, []) ?? DEFAULT_GOALS;
}

/** Whether first-run setup is done; undefined while the database is still loading. */
export function useOnboarded(): boolean | undefined {
  return useLiveQuery(isOnboarded, []);
}

export function useApiKey(): string {
  return useLiveQuery(getApiKey, []) ?? '';
}

// Theme preference is a single shared store so every screen sees the same value.
const THEME_KEY = 'tm_theme';

const readTheme = (): ThemePref => {
  const v = localStorage.getItem(THEME_KEY);
  return v === 'light' || v === 'dark' ? v : 'system';
};

const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
const themeListeners = new Set<() => void>();
let themePref: ThemePref = readTheme();

function applyTheme() {
  const dark = themePref === 'dark' || (themePref === 'system' && darkQuery.matches);
  document.documentElement.classList.toggle('dark', dark);
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#121614' : '#FAF6EF');
}

function setThemePref(next: ThemePref) {
  themePref = next;
  localStorage.setItem(THEME_KEY, next);
  applyTheme();
  themeListeners.forEach((notify) => notify());
}

darkQuery.addEventListener('change', applyTheme);
applyTheme();

export function useTheme(): [ThemePref, (pref: ThemePref) => void] {
  const pref = useSyncExternalStore(
    (notify) => {
      themeListeners.add(notify);
      return () => themeListeners.delete(notify);
    },
    () => themePref,
  );
  return [pref, setThemePref];
}
