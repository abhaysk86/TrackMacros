import { MealLog, SavedMeal, UserSettings } from '../types';

const KEYS = {
  LOGS: 'trackmacros_logs',
  SAVED_MEALS: 'trackmacros_saved_meals',
  SETTINGS: 'trackmacros_settings',
};

// Helper to handle dates
export const getStartOfDay = (date: Date): number => {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

export const getEndOfDay = (date: Date): number => {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d.getTime();
};

export const StorageService = {
  // Settings
  getSettings: (): UserSettings | null => {
    const data = localStorage.getItem(KEYS.SETTINGS);
    return data ? JSON.parse(data) : null;
  },
  saveSettings: (settings: UserSettings) => {
    localStorage.setItem(KEYS.SETTINGS, JSON.stringify(settings));
  },
  clearAll: () => {
    localStorage.clear();
  },

  // Logs
  getLogs: (): MealLog[] => {
    const data = localStorage.getItem(KEYS.LOGS);
    return data ? JSON.parse(data) : [];
  },
  addLog: (log: MealLog) => {
    const logs = StorageService.getLogs();
    logs.push(log);
    // Sort by timestamp descending
    logs.sort((a, b) => b.timestamp - a.timestamp);
    localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
  },
  deleteLog: (id: string) => {
    let logs = StorageService.getLogs();
    logs = logs.filter(l => l.id !== id);
    localStorage.setItem(KEYS.LOGS, JSON.stringify(logs));
  },
  getLogsForDate: (date: Date): MealLog[] => {
    const logs = StorageService.getLogs();
    const start = getStartOfDay(date);
    const end = getEndOfDay(date);
    return logs.filter(log => log.timestamp >= start && log.timestamp <= end);
  },

  // Saved Meals
  getSavedMeals: (): SavedMeal[] => {
    const data = localStorage.getItem(KEYS.SAVED_MEALS);
    return data ? JSON.parse(data) : [];
  },
  addSavedMeal: (meal: SavedMeal) => {
    const meals = StorageService.getSavedMeals();
    meals.push(meal);
    localStorage.setItem(KEYS.SAVED_MEALS, JSON.stringify(meals));
  },
  deleteSavedMeal: (id: string) => {
    let meals = StorageService.getSavedMeals();
    meals = meals.filter(m => m.id !== id);
    localStorage.setItem(KEYS.SAVED_MEALS, JSON.stringify(meals));
  }
};