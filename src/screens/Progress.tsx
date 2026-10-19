import { useMemo, useState } from 'react';
import { addDays, bmi, formatDuration, simulate, toDay, todayKey, trendKgPerDay } from '../lib/calc';
import { latestWeight, setState, useStore, type State } from '../lib/store';
import { Icon, r1, toast } from '../components/ui';

function journey(s: State) {
  const sorted = [...s.weighIns].sort((a, b) => a.date.localeCompare(b.date));
  const startKg = sorted.length ? sorted[0].kg : s.plan?.startKg ?? s.profile!.weightKg;
  const current = latestWeight(s);
  const goal = s.profile!.goalKg;
  const pct = startKg > goal ? Math.min(1, Math.max(0, (startKg - current) / (startKg - goal))) : 0;
  const profile = { ...s.profile!, weightKg: current };
  const sim = simulate(profile, s.plan!.kcal, current);
  const slope = trendKgPerDay(sorted);
  const trendDays = slope && slope < 0 && current > goal ? Math.round((current - goal) / -slope) : null;
  return { sorted, startKg, current, goal, pct, sim, slope, trendDays, done: current <= goal };
}

const fmtDate = (d: Date) => d.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

export function GoalCard({ compact, onClick }: { compact?: boolean; onClick?: () => void }) {
  const s = useStore();
  const j = useMemo(() => journey(s), [s]);
  return (
    <div className="card" onClick={onClick} style={{ cursor: onClick ? 'pointer' : undefined }}>
      <div className="row between">
        <div>
          <div className="small muted">Progress to goal</div>
          <div style={{ fontSize: 26, fontWeight: 800 }} className="num">{Math.round(j.pct * 100)}%</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          <div className="small muted">{j.done ? 'Goal reached' : 'Predicted goal date'}</div>
          <div style={{ fontWeight: 800 }}>
            {j.done ? '🎉 Well done' : j.sim.reached ? fmtDate(addDays(new Date(), j.sim.days)) : 'Plateau first'}
          </div>
        </div>
      </div>
      <div className="bar" style={{ height: 14, marginTop: 12 }}>
        <i style={{ width: `${j.pct * 100}%` }} />
      </div>
      <div className="row between tiny muted num" style={{ marginTop: 6 }}>
        <span>{r1(j.startKg)} kg</span>
        <span style={{ fontWeight: 800, color: 'var(--text)' }}>{r1(j.current)} kg now</span>
        <span>{r1(j.goal)} kg</span>
      </div>
      {!compact && !j.done && (
        <div className="grid2" style={{ marginTop: 14 }}>
          <div className="stat">
            <b>{j.sim.reached ? formatDuration(j.sim.days) : '—'}</b>
            <span>Plan estimate (model)</span>
          </div>
          <div className="stat">
            <b>{j.trendDays ? formatDuration(j.trendDays) : j.slope !== null && j.slope >= 0 ? 'Flat' : '—'}</b>
            <span>{j.slope === null ? 'Trend: needs 1+ week of weigh-ins' : `Your trend: ${r1(-j.slope * 7)} kg/week`}</span>
          </div>
        </div>
      )}
    </div>
  );
}

export function Progress({ onRecalc }: { onRecalc: () => void }) {
  const s = useStore();
  const j = useMemo(() => journey(s), [s]);
  const [kg, setKg] = useState('');
  const [date, setDate] = useState(todayKey());
  const drift = j.current - s.plan!.startKg;

  const save = () => {
    const v = parseFloat(kg);
    if (!(v >= 30 && v <= 350)) return toast('Enter your weight in kg');
    setState((st) => ({ ...st, weighIns: [...st.weighIns.filter((w) => w.date !== date), { date, kg: v }] }));
    setKg('');
    toast('Weigh-in saved');
  };

  const desc = [...j.sorted].reverse();

  return (
    <div>
      <div className="topbar">
        <h1>Progress</h1>
        <span className="chip num">BMI {r1(bmi(j.current, s.profile!.heightCm))}</span>
      </div>

      <GoalCard />

      {Math.abs(drift) >= 2 && !j.done && (
        <div className="callout warn row" style={{ marginTop: 14 }}>
          <div className="grow small">
            You're {r1(Math.abs(drift))} kg {drift < 0 ? 'lighter' : 'heavier'} than when this plan was set. Recalculating keeps your target accurate.
          </div>
          <button className="btn sm" onClick={onRecalc}>Recalculate</button>
        </div>
      )}

      <div className="section-title"><h3>Weigh in</h3></div>
      <div className="card stack">
        <div className="row">
          <div className="input-suffix grow">
            <input className="input num" type="number" inputMode="decimal" placeholder={String(r1(j.current))} value={kg} onChange={(e) => setKg(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && save()} />
            <span>kg</span>
          </div>
          <input className="input" type="date" style={{ width: 150 }} value={date} max={todayKey()} onChange={(e) => setDate(e.target.value)} />
        </div>
        <button className="btn block" onClick={save}><Icon name="scale" size={20} /> Save weigh-in</button>
        <p className="hint" style={{ margin: 0 }}>Weigh at the same time each day, ideally in the morning. Daily ups and downs are mostly water; the trend is what counts.</p>
      </div>

      <div className="section-title"><h3>Your journey</h3></div>
      <div className="card">
        <Chart s={s} j={j} />
      </div>

      <div className="section-title"><h3>History</h3></div>
      <div className="card">
        {desc.length === 0 ? (
          <div className="empty">No weigh-ins yet.</div>
        ) : (
          <div className="list">
            {desc.map((w, i) => {
              const prev = desc[i + 1];
              const diff = prev ? w.kg - prev.kg : 0;
              return (
                <div key={w.date} className="list-item">
                  <div className="grow">
                    <div className="title num">{r1(w.kg)} kg</div>
                    <div className="small muted">{w.date === todayKey() ? 'Today' : fmtDate(new Date(w.date + 'T12:00:00'))}</div>
                  </div>
                  {prev && (
                    <span className="small num" style={{ fontWeight: 700, color: diff <= 0 ? 'var(--green-strong)' : 'var(--muted)' }}>
                      {diff > 0 ? '+' : diff < 0 ? '−' : '±'}{r1(Math.abs(diff))} kg
                    </span>
                  )}
                  <button
                    className="icon-btn sm plain"
                    aria-label="Delete weigh-in"
                    onClick={() => setState((st) => ({ ...st, weighIns: st.weighIns.filter((x) => x.date !== w.date) }))}
                  >
                    <Icon name="trash" size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function Chart({ s, j }: { s: State; j: ReturnType<typeof journey> }) {
  const W = 340;
  const H = 190;
  const pad = { l: 34, r: 10, t: 12, b: 24 };
  const today = toDay(todayKey());
  const pts = j.sorted.map((w) => ({ x: toDay(w.date), y: w.kg }));
  if (!pts.length) return <div className="empty">Add a weigh-in to see your chart.</div>;
  const proj = j.done ? [] : j.sim.curve.map((c) => ({ x: today + c.day, y: c.kg }));
  const all = [...pts, ...proj];
  const x0 = Math.min(...all.map((p) => p.x));
  const x1 = Math.max(...all.map((p) => p.x), x0 + 7);
  const ys = [...all.map((p) => p.y), s.profile!.goalKg];
  const y0 = Math.floor(Math.min(...ys) - 1);
  const y1 = Math.ceil(Math.max(...ys) + 1);
  const X = (x: number) => pad.l + ((x - x0) / (x1 - x0)) * (W - pad.l - pad.r);
  const Y = (y: number) => pad.t + (1 - (y - y0) / (y1 - y0)) * (H - pad.t - pad.b);
  const line = (p: { x: number; y: number }[]) => p.map((q, i) => `${i ? 'L' : 'M'}${X(q.x).toFixed(1)},${Y(q.y).toFixed(1)}`).join(' ');
  const ticks = [y0, (y0 + y1) / 2, y1];
  const dayToLabel = (d: number) => new Date(d * 86400000).toLocaleDateString(undefined, { day: 'numeric', month: 'short', timeZone: 'UTC' });

  return (
    <div>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} width="100%" role="img" aria-label="Weight history and projection">
        {ticks.map((t) => (
          <g key={t}>
            <line x1={pad.l} x2={W - pad.r} y1={Y(t)} y2={Y(t)} stroke="var(--line)" />
            <text x={pad.l - 6} y={Y(t) + 4} textAnchor="end">{r1(t)}</text>
          </g>
        ))}
        <line x1={pad.l} x2={W - pad.r} y1={Y(s.profile!.goalKg)} y2={Y(s.profile!.goalKg)} stroke="var(--green-strong)" strokeDasharray="2 4" strokeWidth={1.5} />
        <text x={W - pad.r} y={Y(s.profile!.goalKg) - 5} textAnchor="end" style={{ fill: 'var(--green-strong)', fontWeight: 700 }}>Goal</text>
        {proj.length > 1 && <path d={line(proj)} fill="none" stroke="var(--muted)" strokeWidth={2} strokeDasharray="5 5" opacity={0.7} />}
        <path d={line(pts)} fill="none" stroke="var(--green)" strokeWidth={3} strokeLinejoin="round" strokeLinecap="round" />
        {pts.map((p) => (
          <circle key={p.x} cx={X(p.x)} cy={Y(p.y)} r={3.5} fill="var(--card)" stroke="var(--green-strong)" strokeWidth={2} />
        ))}
        <text x={pad.l} y={H - 6}>{dayToLabel(x0)}</text>
        <text x={W - pad.r} y={H - 6} textAnchor="end">{dayToLabel(x1)}</text>
      </svg>
      <div className="row tiny muted" style={{ gap: 16, marginTop: 4 }}>
        <span className="row" style={{ gap: 6 }}><i style={{ width: 16, height: 3, background: 'var(--green)', borderRadius: 2, display: 'inline-block' }} />Weigh-ins</span>
        {proj.length > 1 && <span className="row" style={{ gap: 6 }}><i style={{ width: 16, height: 0, borderTop: '2px dashed var(--muted)', display: 'inline-block' }} />{s.settings.intuitive ? 'Projected on your plan' : `Projected at ${s.plan!.kcal.toLocaleString()} kcal`}</span>}
      </div>
    </div>
  );
}
