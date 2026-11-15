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

const NUMBER_WORDS: Record<string, number> = {
  half: 0.5, a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
};
// Words that describe amount or size but do not identify the food.
const FILLER = new Set(['of', 'the', 'x', 'piece', 'pieces', 'pc', 'pcs', 'medium', 'large', 'small', 'big', 'serving', 'servings', 'plate', 'bowl', 'cup', 'glass']);

export interface ParsedQuery {
  /** How many servings were asked for; 1 when no amount was typed. */
  quantity: number;
  words: string[];
}

/** Splits "2 boiled eggs" into a quantity and the words that name the food. */
export function parseQuery(query: string): ParsedQuery {
  let quantity = 1;
  const words: string[] = [];
  for (const token of query.toLowerCase().replace(/[,.+]/g, ' ').split(/\s+/).filter(Boolean)) {
    if (/^\d+(\.\d+)?$/.test(token)) quantity = Number(token);
    else if (token === '½') quantity = 0.5;
    else if (token in NUMBER_WORDS && words.length === 0) quantity = NUMBER_WORDS[token];
    else if (!FILLER.has(token)) words.push(token);
  }
  return { quantity: quantity > 0 && quantity <= 20 ? quantity : 1, words };
}

// A typed word matches when the food text contains it, or its singular form.
const wordMatches = (text: string, word: string) =>
  text.includes(word) || (word.endsWith('es') && text.includes(word.slice(0, -2))) || (word.endsWith('s') && text.includes(word.slice(0, -1)));

interface Scored {
  food: Food;
  matched: number;
  rank: number;
}

const singular = (word: string) => (word.length > 3 && word.endsWith('s') ? word.slice(0, -1) : word);

/**
 * How closely a food's name fits what was typed; lower is better.
 * 0: the name is exactly the phrase. 1: an alias is exactly the phrase.
 * 2: the name starts with it. 3: the name contains it. 4: matched some other way.
 */
function fit(food: Food, phrases: string[]): number {
  const name = food.name.toLowerCase();
  const aliases = (food.aliases ?? []).map((a) => a.toLowerCase());
  if (phrases.includes(name)) return 0;
  if (phrases.some((p) => aliases.includes(p))) return 1;
  if (phrases.some((p) => name.startsWith(p))) return 2;
  if (phrases.some((p) => name.includes(p))) return 3;
  return 4;
}

function score(query: string, foods: Food[]): { scored: Scored[]; parsed: ParsedQuery } {
  const parsed = parseQuery(query);
  // The phrase as typed, and with plurals removed ("rotis" -> "roti").
  const phrases = [...new Set([parsed.words.join(' '), parsed.words.map(singular).join(' ')])];
  const scored = foods
    .map((food) => {
      const text = haystack(food);
      return { food, matched: parsed.words.filter((w) => wordMatches(text, w)).length, rank: fit(food, phrases) };
    })
    .filter((s) => s.matched > 0)
    .sort(
      (a, b) =>
        b.matched - a.matched || a.rank - b.rank || a.food.name.length - b.food.name.length || a.food.name.localeCompare(b.food.name),
    );
  return { scored, parsed };
}

/**
 * Suggestions for what has been typed, best match first. One or two words must
 * all match; with three or more, one stray word (such as "whole") is allowed.
 */
export function searchFoods(query: string, limit = 6, foods: Food[] = FOODS): Food[] {
  const { scored, parsed } = score(query, foods);
  const total = parsed.words.length;
  if (parsed.words.join('').length < 2) return [];
  const needed = total >= 3 ? total - 1 : total;
  return scored.filter((s) => s.matched >= needed).slice(0, limit).map((s) => s.food);
}

/**
 * The single food a typed entry clearly refers to, with its quantity, or null.
 * Used to log straight from the food list instead of asking the AI. Every word
 * must match, and one food must stand out from the rest.
 */
export function matchFood(query: string, foods: Food[] = FOODS): { food: Food; quantity: number } | null {
  const { scored, parsed } = score(query, foods);
  if (parsed.words.join('').length < 2) return null;
  const full = scored.filter((s) => s.matched === parsed.words.length);
  if (full.length === 0) return null;
  if (full.length > 1 && full[0].rank >= full[1].rank) return null;
  return { food: full[0].food, quantity: parsed.quantity };
}
