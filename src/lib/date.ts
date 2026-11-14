// Days are handled as local YYYY-MM-DD strings so a meal never shifts day
// because of a UTC conversion.

const pad = (n: number) => String(n).padStart(2, '0');

export const dayKey = (d: Date = new Date()): string =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const parseDay = (key: string): Date => {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const addDays = (key: string, n: number): string => {
  const d = parseDay(key);
  d.setDate(d.getDate() + n);
  return dayKey(d);
};

/** Whole days from `from` to `to` (positive when `to` is later). */
export const diffDays = (from: string, to: string): number =>
  Math.round((parseDay(to).getTime() - parseDay(from).getTime()) / 86_400_000);

export const relativeLabel = (key: string, today: string): string => {
  const n = diffDays(key, today);
  if (n === 0) return 'Today';
  if (n === 1) return 'Yesterday';
  return `${n} days ago`;
};

export const longDate = (key: string): string =>
  parseDay(key).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });

export const shortDate = (key: string): string =>
  parseDay(key).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });

export const weekdayShort = (key: string): string =>
  parseDay(key).toLocaleDateString('en-GB', { weekday: 'short' });

export const nowTime = (d: Date = new Date()): string => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

/** "13:15" -> "1:15 pm" */
export const formatTime = (time: string): string => {
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'pm' : 'am';
  return `${h % 12 === 0 ? 12 : h % 12}:${pad(m)} ${suffix}`;
};
