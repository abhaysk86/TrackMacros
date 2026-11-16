import type { Macros, Meal } from '../types';
import { parseQuery, wordMatches } from './foods';
import { pickMacros } from './macros';

/** A meal the user has logged before, offered again with the numbers they confirmed. */
export interface PastMeal extends Macros {
  name: string;
  /** The day it was last logged. */
  day: string;
  /** The weight logged that time, when it was known. */
  grams?: number;
}

/**
 * The most recent version of each distinct meal name, newest first.
 * Names in `exclude` (frequent meals, which have their own list) are left out.
 */
export function pastMeals(meals: Meal[], exclude: string[] = []): PastMeal[] {
  const skip = new Set(exclude.map((n) => n.trim().toLowerCase()));
  const latest = new Map<string, Meal>();
  for (const meal of meals) {
    const key = meal.name.trim().toLowerCase();
    if (!key || skip.has(key)) continue;
    const seen = latest.get(key);
    if (!seen || meal.createdAt > seen.createdAt) latest.set(key, meal);
  }
  return [...latest.values()]
    .sort((a, b) => b.createdAt - a.createdAt)
    .map((m) => ({ ...pickMacros(m), name: m.name, day: m.day, ...(m.grams ? { grams: m.grams } : {}) }));
}

/** Past meals whose name contains every word typed. */
export function searchPast(past: PastMeal[], query: string, limit = 4): PastMeal[] {
  const { words } = parseQuery(query);
  if (words.join('').length < 2) return [];
  return past.filter((p) => words.every((w) => wordMatches(p.name.toLowerCase(), w))).slice(0, limit);
}
