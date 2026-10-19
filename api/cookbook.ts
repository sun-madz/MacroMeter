// Vercel serverless function: forwards a cookbook entry to the user's Google Apps Script.
// Running it server-side avoids browser CORS limits so the app can confirm the write worked.

export async function POST(request: Request): Promise<Response> {
  let body: { scriptUrl?: string; title?: string; ingredients?: string[]; servings?: number; token?: string };
  try {
    body = await request.json();
  } catch {
    return json({ error: 'Invalid JSON' }, 400);
  }
  const { scriptUrl, title, ingredients, servings, token } = body;
  if (!scriptUrl || !/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(scriptUrl)) {
    return json({ error: 'That is not a Google Apps Script web app URL (it should end in /exec).' }, 400);
  }
  if (!title || !Array.isArray(ingredients)) return json({ error: 'Missing meal name or ingredients' }, 400);

  const res = await fetch(scriptUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' },
    body: JSON.stringify({ title: String(title).slice(0, 200), ingredients: ingredients.slice(0, 80).map(String), servings, token }),
    redirect: 'follow',
  });
  const text = await res.text();
  let data: { ok?: boolean; error?: string } = {};
  try {
    data = JSON.parse(text);
  } catch {
    return json({ error: 'Google did not accept the request. Check the script is deployed with access "Anyone".' }, 502);
  }
  if (!data.ok) return json({ error: data.error || 'The script reported an error' }, 502);
  return json({ ok: true });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } });
}
