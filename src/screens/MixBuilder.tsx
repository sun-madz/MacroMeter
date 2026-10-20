import { useState } from 'react';
import { setState, sumNutrition, uid, useStore, type Meal } from '../lib/store';
import { FillDot, Icon, portionWord, r0, toast } from '../components/ui';
import { Estimating, NoAi, useAiEnabled, useEstimateRun, type Estimate } from './EstimateTabs';

const UNITS: { value: string; label: string }[] = [
  { value: 'piece', label: 'pcs' },
  { value: 'slice', label: 'slice' },
  { value: 'g', label: 'g' },
  { value: 'ml', label: 'ml' },
  { value: 'tsp', label: 'tsp' },
  { value: 'tbsp', label: 'tbsp' },
  { value: 'cup', label: 'cup' },
  { value: 'scoop', label: 'scoop' },
  { value: 'oz', label: 'oz' },
  { value: 'handful', label: 'handful' },
  { value: 'pinch', label: 'pinch' },
];

const SUGGESTIONS = [
  'Banana', 'Frozen berries', 'Mango', 'Strawberries', 'Dates', 'Full cream milk', 'Low fat milk', 'Almond milk', 'Oat milk', 'Soy milk',
  'Greek yogurt', 'Plain yogurt', 'Peanut butter', 'Almond butter', 'Rolled oats', 'Honey', 'Maple syrup', 'Whey protein', 'Cocoa powder',
  'Chia seeds', 'Flax seeds', 'Spinach', 'Avocado', 'Vanilla ice cream', 'Ice', 'Coffee', 'Condensed milk', 'Milo', 'Sugar',
];

/** Sensible default unit for a typed ingredient (checked in order, whole words only). */
function guessUnit(name: string): string | null {
  const n = ` ${name.toLowerCase()} `;
  const has = (words: string) => new RegExp(`\\b(${words})`).test(n);
  // Things you count
  if (has('slice|toast')) return 'slice';
  if (has('egg|banana|apple|orange|date|tortilla|wrap|bun|bagel|muffin|roti|paratha|chapati|naan|pita|croissant|sausage|nugget|tomato|onion')) return 'piece';
  if (has('bread|cheese')) return 'slice';
  // Spoons
  if (has('peanut butter|almond butter|butter|honey|maple|condensed|cocoa|milo|sugar|chia|flax|seeds?|oil|mayo|mayonnaise|ketchup|sauce|jam|nutella|salt|pepper|cinnamon|ashwagandha|powder|spread')) return 'tbsp';
  if (has('protein|whey|collagen')) return 'scoop';
  // Liquids
  if (has('milk|juice|water|coffee|tea|coconut water|smoothie|yogurt drink|kefir')) return 'ml';
  if (has('spinach|kale|lettuce|ice')) return 'handful';
  if (has('oat|yogurt|yoghurt|berr|mango|strawberr|ice cream|avocado|rice|chicken|beef|tuna|salmon|tofu|pasta|noodle')) return 'g';
  return null;
}

interface Row {
  id: string;
  name: string;
  qty: string;
  unit: string;
  unitTouched?: boolean;
}

const blankRow = (): Row => ({ id: uid(), name: '', qty: '', unit: 'g' });

// Keep the draft if the user flips to another tab and back.
let draft = { name: '', servings: 1, rows: [blankRow(), blankRow()] };

const MSGS = ['Weighing the ingredients…', 'Converting spoons and cups…', 'Looking up nutrition…', 'Adding it all up…'];

export function MixBuilder({ onSaved }: { onSaved: (meal: Meal) => void }) {
  const s = useStore();
  const enabled = useAiEnabled();
  const intuitive = s.settings.intuitive;
  const target = s.plan?.kcal ?? 2000;
  const [name, setNameRaw] = useState(draft.name);
  const [servings, setServingsRaw] = useState(draft.servings);
  const [rows, setRowsRaw] = useState<Row[]>(draft.rows);
  const [est, setEst] = useState<Estimate | null>(null);
  const { busy, err, run, cancel } = useEstimateRun(setEst);

  const setName = (v: string) => { draft = { ...draft, name: v }; setNameRaw(v); };
  const setServings = (v: number) => { draft = { ...draft, servings: v }; setServingsRaw(v); };
  const setRows = (v: Row[]) => { draft = { ...draft, rows: v }; setRowsRaw(v); setEst(null); };
  const update = (id: string, patch: Partial<Row>) => setRows(rows.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  // An empty amount means 1 (that's what the placeholder shows).
  const qtyOf = (r: Row) => (r.qty.trim() === '' ? 1 : parseFloat(r.qty));
  const badQty = (r: Row) => !!r.name.trim() && !(qtyOf(r) > 0);
  const filled = rows.filter((r) => r.name.trim() && qtyOf(r) > 0);
  const missingQty = rows.some(badQty);

  if (busy) return <Estimating messages={MSGS} onCancel={cancel} />;

  if (est) {
    const total = sumNutrition(est.items);
    const per = servings || 1;
    const p = { kcal: total.kcal / per, protein: total.protein / per, carbs: total.carbs / per, fat: total.fat / per };
    return (
      <div className="stack">
        <h2>{name.trim() || est.name}</h2>
        <div className="card">
          <div className="list">
            {est.items.map((it, i) => (
              <div key={i} className="list-item">
                <div className="grow">
                  <div className="title">{it.name}</div>
                  <div className="small muted">{it.amount}</div>
                </div>
                {intuitive ? <FillDot fraction={it.kcal / target} size={22} /> : <span className="num small" style={{ fontWeight: 700 }}>{r0(it.kcal)} kcal</span>}
              </div>
            ))}
          </div>
          {est.note && <p className="hint" style={{ margin: '8px 0 0' }}>{est.note}</p>}
        </div>

        {intuitive ? (
          <div className="card row">
            <FillDot fraction={p.kcal / target} size={56} />
            <div>
              <h3>{portionWord(p.kcal / target)}</h3>
              <div className="small muted">{per > 1 ? 'per serving' : 'for the whole thing'}</div>
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="small muted" style={{ fontWeight: 700, marginBottom: 8 }}>{per > 1 ? `Per serving (makes ${per})` : 'Total'}</div>
            <div className="grid2">
              <div className="stat"><b className="num">{r0(p.kcal)}</b><span>kcal</span></div>
              <div className="stat"><b className="num">{r0(p.protein)} g</b><span>Protein</span></div>
              <div className="stat"><b className="num">{r0(p.carbs)} g</b><span>Carbs</span></div>
              <div className="stat"><b className="num">{r0(p.fat)} g</b><span>Fat</span></div>
            </div>
          </div>
        )}

        <button
          className="btn block"
          onClick={() => {
            const meal: Meal = {
              id: uid(),
              name: name.trim() || est.name,
              servings: per,
              createdAt: new Date().toISOString(),
              ingredients: est.items.map((it) => ({ id: uid(), name: it.name, amount: it.amount, kcal: it.kcal, protein: it.protein, carbs: it.carbs, fat: it.fat })),
            };
            setState((st) => ({ ...st, meals: [meal, ...st.meals] }));
            draft = { name: '', servings: 1, rows: [blankRow(), blankRow()] };
            toast('Saved to your meals');
            onSaved(meal);
          }}
        >
          Save & log it
        </button>
        <button className="btn ghost block" onClick={() => setEst(null)}>
          <Icon name="edit" size={18} /> Edit ingredients
        </button>
      </div>
    );
  }

  return (
    <div className="stack">
      {enabled === false && <NoAi />}
      <label className="field">
        What are you making?
        <input className="input" placeholder="e.g. Banana peanut butter smoothie" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <div className="row between" style={{ marginTop: 4 }}>
        <h3>Ingredients</h3>
        <span className="small muted">amount · unit</span>
      </div>

      <datalist id="mm-ingredients">
        {[...new Set([...s.foods.filter((f) => f.source !== 'meal').map((f) => f.name), ...SUGGESTIONS])].slice(0, 80).map((n) => <option key={n} value={n} />)}
      </datalist>

      <div className="stack" style={{ gap: 8 }}>
        {rows.map((r, i) => (
          <div key={r.id} style={{ display: 'grid', gridTemplateColumns: '1fr 64px 92px 32px', gap: 6, alignItems: 'center' }}>
            <input
              className="input"
              list="mm-ingredients"
              placeholder={i === 0 ? 'e.g. Banana' : i === 1 ? 'e.g. Milk' : 'Ingredient'}
              value={r.name}
              onChange={(e) => {
                const v = e.target.value;
                const g = !r.unitTouched ? guessUnit(v) : null;
                update(r.id, g ? { name: v, unit: g } : { name: v });
              }}
              style={{ padding: '12px 12px' }}
            />
            <input
              className="input num center"
              type="number"
              inputMode="decimal"
              placeholder="1"
              value={r.qty}
              onChange={(e) => update(r.id, { qty: e.target.value })}
              style={{ padding: '12px 6px', borderColor: badQty(r) ? 'var(--red)' : undefined }}
              aria-label="Amount"
            />
            <select className="input" value={r.unit} onChange={(e) => update(r.id, { unit: e.target.value, unitTouched: true })} style={{ padding: '12px 8px' }} aria-label="Unit">
              {UNITS.map((u) => <option key={u.value} value={u.value}>{u.label}</option>)}
            </select>
            <button className="icon-btn sm plain" aria-label="Remove ingredient" onClick={() => setRows(rows.length > 1 ? rows.filter((x) => x.id !== r.id) : [blankRow()])}>
              <Icon name="x" size={18} />
            </button>
          </div>
        ))}
      </div>
      <button className="btn outline" onClick={() => setRows([...rows, blankRow()])}>
        <Icon name="plus" size={18} /> Add ingredient
      </button>

      <div className="row">
        <div className="grow">
          <div style={{ fontWeight: 600, fontSize: 14 }}>Makes how many portions?</div>
          <div className="hint">Leave at 1 if it's all for you. Use 2+ if you're sharing or saving some.</div>
        </div>
        <button className="icon-btn sm" onClick={() => setServings(Math.max(1, servings - 1))} aria-label="Fewer servings"><Icon name="minus" size={18} /></button>
        <span className="num" style={{ fontWeight: 800, minWidth: 22, textAlign: 'center' }}>{servings}</span>
        <button className="icon-btn sm" onClick={() => setServings(servings + 1)} aria-label="More servings"><Icon name="plus" size={18} /></button>
      </div>

      {missingQty && <div className="error">The amount in the red box needs to be more than 0.</div>}
      {!filled.length && <div className="hint">Add at least one ingredient to work out the nutrition.</div>}
      {err && <div className="error">{err}</div>}
      <button
        className="btn block"
        disabled={enabled === false || !filled.length || missingQty}
        onClick={() => run({ kind: 'recipe', description: name, ingredients: filled.map((r) => ({ name: r.name.trim(), qty: qtyOf(r), unit: r.unit })) })}
      >
        <Icon name="sparkle" size={18} /> Work out nutrition
      </button>
    </div>
  );
}
