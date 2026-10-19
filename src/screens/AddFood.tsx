import { useEffect, useMemo, useRef, useState } from 'react';
import { lookupBarcode, searchFoods } from '../lib/foodApi';
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
import { Scanner as BarcodeScanner } from '../components/Scanner';
import { FillDot, Icon, NumField, Seg, Sheet, portionWord, r0, r1, toast } from '../components/ui';

type Tab = 'search' | 'scan' | 'mine' | 'quick' | 'create';

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

export function AddFood({ mode, date, slot: initialSlot, startTab = 'search', onClose, onIngredient }: Props) {
  const s = useStore();
  const [tab, setTab] = useState<Tab>(startTab);
  const [picked, setPicked] = useState<Food | null>(null);
  const [slot, setSlot] = useState<MealSlot>(initialSlot ?? guessSlot());
  const [pendingBarcode, setPendingBarcode] = useState<string | undefined>();
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
    { value: 'search', label: 'Search' },
    { value: 'scan', label: 'Scan' },
    { value: 'mine', label: 'My foods' },
    { value: 'quick', label: mode === 'log' ? 'Quick add' : 'Manual' },
    { value: 'create', label: 'Create' },
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
          {tab === 'scan' && (
            <ScanTab
              onFound={setPicked}
              onMissing={(code) => {
                setPendingBarcode(code);
                setTab('create');
                toast('Not in the database yet. Add it once and it will be remembered.');
              }}
            />
          )}
          {tab === 'mine' && <MineTab onPick={setPicked} intuitive={intuitive} target={target} />}
          {tab === 'quick' && (mode === 'log' ? <QuickAdd intuitive={intuitive} target={target} slot={slot} setSlot={setSlot} date={date!} onDone={onClose} /> : <ManualIngredient onAdd={(ing) => { onIngredient?.(ing); onClose(); }} />)}
          {tab === 'create' && (
            <CreateFood
              barcode={pendingBarcode}
              onCreated={(f) => {
                setState((st) => ({ ...st, foods: [f, ...st.foods] }));
                setPicked(f);
              }}
            />
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

function FoodRow({ f, onPick, intuitive, target }: { f: Food; onPick: (f: Food) => void; intuitive: boolean; target: number }) {
  const ref = f.per === '100g' ? nutritionFor(f, f.servingG ? 1 : 100, f.servingG ? 'serving' : 'g') : f;
  return (
    <div className="list-item tap" onClick={() => onPick(f)} role="button" tabIndex={0} onKeyDown={(e) => e.key === 'Enter' && onPick(f)}>
      <div className="grow">
        <div className="title">{f.name}</div>
        <div className="small muted">
          {[f.brand, f.source === 'meal' ? 'Your meal' : null, intuitive ? null : f.per === '100g' ? `${r0(f.kcal)} kcal / 100 g` : `${r0(f.kcal)} kcal / serving`].filter(Boolean).join(' · ') || ' '}
        </div>
      </div>
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
  const ctrl = useRef<AbortController | null>(null);

  const local = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return [];
    return s.foods.filter((f) => f.name.toLowerCase().includes(t)).slice(0, 8);
  }, [q, s.foods]);

  useEffect(() => {
    const t = q.trim();
    if (t.length < 3) {
      setResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      ctrl.current?.abort();
      ctrl.current = new AbortController();
      setLoading(true);
      setErr(null);
      try {
        setResults(await searchFoods(t, ctrl.current.signal));
      } catch (e) {
        if ((e as Error).name !== 'AbortError') setErr('Search is unavailable right now. Try scanning or create the food.');
      } finally {
        setLoading(false);
      }
    }, 450);
    return () => clearTimeout(timer);
  }, [q]);

  return (
    <div className="stack">
      <div className="input-suffix">
        <input className="input" autoFocus placeholder="Search foods, e.g. greek yogurt" value={q} onChange={(e) => setQ(e.target.value)} />
        <span><Icon name="search" size={18} /></span>
      </div>
      {local.length > 0 && (
        <div className="card">
          <div className="small muted" style={{ fontWeight: 700 }}>Your foods</div>
          <div className="list">{local.map((f) => <FoodRow key={f.id} f={f} onPick={onPick} intuitive={intuitive} target={target} />)}</div>
        </div>
      )}
      {loading && <div className="empty">Searching…</div>}
      {err && <div className="error">{err}</div>}
      {results.length > 0 && (
        <div className="card">
          <div className="small muted" style={{ fontWeight: 700 }}>Open Food Facts</div>
          <div className="list">{results.map((f) => <FoodRow key={f.id} f={f} onPick={onPick} intuitive={intuitive} target={target} />)}</div>
        </div>
      )}
      {!loading && q.trim().length >= 3 && !results.length && !local.length && !err && <div className="empty">No matches. Try the Create tab.</div>}
    </div>
  );
}

function ScanTab({ onFound, onMissing }: { onFound: (f: Food) => void; onMissing: (code: string) => void }) {
  const s = useStore();
  const [status, setStatus] = useState<'scanning' | 'looking' | 'error'>('scanning');
  const [msg, setMsg] = useState('');
  const [key, setKey] = useState(0);

  const handle = async (code: string) => {
    const known = s.foods.find((f) => f.barcode === code);
    if (known) return onFound(known);
    setStatus('looking');
    try {
      const f = await lookupBarcode(code);
      if (f) onFound(f);
      else onMissing(code);
    } catch {
      setStatus('error');
      setMsg(`Couldn't reach the food database for ${code}.`);
    }
  };

  if (status === 'looking') return <div className="empty">Looking up product…</div>;
  if (status === 'error')
    return (
      <div className="stack">
        <div className="callout warn">{msg}</div>
        <button className="btn ghost" onClick={() => { setStatus('scanning'); setKey(key + 1); }}>Scan again</button>
      </div>
    );
  return (
    <div className="stack">
      <BarcodeScanner key={key} onDetect={handle} />
      <p className="hint center" style={{ margin: 0 }}>Point at the barcode on the pack. Products come from Open Food Facts.</p>
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
          <div className="list">{meals.map((f) => <FoodRow key={f.id} f={f} onPick={onPick} intuitive={intuitive} target={target} />)}</div>
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
          <div className="list">{custom.map((f) => <FoodRow key={f.id} f={f} onPick={onPick} intuitive={intuitive} target={target} />)}</div>
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

const SIZES = [
  { label: 'A few bites', f: 0.05 },
  { label: 'Small snack', f: 0.1 },
  { label: 'Light meal', f: 0.2 },
  { label: 'Regular meal', f: 0.3 },
  { label: 'Big meal', f: 0.4 },
];

function QuickAdd({ intuitive, target, slot, setSlot, date, onDone }: { intuitive: boolean; target: number; slot: MealSlot; setSlot: (s: MealSlot) => void; date: string; onDone: () => void }) {
  const s = useStore();
  const [name, setName] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const split = s.plan?.split ?? { p: 30, c: 45, f: 25 };

  if (intuitive) {
    return (
      <div className="stack">
        <p className="muted small" style={{ margin: 0 }}>Ate something you can't look up? Pick roughly how big it was.</p>
        <input className="input" placeholder="What was it? (optional)" value={name} onChange={(e) => setName(e.target.value)} />
        <Seg value={slot} onChange={setSlot} options={MEAL_SLOTS.map((m) => ({ value: m.id, label: m.label }))} />
        {SIZES.map((sz) => (
          <button
            key={sz.label}
            className="choice"
            onClick={() => {
              const k = target * sz.f;
              addLog({ date, slot, name: name.trim() || sz.label, amount: sz.label.toLowerCase(), kcal: k, protein: (k * split.p) / 400, carbs: (k * split.c) / 400, fat: (k * split.f) / 900 });
              toast('Logged');
              onDone();
            }}
          >
            <FillDot fraction={sz.f} />
            <h3 className="grow">{sz.label}</h3>
          </button>
        ))}
      </div>
    );
  }

  const k = parseFloat(kcal) || 0;
  return (
    <div className="stack">
      <input className="input" placeholder="Name (optional)" value={name} onChange={(e) => setName(e.target.value)} />
      <NumField label="Calories" value={kcal} onChange={setKcal} suffix="kcal" />
      <div className="grid3">
        <NumField label="Protein" value={p} onChange={setP} suffix="g" />
        <NumField label="Carbs" value={c} onChange={setC} suffix="g" />
        <NumField label="Fat" value={f} onChange={setF} suffix="g" />
      </div>
      <Seg value={slot} onChange={setSlot} options={MEAL_SLOTS.map((m) => ({ value: m.id, label: m.label }))} />
      <button
        className="btn block"
        disabled={k <= 0}
        onClick={() => {
          addLog({ date, slot, name: name.trim() || 'Quick add', amount: '', kcal: k, protein: parseFloat(p) || 0, carbs: parseFloat(c) || 0, fat: parseFloat(f) || 0 });
          toast('Logged');
          onDone();
        }}
      >
        Log it
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

function CreateFood({ barcode, onCreated }: { barcode?: string; onCreated: (f: Food) => void }) {
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [per, setPer] = useState<'100g' | 'serving'>('100g');
  const [servingG, setServingG] = useState('');
  const [kcal, setKcal] = useState('');
  const [p, setP] = useState('');
  const [c, setC] = useState('');
  const [f, setF] = useState('');
  const ok = name.trim() && parseFloat(kcal) >= 0 && kcal !== '';
  return (
    <div className="stack">
      {barcode && <div className="chip">Barcode {barcode}</div>}
      <input className="input" placeholder="Food name" value={name} onChange={(e) => setName(e.target.value)} />
      <input className="input" placeholder="Brand (optional)" value={brand} onChange={(e) => setBrand(e.target.value)} />
      <Seg value={per} onChange={setPer} options={[{ value: '100g', label: 'Per 100 g' }, { value: 'serving', label: 'Per serving' }]} />
      <p className="hint" style={{ margin: 0 }}>Copy the numbers from the nutrition label.</p>
      <div className="grid2">
        <NumField label="Calories" value={kcal} onChange={setKcal} suffix="kcal" />
        <NumField label={per === 'serving' ? 'Serving size' : 'Usual serving'} value={servingG} onChange={setServingG} suffix="g" hint="Optional" />
        <NumField label="Protein" value={p} onChange={setP} suffix="g" />
        <NumField label="Carbs" value={c} onChange={setC} suffix="g" />
        <NumField label="Fat" value={f} onChange={setF} suffix="g" />
      </div>
      <button
        className="btn block"
        disabled={!ok}
        onClick={() =>
          onCreated({
            id: `custom-${uid()}`,
            name: name.trim(),
            brand: brand.trim() || undefined,
            barcode,
            per,
            servingG: parseFloat(servingG) || undefined,
            kcal: +kcal || 0,
            protein: +p || 0,
            carbs: +c || 0,
            fat: +f || 0,
            source: 'custom',
          })
        }
      >
        Save food
      </button>
    </div>
  );
}
