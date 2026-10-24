import { useEffect, useMemo, useState } from 'react';
import { macrosFor, todayKey } from '../lib/calc';
import { cookbookReady, sendToCookbook } from '../lib/cookbook';
import { matchRecipes, type Recipe } from '../lib/recipes';
import { addLog, logsFor, setState, sumNutrition, uid, useStore, type Ingredient, type Meal, type MealSlot, type Nutrition } from '../lib/store';
import { FillDot, Icon, r0, toast } from '../components/ui';
import { AddFood } from './AddFood';
import { Estimating } from './EstimateTabs';

type Tab = 'pantry' | 'menus' | 'cook' | 'meals';

// Draft meal survives switching tabs.
let draft: Meal = newDraft();
function newDraft(): Meal {
  return { id: uid(), name: '', servings: 1, ingredients: [], createdAt: new Date().toISOString() };
}

const COMMON = ['Eggs', 'Chicken breast', 'Rice', 'Onion', 'Garlic', 'Tomato', 'Spinach', 'Cucumber', 'Oats', 'Milk', 'Greek yogurt', 'Bread', 'Tuna', 'Tofu', 'Noodles', 'Banana', 'Soy sauce', 'Potato', 'Carrot', 'Chickpeas', 'Fish', 'Cheese'];

function slotNow(recipeSlot?: Recipe['slot']): MealSlot {
  if (recipeSlot === 'breakfast') return 'breakfast';
  if (recipeSlot === 'snack') return 'snacks';
  const h = new Date().getHours();
  if (h < 11) return 'breakfast';
  if (h < 15) return 'lunch';
  if (h >= 17 && h < 22) return 'dinner';
  return 'snacks';
}

export function Kitchen({ goSettings }: { goSettings: () => void }) {
  const [tab, setTab] = useState<Tab>('pantry');
  const [meal, setMeal] = useState<Meal>(draft);
  useEffect(() => {
    draft = meal;
  }, [meal]);

  return (
    <div>
      <div className="topbar">
        <h1>Kitchen</h1>
      </div>
      <div className="pill-tabs" style={{ marginBottom: 16 }}>
        {(
          [
            ['pantry', 'On hand'],
            ['menus', 'Ideas'],
            ['cook', 'Cook'],
            ['meals', 'Saved meals'],
          ] as [Tab, string][]
        ).map(([v, l]) => (
          <button key={v} className={tab === v ? 'on' : ''} onClick={() => setTab(v)}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'pantry' && <Pantry goMenus={() => setTab('menus')} />}
      {tab === 'menus' && <Menus goSettings={goSettings} />}
      {tab === 'cook' && <MealBuilder meal={meal} setMeal={setMeal} goSettings={goSettings} onSaved={() => { setMeal(newDraft()); setTab('meals'); }} />}
      {tab === 'meals' && <Meals onEdit={(m) => { setMeal(m); setTab('cook'); }} goSettings={goSettings} />}
    </div>
  );
}

// ---------------- Pantry ----------------
function Pantry({ goMenus }: { goMenus: () => void }) {
  const s = useStore();
  const [text, setText] = useState('');
  const has = (n: string) => s.pantry.some((p) => p.name.toLowerCase() === n.toLowerCase());

  const add = (names: string[]) => {
    const clean = names.map((n) => n.trim()).filter((n) => n && !has(n));
    if (!clean.length) return;
    setState((st) => ({ ...st, pantry: [...st.pantry, ...clean.map((name) => ({ id: uid(), name }))] }));
  };
  const remove = (id: string) => setState((st) => ({ ...st, pantry: st.pantry.filter((p) => p.id !== id) }));

  return (
    <div className="stack">
      <div className="card stack">
        <h3>What's in your kitchen?</h3>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            add(text.split(','));
            setText('');
          }}
        >
          <input className="input grow" placeholder="e.g. chicken, rice, spinach" value={text} onChange={(e) => setText(e.target.value)} />
          <button className="icon-btn" style={{ width: 48, height: 48 }} aria-label="Add"><Icon name="plus" /></button>
        </form>
        {s.pantry.length ? (
          <div className="row wrap" style={{ gap: 8 }}>
            {s.pantry.map((p) => (
              <span key={p.id} className="chip safe">
                {p.name}
                <button onClick={() => remove(p.id)} aria-label={`Remove ${p.name}`}><Icon name="x" size={14} /></button>
              </span>
            ))}
          </div>
        ) : (
          <div className="empty">Nothing yet. Add what you have, or tap the staples below.</div>
        )}
        {s.pantry.length > 0 && (
          <div className="row">
            <button className="btn grow" onClick={goMenus}><Icon name="sparkle" size={18} /> Suggest menus</button>
            <button className="btn outline" onClick={() => setState((st) => ({ ...st, pantry: [] }))}>Clear</button>
          </div>
        )}
      </div>

      <div className="card">
        <div className="small muted" style={{ fontWeight: 700, marginBottom: 10 }}>Quick add</div>
        <div className="row wrap" style={{ gap: 8 }}>
          {COMMON.filter((c) => !has(c)).map((c) => (
            <button key={c} className="chip" style={{ border: 0 }} onClick={() => add([c])}>+ {c}</button>
          ))}
        </div>
      </div>

    </div>
  );
}

// ---------------- Menus ----------------
interface AiMeal {
  name: string;
  servings?: number;
  minutes?: number;
  ingredients: string[];
  steps?: string[];
  perServing?: Nutrition;
  extra?: string[];
}

function useRemaining() {
  const s = useStore();
  const target = macrosFor(s.plan!.kcal, s.plan!.split);
  const eaten = sumNutrition(logsFor(todayKey(), s.log));
  return { target, remaining: { kcal: target.kcal - eaten.kcal, protein: target.protein - eaten.protein, carbs: target.carbs - eaten.carbs, fat: target.fat - eaten.fat } };
}

function Menus({ goSettings }: { goSettings: () => void }) {
  const s = useStore();
  const { target, remaining } = useRemaining();
  const [filter, setFilter] = useState<'all' | Recipe['slot']>('all');
  const matches = useMemo(() => matchRecipes(s.pantry), [s.pantry]);
  const shown = matches.filter((m) => filter === 'all' || m.recipe.slot === filter);
  const [aiEnabled, setAiEnabled] = useState(false);
  const [ai, setAi] = useState<AiMeal[]>([]);
  const [aiBusy, setAiBusy] = useState(false);
  const [aiErr, setAiErr] = useState('');
  const intuitive = s.settings.intuitive;

  useEffect(() => {
    fetch('/api/menu')
      .then((r) => (r.ok ? r.json() : { enabled: false }))
      .then((d) => setAiEnabled(!!d.enabled))
      .catch(() => setAiEnabled(false));
  }, []);

  const askAi = async () => {
    setAiBusy(true);
    setAiErr('');
    try {
      const res = await fetch('/api/menu', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pantry: s.pantry.map((p) => p.name), remaining, meal: filter === 'all' ? undefined : filter, count: 3 }),
      });
      const d = await res.json();
      if (!res.ok) throw new Error(d.error || 'AI chef failed');
      setAi(d.meals || []);
    } catch (e) {
      setAiErr((e as Error).message);
    } finally {
      setAiBusy(false);
    }
  };

  if (!s.pantry.length) return <div className="card empty">Add what's on hand first, then menu ideas appear here.</div>;

  return (
    <div className="stack">
      <div className="card flat small">
        {intuitive ? (
          <div className="row"><FillDot fraction={1 - remaining.kcal / target.kcal} /> <span>Ideas that fit today are marked “fits today”.</span></div>
        ) : (
          <span>
            You have <b className="num">{Math.max(0, r0(remaining.kcal))} kcal</b> and <b className="num">{Math.max(0, r0(remaining.protein))} g protein</b> left today. Ideas that fit are marked.
          </span>
        )}
      </div>
      <div className="pill-tabs">
        {(
          [
            ['all', 'All'],
            ['breakfast', 'Breakfast'],
            ['main', 'Mains'],
            ['snack', 'Snacks'],
          ] as const
        ).map(([v, l]) => (
          <button key={v} className={filter === v ? 'on' : ''} onClick={() => setFilter(v)}>{l}</button>
        ))}
      </div>

      {aiEnabled && (
        <button className="btn outline" onClick={askAi} disabled={aiBusy}>
          <span className={aiBusy ? 'spin' : ''}><Icon name="sparkle" size={18} /></span> {aiBusy ? 'Thinking up meals…' : 'Ask the AI chef for new ideas'}
        </button>
      )}
      {aiBusy && <Estimating messages={['Raiding your pantry…', 'Matching ingredients…', 'Balancing the macros…', 'Plating up ideas…']} />}
      {aiErr && <div className="error">{aiErr}</div>}
      {ai.map((m, i) => (
        <MenuCard
          key={`ai-${i}`}
          name={m.name}
          meta={[m.minutes ? `${m.minutes} min` : null, m.servings ? `serves ${m.servings}` : null, 'AI chef'].filter(Boolean).join(' · ')}
          ingredients={m.ingredients}
          steps={m.steps}
          missing={m.extra}
          per={m.perServing}
          servings={m.servings}
          slot={slotNow()}
          remainingKcal={remaining.kcal}
          target={target.kcal}
          goSettings={goSettings}
        />
      ))}

      {shown.length === 0 && ai.length === 0 && <div className="card empty">No good matches yet. Add a few more ingredients{aiEnabled ? ' or ask the AI chef' : ''}.</div>}
      {shown.map(({ recipe: r, missing }) => (
        <MenuCard
          key={r.id}
          name={r.name}
          meta={`${r.minutes} min · serves ${r.servings}`}
          ingredients={r.ingredients.map((x) => `${x.amount} ${x.name}${x.optional ? ' (optional)' : ''}`)}
          steps={r.steps}
          missing={missing.map((x) => x.name)}
          per={r}
          servings={r.servings}
          slot={slotNow(r.slot)}
          remainingKcal={remaining.kcal}
          target={target.kcal}
          goSettings={goSettings}
        />
      ))}
    </div>
  );
}

function MenuCard({ name, meta, ingredients, steps, missing, per, servings, slot, remainingKcal, target, goSettings }: { name: string; meta: string; ingredients: string[]; steps?: string[]; missing?: string[]; per?: Nutrition; servings?: number; slot: MealSlot; remainingKcal: number; target: number; goSettings: () => void }) {
  const s = useStore();
  const [open, setOpen] = useState(false);
  const fits = per && per.kcal <= remainingKcal + 50;
  return (
    <div className="card">
      <div className="row between" style={{ alignItems: 'flex-start' }}>
        <div className="grow" onClick={() => setOpen(!open)} style={{ cursor: 'pointer' }}>
          <h3>{name}</h3>
          <div className="small muted">{meta}</div>
        </div>
        {per && (s.settings.intuitive ? <FillDot fraction={per.kcal / target} size={32} /> : <span className="chip num">{r0(per.kcal)} kcal</span>)}
      </div>
      <div className="row wrap" style={{ gap: 6, marginTop: 10 }}>
        {fits && <span className="chip safe">Fits today</span>}
        {missing && missing.length > 0 ? <span className="chip firm">Need: {missing.join(', ')}</span> : <span className="chip safe">You have everything</span>}
        {per && !s.settings.intuitive && <span className="chip num">P {r0(per.protein)} g</span>}
      </div>
      {open && (
        <div className="small" style={{ marginTop: 12 }}>
          <b>Ingredients</b>
          <ul style={{ margin: '4px 0 8px', paddingLeft: 20 }}>{ingredients.map((x) => <li key={x}>{x}</li>)}</ul>
          {steps && steps.length > 0 && (
            <>
              <b>Method</b>
              <ol className="steps-list">{steps.map((x) => <li key={x}>{x}</li>)}</ol>
            </>
          )}
        </div>
      )}
      <div className="row wrap" style={{ marginTop: 12, gap: 8 }}>
        <button className="btn sm ghost" onClick={() => setOpen(!open)}>{open ? 'Hide' : 'Recipe'}</button>
        {per && (
          <button
            className="btn sm ghost"
            onClick={() => {
              addLog({ date: todayKey(), slot, name, amount: '1 serving', kcal: per.kcal, protein: per.protein, carbs: per.carbs, fat: per.fat });
              toast(`Logged to ${slot}`);
            }}
          >
            Log a serving
          </button>
        )}
        <CookbookButton title={name} ingredients={ingredients} servings={servings} goSettings={goSettings} />
      </div>
    </div>
  );
}

function CookbookButton({ title, ingredients, servings, goSettings, onSent, label = 'Cookbook' }: { title: string; ingredients: string[]; servings?: number; goSettings: () => void; onSent?: () => void; label?: string }) {
  const s = useStore();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn sm ghost"
      disabled={busy || !title.trim() || !ingredients.length}
      onClick={async () => {
        if (!cookbookReady(s.settings)) {
          toast('Link your Google Doc in Settings first');
          goSettings();
          return;
        }
        setBusy(true);
        try {
          const r = await sendToCookbook(s.settings, { title, ingredients, servings });
          toast(r === 'sent' ? 'Added to your cookbook doc' : 'Sent to your cookbook doc');
          onSent?.();
        } catch (e) {
          toast((e as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <Icon name="book" size={16} /> {busy ? 'Sending…' : label}
    </button>
  );
}

// ---------------- Meal builder ----------------
const ingLine = (i: Ingredient) => [i.amount, i.name].filter(Boolean).join(' ');

function MealBuilder({ meal, setMeal, goSettings, onSaved }: { meal: Meal; setMeal: (m: Meal) => void; goSettings: () => void; onSaved: () => void }) {
  const s = useStore();
  const [adding, setAdding] = useState<null | 'search'>(null);
  const total = sumNutrition(meal.ingredients);
  const per = meal.servings > 0 ? meal.servings : 1;
  const target = s.plan!.kcal;
  const intuitive = s.settings.intuitive;
  const existing = s.meals.some((m) => m.id === meal.id);

  const save = (sent = false) => {
    const m = { ...meal, name: meal.name.trim() || 'Untitled meal', sentToCookbook: sent ? new Date().toISOString() : meal.sentToCookbook };
    setState((st) => ({ ...st, meals: [m, ...st.meals.filter((x) => x.id !== m.id)] }));
    return m;
  };

  return (
    <div className="stack">
      <div className="card stack">
        <label className="field">
          Meal name
          <input className="input" placeholder="e.g. Mum's chicken soup" value={meal.name} onChange={(e) => setMeal({ ...meal, name: e.target.value })} />
        </label>
        <div className="row">
          <span className="grow" style={{ fontWeight: 600, fontSize: 14 }}>Makes how many servings?</span>
          <button className="icon-btn sm" onClick={() => setMeal({ ...meal, servings: Math.max(1, meal.servings - 1) })} aria-label="Fewer servings"><Icon name="minus" size={18} /></button>
          <span className="num" style={{ fontWeight: 800, minWidth: 22, textAlign: 'center' }}>{meal.servings}</span>
          <button className="icon-btn sm" onClick={() => setMeal({ ...meal, servings: meal.servings + 1 })} aria-label="More servings"><Icon name="plus" size={18} /></button>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 6 }}>
        <h3>Ingredients</h3>
        <div className="row">
          <button className="btn sm" onClick={() => setAdding('search')}><Icon name="plus" size={16} /> Add</button>
        </div>
      </div>
      <div className="card">
        {meal.ingredients.length === 0 ? (
          <div className="empty">Scan packets or search for each ingredient as you cook.</div>
        ) : (
          <div className="list">
            {meal.ingredients.map((i) => (
              <div key={i.id} className="list-item">
                <div className="grow">
                  <div className="title">{i.name}</div>
                  <div className="small muted">{[i.amount, intuitive ? null : `${r0(i.kcal)} kcal`].filter(Boolean).join(' · ')}</div>
                </div>
                <button className="icon-btn sm plain" aria-label={`Remove ${i.name}`} onClick={() => setMeal({ ...meal, ingredients: meal.ingredients.filter((x) => x.id !== i.id) })}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {meal.ingredients.length > 0 && (
        <div className="card">
          {intuitive ? (
            <div className="row">
              <FillDot fraction={total.kcal / per / target} size={48} />
              <div>
                <h3>One serving</h3>
                <div className="small muted">fills about this much of your day</div>
              </div>
            </div>
          ) : (
            <div className="grid2">
              <div className="stat"><b className="num">{r0(total.kcal / per)}</b><span>kcal per serving</span></div>
              <div className="stat"><b className="num">{r0(total.protein / per)} g</b><span>Protein per serving</span></div>
              <div className="stat"><b className="num">{r0(total.carbs / per)} g</b><span>Carbs per serving</span></div>
              <div className="stat"><b className="num">{r0(total.fat / per)} g</b><span>Fat per serving</span></div>
            </div>
          )}
        </div>
      )}

      <div className="stack">
        <button
          className="btn block"
          disabled={!meal.ingredients.length}
          onClick={() => {
            const m = save();
            addLog({ date: todayKey(), slot: slotNow(), name: m.name, amount: `1 of ${per} servings`, kcal: total.kcal / per, protein: total.protein / per, carbs: total.carbs / per, fat: total.fat / per });
            toast(`Saved and logged 1 serving to ${slotNow()}`);
            onSaved();
          }}
        >
          Save & log a serving
        </button>
        <div className="row">
          <button className="btn ghost grow" disabled={!meal.ingredients.length} onClick={() => { save(); toast('Meal saved'); onSaved(); }}>
            {existing ? 'Save changes' : 'Save meal'}
          </button>
          <CookbookButton
            label="Send to cookbook"
            title={meal.name || 'Untitled meal'}
            ingredients={meal.ingredients.map(ingLine)}
            servings={meal.servings}
            goSettings={goSettings}
            onSent={() => setMeal(save(true))}
          />
        </div>
        {meal.ingredients.length > 0 && <button className="link-btn" onClick={() => setMeal(newDraft())}>Start over</button>}
      </div>

      {adding && (
        <AddFood
          mode="ingredient"
          startTab={adding}
          onClose={() => setAdding(null)}
          onIngredient={(ing) => setMeal({ ...meal, ingredients: [...meal.ingredients, ing] })}
        />
      )}
    </div>
  );
}

// ---------------- Saved meals ----------------
function Meals({ onEdit, goSettings }: { onEdit: (m: Meal) => void; goSettings: () => void }) {
  const s = useStore();
  const target = s.plan!.kcal;
  if (!s.meals.length) return <div className="card empty">Meals you build in “Cook” are saved here so you can log them again.</div>;
  return (
    <div className="stack">
      {s.meals.map((m) => {
        const t = sumNutrition(m.ingredients);
        const per = m.servings || 1;
        return (
          <div key={m.id} className="card">
            <div className="row between">
              <div className="grow">
                <h3>{m.name}</h3>
                <div className="small muted">
                  {m.ingredients.length} ingredient{m.ingredients.length === 1 ? "" : "s"} · serves {per}
                  {m.sentToCookbook ? ' · in cookbook' : ''}
                </div>
              </div>
              {s.settings.intuitive ? <FillDot fraction={t.kcal / per / target} size={32} /> : <span className="chip num">{r0(t.kcal / per)} kcal</span>}
            </div>
            <div className="row wrap" style={{ marginTop: 12 }}>
              <button
                className="btn sm"
                onClick={() => {
                  addLog({ date: todayKey(), slot: slotNow(), name: m.name, amount: `1 of ${per} servings`, kcal: t.kcal / per, protein: t.protein / per, carbs: t.carbs / per, fat: t.fat / per });
                  toast(`Logged to ${slotNow()}`);
                }}
              >
                Log a serving
              </button>
              <button className="btn sm ghost" onClick={() => onEdit(m)}><Icon name="edit" size={16} /> Edit</button>
              <CookbookButton
                title={m.name}
                ingredients={m.ingredients.map(ingLine)}
                servings={per}
                goSettings={goSettings}
                onSent={() => setState((st) => ({ ...st, meals: st.meals.map((x) => (x.id === m.id ? { ...x, sentToCookbook: new Date().toISOString() } : x)) }))}
              />
              <button
                className="icon-btn sm plain"
                aria-label={`Delete ${m.name}`}
                onClick={() => {
                  if (confirm(`Delete “${m.name}”?`)) setState((st) => ({ ...st, meals: st.meals.filter((x) => x.id !== m.id) }));
                }}
              >
                <Icon name="trash" size={16} />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
