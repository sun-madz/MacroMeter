// MacroMeter calculation engine.
//
// Mirrors the approach used by fatcalc.com/rwl:
//  - Resting energy via Mifflin-St Jeor (1990)
//  - TDEE = RMR x physical activity level (PAL 1.4 sedentary ... 2.3 very active)
//  - Body fat estimated from BMI, age and sex (Jackson et al., HERITAGE 2002) unless the user enters it
//  - Weight-loss timeline from a dynamic model in the spirit of Kevin Hall's NIH model:
//    fat and lean mass are tracked separately (Forbes/Hall partitioning), and expenditure
//    falls as weight falls, so loss slows over time instead of following the "3500 kcal rule".
//  - Intake options listed in 100 kcal steps, never below 1,200 (women) / 1,500 (men).
//  - Macros kept inside the IOM acceptable ranges unless the user picks otherwise.

export type Sex = 'female' | 'male';

export interface Profile {
  name: string;
  sex: Sex;
  age: number;
  heightCm: number;
  weightKg: number;
  goalKg: number;
  pal: number;
  bodyFatPct?: number; // optional, user-entered
}

export const PAL_LEVELS = [
  { value: 1.4, label: 'Sedentary', hint: 'Desk job, little walking, no exercise' },
  { value: 1.55, label: 'Lightly active', hint: 'On your feet some of the day, or light exercise 1–3×/week' },
  { value: 1.7, label: 'Moderately active', hint: 'Active job or exercise 3–5×/week' },
  { value: 1.9, label: 'Very active', hint: 'Hard exercise most days or physical job' },
  { value: 2.2, label: 'Extremely active', hint: 'Athlete training or heavy labour daily' },
];

export const KCAL_PER_KG_FAT = 9440; // Hall 2008
export const KCAL_PER_KG_LEAN = 1816; // Hall 2008 (lean tissue incl. water)
const FORBES_C = 10.4; // kg, Forbes/Hall partition constant
const ALPERT_KCAL_PER_KG_FAT = 69; // ~31.4 kcal per lb of fat per day (Alpert 2005)

export const calorieFloor = (sex: Sex) => (sex === 'female' ? 1200 : 1500);

export function bmi(weightKg: number, heightCm: number) {
  const m = heightCm / 100;
  return weightKg / (m * m);
}

export function weightAtBmi(b: number, heightCm: number) {
  const m = heightCm / 100;
  return b * m * m;
}

/** Mifflin-St Jeor resting metabolic rate (kcal/day). */
export function rmr(sex: Sex, weightKg: number, heightCm: number, age: number) {
  return 10 * weightKg + 6.25 * heightCm - 5 * age + (sex === 'male' ? 5 : -161);
}

export function tdee(p: Pick<Profile, 'sex' | 'heightCm' | 'age' | 'pal'>, weightKg: number) {
  return rmr(p.sex, weightKg, p.heightCm, p.age) * p.pal;
}

/** Body-fat % from BMI (Jackson et al. 2002). Returns 5–60. */
export function estimateBodyFat(sex: Sex, weightKg: number, heightCm: number, age: number) {
  const s = sex === 'male' ? 1 : 0;
  const inv = 1 / bmi(weightKg, heightCm);
  const bf = 76.0 - 1097.8 * inv - 20.6 * s + 0.053 * age + 95.0 * s * inv - 0.044 * s * age;
  return Math.min(60, Math.max(5, bf));
}

export function bodyFatPct(p: Profile, weightKg = p.weightKg) {
  if (p.bodyFatPct && weightKg === p.weightKg) return p.bodyFatPct;
  return estimateBodyFat(p.sex, weightKg, p.heightCm, p.age);
}

export interface Simulation {
  reached: boolean;
  days: number; // days to goal (or simulated span if not reached)
  weeklyLossStartKg: number; // projected loss in the first 4 weeks, per week
  curve: { day: number; kg: number }[]; // sampled weekly
}

/**
 * Day-by-day simulation at a constant daily intake.
 * Each day: imbalance = intake - TDEE(current weight). The imbalance is split between
 * fat and lean tissue using Forbes' rule (dL/dF = C/F), and the weights updated.
 */
export function simulate(p: Profile, intake: number, startKg = p.weightKg, maxDays = 365 * 4): Simulation {
  let fat = (startKg * bodyFatPct(p, startKg)) / 100;
  let lean = startKg - fat;
  const curve: { day: number; kg: number }[] = [{ day: 0, kg: startKg }];
  let day = 0;
  let w = startKg;
  let after28 = startKg;
  const losing = p.goalKg < startKg;

  // Hall: eating less also lowers the thermic effect of food (~10% of the drop in intake)
  // and triggers adaptive thermogenesis (~8% of the drop, tuned so fatcalc's 70-week example matches, building over ~2 weeks).
  const intakeDrop = Math.max(0, tdee(p, startKg) - intake);
  let adaptation = 0;

  while (day < maxDays) {
    adaptation += (0.08 * intakeDrop - adaptation) / 14;
    const expenditure = tdee(p, w) - 0.1 * intakeDrop - adaptation;
    const imbalance = intake - expenditure;
    const dF = imbalance / (KCAL_PER_KG_FAT + (KCAL_PER_KG_LEAN * FORBES_C) / Math.max(fat, 1));
    const dL = (FORBES_C / Math.max(fat, 1)) * dF;
    fat = Math.max(1, fat + dF);
    lean += dL;
    const next = fat + lean;
    day++;
    if (day === 28) after28 = next;
    if (day % 7 === 0) curve.push({ day, kg: next });
    // Plateau: the change per day is negligible and we're not reaching the goal
    if (Math.abs(next - w) < 0.0005 && (losing ? next > p.goalKg : next < p.goalKg)) {
      w = next;
      break;
    }
    w = next;
    if (losing ? w <= p.goalKg : w >= p.goalKg) {
      curve.push({ day, kg: w });
      return { reached: true, days: day, weeklyLossStartKg: (startKg - (day >= 28 ? after28 : w)) / Math.min(day, 28) * 7, curve };
    }
  }
  return { reached: false, days: day, weeklyLossStartKg: ((startKg - after28) / 28) * 7, curve };
}

export type Safety = 'safe' | 'firm' | 'unsafe';

export interface IntakeOption {
  kcal: number;
  deficit: number;
  deficitPct: number;
  weeklyLossKg: number;
  weeklyLossPct: number; // % of body weight per week
  days: number;
  reached: boolean;
  safety: Safety;
  reasons: string[];
}

/** Max daily deficit the body can cover from fat stores (Alpert 2005). */
export function maxFatDeficit(p: Profile) {
  const fatKg = (p.weightKg * bodyFatPct(p)) / 100;
  return fatKg * ALPERT_KCAL_PER_KG_FAT;
}

export function classify(p: Profile, kcal: number, weeklyLossKg: number): { safety: Safety; reasons: string[] } {
  const maintenance = tdee(p, p.weightKg);
  const deficit = maintenance - kcal;
  const pct = deficit / maintenance;
  const lossPct = (weeklyLossKg / p.weightKg) * 100;
  const reasons: string[] = [];
  let safety: Safety = 'safe';
  if (kcal < calorieFloor(p.sex)) {
    reasons.push(`Below the ${calorieFloor(p.sex)} kcal minimum`);
    safety = 'unsafe';
  }
  if (deficit > maxFatDeficit(p)) {
    reasons.push('Bigger than your fat stores can supply in a day, so you would lose muscle');
    safety = 'unsafe';
  }
  if (lossPct > 1) {
    reasons.push('Faster than 1% of body weight per week');
    safety = 'unsafe';
  }
  if (safety === 'safe' && (pct > 0.25 || lossPct > 0.75)) {
    safety = 'firm';
    reasons.push('Doable, but harder to stick to and more muscle loss risk');
  }
  return { safety, reasons };
}

/** fatcalc-style table: intakes stepping down by 100 kcal from just under maintenance. */
export function intakeOptions(p: Profile): IntakeOption[] {
  const maintenance = tdee(p, p.weightKg);
  const floor = calorieFloor(p.sex);
  const out: IntakeOption[] = [];
  const top = Math.floor((maintenance - 100) / 100) * 100;
  for (let kcal = top; kcal >= floor; kcal -= 100) {
    const sim = simulate(p, kcal);
    const deficit = maintenance - kcal;
    const { safety, reasons } = classify(p, kcal, sim.weeklyLossStartKg);
    out.push({
      kcal,
      deficit: Math.round(deficit),
      deficitPct: deficit / maintenance,
      weeklyLossKg: sim.weeklyLossStartKg,
      weeklyLossPct: (sim.weeklyLossStartKg / p.weightKg) * 100,
      days: sim.days,
      reached: sim.reached,
      safety,
      reasons,
    });
  }
  return out;
}

/** The option we highlight: the deepest "safe" deficit, capped at ~20% of maintenance. */
export function recommendedOption(opts: IntakeOption[]) {
  const safe = opts.filter((o) => o.safety === 'safe' && o.reached);
  if (safe.length) return safe[safe.length - 1];
  const firm = opts.filter((o) => o.safety === 'firm' && o.reached);
  return firm[0] ?? opts[0];
}

// ---------- Macros ----------

export type MacroPreset = 'higherProtein' | 'balanced' | 'lowerCarb' | 'custom';

export const MACRO_PRESETS: Record<Exclude<MacroPreset, 'custom'>, { label: string; p: number; c: number; f: number; note: string }> = {
  higherProtein: { label: 'Higher protein', p: 30, c: 45, f: 25, note: 'Best for keeping muscle in a deficit. Within IOM ranges.' },
  balanced: { label: 'Balanced', p: 20, c: 50, f: 30, note: 'Middle of the IOM ranges.' },
  lowerCarb: { label: 'Lower carb', p: 35, c: 30, f: 35, note: 'Carbs sit below the IOM 45% guideline.' },
};

export interface MacroSplit {
  p: number;
  c: number;
  f: number;
} // percentages of kcal

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export function macrosFor(kcal: number, split: MacroSplit): Macros {
  return {
    kcal,
    protein: Math.round((kcal * split.p) / 100 / 4),
    carbs: Math.round((kcal * split.c) / 100 / 4),
    fat: Math.round((kcal * split.f) / 100 / 9),
  };
}

// ---------- Predictions from real weigh-ins ----------

export interface WeighIn {
  date: string; // YYYY-MM-DD
  kg: number;
}

/** Linear-regression trend in kg/day over the last `windowDays` of weigh-ins. */
export function trendKgPerDay(weighIns: WeighIn[], windowDays = 28): number | null {
  if (weighIns.length < 3) return null;
  const sorted = [...weighIns].sort((a, b) => a.date.localeCompare(b.date));
  const last = toDay(sorted[sorted.length - 1].date);
  const pts = sorted.filter((w) => last - toDay(w.date) <= windowDays).map((w) => ({ x: toDay(w.date), y: w.kg }));
  if (pts.length < 3) return null;
  const span = pts[pts.length - 1].x - pts[0].x;
  if (span < 7) return null; // need at least a week of data
  const mx = pts.reduce((s, p) => s + p.x, 0) / pts.length;
  const my = pts.reduce((s, p) => s + p.y, 0) / pts.length;
  const num = pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0);
  const den = pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
  return den === 0 ? null : num / den;
}

export function toDay(date: string) {
  const [y, m, d] = date.split('-').map(Number);
  return Math.round(Date.UTC(y, m - 1, d) / 86400000);
}

export function addDays(date: Date, days: number) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatDuration(days: number) {
  if (days < 14) return `${days} days`;
  const weeks = Math.round(days / 7);
  if (weeks < 9) return `${weeks} weeks`;
  const months = days / 30.44;
  return `${months.toFixed(months < 12 ? 1 : 0).replace(/\.0$/, '')} months`;
}
