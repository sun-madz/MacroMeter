import { useEffect, useRef, useState } from 'react';
import { MEAL_SLOTS, addLog, sumNutrition, useStore, type MealSlot, type Nutrition } from '../lib/store';
import { FillDot, Icon, Seg, portionWord, r0, toast } from '../components/ui';

export interface EstimateItem extends Nutrition {
  name: string;
  amount: string;
}
export interface Estimate {
  name: string;
  items: EstimateItem[];
  confidence?: 'low' | 'medium' | 'high';
  note?: string;
}

// ---------- shared helpers ----------
let aiStatus: Promise<boolean> | null = null;
function useAiEnabled() {
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

async function requestEstimate(body: { image?: string; description?: string; restaurant?: string; kind: string }): Promise<Estimate> {
  const res = await fetch('/api/estimate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const d = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(d.error || `Estimate failed (${res.status})`);
  return d as Estimate;
}

/** Shrinks a photo to max 1024 px JPEG so uploads are small and fast. */
function resizeImage(file: File, max = 1024): Promise<string> {
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

function NoAi() {
  return (
    <div className="callout warn small">
      AI estimates aren't switched on yet. Add <b>ANTHROPIC_API_KEY</b> in your Vercel project (Settings → Environment Variables) and redeploy.
      Until then, use the mixed rice builder, Search, or Quick add.
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
  const n = { kcal: base.kcal * portion, protein: base.protein * portion, carbs: base.carbs * portion, fat: base.fat * portion };

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

      {intuitive ? (
        <div className="card row">
          <FillDot fraction={n.kcal / target} size={56} />
          <div>
            <h3>{portionWord(n.kcal / target)}</h3>
            <div className="small muted">of today's room</div>
          </div>
        </div>
      ) : (
        <div className="grid2">
          <div className="stat"><b className="num">{r0(n.kcal)}</b><span>kcal (estimate)</span></div>
          <div className="stat"><b className="num">{r0(n.protein)} g</b><span>Protein</span></div>
          <div className="stat"><b className="num">{r0(n.carbs)} g</b><span>Carbs</span></div>
          <div className="stat"><b className="num">{r0(n.fat)} g</b><span>Fat</span></div>
        </div>
      )}

      <Seg value={slot} onChange={setSlot} options={MEAL_SLOTS.map((m) => ({ value: m.id, label: m.label }))} />
      <button
        className="btn block"
        disabled={!kept.length}
        onClick={() => {
          addLog({ date, slot, name: name.trim() || 'Meal', amount: `${portion === 1 ? '' : `${portion}× `}estimate`, ...n });
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

// ---------- Photo tab ----------
export function PhotoTab({ date, slot, setSlot, onDone }: { date: string; slot: MealSlot; setSlot: (s: MealSlot) => void; onDone: () => void }) {
  const enabled = useAiEnabled();
  const [image, setImage] = useState<string | null>(null);
  const [desc, setDesc] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [est, setEst] = useState<Estimate | null>(null);
  const camera = useRef<HTMLInputElement>(null);
  const library = useRef<HTMLInputElement>(null);

  if (est) return <EstimateResult est={est} date={date} slot={slot} setSlot={setSlot} onDone={onDone} onRetry={() => { setEst(null); setImage(null); setDesc(''); }} />;

  const pick = async (f?: File) => {
    if (!f) return;
    setErr('');
    try {
      setImage(await resizeImage(f));
    } catch (e) {
      setErr((e as Error).message);
    }
  };

  return (
    <div className="stack">
      {enabled === false && <NoAi />}
      {image ? (
        <div style={{ position: 'relative' }}>
          <img src={image} alt="Your meal" style={{ width: '100%', borderRadius: 20, display: 'block', maxHeight: 320, objectFit: 'cover' }} />
          <button className="icon-btn" style={{ position: 'absolute', top: 10, right: 10, background: 'rgba(0,0,0,.55)', color: '#fff' }} onClick={() => setImage(null)} aria-label="Remove photo">
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
      <label className="field">
        Describe it (optional)
        <textarea className="input" rows={2} placeholder="e.g. half the rice, extra sambal, chicken was skinless" value={desc} onChange={(e) => setDesc(e.target.value)} />
        <span className="hint">Details the camera can't see (oil, sauces, what's hidden) make the estimate better.</span>
      </label>
      {err && <div className="error">{err}</div>}
      <button
        className="btn block"
        disabled={busy || enabled === false || (!image && !desc.trim())}
        onClick={async () => {
          setBusy(true);
          setErr('');
          try {
            setEst(await requestEstimate({ image: image ?? undefined, description: desc, kind: 'photo' }));
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Icon name="sparkle" size={18} /> {busy ? 'Estimating…' : 'Estimate'}
      </button>
    </div>
  );
}

// ---------- Eating out tab ----------
interface Dish extends Nutrition {
  id: string;
  name: string;
  unit: string;
}

// Typical Malaysian economy-rice (nasi campur / chap fan) portions. Rough averages per scoop/piece.
const MIXED_RICE: Dish[] = [
  { id: 'rice', name: 'White rice', unit: 'plate (~200 g)', kcal: 260, protein: 5, carbs: 57, fat: 0.5 },
  { id: 'rice-half', name: 'Rice, half portion', unit: '~100 g', kcal: 130, protein: 2.5, carbs: 28, fat: 0.3 },
  { id: 'fried-chicken', name: 'Fried chicken', unit: 'piece', kcal: 290, protein: 22, carbs: 8, fat: 19 },
  { id: 'curry-chicken', name: 'Curry chicken', unit: 'piece + gravy', kcal: 250, protein: 20, carbs: 5, fat: 16 },
  { id: 'sweet-sour', name: 'Sweet & sour chicken', unit: 'scoop', kcal: 260, protein: 15, carbs: 22, fat: 12 },
  { id: 'rendang', name: 'Beef rendang', unit: 'scoop', kcal: 230, protein: 18, carbs: 6, fat: 15 },
  { id: 'fried-fish', name: 'Fried fish', unit: 'piece', kcal: 220, protein: 20, carbs: 5, fat: 13 },
  { id: 'curry-fish', name: 'Curry / asam fish', unit: 'piece + gravy', kcal: 200, protein: 18, carbs: 5, fat: 12 },
  { id: 'fried-egg', name: 'Fried egg', unit: 'egg', kcal: 110, protein: 6, carbs: 0.5, fat: 9 },
  { id: 'braised-egg', name: 'Braised / curry egg', unit: 'egg', kcal: 90, protein: 6, carbs: 2, fat: 6 },
  { id: 'tofu', name: 'Tofu (braised or fried)', unit: 'scoop', kcal: 120, protein: 8, carbs: 4, fat: 8 },
  { id: 'veg', name: 'Stir-fried vegetables', unit: 'scoop', kcal: 70, protein: 2, carbs: 6, fat: 4.5 },
  { id: 'taugeh', name: 'Bean sprouts', unit: 'scoop', kcal: 60, protein: 3, carbs: 5, fat: 3 },
  { id: 'ikan-bilis', name: 'Sambal ikan bilis', unit: 'scoop', kcal: 100, protein: 8, carbs: 4, fat: 6 },
  { id: 'gravy', name: 'Extra curry gravy / sambal', unit: 'ladle', kcal: 60, protein: 1, carbs: 3, fat: 5 },
];

export function EatingOutTab({ date, slot, setSlot, onDone }: { date: string; slot: MealSlot; setSlot: (s: MealSlot) => void; onDone: () => void }) {
  const [mode, setMode] = useState<'describe' | 'mixed'>('describe');
  return (
    <div className="stack">
      <Seg value={mode} onChange={setMode} options={[{ value: 'describe', label: 'Restaurant / takeaway' }, { value: 'mixed', label: 'Mixed rice' }]} />
      {mode === 'describe' ? <Describe date={date} slot={slot} setSlot={setSlot} onDone={onDone} /> : <MixedRice date={date} slot={slot} setSlot={setSlot} onDone={onDone} />}
    </div>
  );
}

const PLACES = ['Taco Bell', "McDonald's", 'KFC', 'Subway', 'Mamak', 'Mixed rice stall', 'Starbucks', 'Pizza Hut', 'Nando’s', 'Tealive'];

function Describe({ date, slot, setSlot, onDone }: { date: string; slot: MealSlot; setSlot: (s: MealSlot) => void; onDone: () => void }) {
  const enabled = useAiEnabled();
  const [place, setPlace] = useState('');
  const [order, setOrder] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [est, setEst] = useState<Estimate | null>(null);
  const file = useRef<HTMLInputElement>(null);

  if (est) return <EstimateResult est={est} date={date} slot={slot} setSlot={setSlot} onDone={onDone} onRetry={() => setEst(null)} />;

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
        onClick={async () => {
          setBusy(true);
          setErr('');
          try {
            setEst(await requestEstimate({ restaurant: place, description: order, image: image ?? undefined, kind: 'restaurant' }));
          } catch (e) {
            setErr((e as Error).message);
          } finally {
            setBusy(false);
          }
        }}
      >
        <Icon name="sparkle" size={18} /> {busy ? 'Estimating…' : 'Estimate'}
      </button>
    </div>
  );
}

function MixedRice({ date, slot, setSlot, onDone }: { date: string; slot: MealSlot; setSlot: (s: MealSlot) => void; onDone: () => void }) {
  const s = useStore();
  const intuitive = s.settings.intuitive;
  const target = s.plan?.kcal ?? 2000;
  const [qty, setQty] = useState<Record<string, number>>({ rice: 1 });
  const picked = MIXED_RICE.filter((d) => qty[d.id]);
  const total = sumNutrition(picked.map((d) => ({ kcal: d.kcal * qty[d.id], protein: d.protein * qty[d.id], carbs: d.carbs * qty[d.id], fat: d.fat * qty[d.id] })));
  const change = (id: string, delta: number) => setQty((q) => ({ ...q, [id]: Math.max(0, (q[id] ?? 0) + delta) }));

  return (
    <div className="stack">
      <p className="small muted" style={{ margin: 0 }}>Tap what's on your plate. Works offline, using typical stall portions.</p>
      <div className="card" style={{ paddingTop: 4, paddingBottom: 4 }}>
        <div className="list">
          {MIXED_RICE.map((d) => (
            <div key={d.id} className="list-item">
              <div className="grow">
                <div className="title">{d.name}</div>
                <div className="small muted">{d.unit}{intuitive ? '' : ` · ${d.kcal} kcal`}</div>
              </div>
              {qty[d.id] ? (
                <>
                  <button className="icon-btn sm" onClick={() => change(d.id, -1)} aria-label={`Less ${d.name}`}><Icon name="minus" size={16} /></button>
                  <span className="num" style={{ fontWeight: 800, minWidth: 16, textAlign: 'center' }}>{qty[d.id]}</span>
                </>
              ) : null}
              <button className="icon-btn sm" onClick={() => change(d.id, 1)} aria-label={`Add ${d.name}`}><Icon name="plus" size={16} /></button>
            </div>
          ))}
        </div>
      </div>
      <div className="card row" style={{ position: 'sticky', bottom: 0 }}>
        {intuitive ? <FillDot fraction={total.kcal / target} size={40} /> : <div className="grow"><b className="num" style={{ fontSize: 20 }}>{r0(total.kcal)} kcal</b><div className="tiny muted num">P {r0(total.protein)} · C {r0(total.carbs)} · F {r0(total.fat)}</div></div>}
        {intuitive && <div className="grow"><b>{portionWord(total.kcal / target)}</b></div>}
        <select className="input" style={{ width: 120, minHeight: 40, padding: '6px 10px' }} value={slot} onChange={(e) => setSlot(e.target.value as MealSlot)}>
          {MEAL_SLOTS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        <button
          className="btn sm"
          disabled={!picked.length}
          onClick={() => {
            const name = 'Mixed rice: ' + picked.map((d) => (qty[d.id] > 1 ? `${qty[d.id]}× ` : '') + d.name.toLowerCase()).join(', ');
            addLog({ date, slot, name, amount: 'stall estimate', ...total });
            toast('Logged mixed rice');
            onDone();
          }}
        >
          Log
        </button>
      </div>
    </div>
  );
}
