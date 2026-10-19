// Sanity checks for the calculation engine: `npm run test:calc`
import { simulate, tdee, intakeOptions, recommendedOption, estimateBodyFat, type Profile } from '../src/lib/calc.ts';

// fatcalc.com/rwl worked example: 37 y, 6 ft, 265 lb sedentary man eating 1,600 kcal to lose 85 lb.
// Hall's model says "almost 70 weeks" (the 3500-kcal rule says ~43).
const man: Profile = { name: 'x', sex: 'male', age: 37, heightCm: 182.88, weightKg: 265 * 0.4536, goalKg: 180 * 0.4536, pal: 1.4 };
console.log('maintenance ~2600?', Math.round(tdee(man, man.weightKg)));
const s = simulate(man, 1600);
console.log('weeks to goal (expect ~70):', (s.days / 7).toFixed(1), 'reached', s.reached);
console.log('bf est', estimateBodyFat('male', man.weightKg, man.heightCm, 37).toFixed(1));

const woman: Profile = { name: 'y', sex: 'female', age: 21, heightCm: 163, weightKg: 72, goalKg: 62, pal: 1.55 };
const opts = intakeOptions(woman);
console.table(opts.map((o) => ({ kcal: o.kcal, deficit: o.deficit, wk: o.weeklyLossKg.toFixed(2), weeks: (o.days / 7).toFixed(1), safety: o.safety })));
console.log('recommended', recommendedOption(opts).kcal);
const m = Math.round(tdee(man, man.weightKg));
const s2 = simulate(man, m - 1000);
console.log('1000 kcal deficit -> weeks', (s2.days / 7).toFixed(1), '(fatcalc/Hall ~70; 3500-rule ~43)');
