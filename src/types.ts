export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  /** Added sugar, in grams. */
  sugar: number;
}

export type MacroKey = keyof Macros;

export interface Meal extends Macros {
  id: string;
  name: string;
  /** Local calendar day, YYYY-MM-DD. */
  day: string;
  /** Local time of day, HH:mm (24-hour). */
  time: string;
  source: 'manual' | 'saved' | 'ai' | 'library';
  createdAt: number;
}

export interface SavedMeal extends Macros {
  id: string;
  name: string;
  uses: number;
  createdAt: number;
}

export type Goals = Macros;

export type ThemePref = 'system' | 'light' | 'dark';

export const DEFAULT_GOALS: Goals = { calories: 2000, protein: 130, carbs: 220, fats: 65, sugar: 30 };

export const MACRO_META: { key: Exclude<MacroKey, 'calories'>; label: string; color: string }[] = [
  { key: 'protein', label: 'Protein', color: 'var(--protein)' },
  { key: 'carbs', label: 'Carbs', color: 'var(--carbs)' },
  { key: 'fats', label: 'Fats', color: 'var(--fats)' },
  { key: 'sugar', label: 'Sugar', color: 'var(--sugar)' },
];
