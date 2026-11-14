import type { Goals, Meal, SavedMeal } from '../types';

export interface Backup {
  app: 'trackmacros';
  version: 1;
  exportedAt: string;
  meals: Meal[];
  savedMeals: SavedMeal[];
  goals: Goals;
}

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;
const hasMacros = (o: Record<string, unknown>) =>
  isNum(o.calories) && isNum(o.protein) && isNum(o.carbs) && isNum(o.fats) && isNum(o.sugar);

const isMeal = (v: unknown): v is Meal => {
  const o = v as Record<string, unknown>;
  return (
    !!o && isStr(o.id) && isStr(o.name) && hasMacros(o) && isNum(o.createdAt) &&
    typeof o.day === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.day) &&
    typeof o.time === 'string' && /^\d{2}:\d{2}$/.test(o.time)
  );
};

const isSavedMeal = (v: unknown): v is SavedMeal => {
  const o = v as Record<string, unknown>;
  return !!o && isStr(o.id) && isStr(o.name) && hasMacros(o) && isNum(o.uses);
};

/** Reads a backup file's text. Entries that are not valid are dropped; a wrong file throws. */
export function parseBackup(text: string): Pick<Backup, 'meals' | 'savedMeals'> & { goals?: Goals } {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('That file is not a TrackMacros backup.');
  }
  if (!data || data.app !== 'trackmacros' || !Array.isArray(data.meals) || !Array.isArray(data.savedMeals)) {
    throw new Error('That file is not a TrackMacros backup.');
  }
  const goals = data.goals as Record<string, unknown> | undefined;
  return {
    meals: data.meals.filter(isMeal),
    savedMeals: data.savedMeals.filter(isSavedMeal),
    goals: goals && hasMacros(goals) ? (goals as unknown as Goals) : undefined,
  };
}
