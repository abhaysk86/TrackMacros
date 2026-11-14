import type { Goals } from '../types';

export type Sex = 'male' | 'female';
export type Activity = 'sedentary' | 'light' | 'moderate' | 'very';
export type Aim = 'lose' | 'maintain' | 'gain';

export interface BodyProfile {
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  activity: Activity;
  aim: Aim;
}

export const ACTIVITY_OPTIONS: { value: Activity; label: string; hint: string; factor: number }[] = [
  { value: 'sedentary', label: 'Mostly sitting', hint: 'little exercise', factor: 1.2 },
  { value: 'light', label: 'Lightly active', hint: '1 to 3 days a week', factor: 1.375 },
  { value: 'moderate', label: 'Active', hint: '3 to 5 days a week', factor: 1.55 },
  { value: 'very', label: 'Very active', hint: 'hard exercise most days', factor: 1.725 },
];

export const AIM_OPTIONS: { value: Aim; label: string; calorieShift: number; proteinPerKg: number }[] = [
  { value: 'lose', label: 'Lose weight', calorieShift: -500, proteinPerKg: 1.8 },
  { value: 'maintain', label: 'Stay the same', calorieShift: 0, proteinPerKg: 1.6 },
  { value: 'gain', label: 'Build muscle', calorieShift: 300, proteinPerKg: 1.8 },
];

const roundTo = (value: number, step: number) => Math.round(value / step) * step;

/**
 * Suggests daily goals from a body profile.
 * Energy needs use the Mifflin-St Jeor equation times an activity factor.
 * Protein is set per kg of body weight, fat at 27% of calories, carbs take the
 * rest, and added sugar is capped at 6% of calories. These are general starting
 * points, not medical advice.
 */
export function suggestGoals(p: BodyProfile): Goals {
  const bmr = 10 * p.weightKg + 6.25 * p.heightCm - 5 * p.age + (p.sex === 'male' ? 5 : -161);
  const activity = ACTIVITY_OPTIONS.find((a) => a.value === p.activity)!;
  const aim = AIM_OPTIONS.find((a) => a.value === p.aim)!;
  const floor = p.sex === 'male' ? 1500 : 1200;

  const calories = Math.max(floor, roundTo(bmr * activity.factor + aim.calorieShift, 50));
  const protein = roundTo(p.weightKg * aim.proteinPerKg, 5);
  const fats = roundTo((calories * 0.27) / 9, 5);
  const carbs = Math.max(0, roundTo((calories - protein * 4 - fats * 9) / 4, 5));
  const sugar = roundTo((calories * 0.06) / 4, 5);
  return { calories, protein, carbs, fats, sugar };
}

export const isValidProfile = (p: BodyProfile): boolean =>
  p.age >= 14 && p.age <= 100 && p.heightCm >= 120 && p.heightCm <= 230 && p.weightKg >= 30 && p.weightKg <= 250;
