import { useState } from 'react';
import { macrosFor, todayKey } from '../lib/calc';
import { MEAL_SLOTS, addLog, setState, sumNutrition, useStore, type LoggedItem, type LogEntry } from '../lib/store';
import { FillCircle, FillDot, Icon, Seg, Sheet, portionWord, r0, r1, toast } from '../components/ui';

const STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2, 3];

/** "1 tsp" × 2 → "2 tsp"; falls back to "2× …" when the amount has no leading number. */
function scaleAmount(amount: string, f: number) {
  if (f === 1) return amount;
  const m = /^(\d+(?:\.\d+)?)\s*(.*)$/.exec(amount.trim());
  return m ? `${r1(parseFloat(m[1]) * f)} ${m[2]}`.trim() : `${r1(f)}× ${amount}`;
}

/** Full-screen detail for one logged item: what was in it, its nutrition, and quick edits. */
export function EntryDetail({ entryId, onClose }: { entryId: string; onClose: () => void }) {
  const s = useStore();
  const entry = s.log.find((l) => l.id === entryId);
  // Remember the entry as it was when opened, so portion changes don't compound.
  const [base] = useState<LogEntry | undefined>(entry);
  const [factor, setFactor] = useState(1);
  if (!entry || !base) return null;

  const intuitive = s.settings.intuitive;
  const target = macrosFor(s.plan!.kcal, s.plan!.split);

  // ---- What was in it ----
  let items: LoggedItem[] | null = null;
  let source = '';
  const meal = entry.foodId?.startsWith('meal-') ? s.meals.find((m) => `meal-${m.id}` === entry.foodId) : undefined;
  const food = !meal && entry.foodId ? s.foods.find((f) => f.id === entry.foodId) : undefined;
  if (entry.items?.length) {
    items = entry.items;
    source = 'Estimated items';
  } else if (meal && meal.ingredients.length) {
    const total = sumNutrition(meal.ingredients);
    const share = total.kcal > 0 ? entry.kcal / total.kcal : 1 / (meal.servings || 1);
    items = meal.ingredients.map((i) => ({
      name: i.name,
      amount: scaleAmount(i.amount, share),
      kcal: i.kcal * share,
      protein: i.protein * share,
      carbs: i.carbs * share,
      fat: i.fat * share,
    }));
    source = Math.abs(share - 1) < 0.01 ? 'Ingredients' : share > 1 ? `Ingredients (×${r1(share)})` : `Ingredients (your share of the batch)`;
  }

  const update = (patch: Partial<LogEntry>) => setState((st) => ({ ...st, log: st.log.map((l) => (l.id === entry.id ? { ...l, ...patch } : l)) }));

  const changeFactor = (f: number) => {
    setFactor(f);
    update({
      kcal: base.kcal * f,
      protein: base.protein * f,
      carbs: base.carbs * f,
      fat: base.fat * f,
      amount: f === 1 ? base.amount : `${f}× ${base.amount}`,
      items: base.items?.map((i) => ({ ...i, amount: scaleAmount(i.amount, f), kcal: i.kcal * f, protein: i.protein * f, carbs: i.carbs * f, fat: i.fat * f })),
    });
  };

  const day = entry.date === todayKey() ? 'Today' : new Date(entry.date + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' });
  const kcalFromMacros = entry.protein * 4 + entry.carbs * 4 + entry.fat * 9 || 1;
  const split = [
    { label: 'Protein', g: entry.protein, pct: (entry.protein * 4) / kcalFromMacros, color: 'var(--protein)', of: target.protein },
    { label: 'Carbs', g: entry.carbs, pct: (entry.carbs * 4) / kcalFromMacros, color: 'var(--carbs)', of: target.carbs },
    { label: 'Fat', g: entry.fat, pct: (entry.fat * 9) / kcalFromMacros, color: 'var(--fat)', of: target.fat },
  ];

  return (
    <Sheet title={entry.name} onClose={onClose}>
      <div className="stack">
        <div className="row wrap" style={{ gap: 6, marginTop: -6 }}>
          <span className="chip">{MEAL_SLOTS.find((m) => m.id === entry.slot)?.label} · {day}</span>
          {entry.amount && <span className="chip">{entry.amount}</span>}
          {food?.brand && <span className="chip">{food.brand}</span>}
        </div>

        {/* Nutrition */}
        {intuitive ? (
          <div className="card stack" style={{ alignItems: 'center' }}>
            <FillCircle fraction={entry.kcal / target.kcal} size={140} label={portionWord(entry.kcal / target.kcal)} />
            <h3>{portionWord(entry.kcal / target.kcal)}</h3>
            <div className="grid3" style={{ width: '100%' }}>
              {split.map((m) => (
                <div key={m.label} style={{ display: 'grid', justifyItems: 'center', gap: 4 }}>
                  <FillCircle fraction={m.g / m.of} size={56} color={m.color} label={m.label} />
                  <span className="small" style={{ fontWeight: 700 }}>{m.label}</span>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="card">
            <div className="row between" style={{ alignItems: 'flex-end' }}>
              <div>
                <div className="num" style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{r0(entry.kcal)}</div>
                <div className="small muted">kcal · {r0((entry.kcal / target.kcal) * 100)}% of your day</div>
              </div>
            </div>
            <div style={{ display: 'flex', height: 10, borderRadius: 99, overflow: 'hidden', margin: '14px 0 12px', background: 'var(--card-2)' }}>
              {split.map((m) => <i key={m.label} style={{ width: `${m.pct * 100}%`, background: m.color }} />)}
            </div>
            <div className="grid3">
              {split.map((m) => (
                <div key={m.label} className="stat" style={{ borderTop: `4px solid ${m.color}` }}>
                  <b className="num">{r1(m.g)} g</b>
                  <span>{m.label} · {r0(m.pct * 100)}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What's in it */}
        {items && (
          <div className="card">
            <div className="small muted" style={{ fontWeight: 700 }}>{source}</div>
            <div className="list">
              {items.map((it, i) => (
                <div key={i} className="list-item">
                  <div className="grow">
                    <div className="title">{it.name}</div>
                    <div className="small muted">
                      {[it.amount, intuitive ? null : `P ${r1(it.protein)} · C ${r1(it.carbs)} · F ${r1(it.fat)}`].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {intuitive ? <FillDot fraction={it.kcal / target.kcal} size={22} /> : <span className="num small" style={{ fontWeight: 700 }}>{r0(it.kcal)}</span>}
                </div>
              ))}
            </div>
          </div>
        )}

        {food && (
          <div className="card small">
            <div className="muted" style={{ fontWeight: 700, marginBottom: 6 }}>Product info</div>
            {!intuitive && (
              <div>
                {r0(food.kcal)} kcal · P {r1(food.protein)} · C {r1(food.carbs)} · F {r1(food.fat)} {food.per === '100g' ? 'per 100 g' : 'per serving'}
              </div>
            )}
            {food.servingLabel && <div className="muted">Serving: {food.servingLabel}</div>}
            {food.barcode && <div className="muted">Barcode {food.barcode}</div>}
            <div className="muted">{food.source === 'openfoodfacts' ? 'From Open Food Facts' : 'Added by you'}</div>
          </div>
        )}

        {!items && !food && <div className="card empty">No ingredient breakdown for this one, it was logged as a single item.</div>}

        {/* Edits */}
        <div className="section-title" style={{ margin: '8px 4px 0' }}><h3>Adjust</h3></div>
        <div className="card stack">
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>How much did you have?</div>
            <div className="pill-tabs">
              {STEPS.map((f) => (
                <button key={f} className={factor === f ? 'on' : ''} onClick={() => changeFactor(f)}>
                  {f === 1 ? 'As logged' : `${f}×`}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>Meal</div>
            <Seg value={entry.slot} onChange={(slot) => update({ slot })} options={MEAL_SLOTS.map((m) => ({ value: m.id, label: m.label }))} />
          </div>
        </div>

        <div className="row">
          <button
            className="btn ghost grow"
            onClick={() => {
              const { id: _id, date: _d, ...rest } = entry;
              addLog({ ...rest, date: todayKey() });
              toast('Logged again for today');
              onClose();
            }}
          >
            <Icon name="plus" size={18} /> Log again today
          </button>
          <button
            className="btn danger"
            onClick={() => {
              setState((st) => ({ ...st, log: st.log.filter((l) => l.id !== entry.id) }));
              toast('Removed');
              onClose();
            }}
          >
            <Icon name="trash" size={18} /> Remove
          </button>
        </div>
      </div>
    </Sheet>
  );
}
