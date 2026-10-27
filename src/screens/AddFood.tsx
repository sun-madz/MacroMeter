import { useEffect, useMemo, useRef, useState } from 'react';
import { askAiForFood, searchFoods } from '../lib/foodApi';
import { searchCommon } from '../lib/commonFoods';
import {
  MEAL_SLOTS,
  addLog,
  nutritionFor,
  rememberFood,
  setState,
  sumNutrition,
  uid,
  useStore,
  type Food,
  type Ingredient,
  type Meal,
  type MealSlot,
  type Nutrition,
} from '../lib/store';
import { KnownNumbers } from './EstimateTabs';
import { MixBuilder } from './MixBuilder';
import { FillDot, Icon, NumField, Seg, Sheet, portionWord, r0, r1, toast } from '../components/ui';

export type Tab = 'search' | 'mine' | 'quick' | 'create';

interface Props {
  mode: 'log' | 'ingredient';
  date?: string;
  slot?: MealSlot;
  startTab?: Tab;
  onClose: () => void;
  onIngredient?: (ing: Ingredient) => void;
}

export function mealToFood(m: Meal): Food {
  const total = sumNutrition(m.ingredients);
  const per = m.servings || 1;
  return {
    id: `meal-${m.id}`,
    name: m.name,
    per: 'serving',
    servingLabel: `1 of ${per} servings`,
    kcal: total.kcal / per,
    protein: total.protein / per,
    carbs: total.carbs / per,
    fat: total.fat / per,
    source: 'meal',
  };
}

export function AddFood({ mode, date, slot: initialSlot, startTab = 'create', onClose, onIngredient }: Props) {
  const s = useStore();
  const [tab, setTab] = useState<Tab>(mode === 'ingredient' && startTab === 'create' ? 'search' : startTab);
  const [picked, setPicked] = useState<Food | null>(null);
  const [slot, setSlot] = useState<MealSlot>(initialSlot ?? guessSlot());
  const target = s.plan?.kcal ?? 2000;
  const intuitive = s.settings.intuitive;

  const title = picked ? 'How much?' : mode === 'ingredient' ? 'Add ingredient' : 'Log food';

  const finish = (food: Food, n: Nutrition, amount: string, grams?: number) => {
    rememberFood(food);
    if (mode === 'ingredient') {
      onIngredient?.({ id: uid(), name: food.brand ? `${food.name} (${food.brand})` : food.name, amount, grams, ...n });
      toast(`Added ${food.name}`);
      onClose();
      return;
    }
    addLog({ date: date!, slot, name: food.name, amount, foodId: food.id, ...n });
    toast(`Logged ${food.name}`);
    onClose();
  };

  const tabs: { value: Tab; label: string }[] = [
    ...(mode === 'log' ? ([{ value: 'create', label: 'Create' }] as { value: Tab; label: string }[]) : []),
    { value: 'search', label: 'Search' },
    { value: 'mine', label: 'My foods' },
    ...(mode === 'ingredient' ? ([{ value: 'quick', label: 'Manual' }] as { value: Tab; label: string }[]) : []),
  ];

  return (
    <Sheet
      title={title}
      onClose={onClose}
      right={
        picked ? (
          <button className="icon-btn" onClick={() => setPicked(null)} aria-label="Back">
            <Icon name="left" />
          </button>
        ) : undefined
      }
    >
      {picked ? (
        <AmountPicker food={picked} target={target} intuitive={intuitive} mode={mode} slot={slot} setSlot={setSlot} onConfirm={finish} />
      ) : (
        <div className="stack">
          <div className="pill-tabs">
            {tabs.map((t) => (
              <button key={t.value} className={tab === t.value ? 'on' : ''} onClick={() => setTab(t.value)}>
                {t.label}
              </button>
            ))}
          </div>
          {tab === 'search' && <SearchTab onPick={setPicked} intuitive={intuitive} target={target} />}
          {tab === 'mine' && <MineTab onPick={setPicked} intuitive={intuitive} target={target} />}
          {tab === 'quick' && mode === 'ingredient' && <ManualIngredient onAdd={(ing) => { onIngredient?.(ing); onClose(); }} />}
          {tab === 'create' && (
            <CreateTab date={date} slot={slot} setSlot={setSlot} onDone={onClose} onMix={(meal) => setPicked(mealToFood(meal))} />
          )}
        </div>
      )}
    </Sheet>
  );
}

function guessSlot(): MealSlot {
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h >= 17 && h < 22) return 'dinner';
  return 'snacks';
}

function FoodRow({ f, onPick, intuitive, target, onDelete }: { f: Food; onPick: (f: Food) => void; intuitive: boolean; target: number; onDelete?: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const ref = f.per === '100g' ? nutritionFor(f, f.servingG ? 1 : 100, f.servingG ? 'serving' : 'g') : f;
  return (
    <div className="list-item tap" onClick={() => onPick(f)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onPick(f)}>
      <div className="grow">
        <div className="title">{f.name}</div>
        <div className="small muted">
          {[f.brand, f.source === 'meal' ? 'Your meal' : null, intuitive ? null : f.per === '100g' ? (f.servingG && f.servingLabel ? `${r0((f.kcal * f.servingG) / 100)} kcal · ${f.servingLabel}` : `${r0(f.kcal)} kcal / 100 g`) : `${r0(f.kcal)} kcal / serving`].filter(Boolean).join(' · ') || ' '}
        </div>
      </div>
      {onDelete &&
        (confirming ? (
          <button
            className="btn danger sm"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            Delete
          </button>
        ) : (
          <button
            className="icon-btn sm plain"
            aria-label={`Delete ${f.name}`}
            onClick={(e) => {
              e.stopPropagation();
              setConfirming(true);
              setTimeout(() => setConfirming(false), 3000);
            }}
          >
            <Icon name="trash" size={16} />
          </button>
        ))}
      {intuitive ? <FillDot fraction={ref.kcal / target} /> : <Icon name="plus" size={20} />}
    </div>
  );
}

function SearchTab({ onPick, intuitive, target }: { onPick: (f: Food) => void; intuitive: boolean; target: number }) {
  const s = useStore();
  const [q, setQ] = useState('');
  const [results, setResults] = useState<Food[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [asking, setAsking] = useState(false);
  const [askErr, setAskErr] = useState('');
  const ctrl = useRef<AbortController | null>(null);
  const term = q.trim();

  const local = useMemo(() => {
    const t = term.toLowerCase();
    if (!t) return [];
    const words = t.split(/\s+/);
    return s.foods.filter((f) => f.source !== 'common' && words.every((w) => f.name.toLowerCase().includes(w))).slice(0, 6);
  }, [term, s.foods]);
  const common = useMemo(() => (term ? searchCommon(term) : []), [term]);

  useEffect(() => {
    setAskErr('');
    if (term.length < 3) {
      setResults([]);
      setErr(null);
      return;
    }
    const timer = setTimeout(async () => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      setLoading(true);
      setErr(null);
      try {
        setResults(await searchFoods(term, ctrl.current.signal));
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setErr("Packaged-food search isn't responding right now.");
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [term]);

  const ask = async () => {
    setAsking(true);
    setAskErr('');
    try {
      onPick(await askAiForFood(term));
    } catch (e) {
      setAskErr((e as Error).message);
    } finally {
      setAsking(false);
    }
  };

  const row = (f: Food) => <FoodRow key={f.id} f={f} onPick={onPick} intuitive={intuitive} target={target} />;

  return (
    <div className="stack">
      <div className="input-suffix">
        <input className="input" autoFocus placeholder="Search foods, e.g. boiled egg" value={q} onChange={(e) => setQ(e.target.value)} />
        <span><Icon name="search" size={18} /></span>
      </div>
      {local.length > 0 && (
        <div className="card">
          <div className="small muted" style={{ fontWeight: 700 }}>Your foods</div>
          <div className="list">{local.map(row)}</div>
        </div>
      )}
      {common.length > 0 && (
        <div className="card">
          <div className="small muted" style={{ fontWeight: 700 }}>Everyday foods</div>
          <div className="list">{common.map(row)}</div>
        </div>
      )}
      {loading && <div className="empty">Searching packaged foods…</div>}
      {results.length > 0 && (
        <div className="card">
          <div className="small muted" style={{ fontWeight: 700 }}>Packaged products</div>
          <div className="list">{results.map(row)}</div>
        </div>
      )}
      {err && <div className="hint">{err} Everyday foods above still work, or ask Gemini.</div>}
      {term.length >= 2 && !loading && (
        <div className="card row">
          <div className="grow small">
            <b>{local.length || common.length || results.length ? "Don't see it?" : 'No matches yet.'}</b>
            <div className="muted">Get typical nutrition for “{term}” from Gemini.</div>
          </div>
          <button className="btn sm" onClick={ask} disabled={asking}>
            <span className={asking ? 'spin' : ''} style={{ display: 'inline-flex' }}><Icon name="sparkle" size={16} /></span> {asking ? 'Asking…' : 'Ask Gemini'}
          </button>
        </div>
      )}
      {askErr && <div className="error">{askErr}</div>}
    </div>
  );
}

function MineTab({ onPick, intuitive, target }: { onPick: (f: Food) => void; intuitive: boolean; target: number }) {
  const s = useStore();
  const recent = s.recentFoodIds.map((id) => s.foods.find((f) => f.id === id)).filter((f): f is Food => !!f && f.source !== 'meal');
  const custom = s.foods.filter((f) => f.source === 'custom' && !s.recentFoodIds.includes(f.id));
  const meals = s.meals.map(mealToFood);
  return (
    <div className="stack">
      {meals.length > 0 && (
        <div className="card">
          <div className="small muted" style={{ fontWeight: 700 }}>Meals you've cooked</div>
          <div className="list">
            {meals.map((f) => (
              <FoodRow
                key={f.id}
                f={f}
                onPick={onPick}
                intuitive={intuitive}
                target={target}
                onDelete={() => {
                  setState((st) => ({ ...st, meals: st.meals.filter((m) => `meal-${m.id}` !== f.id) }));
                  toast(`Deleted ${f.name}`);
                }}
              />
            ))}
          </div>
        </div>
      )}
      <div className="card">
        <div className="small muted" style={{ fontWeight: 700 }}>Recent</div>
        {recent.length ? (
          <div className="list">{recent.map((f) => <FoodRow key={f.id} f={f} onPick={onPick} intuitive={intuitive} target={target} />)}</div>
        ) : (
          <div className="empty">Foods you log will show up here.</div>
        )}
      </div>
      {custom.length > 0 && (
        <div className="card">
          <div className="small muted" style={{ fontWeight: 700 }}>Created by you</div>
          <div className="list">
            {custom.map((f) => (
              <FoodRow
                key={f.id}
                f={f}
                onPick={onPick}
                intuitive={intuitive}
                target={target}
                onDelete={() => {
                  setState((st) => ({ ...st, foods: st.foods.filter((x) => x.id !== f.id) }));
                  toast(`Deleted ${f.name}`);
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AmountPicker({ food, target, intuitive, mode, slot, setSlot, onConfirm }: { food: Food; target: number; intuitive: boolean; mode: 'log' | 'ingredient'; slot: MealSlot; setSlot: (s: MealSlot) => void; onConfirm: (f: Food, n: Nutrition, amount: string, grams?: number) => void }) {
  const hasServing = food.per === 'serving' || !!food.servingG;
  const [unit, setUnit] = useState<'g' | 'serving'>(hasServing && mode === 'log' ? 'serving' : 'g');
  const [qty, setQty] = useState(unit === 'serving' ? '1' : food.per === 'serving' ? '1' : '100');
  const q = parseFloat(qty) || 0;
  const effUnit = food.per === 'serving' && !food.servingG ? 'serving' : unit;
  const n = nutritionFor(food, q, effUnit);
  const grams = effUnit === 'g' ? q : food.servingG ? q * food.servingG : undefined;
  const amount = effUnit === 'g' ? `${r1(q)} g` : `${r1(q)} serving${q === 1 ? '' : 's'}${food.servingLabel ? ` (${food.servingLabel})` : ''}`;
  const f = n.kcal / target;

  return (
    <div className="stack lg">
      <div>
        <h2>{food.name}</h2>
        {food.brand && <div className="muted">{food.brand}</div>}
      </div>

      {food.servingLabel && <div className="hint" style={{ marginTop: -10 }}>1 serving = {food.servingLabel}</div>}
      {hasServing && food.servingG && (
        <Seg value={unit} onChange={(u) => { setUnit(u); setQty(u === 'g' ? String(food.servingG ?? 100) : '1'); }} options={[{ value: 'serving', label: 'Servings' }, { value: 'g', label: 'Grams' }]} />
      )}
      <div className="row">
        <button className="icon-btn" style={{ width: 48, height: 48 }} onClick={() => setQty(String(Math.max(0, q - (effUnit === 'g' ? 10 : 0.5))))} aria-label="Less">
          <Icon name="minus" />
        </button>
        <div className="input-suffix grow">
          <input className="input num center" inputMode="decimal" type="number" value={qty} onChange={(e) => setQty(e.target.value)} style={{ fontSize: 22, fontWeight: 800 }} />
          <span>{effUnit === 'g' ? 'g' : 'serv'}</span>
        </div>
        <button className="icon-btn" style={{ width: 48, height: 48 }} onClick={() => setQty(String(q + (effUnit === 'g' ? 10 : 0.5)))} aria-label="More">
          <Icon name="plus" />
        </button>
      </div>

      {intuitive ? (
        <div className="card row">
          <FillDot fraction={f} size={56} />
          <div>
            <h3>{portionWord(f)}</h3>
            <div className="small muted">of today's room</div>
          </div>
        </div>
      ) : (
        <div className="grid2">
          <div className="stat"><b className="num">{r0(n.kcal)}</b><span>kcal</span></div>
          <div className="stat"><b className="num">{r0(n.protein)} g</b><span>Protein</span></div>
          <div className="stat"><b className="num">{r0(n.carbs)} g</b><span>Carbs</span></div>
          <div className="stat"><b className="num">{r0(n.fat)} g</b><span>Fat</span></div>
        </div>
      )}

      {mode === 'log' && (
        <Seg value={slot} onChange={setSlot} options={MEAL_SLOTS.map((m) => ({ value: m.id, label: m.label }))} />
      )}

      <button className="btn block" disabled={q <= 0} onClick={() => onConfirm(food, n, amount, grams)}>
        {mode === 'log' ? `Add to ${MEAL_SLOTS.find((m) => m.id === slot)!.label.toLowerCase()}` : 'Add to meal'}
      </button>
    </div>
  );
}

function ManualIngredient({ onAdd }: { onAdd: (i: Ingredient) => void }) {
  const [name, setName] = useState('');
  const [amount, setAmount] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  return (
    <div className="stack">
      <p className="muted small" style={{ margin: 0 }}>For things like spices or a splash of sauce. Nutrition is optional.</p>
      <input className="input" placeholder="Ingredient, e.g. ginger" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input" placeholder="Amount, e.g. 1 thumb" value={amount} onChange={(e) => setAmount(e.target.value)} />
      <div className="grid2">
        <NumField label="kcal" value={kcal} onChange={setKcal} />
        <NumField label="Protein g" value={p} onChange={setP} />
        <NumField label="Carbs g" value={c} onChange={setC} />
        <NumField label="Fat g" value={f} onChange={setF} />
      </div>
      <button className="btn block" disabled={!name.trim()} onClick={() => onAdd({ id: uid(), name: name.trim(), amount: amount.trim(), kcal: +kcal || 0, protein: +p || 0, carbs: +c || 0, fat: +f || 0 })}>
        Add to meal
      </button>
    </div>
  );
}

function CreateTab({ date, slot, setSlot, onDone, onMix }: { date?: string; slot: MealSlot; setSlot: (s: MealSlot) => void; onDone: () => void; onMix: (m: Meal) => void }) {
  const [kind, setKind] = useState<'mix' | 'numbers'>('mix');
  return (
    <div className="stack">
      <Seg
        value={kind}
        onChange={setKind}
        options={[
          { value: 'mix', label: 'I made it' },
          { value: 'numbers', label: 'Just numbers' },
        ]}
      />
      {kind === 'mix' ? <MixBuilder onSaved={onMix} /> : <KnownNumbers date={date!} slot={slot} setSlot={setSlot} onDone={onDone} />}
    </div>
  );
}

