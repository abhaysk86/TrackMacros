import Dexie, { type EntityTable } from 'dexie';
import { DEFAULT_GOALS, type Goals, type Macros, type Meal, type SavedMeal } from './types';
import { nowTime } from './lib/date';
import { pickMacros } from './lib/macros';
import type { Backup } from './lib/backup';

interface Setting {
  key: string;
  value: unknown;
}

// The database keeps its original name so existing installs keep their data.
export const db = new Dexie('trackmacros') as Dexie & {
  meals: EntityTable<Meal, 'id'>;
  savedMeals: EntityTable<SavedMeal, 'id'>;
  settings: EntityTable<Setting, 'key'>;
};

db.version(1).stores({
  meals: 'id, day',
  savedMeals: 'id, name',
  settings: 'key',
});

const newId = () => crypto.randomUUID();

export type MealInput = Macros & Pick<Meal, 'name' | 'day' | 'time' | 'source' | 'thumb' | 'grams'>;

export async function addMeal(input: MealInput): Promise<Meal> {
  const meal: Meal = { ...input, id: newId(), createdAt: Date.now() };
  await db.meals.add(meal);
  return meal;
}

export const updateMeal = (id: string, changes: Partial<Meal>) => db.meals.update(id, changes);
export const deleteMeal = (id: string) => db.meals.delete(id);
/** Puts back a meal removed by deleteMeal (used by Undo). */
export const restoreMeal = (meal: Meal) => db.meals.put(meal);

export async function addSavedMeal(name: string, macros: Macros): Promise<SavedMeal> {
  const saved: SavedMeal = { ...pickMacros(macros), id: newId(), name, uses: 0, createdAt: Date.now() };
  await db.savedMeals.add(saved);
  return saved;
}

export const updateSavedMeal = (id: string, changes: Partial<SavedMeal>) => db.savedMeals.update(id, changes);
export const deleteSavedMeal = (id: string) => db.savedMeals.delete(id);
export const restoreSavedMeal = (saved: SavedMeal) => db.savedMeals.put(saved);

/** Logs a frequent meal to the given day at the current time. */
export async function logSavedMeal(saved: SavedMeal, day: string): Promise<Meal> {
  const meal = await addMeal({ ...pickMacros(saved), name: saved.name, day, time: nowTime(), source: 'saved' });
  await db.savedMeals.update(saved.id, { uses: saved.uses + 1 });
  return meal;
}

/** Reverses logSavedMeal. */
export async function undoLogSavedMeal(meal: Meal, saved: SavedMeal): Promise<void> {
  await db.meals.delete(meal.id);
  await db.savedMeals.update(saved.id, { uses: saved.uses });
}

export async function getGoals(): Promise<Goals> {
  const row = await db.settings.get('goals');
  return { ...DEFAULT_GOALS, ...((row?.value as Partial<Goals>) ?? {}) };
}

export const setGoals = (goals: Goals) => db.settings.put({ key: 'goals', value: goals });

/** The user's own Gemini key. It is stored only in this browser. */
export async function getApiKey(): Promise<string> {
  const row = await db.settings.get('geminiKey');
  return typeof row?.value === 'string' ? row.value : '';
}

export const setApiKey = (key: string) =>
  key ? db.settings.put({ key: 'geminiKey', value: key }) : db.settings.delete('geminiKey');

export async function isOnboarded(): Promise<boolean> {
  return (await db.settings.get('onboarded'))?.value === true;
}

export const setOnboarded = () => db.settings.put({ key: 'onboarded', value: true });

/** Everything needed to restore the app on another device. The Gemini key is left out on purpose. */
export async function exportBackup(): Promise<Backup> {
  return {
    app: 'mealglimpse',
    version: 1,
    exportedAt: new Date().toISOString(),
    meals: await db.meals.toArray(),
    savedMeals: await db.savedMeals.toArray(),
    goals: await getGoals(),
  };
}

/** Adds a backup's contents to what is already here; entries with the same id are replaced. */
export async function importBackup(backup: Pick<Backup, 'meals' | 'savedMeals'> & { goals?: Goals }): Promise<void> {
  await db.transaction('rw', db.meals, db.savedMeals, db.settings, async () => {
    await db.meals.bulkPut(backup.meals);
    await db.savedMeals.bulkPut(backup.savedMeals);
    if (backup.goals) await setGoals(backup.goals);
  });
}

/** Removes every meal, frequent meal and setting from this device. */
export async function deleteAllData(): Promise<void> {
  await db.transaction('rw', db.meals, db.savedMeals, db.settings, async () => {
    await Promise.all([db.meals.clear(), db.savedMeals.clear(), db.settings.clear()]);
  });
}
