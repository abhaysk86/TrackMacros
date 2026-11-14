import type { Macros } from '../types';
import { formatTime, longDate } from './date';

export interface Estimate extends Macros {
  name: string;
  day: string;
  time: string;
}

export type AiErrorKind = 'key' | 'quota' | 'busy' | 'network' | 'unreadable';

export class AiError extends Error {
  constructor(public kind: AiErrorKind, message: string) {
    super(message);
  }
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Used only when Google's model list cannot be fetched.
const FALLBACK_MODELS = ['gemini-3.5-flash', 'gemini-2.5-flash'];
const MODELS_CACHE_KEY = 'tm_models';
const MODELS_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

interface ListedModel {
  name: string;
  supportedGenerationMethods?: string[];
}

// Stable Flash models only: no previews, experiments, "lite" or special-purpose variants.
const FLASH_RE = /^models\/(gemini-(\d+)(?:\.(\d+))?-flash)$/;

/** Picks the newest stable Flash models from Google's list, newest first. */
export function pickModels(listed: ListedModel[]): string[] {
  return listed
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => FLASH_RE.exec(m.name))
    .filter((match): match is RegExpExecArray => match !== null)
    .map((match) => ({ id: match[1], major: Number(match[2]), minor: Number(match[3] ?? 0) }))
    .sort((x, y) => y.major - x.major || y.minor - x.minor)
    .slice(0, 3)
    .map((m) => m.id);
}

async function fetchModelList(apiKey: string): Promise<string[]> {
  const listed: ListedModel[] = [];
  let pageToken = '';
  for (let page = 0; page < 5; page++) {
    const res = await fetch(`${ENDPOINT}?pageSize=1000${pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : ''}`, {
      headers: { 'x-goog-api-key': apiKey },
    });
    if (!res.ok) throw new Error(`model list failed: ${res.status}`);
    const json = await res.json();
    listed.push(...((json.models as ListedModel[] | undefined) ?? []));
    pageToken = json.nextPageToken ?? '';
    if (!pageToken) break;
  }
  return pickModels(listed);
}

/**
 * The models to try, newest first. The list comes from Google and is refreshed
 * weekly, or at once when `refresh` is set, so a retired model heals itself.
 */
async function resolveModels(apiKey: string, refresh = false): Promise<string[]> {
  let cached: { at: number; models: string[] } | null = null;
  try {
    cached = JSON.parse(localStorage.getItem(MODELS_CACHE_KEY) ?? 'null');
  } catch {
    cached = null;
  }
  if (!refresh && cached?.models?.length && Date.now() - cached.at < MODELS_MAX_AGE) return cached.models;
  try {
    const models = await fetchModelList(apiKey);
    if (models.length) {
      localStorage.setItem(MODELS_CACHE_KEY, JSON.stringify({ at: Date.now(), models }));
      return models;
    }
  } catch {
    /* fall through to the last known list */
  }
  return cached?.models?.length ? cached.models : FALLBACK_MODELS;
}

const RESPONSE_SCHEMA = {
  type: 'OBJECT',
  properties: {
    name: { type: 'STRING', description: 'Short descriptive meal name, at most 6 words.' },
    calories: { type: 'NUMBER' },
    protein: { type: 'NUMBER', description: 'grams' },
    carbs: { type: 'NUMBER', description: 'grams' },
    fats: { type: 'NUMBER', description: 'grams' },
    addedSugar: { type: 'NUMBER', description: 'grams of added sugar only, not natural sugar' },
    date: { type: 'STRING', description: 'YYYY-MM-DD the meal was eaten' },
    time: { type: 'STRING', description: 'HH:mm, 24-hour, the meal was eaten' },
  },
  required: ['name', 'calories', 'protein', 'carbs', 'fats', 'addedSugar', 'date', 'time'],
};

const buildPrompt = (text: string, today: string, now: string) => `You are a nutrition expert estimating the content of one meal.

Current local date: ${today} (${longDate(today)}). Current local time: ${now}.
${text ? `The user wrote: "${text}"` : 'The user sent a photo with no description.'}

Do this:
1. Identify the food and estimate the portion actually shown or described.
2. Estimate calories, protein, carbs, fats and ADDED sugar (sugar added in cooking or processing; not sugar naturally in fruit or milk) for that portion.
3. Work out when it was eaten. If the user gives a day or time ("yesterday", "at 8am", "on the 10th"), resolve it against the current date and time. A named meal with no time means a typical time for it (breakfast 08:30, lunch 13:00, dinner 20:00). Otherwise use the current date and time. Never return a future date.
4. Give a short, plain name for the meal.

Round every number to a whole number. Reply with JSON only.`;

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const num = (v: unknown) => Math.max(0, Math.round(Number(v) || 0));

/** Turns the model's reply into a safe estimate, falling back to now for bad dates. */
export function parseEstimate(raw: string, today: string, now: string): Estimate {
  let data: Record<string, unknown>;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new AiError('unreadable', 'The estimate came back in an unexpected form. Please try again.');
  }
  const day = typeof data.date === 'string' && DAY_RE.test(data.date) && data.date <= today ? data.date : today;
  const time = typeof data.time === 'string' && TIME_RE.test(data.time) ? data.time : now;
  const name = typeof data.name === 'string' && data.name.trim() ? data.name.trim().slice(0, 80) : 'Meal';
  return {
    name, day, time,
    calories: num(data.calories), protein: num(data.protein), carbs: num(data.carbs),
    fats: num(data.fats), sugar: num(data.addedSugar),
  };
}

interface EstimateRequest {
  apiKey: string;
  text: string;
  imageBase64?: string;
  today: string;
  now: string;
}

export async function estimateMeal({ apiKey, text, imageBase64, today, now }: EstimateRequest): Promise<Estimate> {
  const parts: unknown[] = [{ text: buildPrompt(text.trim(), today, formatTime(now)) }];
  if (imageBase64) parts.push({ inline_data: { mime_type: 'image/jpeg', data: imageBase64 } });
  const body = JSON.stringify({
    contents: [{ parts }],
    generationConfig: { responseMimeType: 'application/json', responseSchema: RESPONSE_SCHEMA },
  });

  const busy = () => new AiError('busy', 'The AI service is busy right now. Please try again in a moment.');
  let models = await resolveModels(apiKey);
  let refreshed = false;

  for (let i = 0; i < models.length; i++) {
    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}/${models[i]}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
        body,
      });
    } catch {
      throw new AiError('network', 'No connection. Check your internet and try again.');
    }

    if (res.ok) {
      const json = await res.json();
      const reply = json?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (typeof reply !== 'string') {
        throw new AiError('unreadable', 'The AI could not estimate that. Try a clearer photo or description.');
      }
      return parseEstimate(reply, today, now);
    }

    if (res.status === 429) {
      throw new AiError('quota', 'Your Gemini key has hit its usage limit. Wait a minute, or enter the meal yourself.');
    }
    if (res.status === 400 || res.status === 401 || res.status === 403) {
      throw new AiError('key', 'Your Gemini key was not accepted. Check it in Profile.');
    }

    // 404 means the model has been retired or renamed; 5xx means it is overloaded.
    // Either way the next model is tried. If a model was missing and the whole list
    // is exhausted, fetch a fresh list from Google once and try any new models.
    if (res.status === 404 && i === models.length - 1 && !refreshed) {
      refreshed = true;
      const fresh = (await resolveModels(apiKey, true)).filter((m) => !models.includes(m));
      if (fresh.length) {
        models = fresh;
        i = -1;
      }
    }
  }
  throw busy();
}
