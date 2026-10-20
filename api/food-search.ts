// Vercel serverless function: food search via Open Food Facts, done server-side so the
// browser isn't hit by CORS, rate limits or a slow endpoint. Tries the fast search
// service first, then the classic search as a backup.

const FIELDS = 'code,product_name,product_name_en,brands,nutriments,serving_size,serving_quantity';
const UA = 'MacroMeter/1.0 (personal nutrition tracker)';

async function withTimeout(url: string, ms: number) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    return await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: c.signal });
  } finally {
    clearTimeout(t);
  }
}

type Product = Record<string, unknown>;

/** search-a-licious can return language maps ({en: "..."}) for text fields; flatten them. */
function flat(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v)) return v.map(String).join(', ');
  if (v && typeof v === 'object') {
    const o = v as Record<string, unknown>;
    return String(o.en ?? o.main ?? Object.values(o)[0] ?? '');
  }
  return undefined;
}

async function fastSearch(q: string): Promise<Product[]> {
  const url = `https://search.openfoodfacts.org/search?q=${encodeURIComponent(q)}&page_size=25&langs=en&fields=${FIELDS}`;
  const res = await withTimeout(url, 6000);
  if (!res.ok) throw new Error(`search ${res.status}`);
  const d = (await res.json()) as { hits?: Product[] };
  return (d.hits ?? []).map((h) => ({ ...h, product_name: flat(h.product_name), product_name_en: flat(h.product_name_en), brands: flat(h.brands) }));
}

async function classicSearch(q: string): Promise<Product[]> {
  const url = `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(q)}&search_simple=1&action=process&json=1&page_size=25&fields=${FIELDS}`;
  const res = await withTimeout(url, 9000);
  if (!res.ok) throw new Error(`classic ${res.status}`);
  const d = (await res.json()) as { products?: Product[] };
  return d.products ?? [];
}

export async function GET(request: Request): Promise<Response> {
  const q = (new URL(request.url).searchParams.get('q') || '').trim().slice(0, 100);
  if (q.length < 2) return json({ products: [] });
  for (const attempt of [fastSearch, classicSearch]) {
    try {
      const products = await attempt(q);
      if (products.length) return json({ products, via: attempt.name }, 200, 'public, s-maxage=86400, stale-while-revalidate=604800');
    } catch {
      /* try the next source */
    }
  }
  return json({ products: [], error: 'Food database is not responding' }, 502);
}

function json(data: unknown, status = 200, cache = 'no-store') {
  return new Response(JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache } });
}
