// Vercel serverless function: estimate nutrition for a food photo and/or a description,
// including restaurant meals ("Taco Bell Crunchwrap Supreme", "mixed rice with fried chicken").
// Needs GEMINI_API_KEY (free tier) or ANTHROPIC_API_KEY in the Vercel project's environment variables.

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

interface EstimateRequest {
  image?: string; // data URL (image/jpeg|png|webp)
  description?: string;
  restaurant?: string;
  kind?: 'photo' | 'restaurant' | 'package' | 'recipe';
  ingredients?: { name: string; qty: number; unit: string }[];
}

export async function POST(request: Request): Promise<Response> {
  if (!aiEnabled()) return json({ error: 'Estimates need GEMINI_API_KEY (free) or ANTHROPIC_API_KEY set in Vercel.' }, 503);

  let body: EstimateRequest;
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid request' }, 400);
  }
  if (body.kind === 'recipe') return recipe(body);

  const description = (body.description || '').slice(0, 600).trim();
  const restaurant = (body.restaurant || '').slice(0, 120).trim();
  if (!body.image && !description) return json({ error: 'Add a photo or describe what you ate.' }, 400);

  let image: { mime: string; data: string } | undefined;
  if (body.image) {
    const m = /^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/.exec(body.image);
    if (!m) return json({ error: 'Unsupported image' }, 400);
    if (m[2].length > 5_000_000) return json({ error: 'Image too large' }, 413);
    image = { mime: m[1], data: m[2] };
  }

  if (body.kind === 'package') {
    if (!image) return json({ error: 'Take a photo of the packaging first.' }, 400);
    return readPackage(image, description);
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
  let text: string;
  try {
    text = await askAi(prompt, image, 1200);
  } catch (e) {
    return json({ error: (e as Error).message }, e instanceof AiError ? e.status : 502);
  }
  try {
    const parsed = parseJson(text);
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

/** Nutrition for each ingredient of something the user made (smoothie, shake, bowl...). */
async function recipe(body: EstimateRequest): Promise<Response> {
  const list = (body.ingredients || [])
    .filter((i) => i && String(i.name || '').trim())
    .slice(0, 40)
    .map((i) => ({ name: String(i.name).trim().slice(0, 80), qty: Number(i.qty) || 1, unit: String(i.unit || 'piece').slice(0, 12) }));
  if (!list.length) return json({ error: 'Add at least one ingredient.' }, 400);
  const dish = String(body.description || '').slice(0, 120).trim();

  const prompt = [
    `The user made${dish ? ` "${dish}"` : ' something'} from these ingredients (quantity, unit, ingredient):`,
    ...list.map((i, n) => `${n + 1}. ${i.qty} ${i.unit} ${i.name}`),
    'Give the nutrition for EXACTLY the stated quantity of each ingredient, in the same order, one item per ingredient.',
    'Use standard reference values (USDA-style). Convert volume units sensibly for that ingredient (e.g. 1 tbsp peanut butter ≈ 16 g, 1 cup milk = 244 g, 1 tsp honey ≈ 7 g, 1 scoop whey ≈ 30 g unless a brand says otherwise).',
    'If a brand is named, use that product\'s typical label values. Ice and water are 0.',
    'Reply with JSON only, in exactly this shape (numbers without units):',
    '{"name":"short name for the result","items":[{"name":"ingredient","amount":"the quantity and unit as given","grams":0,"kcal":0,"protein":0,"carbs":0,"fat":0}],"confidence":"low|medium|high","note":"one short sentence on any assumption"}',
  ].join('\n');

  let text: string;
  try {
    text = await askAi(prompt, undefined, 1500);
  } catch (e) {
    return json({ error: (e as Error).message }, e instanceof AiError ? e.status : 502);
  }
  try {
    const p = parseJson(text);
    const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const raw: Record<string, unknown>[] = Array.isArray(p.items) ? p.items : [];
    // Keep the user's own names and amounts; take numbers from the model by position.
    const items = list.map((ing, i) => {
      const r = raw[i] ?? {};
      return { name: ing.name, amount: `${ing.qty} ${ing.unit}`, grams: n(r.grams) || undefined, kcal: n(r.kcal), protein: n(r.protein), carbs: n(r.carbs), fat: n(r.fat) };
    });
    return json({ name: dish || String(p.name || 'My mix'), items, confidence: p.confidence || 'medium', note: p.note ? String(p.note).slice(0, 200) : '' });
  } catch {
    return json({ error: 'Could not work that out, please try again.' }, 502);
  }
}

/** Reads a product's packaging (nutrition label, name, brand, barcode digits) from a photo. */
async function readPackage(image: { mime: string; data: string }, note: string): Promise<Response> {
  const prompt = [
    'This is a photo of food or drink packaging. Identify the product and its nutrition.',
    note ? `User note: ${note}` : '',
    '1. Read the product name and brand from the pack.',
    '2. If a nutrition facts / nutrition information table is visible, copy its numbers exactly. Prefer the per-100 g (or per-100 ml) column; if only per-serving is shown, use that.',
    '3. Read the serving size in grams/ml if printed.',
    '4. If barcode digits are printed under a barcode, copy them exactly (digits only).',
    '5. If no nutrition table is visible, estimate typical values for this exact product (or the closest common equivalent) per 100 g and set "source":"estimated".',
    'Energy must be kcal (convert kJ ÷ 4.184 if only kJ is shown).',
    'Reply with JSON only, in exactly this shape (numbers without units):',
    '{"name":"","brand":"","barcode":"","per":"100g|serving","servingG":0,"servingLabel":"e.g. 1 bar (40 g)","kcal":0,"protein":0,"carbs":0,"fat":0,"source":"label|estimated","note":"one short sentence"}',
    'If the photo is not of a food or drink product, reply {"error":"Couldn\'t see a food package in the photo"}.',
  ]
    .filter(Boolean)
    .join('\n');
  let text: string;
  try {
    text = await askAi(prompt, image, 800);
  } catch (e) {
    return json({ error: (e as Error).message }, e instanceof AiError ? e.status : 502);
  }
  try {
    const p = parseJson(text);
    if (p.error) return json({ error: String(p.error) }, 422);
    const n = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
    const barcode = String(p.barcode ?? '').replace(/\D/g, '');
    const product = {
      name: String(p.name || 'Packaged food').slice(0, 120),
      brand: p.brand ? String(p.brand).slice(0, 80) : undefined,
      barcode: barcode.length >= 8 ? barcode : undefined,
      per: p.per === 'serving' ? 'serving' : '100g',
      servingG: n(p.servingG) || undefined,
      servingLabel: p.servingLabel ? String(p.servingLabel).slice(0, 60) : undefined,
      kcal: n(p.kcal),
      protein: n(p.protein),
      carbs: n(p.carbs),
      fat: n(p.fat),
      source: p.source === 'label' ? 'label' : 'estimated',
      note: p.note ? String(p.note).slice(0, 200) : '',
    };
    if (!product.kcal && !product.protein && !product.carbs && !product.fat) return json({ error: "Couldn't read the nutrition. Try a clearer photo of the label." }, 422);
    return json({ product });
  } catch {
    return json({ error: 'Could not read the package, please try again.' }, 502);
  }
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
