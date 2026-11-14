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

// Tried in order; the next model is used only when one is overloaded or unavailable.
const MODELS = ['gemini-3.5-flash', 'gemini-2.5-flash'];
const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

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

  let lastError = new AiError('busy', 'The AI service is busy right now. Please try again in a moment.');
  for (const model of MODELS) {
    let res: Response;
    try {
      res = await fetch(`${ENDPOINT}/${model}:generateContent`, {
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
    // 404 (model not available to this key) and 5xx (overloaded): try the next model.
    lastError = new AiError('busy', 'The AI service is busy right now. Please try again in a moment.');
  }
  throw lastError;
}
