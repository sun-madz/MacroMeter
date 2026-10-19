// Open Food Facts: free, open barcode + food database (no API key needed).
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

export async function lookupBarcode(code: string): Promise<Food | null> {
  const res = await fetch(`https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Food database error (${res.status})`);
  const data = await res.json();
  if (data.status !== 1 || !data.product) return null;
  return toFood({ ...data.product, code });
}

export async function searchFoods(query: string, signal?: AbortSignal): Promise<Food[]> {
  const url =
    `https://world.openfoodfacts.org/cgi/search.pl?search_terms=${encodeURIComponent(query)}` +
    `&search_simple=1&action=process&json=1&page_size=25&fields=${FIELDS}`;
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`Food search error (${res.status})`);
  const data = await res.json();
  return ((data.products ?? []) as OffProduct[]).map(toFood).filter((f): f is Food => !!f);
}
