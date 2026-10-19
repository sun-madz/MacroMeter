// Vercel serverless function: "AI chef" menu ideas from ingredients on hand.
// Optional — active when GEMINI_API_KEY (free tier) or ANTHROPIC_API_KEY is set in Vercel.

declare const process: { env: Record<string, string | undefined> };

// ---- AI provider (Gemini free tier or Claude), shared shape in api/estimate.ts and api/menu.ts ----
// Kept inline in each function file so Vercel bundles them without cross-file imports.
const GEMINI_MODELS = () => (process.env.GEMINI_MODEL ? [process.env.GEMINI_MODEL] : ['gemini-3.5-flash-lite', 'gemini-3.8-flash', 'gemini-3.6-flash']);
const aiEnabled = () => !!(process.env.GEMINI_API_KEY || process.env.ANTHROPIC_API_KEY);

class AiError extends Error {
  status: number;
  constructor(message: string, status = 502) {
    super(message);
    this.status = status;
  }
}

/** Sends a prompt (plus optional base64 image) and returns the model's text reply. */
async function askAi(prompt: string, image?: { mime: string; data: string }, maxTokens = 1500): Promise<string> {
  const gemini = process.env.GEMINI_API_KEY;
  if (gemini) {
    const parts: unknown[] = [];
    if (image) parts.push({ inline_data: { mime_type: image.mime, data: image.data } });
    parts.push({ text: prompt });
    let last = '';
    for (const model of GEMINI_MODELS()) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'x-goog-api-key': gemini, 'content-type': 'application/json' },
        body: JSON.stringify({ contents: [{ role: 'user', parts }], generationConfig: { maxOutputTokens: maxTokens, responseMimeType: 'application/json', temperature: 0.4 } }),
      });
      if (res.status === 404) {
        last = `Model ${model} not available`;
        continue; // try the next model name
      }
      if (res.status === 429) throw new AiError("You've hit Gemini's free limit for now. Try again later.", 429);
      if (res.status === 400 || res.status === 403) {
        const t = await res.text();
        throw new AiError(/API key/i.test(t) ? 'Gemini rejected the API key. Check GEMINI_API_KEY in Vercel.' : `Gemini error: ${t.slice(0, 160)}`, 502);
      }
      if (!res.ok) throw new AiError(`Gemini error (${res.status})`);
      const d = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
      return (d.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('');
    }
    throw new AiError(`${last}. Set GEMINI_MODEL in Vercel to a current model name.`);
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) throw new AiError('AI is not set up. Add GEMINI_API_KEY (free) or ANTHROPIC_API_KEY in Vercel.', 503);
  const content: unknown[] = [];
  if (image) content.push({ type: 'image', source: { type: 'base64', media_type: image.mime, data: image.data } });
  content.push({ type: 'text', text: prompt });
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5', max_tokens: maxTokens, messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) throw new AiError(`Claude error (${res.status})`);
  const d = (await res.json()) as { content?: { type: string; text?: string }[] };
  return (d.content ?? []).filter((c) => c.type === 'text').map((c) => c.text).join('');
}

function parseJson(text: string) {
  return JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
}

export function GET(): Response {
  return json({ enabled: aiEnabled() });
}

interface MenuRequest {
  pantry: string[];
  remaining?: { kcal: number; protein: number; carbs: number; fat: number };
  meal?: string; // e.g. "dinner"
  count?: number;
}

export async function POST(request: Request): Promise<Response> {
  if (!aiEnabled()) return json({ error: 'AI chef is not set up. Add GEMINI_API_KEY (free) or ANTHROPIC_API_KEY in Vercel.' }, 503);

  let body: MenuRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const pantry = (body.pantry || []).map(String).slice(0, 60);
  if (!pantry.length) return json({ error: 'Add some ingredients to your pantry first.' }, 400);
  const count = Math.min(Math.max(body.count ?? 3, 1), 5);
  const r = body.remaining;

  const prompt = [
    `Ingredients on hand: ${pantry.join(', ')}.`,
    'Assume basic staples too: salt, pepper, cooking oil, water, common dried spices.',
    body.meal ? `Meal: ${body.meal}.` : '',
    r && r.kcal > 0
      ? `Aim for about ${Math.round(r.kcal)} kcal or less per serving, prioritising protein (about ${Math.round(r.protein)} g left today).`
      : 'Keep each serving moderate in calories and high in protein.',
    `Suggest ${count} different, realistic home-cooked meals that use mostly these ingredients.`,
    'Reply with JSON only, no prose, in this exact shape:',
    '{"meals":[{"name":"","servings":2,"minutes":20,"ingredients":["150 g chicken breast"],"steps":["..."],"perServing":{"kcal":0,"protein":0,"carbs":0,"fat":0},"uses":["chicken"],"extra":["anything not on hand"]}]}',
  ]
    .filter(Boolean)
    .join('\n');

  let text: string;
  try {
    text = await askAi(prompt, undefined, 2000);
  } catch (e) {
    return json({ error: (e as Error).message }, e instanceof AiError ? e.status : 502);
  }
  try {
    const parsed = parseJson(text);
    return json({ meals: Array.isArray(parsed.meals) ? parsed.meals : [] });
  } catch {
    return json({ error: 'Could not read the AI response, try again.' }, 502);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
