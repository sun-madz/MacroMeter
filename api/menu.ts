// Vercel serverless function: "AI chef" menu ideas from ingredients on hand.
// Optional — only active when ANTHROPIC_API_KEY is set in the Vercel project's environment variables.

declare const process: { env: Record<string, string | undefined> };

const MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';

export function GET(): Response {
  return json({ enabled: !!process.env.ANTHROPIC_API_KEY });
}

interface MenuRequest {
  pantry: string[];
  remaining?: { kcal: number; protein: number; carbs: number; fat: number };
  meal?: string; // e.g. "dinner"
  count?: number;
}

export async function POST(request: Request): Promise<Response> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: 'AI chef is not set up (ANTHROPIC_API_KEY missing).' }, 503);

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

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL(), max_tokens: 2000, messages: [{ role: 'user', content: prompt }] }),
  });
  if (!res.ok) {
    const detail = await res.text();
    return json({ error: `AI request failed (${res.status})`, detail: detail.slice(0, 300) }, 502);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  try {
    const parsed = JSON.parse(text.slice(start, end + 1));
    return json({ meals: Array.isArray(parsed.meals) ? parsed.meals : [] });
  } catch {
    return json({ error: 'Could not read the AI response, try again.' }, 502);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
