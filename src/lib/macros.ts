import type { Macros } from '../types';

export const ZERO: Macros = { calories: 0, protein: 0, carbs: 0, fats: 0, sugar: 0 };

export const sumMacros = (items: Macros[]): Macros =>
  items.reduce<Macros>(
    (acc, m) => ({
      calories: acc.calories + m.calories,
      protein: acc.protein + m.protein,
      carbs: acc.carbs + m.carbs,
      fats: acc.fats + m.fats,
      sugar: acc.sugar + m.sugar,
    }),
    ZERO,
  );

export const scaleMacros = (m: Macros, factor: number): Macros => ({
  calories: Math.round(m.calories * factor),
  protein: Math.round(m.protein * factor),
  carbs: Math.round(m.carbs * factor),
  fats: Math.round(m.fats * factor),
  sugar: Math.round(m.sugar * factor),
});

export const pickMacros = (m: Macros): Macros => ({
  calories: m.calories,
  protein: m.protein,
  carbs: m.carbs,
  fats: m.fats,
  sugar: m.sugar,
});

/** Share of the goal reached, clamped to 0..1. A zero goal counts as reached. */
export const progress = (value: number, goal: number): number =>
  goal <= 0 ? 1 : Math.max(0, Math.min(1, value / goal));

export const fmt = (n: number): string => Math.round(n).toLocaleString('en-US');
