export interface Macros {
  calories: number;
  protein: number;
  carbs: number;
  fats: number;
  addedSugar: number;
}

export interface MealLog extends Macros {
  id: string;
  name: string;
  timestamp: number; // Unix timestamp
  imageUri?: string; // Base64 or URL
}

export interface SavedMeal extends Macros {
  id: string;
  name: string;
  keywords: string[]; // For basic matching
}

export interface UserSettings {
  apiKey: string;
  calorieGoal: number;
  activeModel: string;
}

export type ViewState = 'SETUP' | 'DASHBOARD' | 'SAVED_MEALS' | 'SETTINGS';

export interface DailySummary extends Macros {
  date: string; // YYYY-MM-DD
}

export const DEFAULT_MODEL = 'gemini-2.5-flash';
