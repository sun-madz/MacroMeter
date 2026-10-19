// Vercel serverless function: estimate nutrition for a food photo and/or a description,
// including restaurant meals ("Taco Bell Crunchwrap Supreme", "mixed rice with fried chicken").
// Needs ANTHROPIC_API_KEY in the Vercel project's environment variables.

declare const process: { env: Record<string, string | undefined> };

const MODEL = () => process.env.ANTHROPIC_MODEL || 'claude-haiku-5-5';

export function GET(): Response {
  return json({ enabled: !!process.env.ANTHROPIC_API_KEY });
}

interface EstimateRequest {
  image?: string; // data URL (image/jpeg|png|webp)
  description?: string;
  restaurant?: string;
  kind?: 'photo' | 'restaurant';
}

export async function POST(request: Request): Promise<Response> {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return json({ error: 'Estimates need ANTHROPIC_API_KEY set in Vercel.' }, 503);

  let body: EstimateRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  const description = (body.description || '').slice(0, 600).trim();
  const restaurant = (body.restaurant || '').slice(0, 120).trim();
  if (!body.image && !description) return json({ error: 'Add a photo or describe what you ate.' }, 400);

  const content: unknown[] = [];
  if (body.image) {
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(body.image);
    if (!m) return json({ error: 'Unsupported image' }, 400);
    if (m[2].length > 5_000_000) return json({ error: 'Image too large' }, 413);
    content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[2] } });
  }

  const prompt = [
    'Estimate the nutrition of the food the user ate.',
    restaurant ? `It was from: ${restaurant}. If this is a chain with published nutrition, use those official figures for the items named.` : '',
    description ? `User's description: ${description}` : '',
    body.image ? 'Use the photo to judge which foods are present and the portion sizes (plate size, utensils and packaging help with scale).' : '',
    'The user is in Malaysia; assume local portion sizes for local dishes (e.g. economy/mixed rice "nasi campur", mamak dishes) unless told otherwise.',
    'Count visible oil, sauces, gravies and drinks if they are part of the meal. If unsure between two sizes, pick the more typical one and say so.',
    'Reply with JSON only, in exactly this shape (numbers, no units in values):',
    '{"name":"short meal name","items":[{"name":"","amount":"e.g. 1 cup / 1 piece","kcal":0,"protein":0,"carbs":0,"fat":0}],"confidence":"low|medium|high","note":"one short sentence on the main uncertainty"}',
    'If there is no food in the image, reply {"error":"No food found in the photo"}.',
  ]
    .filter(Boolean)
    .join('\n');
  content.push({ type: 'text', text: prompt });

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL(), max_tokens: 1200, messages: [{ role: 'user', content }] }),
  });
  if (!res.ok) {
    const detail = await res.text();
    return json({ error: `Estimate failed (${res.status})`, detail: detail.slice(0, 300) }, 502);
  }
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  try {
    const parsed = JSON.parse(text.slice(text.indexOf('{'), text.lastIndexOf('}') + 1));
    if (parsed.error) return json({ error: String(parsed.error) }, 422);
    const items = (Array.isArray(parsed.items) ? parsed.items : []).map((i: Record<string, unknown>) => ({
      name: String(i.name ?? 'Item'),
      amount: String(i.amount ?? ''),
      kcal: Number(i.kcal) || 0,
      protein: Number(i.protein) || 0,
      carbs: Number(i.carbs) || 0,
      fat: Number(i.fat) || 0,
    }));
    if (!items.length) return json({ error: "Couldn't estimate that, try adding a description." }, 422);
    return json({ name: String(parsed.name || 'Meal'), items, confidence: parsed.confidence || 'medium', note: parsed.note || '' });
  } catch {
    return json({ error: 'Could not read the estimate, please try again.' }, 502);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
