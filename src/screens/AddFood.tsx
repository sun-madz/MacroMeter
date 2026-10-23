import { useEffect, useMemo, useRef, useState } from 'react';
import { askAiForFood, lookupBarcode, searchFoods } from '../lib/foodApi';
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
import { Scanner as BarcodeScanner } from '../components/Scanner';
import { EatingOutTab, EstimateResult, Estimating, KnownNumbers, PHOTO_MSGS, resizeImage, useAiEnabled, type Estimate } from './EstimateTabs';
import { MixBuilder } from './MixBuilder';
import { FillDot, Icon, NumField, Seg, Sheet, portionWord, r0, r1, toast } from '../components/ui';

export type Tab = 'search' | 'scan' | 'photo' | 'out' | 'mine' | 'quick' | 'create';

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
  const [tab, setTab] = useState<Tab>(startTab === 'photo' ? 'scan' : startTab);
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
    { value: 'create', label: 'Create' },
    { value: 'search', label: 'Search' },
    { value: 'scan', label: 'Scan' },
    ...(mode === 'log'
      ? ([
          { value: 'out', label: 'Eating out' },
        ] as { value: Tab; label: string }[])
      : []),
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
          {tab === 'scan' && (
            <ScanTab
              mode={mode}
              initial={startTab === 'photo' ? 'photo' : 'live'}
              date={date}
              slot={slot}
              setSlot={setSlot}
              onDone={onClose}
              onFound={setPicked}
              onMissing={(code) => {
                setPendingBarcode(code);
                setTab('create');
                toast('Not in the database yet. Add it once and it will be remembered.');
              }}
            />
          )}
          {tab === 'out' && <EatingOutTab date={date!} slot={slot} setSlot={setSlot} onDone={onClose} />}
          {tab === 'mine' && <MineTab onPick={setPicked} intuitive={intuitive} target={target} />}
          {tab === 'quick' && mode === 'ingredient' && <ManualIngredient onAdd={(ing) => { onIngredient?.(ing); onClose(); }} />}
          {tab === 'create' && (
            <CreateTab
              mode={mode}
              date={date}
              slot={slot}
              setSlot={setSlot}
              onDone={onClose}
              barcode={pendingBarcode}
              onMix={(meal) => setPicked(mealToFood(meal))}
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

function ScanTab({ mode, initial, date, slot, setSlot, onDone, onFound, onMissing }: { mode: 'log' | 'ingredient'; initial: 'live' | 'photo'; date?: string; slot: MealSlot; setSlot: (s: MealSlot) => void; onDone: () => void; onFound: (f: Food) => void; onMissing: (code: string) => void }) {
  const [view, setView] = useState<'live' | 'photo'>(initial);
  return (
    <div className="stack">
      <Seg value={view} onChange={setView} options={[{ value: 'live', label: 'Barcode' }, { value: 'photo', label: 'Photo' }]} />
      {view === 'live' ? <LiveBarcode onFound={onFound} onMissing={onMissing} /> : <SnapPhoto mode={mode} date={date} slot={slot} setSlot={setSlot} onDone={onDone} onFound={onFound} />}
    </div>
  );
}

function LiveBarcode({ onFound, onMissing }: { onFound: (f: Food) => void; onMissing: (code: string) => void }) {
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
      <p className="hint center" style={{ margin: 0 }}>Point at the barcode on the pack. No barcode? Use Package photo.</p>
    </div>
  );
}

const PACKAGE_MSGS = ['Looking for a barcode…', 'Reading the label…', 'Finding the nutrition table…', 'Checking serving size…', 'Almost there…'];

/** One photo of anything: a barcode in shot is used first, otherwise Gemini reads the
 *  package label or estimates the meal on the plate. (Ingredient mode: packages only.) */
function SnapPhoto({ mode, date, slot, setSlot, onDone, onFound }: { mode: 'log' | 'ingredient'; date?: string; slot: MealSlot; setSlot: (s: MealSlot) => void; onDone: () => void; onFound: (f: Food) => void }) {
  const s = useStore();
  const enabled = useAiEnabled();
  const [file, setFile] = useState<File | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [meal, setMeal] = useState<Estimate | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);
  const cancelled = useRef(false);

  const pick = async (f?: File) => {
    if (!f) return;
    setErr('');
    try {
      setImage(await resizeImage(f, 1600));
      setFile(f);
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  const go = async () => {
    if (!file || !image) return;
    cancelled.current = false;
    setErr('');
    setBusy(true);
    try {
      // 1. A barcode in the photo is the most accurate route.
      const { barcodeFromFile } = await import('../lib/imageBarcode');
      const code = await barcodeFromFile(file);
      if (cancelled.current) return;
      if (code) {
        const known = s.foods.find((f) => f.barcode === code);
        if (known) return onFound(known);
        const f = await lookupBarcode(code).catch(() => null);
        if (cancelled.current) return;
        if (f) {
          toast('Found by barcode');
          return onFound(f);
        }
      }
      // 2. Otherwise Gemini works out whether it's a package or a meal.
      const res = await fetch('/api/estimate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind: mode === 'log' ? 'auto' : 'package', image, description: desc }),
      });
      const d = await res.json().catch(() => ({}));
      if (cancelled.current) return;
      if (!res.ok) {
        if (res.status === 404 || res.status === 503) throw new Error("No barcode found, and AI photo reading isn't set up (add GEMINI_API_KEY in Vercel).");
        throw new Error(d.error || `Couldn't read the photo (${res.status})`);
      }
      if (d.type === 'meal') {
        setMeal({ name: d.name, items: d.items, confidence: d.confidence, note: d.note });
        return;
      }
      const p = d.product;
      toast(p.source === 'label' ? 'Read from the nutrition label' : 'No label visible, values are estimated');
      onFound({
        id: `pkg-${uid()}`,
        name: p.name,
        brand: p.brand,
        barcode: p.barcode || code || undefined,
        per: p.per,
        servingG: p.servingG,
        servingLabel: p.servingLabel,
        kcal: p.kcal,
        protein: p.protein,
        carbs: p.carbs,
        fat: p.fat,
        source: 'custom',
      });
    } catch (e) {
      if (!cancelled.current) setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  if (meal) return <EstimateResult est={meal} date={date!} slot={slot} setSlot={setSlot} onDone={onDone} onRetry={() => { setMeal(null); setImage(null); setFile(null); setDesc(''); }} />;
  if (busy) return <Estimating messages={mode === 'log' ? ['Looking for a barcode…', ...PHOTO_MSGS] : PACKAGE_MSGS} onCancel={() => { cancelled.current = true; setBusy(false); }} />;

  return (
    <div className="stack">
      {image ? (
        <div style={{ position: 'relative' }}>
          <img src={image} alt="Your photo" style={{ width: '100%', borderRadius: 20, display: 'block', maxHeight: 320, objectFit: 'cover' }} />
          <button className="icon-btn" style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,.55)', color: '#fff' }} onClick={() => { setImage(null); setFile(null); }} aria-label="Remove photo">
            <Icon name="x" />
          </button>
        </div>
      ) : (
        <div className="grid2">
          <button className="card center" style={{ border: 0, padding: 22 }} onClick={() => camera.current?.click()}>
            <Icon name="camera" size={30} />
            <div style={{ fontWeight: 700, marginTop: 6 }}>Take photo</div>
          </button>
          <button className="card center" style={{ border: 0, padding: 22, marginTop: 0 }} onClick={() => library.current?.click()}>
            <Icon name="image" size={30} />
            <div style={{ fontWeight: 700, marginTop: 6 }}>From gallery</div>
          </button>
        </div>
      )}
      <input ref={camera} type="file" accept="image/*" capture="environment" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      <input ref={library} type="file" accept="image/*" hidden onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
      <p className="hint" style={{ margin: 0 }}>
        {mode === 'log'
          ? 'Snap a meal or a package. A barcode in shot is used first; otherwise the label is read or the plate is estimated.'
          : 'Snap the pack or its nutrition label. A barcode in shot is used first.'}
      </p>
      {mode === 'log' && (
        <label className="field">
          Describe it (optional)
          <textarea className="input" rows={2} placeholder="e.g. half the rice, extra sambal, chicken was skinless" value={desc} onChange={(e) => setDesc(e.target.value)} />
        </label>
      )}
      {enabled === false && <div className="hint">Barcodes in photos work without AI. Reading labels and plates needs GEMINI_API_KEY in Vercel.</div>}
      {err && <div className="callout warn small">{err}</div>}
      <button className="btn block" disabled={!image} onClick={go}>
        <Icon name="sparkle" size={18} /> {mode === 'log' ? 'Estimate' : 'Read package'}
      </button>
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

function CreateTab({ mode, date, slot, setSlot, onDone, barcode, onMix, onCreated }: { mode: 'log' | 'ingredient'; date?: string; slot: MealSlot; setSlot: (s: MealSlot) => void; onDone: () => void; barcode?: string; onMix: (m: Meal) => void; onCreated: (f: Food) => void }) {
  // A scanned-but-unknown barcode goes straight to the label form.
  const [kind, setKind] = useState<'mix' | 'label' | 'numbers'>(mode === 'log' && !barcode ? 'mix' : 'label');
  return (
    <div className="stack">
      {mode === 'log' && (
        <Seg
          value={kind}
          onChange={setKind}
          options={[
            { value: 'mix', label: 'I made it' },
            { value: 'label', label: 'From a label' },
            { value: 'numbers', label: 'Just numbers' },
          ]}
        />
      )}
      {kind === 'mix' && <MixBuilder onSaved={onMix} />}
      {kind === 'label' && <CreateFood barcode={barcode} onCreated={onCreated} />}
      {kind === 'numbers' && <KnownNumbers date={date!} slot={slot} setSlot={setSlot} onDone={onDone} />}
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
