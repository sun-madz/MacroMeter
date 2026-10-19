import { useEffect, useState, useSyncExternalStore } from 'react';
import type { MacroPreset, MacroSplit, Profile, WeighIn } from './calc';
import { MACRO_PRESETS, todayKey } from './calc';

export type MealSlot = 'breakfast' | 'lunch' | 'dinner' | 'snacks';
export const MEAL_SLOTS: { id: MealSlot; label: string }[] = [
  { id: 'breakfast', label: 'Breakfast' },
  { id: 'lunch', label: 'Lunch' },
  { id: 'dinner', label: 'Dinner' },
  { id: 'snacks', label: 'Snacks' },
];

export interface Nutrition {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

/** A food with nutrition per 100 g (or per serving when `per` is 'serving'). */
export interface Food extends Nutrition {
  id: string;
  name: string;
  brand?: string;
  barcode?: string;
  per: '100g' | 'serving';
  servingG?: number; // grams in one serving, if known
  servingLabel?: string;
  source: 'openfoodfacts' | 'custom' | 'meal';
}

export interface LogEntry extends Nutrition {
  id: string;
  date: string;
  slot: MealSlot;
  name: string;
  amount: string; // human description, e.g. "150 g" or "1 serving"
  foodId?: string;
}

export interface Ingredient extends Nutrition {
  id: string;
  name: string;
  grams?: number;
  amount: string;
}

export interface Meal {
  id: string;
  name: string;
  servings: number;
  ingredients: Ingredient[];
  createdAt: string;
  sentToCookbook?: string; // ISO time when sent
}

export interface PantryItem {
  id: string;
  name: string;
  note?: string;
}

export interface Plan {
  kcal: number;
  startKg: number;
  startDate: string;
  macroPreset: MacroPreset;
  split: MacroSplit;
}

export interface Settings {
  intuitive: boolean;
  theme: 'system' | 'light' | 'dark';
  cookbookDocUrl: string;
  cookbookScriptUrl: string;
  cookbookToken: string;
}

export interface State {
  version: 1;
  profile: Profile | null;
  plan: Plan | null;
  settings: Settings;
  log: LogEntry[];
  foods: Food[]; // my foods + recently used
  recentFoodIds: string[];
  meals: Meal[];
  pantry: PantryItem[];
  weighIns: WeighIn[];
}

const KEY = 'macrometer:v1';

export const defaultSplit = (): MacroSplit => {
  const p = MACRO_PRESETS.higherProtein;
  return { p: p.p, c: p.c, f: p.f };
};

const initial: State = {
  version: 1,
  profile: null,
  plan: null,
  settings: { intuitive: false, theme: 'system', cookbookDocUrl: '', cookbookScriptUrl: '', cookbookToken: '' },
  log: [],
  foods: [],
  recentFoodIds: [],
  meals: [],
  pantry: [],
  weighIns: [],
};

function load(): State {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initial;
    const parsed = JSON.parse(raw);
    return { ...initial, ...parsed, settings: { ...initial.settings, ...parsed.settings } };
  } catch {
    return initial;
  }
}

let state: State = load();
const listeners = new Set<() => void>();

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full or blocked — keep working in memory */
  }
}

export function getState() {
  return state;
}

export function setState(update: (s: State) => State) {
  state = update(state);
  persist();
  listeners.forEach((l) => l());
}

export function replaceState(next: State) {
  state = { ...initial, ...next, settings: { ...initial.settings, ...next.settings } };
  persist();
  listeners.forEach((l) => l());
}

export function resetState() {
  replaceState(initial);
}

export function useStore(): State {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state,
  );
}

export const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);

// ---------- Helpers ----------

export function sumNutrition(items: Nutrition[]): Nutrition {
  return items.reduce(
    (a, b) => ({ kcal: a.kcal + b.kcal, protein: a.protein + b.protein, carbs: a.carbs + b.carbs, fat: a.fat + b.fat }),
    { kcal: 0, protein: 0, carbs: 0, fat: 0 },
  );
}

export function scale(n: Nutrition, factor: number): Nutrition {
  return { kcal: n.kcal * factor, protein: n.protein * factor, carbs: n.carbs * factor, fat: n.fat * factor };
}

/** Nutrition for an amount of a food. `qty` is grams (per 100g foods) or servings (per-serving foods). */
export function nutritionFor(food: Food, qty: number, unit: 'g' | 'serving'): Nutrition {
  if (food.per === '100g') {
    const grams = unit === 'g' ? qty : qty * (food.servingG ?? 100);
    return scale(food, grams / 100);
  }
  const servings = unit === 'serving' ? qty : qty / (food.servingG ?? 100);
  return scale(food, servings);
}

export function addLog(entry: Omit<LogEntry, 'id'>) {
  setState((s) => ({ ...s, log: [...s.log, { ...entry, id: uid() }] }));
}

export function rememberFood(food: Food) {
  setState((s) => {
    const others = s.foods.filter((f) => f.id !== food.id && !(food.barcode && f.barcode === food.barcode));
    return {
      ...s,
      foods: [food, ...others].slice(0, 300),
      recentFoodIds: [food.id, ...s.recentFoodIds.filter((id) => id !== food.id)].slice(0, 30),
    };
  });
}

export function logsFor(date: string, log: LogEntry[]) {
  return log.filter((l) => l.date === date);
}

export function latestWeight(s: State) {
  const sorted = [...s.weighIns].sort((a, b) => a.date.localeCompare(b.date));
  return sorted.length ? sorted[sorted.length - 1].kg : s.profile?.weightKg ?? 0;
}

export function useToday() {
  const [today, setToday] = useState(todayKey());
  useEffect(() => {
    const t = setInterval(() => setToday(todayKey()), 60_000);
    return () => clearInterval(t);
  }, []);
  return today;
}
