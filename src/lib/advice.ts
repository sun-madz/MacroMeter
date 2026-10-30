// Plan check-ins: looks at your real weigh-ins and suggests easing the deficit when it's time.
// Rules (first match wins):
//  1. Losing faster than ~1% of body weight a week (over 2+ weeks)   -> eat a bit more
//  2. Target is now too aggressive for your (smaller) fat stores      -> eat a bit more
//  3. Within ~2 kg of goal                                            -> ease toward maintenance
//  4. 12+ weeks on the same deficit                                   -> take a 1–2 week maintenance break
//  5. Stalled for 3+ weeks (still above goal)                         -> recalculate for your new weight
import { calorieFloor, maxFatDeficit, tdee, toDay, todayKey, trendKgPerDay, type Profile } from './calc';
import type { State } from './store';

export interface Advice {
  id: string; // stable per situation, used for snoozing and one-time notifications
  kind: 'ease' | 'break' | 'recalc';
  title: string;
  body: string; // may include numbers; use bodyIntuitive when numbers are hidden
  bodyIntuitive: string;
  suggestKcal?: number; // new daily target, when there is a concrete suggestion
}

const round50 = (n: number) => Math.round(n / 50) * 50;

export function planAdvice(s: State, today = todayKey()): Advice | null {
  if (!s.profile || !s.plan) return null;
  const weighIns = [...s.weighIns].sort((a, b) => a.date.localeCompare(b.date));
  if (!weighIns.length) return null;

  const current = weighIns[weighIns.length - 1].kg;
  const profile: Profile = { ...s.profile, weightKg: current, bodyFatPct: undefined };
  const maintenance = tdee(profile, current);
  const goal = s.profile.goalKg;
  const kcal = s.plan.kcal;
  const floor = calorieFloor(s.profile.sex);
  const since = (d: string) => toDay(today) - toDay(d);
  const recent = weighIns.filter((w) => since(w.date) <= 28);
  const span = recent.length ? since(recent[0].date) : 0;
  const slope = trendKgPerDay(weighIns, 28); // kg/day, negative when losing
  const weeklyLoss = slope !== null ? -slope * 7 : null;
  const weeklyPct = weeklyLoss !== null ? (weeklyLoss / current) * 100 : null;
  const planAge = since(s.plan.calcDate ?? s.plan.startDate);

  if (current <= goal) return null; // goal reached: the Progress card celebrates instead

  // On a diet break: stay quiet until it ends, then prompt to go back to a deficit.
  if (s.plan.breakUntil) {
    if (today < s.plan.breakUntil) return null;
    return {
      id: `break-over-${s.plan.breakUntil}`,
      kind: 'recalc',
      title: 'Your break is over',
      body: 'Ready to go back to your deficit? Recalculating picks a safe target for your current weight.',
      bodyIntuitive: 'Ready to go back to your plan? Recalculating sets it up for your current weight.',
    };
  }

  // Give a new target at least 2 weeks to show up in your weigh-ins before suggesting more changes.
  if (planAge < 14) return null;

  // 1. Too fast
  if (weeklyPct !== null && span >= 14 && weeklyPct > 1) {
    const add = weeklyPct > 1.25 ? 200 : 100;
    const next = Math.min(round50(maintenance - 200), kcal + add);
    return {
      id: `fast-${kcal}`,
      kind: 'ease',
      title: "You're losing faster than is safe",
      body: `You've lost about ${weeklyLoss!.toFixed(1)} kg a week lately (${weeklyPct.toFixed(1)}% of your weight). Above 1% a week you lose more muscle and it's harder to keep up. Try ${next.toLocaleString()} kcal a day (+${next - kcal}).`,
      bodyIntuitive: "You've been losing faster than is safe lately. Eating a little more each day will protect your muscle and make this easier to keep up.",
      suggestKcal: next,
    };
  }

  // 2. Deficit now bigger than fat stores can supply
  const deficit = maintenance - kcal;
  const maxDef = maxFatDeficit(profile);
  if (deficit > maxDef && span >= 7) {
    const next = Math.max(floor, round50(maintenance - maxDef * 0.9));
    if (next > kcal) {
      return {
        id: `fatcap-${kcal}`,
        kind: 'ease',
        title: 'Time to ease your deficit',
        body: `As you've lost fat, your body can cover less of a gap from fat stores, so the current target eats into muscle. Moving to ${next.toLocaleString()} kcal (+${next - kcal}) keeps the deficit safe.`,
        bodyIntuitive: "Now that you've lost some fat, your current plan is a little too strict. Eating slightly more keeps it safe.",
        suggestKcal: next,
      };
    }
  }

  // 3. Close to goal
  if (current - goal <= 2) {
    const goalMaintenance = tdee(profile, goal);
    const next = round50((kcal + goalMaintenance) / 2);
    if (next > kcal + 50) {
      return {
        id: `near-goal-${kcal}`,
        kind: 'ease',
        title: "You're nearly there",
        body: `You're within ${(current - goal).toFixed(1)} kg of your goal. Easing to ${next.toLocaleString()} kcal (+${next - kcal}) makes the last stretch gentler and helps you settle into maintenance (about ${round50(goalMaintenance).toLocaleString()} kcal at your goal weight).`,
        bodyIntuitive: "You're very close to your goal. Eating a bit more now makes the last stretch gentler and eases you into maintaining.",
        suggestKcal: next,
      };
    }
  }

  // 4. Long stretch on the same deficit
  if (planAge >= 84) {
    return {
      id: `break-${s.plan.calcDate ?? s.plan.startDate}`,
      kind: 'break',
      title: 'Consider a diet break',
      body: `You've been on the same deficit for ${Math.floor(planAge / 7)} weeks. A 1–2 week break at maintenance (about ${round50(maintenance).toLocaleString()} kcal) can ease hunger and fatigue. Come back to your deficit afterwards.`,
      bodyIntuitive: "You've been in a deficit for a long time. A week or two of eating to maintenance can ease hunger and tiredness before you continue.",
      suggestKcal: round50(maintenance),
    };
  }

  // 5. Stalled
  if (slope !== null && span >= 21 && weeklyLoss! < 0.1) {
    return {
      id: `stall-${Math.round(current * 10)}`,
      kind: 'recalc',
      title: 'Your progress has stalled',
      body: "Your weight has barely moved for 3+ weeks. As you get lighter you burn less, so your target may need updating. Recalculating uses your current weight.",
      bodyIntuitive: "Your weight has barely moved for a few weeks. Updating your plan for your current weight can get things going again.",
    };
  }
  return null;
}

/** Hidden if you tapped "Not now" in the last 14 days. */
export function visibleAdvice(s: State, today = todayKey()): Advice | null {
  const a = planAdvice(s, today);
  if (!a) return null;
  const until = s.settings.checkinSnoozeUntil;
  if (until && today < until) return null;
  return a;
}
