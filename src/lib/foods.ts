import foodsJson from '../data/foods.json';
import type { Macros } from '../types';

export interface Food extends Macros {
  id: string;
  name: string;
  brand?: string;
  /** Human-readable serving, e.g. "1 large (50 g)". Values are for this serving. */
  serving: string;
  /** True when added sugar is not published and total sugar is shown instead. */
  sugarApprox?: boolean;
  aliases?: string[];
  source: string;
}

export const FOODS = foodsJson as Food[];

const haystack = (f: Food) => [f.name, f.brand ?? '', ...(f.aliases ?? [])].join(' ').toLowerCase();

/**
 * Foods matching every word typed, best match first: names that start with the
 * query, then names containing it, then matches on brand or alias only.
 */
export function searchFoods(query: string, limit = 6, foods: Food[] = FOODS): Food[] {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const words = q.split(/\s+/);
  const rank = (f: Food) => {
    const name = f.name.toLowerCase();
    return name.startsWith(q) ? 0 : name.includes(q) ? 1 : 2;
  };
  return foods
    .filter((f) => {
      const text = haystack(f);
      return words.every((w) => text.includes(w));
    })
    .sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name))
    .slice(0, limit);
}
