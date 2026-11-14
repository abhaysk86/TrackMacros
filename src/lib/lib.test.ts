import { describe, expect, it } from 'vitest';
import { addDays, dayKey, diffDays, formatTime, relativeLabel } from './date';
import { progress, scaleMacros, sumMacros } from './macros';

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
