import { useState } from 'react';
import { addDays, macrosFor, todayKey } from '../lib/calc';
import { MEAL_SLOTS, logsFor, sumNutrition, useStore, type MealSlot } from '../lib/store';
import { FillCircle, FillDot, Icon, Ring, fullnessPhrase, r0 } from '../components/ui';
import { GoalCard } from './Progress';
import { EntryDetail } from './EntryDetail';
import type { Tab as AddTab } from './AddFood';

export function Today({ date, setDate, onAdd, goProgress }: { date: string; setDate: (d: string) => void; onAdd: (slot?: MealSlot, tab?: AddTab) => void; goProgress: () => void }) {
  const s = useStore();
  const plan = s.plan!;
  const target = macrosFor(plan.kcal, plan.split);
  const entries = logsFor(date, s.log);
  const eaten = sumNutrition(entries);
  const intuitive = s.settings.intuitive;
  const isToday = date === todayKey();
  const d = new Date(date + 'T12:00:00');
  const shift = (n: number) => setDate(todayKey(addDays(d, n)));
  const [open, setOpen] = useState<string | null>(null);

  const hour = new Date().getHours();
  const greet = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <div>
      <div className="topbar">
        <div className="brand">
          <img src="/logo.png" alt="" />
          <div>
            <div className="small muted">{greet}</div>
            <h2>{s.profile!.name}</h2>
          </div>
        </div>
        <div className="row" style={{ gap: 4 }}>
          <button className="icon-btn sm" onClick={() => shift(-1)} aria-label="Previous day"><Icon name="left" size={18} /></button>
          <button className="chip" style={{ border: 0, minWidth: 74, justifyContent: 'center' }} onClick={() => setDate(todayKey())}>
            {isToday ? 'Today' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
          </button>
          <button className="icon-btn sm" onClick={() => shift(1)} disabled={isToday} style={{ opacity: isToday ? 0.4 : 1 }} aria-label="Next day"><Icon name="right" size={18} /></button>
        </div>
      </div>

      {intuitive ? (
        <div className="card">
          <div className="row" style={{ justifyContent: 'center' }}>
            <FillCircle fraction={eaten.kcal / target.kcal} size={200} label={fullnessPhrase(eaten.kcal / target.kcal)} />
          </div>
          <h2 className="center" style={{ marginTop: 12 }}>{fullnessPhrase(eaten.kcal / target.kcal)}</h2>
          <p className="center small muted" style={{ margin: '2px 0 0' }}>Today's plate</p>
          <div className="grid3" style={{ marginTop: 18 }}>
            {[
              { label: 'Protein', v: eaten.protein / target.protein, color: 'var(--protein)' },
              { label: 'Carbs', v: eaten.carbs / target.carbs, color: 'var(--carbs)' },
              { label: 'Fat', v: eaten.fat / target.fat, color: 'var(--fat)' },
            ].map((m) => (
              <div key={m.label} className="center" style={{ display: 'grid', justifyItems: 'center', gap: 6 }}>
                <FillCircle fraction={m.v} size={74} color={m.color} label={`${m.label} ${fullnessPhrase(m.v)}`} />
                <span className="small" style={{ fontWeight: 700 }}>{m.label}</span>
              </div>
            ))}
          </div>
          {eaten.protein / target.protein < 0.5 && eaten.kcal / target.kcal > 0.6 && (
            <div className="callout" style={{ marginTop: 14 }}>Protein's still low. A protein-rich choice next will help you stay full.</div>
          )}
        </div>
      ) : (
        <div className="card">
          <div className="row between" style={{ alignItems: 'center' }}>
            <div className="stack" style={{ gap: 14 }}>
              <div>
                <div className="small muted">Eaten</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{r0(eaten.kcal).toLocaleString()}</div>
              </div>
              <div>
                <div className="small muted">Daily target</div>
                <div className="num" style={{ fontSize: 22, fontWeight: 800 }}>{target.kcal.toLocaleString()}</div>
              </div>
            </div>
            <Ring value={eaten.kcal} max={target.kcal} size={170}>
              <div>
                <div className="num" style={{ fontSize: 34, fontWeight: 800, lineHeight: 1 }}>{Math.abs(r0(target.kcal - eaten.kcal)).toLocaleString()}</div>
                <div className="small muted">{eaten.kcal > target.kcal ? 'kcal over' : 'kcal left'}</div>
              </div>
            </Ring>
          </div>
          <div className="macro-row">
            {[
              { label: 'Protein', v: eaten.protein, t: target.protein, color: 'var(--protein)' },
              { label: 'Carbs', v: eaten.carbs, t: target.carbs, color: 'var(--carbs)' },
              { label: 'Fat', v: eaten.fat, t: target.fat, color: 'var(--fat)' },
            ].map((m) => (
              <div key={m.label}>
                <div className="label"><span>{m.label}</span></div>
                <div className="bar"><i style={{ width: `${Math.min(100, (m.v / m.t) * 100)}%`, background: m.color }} /></div>
                <div className="tiny muted num" style={{ marginTop: 4 }}>{r0(m.v)} / {m.t} g</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="grid3" style={{ marginTop: 14 }}>
        {(
          [
            ['photo', 'camera', 'Snap a meal'],
            ['out', 'store', 'Eating out'],
            ['scan', 'barcode', 'Scan product'],
          ] as [AddTab, string, string][]
        ).map(([tab, icon, label]) => (
          <button key={tab} className="card center" style={{ border: 0, padding: '14px 8px', marginTop: 0, fontWeight: 700, fontSize: 13 }} onClick={() => onAdd(undefined, tab)}>
            <span style={{ color: 'var(--green-strong)' }}><Icon name={icon} size={24} /></span>
            <div style={{ marginTop: 4 }}>{label}</div>
          </button>
        ))}
      </div>

      {MEAL_SLOTS.map((slot) => {
        const items = entries.filter((e) => e.slot === slot.id);
        const total = sumNutrition(items);
        return (
          <div key={slot.id}>
            <div className="section-title">
              <h3>{slot.label}</h3>
              <div className="row">
                {items.length > 0 && (intuitive ? <FillDot fraction={total.kcal / target.kcal} size={22} /> : <span className="small muted num">{r0(total.kcal)} kcal</span>)}
                <button className="icon-btn sm" onClick={() => onAdd(slot.id)} aria-label={`Add to ${slot.label}`}><Icon name="plus" size={18} /></button>
              </div>
            </div>
            <div className="card" style={{ paddingTop: items.length ? 6 : 18, paddingBottom: items.length ? 6 : 18 }}>
              {items.length === 0 ? (
                <button className="link-btn" onClick={() => onAdd(slot.id)}>+ Add {slot.label.toLowerCase()}</button>
              ) : (
                <div className="list">
                  {items.map((e) => (
                    <div key={e.id} className="list-item tap" role="button" tabIndex={0} onClick={() => setOpen(e.id)} onKeyDown={(ev) => ev.key === 'Enter' && setOpen(e.id)}>
                      <div className="grow">
                        <div className="title">{e.name}</div>
                        <div className="small muted">
                          {[e.amount, intuitive ? null : `P ${r0(e.protein)} · C ${r0(e.carbs)} · F ${r0(e.fat)}`].filter(Boolean).join(' · ')}
                        </div>
                      </div>
                      {intuitive ? <FillDot fraction={e.kcal / target.kcal} /> : <span className="num" style={{ fontWeight: 700 }}>{r0(e.kcal)}</span>}
                      <span className="muted" style={{ display: 'inline-flex' }}><Icon name="right" size={16} /></span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}

      {open && <EntryDetail entryId={open} onClose={() => setOpen(null)} />}

      <div className="section-title"><h3>Goal</h3></div>
      <GoalCard compact onClick={goProgress} />
    </div>
  );
}
