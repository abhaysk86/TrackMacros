import { describe, expect, it } from 'vitest';
import { addDays, dayKey, diffDays, formatTime, relativeLabel } from './date';
import { progress, scaleMacros, sumMacros } from './macros';
import { parseEstimate, pickModels } from './ai';
import { isValidProfile, suggestGoals, type BodyProfile } from './goals';
import { parseBackup } from './backup';
import { FOODS, searchFoods } from './foods';

describe('date helpers', () => {
  it('builds a local day key', () => {
    expect(dayKey(new Date(2026, 10, 14, 0, 30))).toBe('2026-11-14');
    expect(dayKey(new Date(2026, 10, 14, 23, 59))).toBe('2026-11-14');
  });
  it('adds days across month and year ends', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31');
  });
  it('counts days between keys', () => {
    expect(diffDays('2026-11-12', '2026-11-14')).toBe(2);
    expect(diffDays('2026-11-14', '2026-11-12')).toBe(-2);
  });
  it('labels days relative to today', () => {
    expect(relativeLabel('2026-11-14', '2026-11-14')).toBe('Today');
    expect(relativeLabel('2026-11-13', '2026-11-14')).toBe('Yesterday');
    expect(relativeLabel('2026-11-12', '2026-11-14')).toBe('2 days ago');
  });
  it('formats 24-hour times', () => {
    expect(formatTime('00:05')).toBe('12:05 am');
    expect(formatTime('12:00')).toBe('12:00 pm');
    expect(formatTime('13:15')).toBe('1:15 pm');
  });
});

describe('macro helpers', () => {
  const a = { calories: 390, protein: 24, carbs: 31, fats: 19, sugar: 2 };
  const b = { calories: 91, protein: 4, carbs: 9, fats: 4, sugar: 5 };
  it('sums meals', () => {
    expect(sumMacros([a, b])).toEqual({ calories: 481, protein: 28, carbs: 40, fats: 23, sugar: 7 });
    expect(sumMacros([])).toEqual({ calories: 0, protein: 0, carbs: 0, fats: 0, sugar: 0 });
  });
  it('scales by portion and rounds', () => {
    expect(scaleMacros(b, 1.5)).toEqual({ calories: 137, protein: 6, carbs: 14, fats: 6, sugar: 8 });
  });
  it('clamps progress', () => {
    expect(progress(50, 100)).toBe(0.5);
    expect(progress(150, 100)).toBe(1);
    expect(progress(10, 0)).toBe(1);
  });
});

describe('parseEstimate', () => {
  const today = '2026-11-14';
  const reply = (over: object = {}) =>
    JSON.stringify({ name: 'Dal chawal', calories: 489.6, protein: 18, carbs: 78, fats: 11, addedSugar: 3, date: '2026-11-13', time: '13:40', ...over });

  it('reads a normal reply and rounds numbers', () => {
    expect(parseEstimate(reply(), today, '20:00')).toEqual({
      name: 'Dal chawal', day: '2026-11-13', time: '13:40', calories: 490, protein: 18, carbs: 78, fats: 11, sugar: 3,
    });
  });
  it('falls back to now for future or malformed dates and times', () => {
    const e = parseEstimate(reply({ date: '2026-11-20', time: '25:00' }), today, '20:00');
    expect(e.day).toBe(today);
    expect(e.time).toBe('20:00');
    expect(parseEstimate(reply({ date: 'yesterday' }), today, '20:00').day).toBe(today);
  });
  it('never returns negative or non-numeric values', () => {
    const e = parseEstimate(reply({ calories: -50, protein: 'lots', name: '  ' }), today, '20:00');
    expect(e.calories).toBe(0);
    expect(e.protein).toBe(0);
    expect(e.name).toBe('Meal');
  });
  it('rejects a reply that is not JSON', () => {
    expect(() => parseEstimate('sorry, no', today, '20:00')).toThrow();
  });
});

describe('pickModels', () => {
  const gen = ['generateContent', 'countTokens'];
  it('picks the newest stable Flash models, newest first', () => {
    const picked = pickModels([
      { name: 'models/gemini-2.5-flash', supportedGenerationMethods: gen },
      { name: 'models/gemini-4.0-flash', supportedGenerationMethods: gen },
      { name: 'models/gemini-3.5-flash', supportedGenerationMethods: gen },
      { name: 'models/gemini-3-flash', supportedGenerationMethods: gen },
      { name: 'models/gemini-2.0-flash', supportedGenerationMethods: gen },
    ]);
    expect(picked).toEqual(['gemini-4.0-flash', 'gemini-3.5-flash', 'gemini-3-flash']);
  });
  it('ignores previews, lite, pro, special-purpose and non-generating models', () => {
    const picked = pickModels([
      { name: 'models/gemini-4.5-flash-preview', supportedGenerationMethods: gen },
      { name: 'models/gemini-3.5-flash-lite', supportedGenerationMethods: gen },
      { name: 'models/gemini-3.5-pro', supportedGenerationMethods: gen },
      { name: 'models/gemini-3.5-flash-image', supportedGenerationMethods: gen },
      { name: 'models/gemini-flash-latest', supportedGenerationMethods: gen },
      { name: 'models/gemini-9.0-flash', supportedGenerationMethods: ['embedContent'] },
      { name: 'models/gemini-9.5-flash' },
      { name: 'models/gemini-2.5-flash', supportedGenerationMethods: gen },
    ]);
    expect(picked).toEqual(['gemini-2.5-flash']);
  });
  it('treats Gemini 4 Hydrogen as the fast tier, ahead of older Flash models', () => {
    const picked = pickModels([
      { name: 'models/gemini-3.8-flash', supportedGenerationMethods: gen },
      { name: 'models/gemini-4-hydrogen', supportedGenerationMethods: gen },
      { name: 'models/gemini-4-argon', supportedGenerationMethods: gen },
      { name: 'models/gemini-4-hydrogen-preview', supportedGenerationMethods: gen },
      { name: 'models/gemini-3.6-flash', supportedGenerationMethods: gen },
    ]);
    expect(picked).toEqual(['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-3.6-flash']);
  });
  it('returns nothing for an empty list', () => {
    expect(pickModels([])).toEqual([]);
  });
});

describe('suggestGoals', () => {
  const base: BodyProfile = { sex: 'male', age: 40, heightCm: 175, weightKg: 80, activity: 'light', aim: 'maintain' };
  it('matches a hand-worked example', () => {
    // BMR = 800 + 1093.75 - 200 + 5 = 1698.75; x 1.375 = 2335.8 -> 2350 kcal
    // protein 80 x 1.6 = 128 -> 130 g; fat 2350 x 0.27 / 9 = 70.5 -> 70 g
    // carbs (2350 - 520 - 630) / 4 = 300 g; sugar 2350 x 0.06 / 4 = 35.25 -> 35 g
    expect(suggestGoals(base)).toEqual({ calories: 2350, protein: 130, carbs: 300, fats: 70, sugar: 35 });
  });
  it('lowers calories to lose weight and raises them to gain', () => {
    expect(suggestGoals({ ...base, aim: 'lose' }).calories).toBe(1850);
    expect(suggestGoals({ ...base, aim: 'gain' }).calories).toBe(2650);
  });
  it('never goes below a safe calorie floor', () => {
    const small: BodyProfile = { sex: 'female', age: 60, heightCm: 150, weightKg: 45, activity: 'sedentary', aim: 'lose' };
    expect(suggestGoals(small).calories).toBe(1200);
    expect(suggestGoals(small).carbs).toBeGreaterThanOrEqual(0);
  });
  it('validates plausible ranges', () => {
    expect(isValidProfile(base)).toBe(true);
    expect(isValidProfile({ ...base, age: 5 })).toBe(false);
    expect(isValidProfile({ ...base, weightKg: 0 })).toBe(false);
  });
});

describe('parseBackup', () => {
  const meal = { id: 'm1', name: 'Dal', day: '2026-11-14', time: '13:00', source: 'manual', createdAt: 1, calories: 400, protein: 15, carbs: 60, fats: 8, sugar: 0 };
  const saved = { id: 's1', name: 'Coffee', uses: 3, createdAt: 1, calories: 91, protein: 4, carbs: 9, fats: 4, sugar: 5 };
  const file = (over: object = {}) => JSON.stringify({ app: 'trackmacros', version: 1, exportedAt: 'x', meals: [meal], savedMeals: [saved], goals: { calories: 2000, protein: 130, carbs: 220, fats: 65, sugar: 30 }, ...over });

  it('reads a valid backup', () => {
    const b = parseBackup(file());
    expect(b.meals).toHaveLength(1);
    expect(b.savedMeals).toHaveLength(1);
    expect(b.goals?.calories).toBe(2000);
  });
  it('drops broken entries and keeps good ones', () => {
    const b = parseBackup(file({ meals: [meal, { ...meal, id: 'm2', day: '14/11/2026' }, { id: 'm3' }, null] }));
    expect(b.meals.map((m) => m.id)).toEqual(['m1']);
  });
  it('rejects files that are not backups', () => {
    expect(() => parseBackup('hello')).toThrow();
    expect(() => parseBackup(JSON.stringify({ app: 'other', meals: [], savedMeals: [] }))).toThrow();
  });
});

describe('food library', () => {
  it('ships with a full set of valid entries', () => {
    expect(FOODS.length).toBeGreaterThan(100);
    for (const f of FOODS) {
      expect(f.name && f.serving && f.source).toBeTruthy();
      for (const k of ['calories', 'protein', 'carbs', 'fats', 'sugar'] as const) {
        expect(Number.isFinite(f[k]) && f[k] >= 0, `${f.name} ${k}`).toBe(true);
      }
      expect(f.sugar, `${f.name} sugar within carbs`).toBeLessThanOrEqual(f.carbs + 0.5);
    }
    expect(new Set(FOODS.map((f) => f.id)).size).toBe(FOODS.length);
  });
  it('finds foods by name, alias and brand', () => {
    expect(searchFoods('boiled egg')[0].name).toBe('Boiled egg');
    expect(searchFoods('coke').map((f) => f.name)).toContain('Coca-Cola');
    expect(searchFoods('lays').length).toBe(2);
    expect(searchFoods('chawal')[0].name).toBe('White rice, cooked');
    expect(searchFoods('amul').every((f) => f.brand === 'Amul')).toBe(true);
  });
  it('ranks names that start with the query first and needs two characters', () => {
    expect(searchFoods('dal')[0].name).toBe('Dal');
    expect(searchFoods('e')).toEqual([]);
    expect(searchFoods('zzzz')).toEqual([]);
  });
});
