// Open Food Facts: free, open food database (no API key needed).
import type { Food } from './store';

const FIELDS = 'code,product_name,product_name_en,brands,nutriments,serving_size,serving_quantity';

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  brands?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

const num = (v: unknown) => {
  const n = typeof v === 'string' ? parseFloat(v) : typeof v === 'number' ? v : NaN;
  return Number.isFinite(n) ? n : 0;
};

function toFood(p: OffProduct): Food | null {
  const n = p.nutriments ?? {};
  let kcal = num(n['energy-kcal_100g']);
  if (!kcal && n['energy_100g']) kcal = num(n['energy_100g']) / 4.184; // kJ -> kcal
  const name = (p.product_name_en || p.product_name || '').trim();
  if (!name || !kcal) return null;
  const servingG = num(p.serving_quantity) || undefined;
  return {
    id: `off-${p.code}`,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    barcode: p.code,
    per: '100g',
    kcal,
    protein: num(n['proteins_100g']),
    carbs: num(n['carbohydrates_100g']),
    fat: num(n['fat_100g']),
    servingG,
    servingLabel: p.serving_size || undefined,
    source: 'openfoodfacts',
  };
}

export async function searchFoods(query: string, signal?: AbortSignal): Promise<Food[]> {
  // Preferred: our Vercel function (no CORS issues, has a backup source, cached).
  try {
    const res = await fetch(`/api/food-search?q=${encodeURIComponent(query)}`, { signal });
    if (res.ok) {
      const data = await res.json();
      return ((data.products ?? []) as OffProduct[]).map(toFood).filter((f): f is Food => !!f);
    }
    if (res.status !== 404) throw new Error(`Food search error (${res.status})`);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    if (!/404/.test(String(e)) && !(e instanceof TypeError)) throw e;
  }
  // Fallback (local dev without the API): straight to Open Food Facts.
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=25&fields=${FIELDS}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Food search error (${res.status})`);
  const data = await res.json();
  return ((data.products ?? []) as OffProduct[]).map(toFood).filter((f): f is Food => !!f);
}

/** Ask the AI for typical nutrition of a generic food ("boiled egg", "kaya toast"). */
export async function askAiForFood(query: string): Promise<Food> {
  const res = await fetch('/api/estimate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ kind: 'food', description: query }),
  });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || (res.status === 404 || res.status === 503 ? 'AI is not set up (add GEMINI_API_KEY in Vercel).' : `Couldn't look that up (${res.status})`));
  const p = d.product;
  return {
    id: `ai-${query.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Date.now().toString(36)}`,
    name: p.name,
    brand: p.brand,
    per: p.per,
    servingG: p.servingG,
    servingLabel: p.servingLabel,
    kcal: p.kcal,
    protein: p.protein,
    carbs: p.carbs,
    fat: p.fat,
    source: 'ai',
  };
}
