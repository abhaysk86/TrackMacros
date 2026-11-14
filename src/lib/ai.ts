import type { Macros } from '../types';
import { buildRequest } from '../../supabase/functions/estimate/prompt';

export interface Estimate extends Macros {
  name: string;
  day: string;
  time: string;
}

export type AiErrorKind = 'key' | 'quota' | 'busy' | 'network' | 'unreadable' | 'limit' | 'paused';

export class AiError extends Error {
  constructor(public kind: AiErrorKind, message: string) {
    super(message);
  }
}

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

// Used only when Google's model list cannot be fetched.
const FALLBACK_MODELS = ['gemini-4-hydrogen', 'gemini-3.5-flash', 'gemini-2.5-flash'];
const MODELS_CACHE_KEY = 'tm_models';
const MODELS_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

interface ListedModel {
  name: string;
  supportedGenerationMethods?: string[];
}

// Google's fast, low-cost tier has been called "flash" (up to Gemini 3.x) and "hydrogen"
// (Gemini 4). Add a name here if the tier is renamed again.
const FAST_TIERS = ['flash', 'hydrogen'];
// Stable releases only: no previews, experiments, "lite" or special-purpose variants.
const FAST_RE = new RegExp(`^models/(gemini-(\\d+)(?:\\.(\\d+))?-(?:${FAST_TIERS.join('|')}))$`);

/** Picks the newest stable fast-tier models from Google's list, newest first. */
export function pickModels(listed: ListedModel[]): string[] {
  return listed
    .filter((m) => m.supportedGenerationMethods?.includes('generateContent'))
    .map((m) => FAST_RE.exec(m.name))
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

/** Address of the free estimate service; empty when it is not set up. */
export const PROXY_URL: string = import.meta.env.VITE_AI_PROXY_URL ?? '';

/** A random id for this browser, used only to count free AI logs. */
export function deviceId(): string {
  let id = localStorage.getItem('tm_device');
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem('tm_device', id);
  }
  return id;
}

export interface Quota {
  remaining: number;
  limit: number;
  paused: boolean;
}

/** How many free AI logs are left today, or null if that cannot be found out. */
export async function fetchQuota(): Promise<Quota | null> {
  if (!PROXY_URL) return null;
  try {
    const res = await fetch(`${PROXY_URL}?device=${deviceId()}`);
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json?.remaining === 'number' ? { remaining: json.remaining, limit: json.limit, paused: !!json.paused } : null;
  } catch {
    return null;
  }
}

/** Estimates a meal through the free service, which holds its own key and enforces the daily allowance. */
export async function estimateViaProxy({ text, imageBase64, today, now }: Omit<EstimateRequest, 'apiKey'>): Promise<Estimate> {
  let res: Response;
  try {
    res = await fetch(PROXY_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device: deviceId(), text, imageBase64, today, now }),
    });
  } catch {
    throw new AiError('network', 'No connection. Check your internet and try again.');
  }
  const json = await res.json().catch(() => null);
  if (res.ok && typeof json?.estimate === 'string') return parseEstimate(json.estimate, today, now);
  const code = json?.error?.code;
  const message = typeof json?.error?.message === 'string' ? json.error.message : '';
  if (code === 'limit') {
    throw new AiError('limit', `${message} The food list, frequent meals and manual entry still work, or add your own Gemini key in Profile for unlimited logging.`);
  }
  if (code === 'paused') throw new AiError('paused', `${message} You can still use the food list, frequent meals and manual entry.`);
  throw new AiError('busy', message || 'The AI service is busy right now. Please try again in a moment.');
}

interface EstimateRequest {
  apiKey: string;
  text: string;
  imageBase64?: string;
  today: string;
  now: string;
}

export async function estimateMeal({ apiKey, text, imageBase64, today, now }: EstimateRequest): Promise<Estimate> {
  // No key of their own: use the free service.
  if (!apiKey) return estimateViaProxy({ text, imageBase64, today, now });
  const body = JSON.stringify(buildRequest(text, today, now, imageBase64));

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
    if (res.status === 401 || res.status === 403) {
      throw new AiError('key', 'Your Gemini key was not accepted. Check it in Profile.');
    }
    if (res.status === 400) {
      // A 400 is either a bad key or a request this particular model does not accept.
      const detail = await res.json().then((j) => String(j?.error?.message ?? ''), () => '');
      if (/api key/i.test(detail)) throw new AiError('key', 'Your Gemini key was not accepted. Check it in Profile.');
    }

    // 404 means the model has been retired or renamed, 5xx that it is overloaded, and a
    // remaining 400 that it rejected the request format. Either way the next model is tried. If a model was missing and the whole list
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
