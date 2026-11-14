// Free AI meal estimates for people without their own Gemini key.
// POST: estimate one meal, within a per-device and per-address daily allowance
//       and a daily and monthly spending budget.
// GET ?device=<id>: how many free estimates the device has left today.
import { buildRequest } from './prompt.ts';

const env = (key: string, fallback = '') => Deno.env.get(key) ?? fallback;
const num = (key: string, fallback: number) => Number(env(key)) || fallback;

const SUPABASE_URL = env('SUPABASE_URL');
const SERVICE_KEY = env('SUPABASE_SERVICE_ROLE_KEY');
const MODELS = env('GEMINI_MODELS', 'gemini-4-hydrogen,gemini-3.8-flash').split(',').map((m) => m.trim()).filter(Boolean);
const DEVICE_LIMIT = num('DEVICE_DAILY_LIMIT', 5);
const IP_LIMIT = num('IP_DAILY_LIMIT', 20);
const DAILY_MICROS = Math.round(num('DAILY_BUDGET_USD', 0.4) * 1_000_000);
const MONTHLY_MICROS = Math.round(num('MONTHLY_BUDGET_USD', 10) * 1_000_000);
// US dollars per million tokens: [input, output]. Unknown models use the default.
const PRICES: Record<string, [number, number]> = { 'gemini-4-hydrogen': [1.5, 7.5], 'gemini-3.8-flash': [1.5, 7.5] };
const DEFAULT_PRICE: [number, number] = [1.5, 7.5];

const ALLOWED_ORIGINS = [
  /^https:\/\/trackmacros\.theabhayperspective\.com$/,
  /^https:\/\/track-macros[a-z0-9-]*\.vercel\.app$/,
  /^http:\/\/localhost(:\d+)?$/,
];

const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
const DEVICE_RE = /^[A-Za-z0-9-]{16,64}$/;
const MAX_IMAGE_CHARS = 700_000; // about 500 KB of JPEG

function cors(origin: string | null): Record<string, string> {
  const allowed = origin && ALLOWED_ORIGINS.some((re) => re.test(origin));
  return {
    'Access-Control-Allow-Origin': allowed ? origin! : 'https://trackmacros.theabhayperspective.com',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'content-type, authorization, apikey',
    Vary: 'Origin',
  };
}

async function rpc(fn: string, args: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  if (!res.ok) throw new Error(`${fn} failed: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

// Addresses are stored only as a keyed hash, never in the clear.
async function hashIp(ip: string): Promise<string> {
  const bytes = new TextEncoder().encode(`${ip}|${SERVICE_KEY}`);
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', bytes));
  return [...digest.slice(0, 16)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  const headers = { ...cors(req.headers.get('origin')), 'Content-Type': 'application/json' };
  const reply = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers });
  const fail = (status: number, code: string, message: string) => reply(status, { error: { code, message } });

  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers });

  try {
    if (req.method === 'GET') {
      const device = new URL(req.url).searchParams.get('device') ?? '';
      if (!DEVICE_RE.test(device)) return fail(400, 'bad_request', 'Missing device id.');
      return reply(200, await rpc('ai_quota', {
        p_device: device, p_device_limit: DEVICE_LIMIT, p_daily_micros: DAILY_MICROS, p_monthly_micros: MONTHLY_MICROS,
      }));
    }
    if (req.method !== 'POST') return fail(405, 'bad_request', 'Use POST.');
    // Read per request so a newly saved secret is picked up without a redeploy.
    const GEMINI_KEY = env('GEMINI_API_KEY').trim();
    if (!GEMINI_KEY) return fail(503, 'paused', 'Free AI logging is not set up yet.');

    const body = await req.json().catch(() => null);
    const text = typeof body?.text === 'string' ? body.text.slice(0, 300) : '';
    const image = typeof body?.imageBase64 === 'string' ? body.imageBase64 : undefined;
    if (
      !body || !DEVICE_RE.test(body.device ?? '') || !DAY_RE.test(body.today ?? '') || !TIME_RE.test(body.now ?? '') ||
      (!text.trim() && !image) || (image && (image.length > MAX_IMAGE_CHARS || !/^[A-Za-z0-9+/=]+$/.test(image)))
    ) {
      return fail(400, 'bad_request', 'That request could not be read.');
    }

    const ip = await hashIp((req.headers.get('x-forwarded-for') ?? 'unknown').split(',')[0].trim());
    const claim = await rpc('claim_ai_log', {
      p_device: body.device, p_ip: ip, p_device_limit: DEVICE_LIMIT, p_ip_limit: IP_LIMIT,
      p_daily_micros: DAILY_MICROS, p_monthly_micros: MONTHLY_MICROS,
    });
    if (!claim.ok) {
      return claim.reason === 'budget'
        ? fail(503, 'paused', 'Free AI logging is paused for now. It will be back tomorrow.')
        : fail(429, 'limit', `You have used today's ${DEVICE_LIMIT} free AI logs. They reset tomorrow.`);
    }

    const request = JSON.stringify(buildRequest(text, body.today, body.now, image));
    let outOfCredit = false;
    for (const model of MODELS) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-goog-api-key': GEMINI_KEY },
        body: request,
      });
      if (res.ok) {
        const json = await res.json();
        const estimate = json?.candidates?.[0]?.content?.parts?.find((p: any) => typeof p.text === 'string')?.text;
        const usage = json?.usageMetadata ?? {};
        const [priceIn, priceOut] = PRICES[model] ?? DEFAULT_PRICE;
        // tokens x dollars-per-million = millionths of a dollar
        const micros = Math.ceil(
          (usage.promptTokenCount ?? 0) * priceIn + ((usage.candidatesTokenCount ?? 0) + (usage.thoughtsTokenCount ?? 0)) * priceOut,
        );
        await rpc('record_ai_spend', { p_micros: micros });
        if (typeof estimate !== 'string') break; // paid for, but unusable: refund the allowance below
        return reply(200, { estimate, remaining: claim.remaining, limit: DEVICE_LIMIT });
      }
      if (res.status === 402) outOfCredit = true;
      console.error(`model ${model} failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
    }

    await rpc('refund_ai_log', { p_device: body.device, p_ip: ip });
    return outOfCredit
      ? fail(503, 'paused', 'Free AI logging is paused for now.')
      : fail(502, 'busy', 'The AI service is busy right now. Please try again in a moment.');
  } catch (err) {
    console.error(err);
    return fail(500, 'busy', 'Something went wrong. Please try again.');
  }
});
