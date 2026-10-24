import { useEffect, useRef, useState } from 'react';
import { MEAL_SLOTS, addLog, sumNutrition, useStore, type MealSlot, type Nutrition } from '../lib/store';
import { FillDot, Icon, NumField, Seg, portionWord, r0, toast } from '../components/ui';

export interface EstimateItem extends Nutrition {
  name: string;
  amount: string;
  qty?: number;
  unit?: string;
  fromLabel?: boolean;
}
export interface Estimate {
  name: string;
  items: EstimateItem[];
  confidence?: 'low' | 'medium' | 'high';
  note?: string;
}

// ---------- shared helpers ----------
let aiStatus: Promise<boolean> | null = null;
export function useAiEnabled() {
  const [enabled, setEnabled] = useState<boolean | null>(null);
  useEffect(() => {
    aiStatus ??= fetch('/api/estimate')
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => !!d.enabled)
      .catch(() => false);
    aiStatus.then(setEnabled);
  }, []);
  return enabled;
}

async function requestEstimate(body: { image?: string; description?: string; restaurant?: string; kind: string; ingredients?: { name: string; qty: number; unit: string }[]; images?: string[] }, signal?: AbortSignal): Promise<Estimate> {
  const res = await fetch('/api/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Estimate failed (${res.status})`);
  return d as Estimate;
}

/** Shrinks a photo to max 1024 px JPEG so uploads are small and fast. */
export function resizeImage(file: File, max = 1024): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement('canvas');
      c.width = Math.round(img.width * scale);
      c.height = Math.round(img.height * scale);
      c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Couldn't read that image"));
    };
    img.src = url;
  });
}

export function NoAi() {
  return (
    <div className="callout warn small">
      AI estimates aren't switched on yet. Add <b>GEMINI_API_KEY</b> (free from Google AI Studio) in your Vercel project (Settings → Environment Variables) and redeploy.
      Until then, use Search or Create → Just numbers.
    </div>
  );
}

// ---------- running an estimate (cancellable) ----------
export function useEstimateRun(onResult: (e: Estimate) => void) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const ctrl = useRef<AbortController | null>(null);
  useEffect(() => () => ctrl.current?.abort(), []);
  const run = async (body: Parameters<typeof requestEstimate>[0]) => {
    ctrl.current?.abort();
    const c = new AbortController();
    ctrl.current = c;
    setBusy(true);
    setErr('');
    try {
      onResult(await requestEstimate(body, c.signal));
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setErr((e as Error).message);
    } finally {
      if (ctrl.current === c) setBusy(false);
    }
  };
  const cancel = () => {
    ctrl.current?.abort();
    ctrl.current = null;
    setBusy(false);
  };
  return { busy, err, setErr, run, cancel };
}

// ---------- loading state ----------
export const PHOTO_MSGS = ['Looking at your plate…', 'Spotting each food…', 'Judging portion sizes…', 'Counting the sauces…', 'Adding it all up…'];
const OUT_MSGS = ['Checking the menu…', 'Looking up the nutrition…', 'Sizing up the portions…', 'Counting sides and drinks…', 'Adding it all up…'];

export function Estimating({ messages, onCancel }: { messages: string[]; onCancel?: () => void }) {
  const [i, setI] = useState(0);
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % messages.length), 1800);
    const s = setTimeout(() => setSlow(true), 15000);
    return () => {
      clearInterval(t);
      clearTimeout(s);
    };
  }, [messages.length]);
  return (
    <div className="card estimating" role="status" aria-live="polite">
      <div className="orb">
        <img src="/logo.png" alt="" />
      </div>
      <div key={i} className="msg">{messages[i]}</div>
      <div className="dots"><i /><i /><i /></div>
      <p className="small muted" style={{ margin: 0 }}>{slow ? 'Taking a bit longer than usual…' : 'This usually takes a few seconds.'}</p>
      {onCancel && <button className="link-btn" onClick={onCancel}>Cancel</button>}
    </div>
  );
}

// ---------- result + logging ----------
const PORTIONS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function EstimateResult({ est, date, slot, setSlot, onDone, onRetry }: { est: Estimate; date: string; slot: MealSlot; setSlot: (s: MealSlot) => void; onDone: () => void; onRetry?: () => void }) {
  const s = useStore();
  const intuitive = s.settings.intuitive;
  const target = s.plan?.kcal ?? 2000;
  const [name, setName] = useState(est.name);
  const [portion, setPortion] = useState(1);
  const [skip, setSkip] = useState<Set<number>>(new Set());
  const kept = est.items.filter((_, i) => !skip.has(i));
  const base = sumNutrition(kept);
  const est0 = { kcal: base.kcal * portion, protein: base.protein * portion, carbs: base.carbs * portion, fat: base.fat * portion };
  // Your own numbers, if you'd rather override the estimate.
  const [own, setOwn] = useState<null | { kcal: string; protein: string; carbs: string; fat: string }>(null);
  const num = (v: string) => Math.max(0, parseFloat(v) || 0);
  const n = own ? { kcal: num(own.kcal), protein: num(own.protein), carbs: num(own.carbs), fat: num(own.fat) } : est0;

  return (
    <div className="stack">
      <label className="field">
        Name
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </label>

      <div className="card">
        <div className="row between" style={{ marginBottom: 4 }}>
          <span className="small muted" style={{ fontWeight: 700 }}>What we think is there</span>
          {est.confidence && <span className={`chip ${est.confidence === 'high' ? 'safe' : est.confidence === 'low' ? 'unsafe' : 'firm'}`}>{est.confidence} confidence</span>}
        </div>
        <div className="list">
          {est.items.map((it, i) => (
            <label key={i} className="list-item" style={{ opacity: skip.has(i) ? 0.45 : 1 }}>
              <input
                type="checkbox"
                checked={!skip.has(i)}
                onChange={() => {
                  const next = new Set(skip);
                  if (next.has(i)) next.delete(i);
                  else next.add(i);
                  setSkip(next);
                }}
                style={{ width: 20, height: 20, accentColor: 'var(--green)' }}
              />
              <div className="grow">
                <div className="title">{it.name}</div>
                <div className="small muted">{it.amount}</div>
              </div>
              {intuitive ? <FillDot fraction={it.kcal / target} size={22} /> : <span className="num small" style={{ fontWeight: 700 }}>{r0(it.kcal)}</span>}
            </label>
          ))}
        </div>
        {est.note && <p className="hint" style={{ margin: '8px 0 0' }}>{est.note}</p>}
      </div>

{!own && (
      <div>
        <div style={{ fontWeight: 600, fontSize: 14, marginBottom: 8 }}>How much did you eat?</div>
        <div className="seg">
          {PORTIONS.map((p) => (
            <button key={p} className={portion === p ? 'on' : ''} onClick={() => setPortion(p)}>
              {p === 1 ? 'All' : `${p}×`}
            </button>
          ))}
        </div>
      </div>
      )}

      {own ? (
        <div className="card stack">
          <div className="row between">
            <h3>Your numbers</h3>
            <button className="link-btn" onClick={() => setOwn(null)}>Use the estimate</button>
          </div>
          <MacroInputs value={own} onChange={setOwn} />
        </div>
      ) : intuitive ? (
        <div className="card row">
          <FillDot fraction={n.kcal / target} size={56} />
          <div>
            <h3>{portionWord(n.kcal / target)}</h3>
            <div className="small muted">of today's room</div>
          </div>
        </div>
      ) : (
        <div className="stack" style={{ gap: 8 }}>
          <div className="grid2">
            <div className="stat"><b className="num">{r0(n.kcal)}</b><span>kcal (estimate)</span></div>
            <div className="stat"><b className="num">{r0(n.protein)} g</b><span>Protein</span></div>
            <div className="stat"><b className="num">{r0(n.carbs)} g</b><span>Carbs</span></div>
            <div className="stat"><b className="num">{r0(n.fat)} g</b><span>Fat</span></div>
          </div>
          <button
            className="link-btn"
            style={{ alignSelf: 'flex-start' }}
            onClick={() => setOwn({ kcal: String(r0(est0.kcal)), protein: String(r0(est0.protein)), carbs: String(r0(est0.carbs)), fat: String(r0(est0.fat)) })}
          >
            <Icon name="edit" size={14} /> Know the real numbers? Enter them
          </button>
        </div>
      )}

      <Seg value={slot} onChange={setSlot} options={MEAL_SLOTS.map((m) => ({ value: m.id, label: m.label }))} />
      <button
        className="btn block"
        disabled={!kept.length || (!!own && n.kcal <= 0)}
        onClick={() => {
          addLog({
            date,
            slot,
            name: name.trim() || 'Meal',
            amount: own ? 'your numbers' : `${portion === 1 ? '' : `${portion}× `}estimate`,
            ...n,
            items: kept.map((it) => ({ name: it.name, amount: portion === 1 ? it.amount : `${portion}× ${it.amount}`, kcal: it.kcal * portion, protein: it.protein * portion, carbs: it.carbs * portion, fat: it.fat * portion })),
          });
          toast(`Logged ${name.trim() || 'meal'}`);
          onDone();
        }}
      >
        Log it
      </button>
      {onRetry && <button className="link-btn" onClick={onRetry}>Start over</button>}
    </div>
  );
}

type Macros = { kcal: string; protein: string; carbs: string; fat: string };

function MacroInputs({ value, onChange }: { value: Macros; onChange: (m: Macros) => void }) {
  return (
    <div className="grid2">
      <NumField label="Calories" value={value.kcal} onChange={(v) => onChange({ ...value, kcal: v })} suffix="kcal" />
      <NumField label="Protein" value={value.protein} onChange={(v) => onChange({ ...value, protein: v })} suffix="g" />
      <NumField label="Carbs" value={value.carbs} onChange={(v) => onChange({ ...value, carbs: v })} suffix="g" />
      <NumField label="Fat" value={value.fat} onChange={(v) => onChange({ ...value, fat: v })} suffix="g" />
    </div>
  );
}

/** Log a meal with calories and macros you already know (from a menu, app or label). */
export function KnownNumbers({ date, slot, setSlot, onDone }: { date: string; slot: MealSlot; setSlot: (s: MealSlot) => void; onDone: () => void }) {
  const [name, setName] = useState('');
  const [m, setM] = useState<Macros>({ kcal: '', protein: '', carbs: '', fat: '' });
  const num = (v: string) => Math.max(0, parseFloat(v) || 0);
  const kcal = num(m.kcal);
  const fromMacros = num(m.protein) * 4 + num(m.carbs) * 4 + num(m.fat) * 9;
  const mismatch = kcal > 0 && fromMacros > 0 && Math.abs(fromMacros - kcal) / kcal > 0.25;
  return (
    <div className="stack">
      <label className="field">
        What did you eat?
        <input className="input" placeholder="e.g. Subway 6-inch chicken teriyaki" value={name} onChange={(e) => setName(e.target.value)} />
      </label>
      <MacroInputs value={m} onChange={setM} />
      {!kcal && fromMacros > 0 && <div className="hint">No calories entered. We'll use {r0(fromMacros)} kcal worked out from the macros.</div>}
      {mismatch && <div className="hint">Heads up: those macros add up to about {r0(fromMacros)} kcal, not {r0(kcal)}. Double-check if you can.</div>}
      <Seg value={slot} onChange={setSlot} options={MEAL_SLOTS.map((x) => ({ value: x.id, label: x.label }))} />
      <button
        className="btn block"
        disabled={!(kcal > 0 || fromMacros > 0)}
        onClick={() => {
          addLog({ date, slot, name: name.trim() || 'Meal', amount: 'your numbers', kcal: kcal || fromMacros, protein: num(m.protein), carbs: num(m.carbs), fat: num(m.fat) });
          toast(`Logged ${name.trim() || 'meal'}`);
          onDone();
        }}
      >
        Log it
      </button>
    </div>
  );
}

// ---------- Eating out tab ----------
export function EatingOutTab(props: { date: string; slot: MealSlot; setSlot: (s: MealSlot) => void; onDone: () => void }) {
  return <Describe {...props} />;
}

const PLACES = ['Taco Bell', "McDonald's", 'KFC', 'Subway', 'Mamak', 'Mixed rice (nasi campur)', 'Starbucks', 'Pizza Hut', 'Nando’s', 'Tealive'];

function Describe({ date, slot, setSlot, onDone }: { date: string; slot: MealSlot; setSlot: (s: MealSlot) => void; onDone: () => void }) {
  const enabled = useAiEnabled();
  const [place, setPlace] = useState('');
  const [order, setOrder] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [est, setEst] = useState<Estimate | null>(null);
  const { busy, err, run, cancel } = useEstimateRun(setEst);
  const file = useRef<HTMLInputElement>(null);

  if (est) return <EstimateResult est={est} date={date} slot={slot} setSlot={setSlot} onDone={onDone} onRetry={() => setEst(null)} />;
  if (busy) return <Estimating messages={OUT_MSGS} onCancel={cancel} />;

  return (
    <div className="stack">
      {enabled === false && <NoAi />}
      <label className="field">
        Where from?
        <input className="input" list="mm-places" placeholder="e.g. Taco Bell, mamak, Nasi Kandar Pelita" value={place} onChange={(e) => setPlace(e.target.value)} />
        <datalist id="mm-places">{PLACES.map((p) => <option key={p} value={p} />)}</datalist>
      </label>
      <label className="field">
        What did you have?
        <textarea className="input" rows={3} placeholder="e.g. Crunchwrap Supreme, 3 soft tacos, medium Pepsi Zero" value={order} onChange={(e) => setOrder(e.target.value)} />
        <span className="hint">Include sizes, drinks and sides. Chains with published nutrition get their official numbers where known.</span>
      </label>
      {image ? (
        <div className="row">
          <img src={image} alt="" style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 12 }} />
          <span className="grow small muted">Photo added</span>
          <button className="link-btn" onClick={() => setImage(null)}>Remove</button>
        </div>
      ) : (
        <button className="btn outline" onClick={() => file.current?.click()}>
          <Icon name="camera" size={18} /> Add a photo (optional)
        </button>
      )}
      <input ref={file} type="file" accept="image/*" capture="environment" hidden onChange={async (e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setImage(await resizeImage(f).catch(() => null)); }} />
      {err && <div className="error">{err}</div>}
      <button
        className="btn block"
        disabled={busy || enabled === false || !order.trim()}
        onClick={() => run({ restaurant: place, description: order, image: image ?? undefined, kind: 'restaurant' })}
      >
        <Icon name="sparkle" size={18} /> Estimate
      </button>
    </div>
  );
}
