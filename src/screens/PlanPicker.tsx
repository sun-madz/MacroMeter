import { useMemo, useState } from 'react';
import {
  MACRO_PRESETS,
  addDays,
  bodyFatPct,
  calorieFloor,
  formatDuration,
  intakeOptions,
  macrosFor,
  maxFatDeficit,
  recommendedOption,
  rmr,
  tdee,
  todayKey,
  type IntakeOption,
  type MacroPreset,
  type MacroSplit,
  type Profile,
} from '../lib/calc';
import type { Plan } from '../lib/store';
import { Icon, r0, r1 } from '../components/ui';

interface Props {
  profile: Profile;
  current?: Plan | null;
  onDone: (plan: Plan) => void;
  onCancel?: () => void;
}

const SAFETY_LABEL = { safe: 'Safe', firm: 'Firm', unsafe: 'Not recommended' } as const;

export function PlanPicker({ profile, current, onDone, onCancel }: Props) {
  const options = useMemo(() => intakeOptions(profile), [profile]);
  const rec = useMemo(() => recommendedOption(options), [options]);
  const [kcal, setKcal] = useState<number | null>(current && options.some((o) => o.kcal === current.kcal) ? current.kcal : rec?.kcal ?? null);
  const [stage, setStage] = useState<'deficit' | 'macros'>('deficit');
  const [preset, setPreset] = useState<MacroPreset>(current?.macroPreset ?? 'higherProtein');
  const [split, setSplit] = useState<MacroSplit>(current?.split ?? { ...MACRO_PRESETS.higherProtein });
  const [showUnsafe, setShowUnsafe] = useState(false);

  const maintenance = tdee(profile, profile.weightKg);
  const bf = bodyFatPct(profile);
  const chosen = options.find((o) => o.kcal === kcal) ?? null;
  const visible = options.filter((o) => o.safety !== 'unsafe');
  const unsafe = options.filter((o) => o.safety === 'unsafe');

  if (!options.length) {
    return (
      <div className="stack lg">
        <h1>Plan</h1>
        <div className="callout warn">
          Your maintenance is about {r0(maintenance)} kcal, which is already close to the safe minimum of {calorieFloor(profile.sex)} kcal. Rather than
          eating less, the safest lever for you is moving more. Try raising your activity level in your profile.
        </div>
        {onCancel && <button className="btn ghost" onClick={onCancel}>Back</button>}
      </div>
    );
  }

  if (stage === 'macros' && chosen) {
    const m = macrosFor(chosen.kcal, split);
    const sum = split.p + split.c + split.f;
    return (
      <div className="stack lg">
        <div className="row">
          <button className="icon-btn" onClick={() => setStage('deficit')} aria-label="Back">
            <Icon name="left" />
          </button>
          <div>
            <h1>Your macros</h1>
            <p className="muted small" style={{ margin: 0 }}>For {chosen.kcal.toLocaleString()} kcal a day</p>
          </div>
        </div>

        <div className="card">
          <div className="grid3 center">
            <MacroStat label="Protein" g={m.protein} color="var(--protein)" pct={split.p} />
            <MacroStat label="Carbs" g={m.carbs} color="var(--carbs)" pct={split.c} />
            <MacroStat label="Fat" g={m.fat} color="var(--fat)" pct={split.f} />
          </div>
          <p className="small muted" style={{ marginBottom: 0 }}>
            That's about {r1(m.protein / profile.weightKg)} g of protein per kg of body weight.
          </p>
        </div>

        <div className="stack">
          {(Object.keys(MACRO_PRESETS) as (keyof typeof MACRO_PRESETS)[]).map((k) => {
            const p = MACRO_PRESETS[k];
            return (
              <button
                key={k}
                className={`choice ${preset === k ? 'on' : ''}`}
                onClick={() => {
                  setPreset(k);
                  setSplit({ p: p.p, c: p.c, f: p.f });
                }}
              >
                <div className="grow">
                  <h3>{p.label}</h3>
                  <div className="small muted">{p.note}</div>
                </div>
                <span className="chip num">{p.p}/{p.c}/{p.f}</span>
              </button>
            );
          })}
          <button className={`choice ${preset === 'custom' ? 'on' : ''}`} onClick={() => setPreset('custom')}>
            <div className="grow">
              <h3>Custom</h3>
              <div className="small muted">Set your own percentages</div>
            </div>
          </button>
          {preset === 'custom' && (
            <div className="card flat">
              <div className="grid3">
                {(['p', 'c', 'f'] as const).map((k) => (
                  <label key={k} className="field">
                    {k === 'p' ? 'Protein' : k === 'c' ? 'Carbs' : 'Fat'} %
                    <input className="input num" type="number" inputMode="numeric" value={split[k]} onChange={(e) => setSplit({ ...split, [k]: Number(e.target.value) || 0 })} />
                  </label>
                ))}
              </div>
              {sum !== 100 && <p className="error">Percentages add up to {sum}%, they need to total 100%.</p>}
              <p className="hint" style={{ marginBottom: 0 }}>IOM ranges: protein 10–35%, carbs 45–65%, fat 20–35%.</p>
            </div>
          )}
        </div>

        <button
          className="btn block"
          disabled={sum !== 100}
          onClick={() =>
            onDone({
              kcal: chosen.kcal,
              startKg: profile.weightKg,
              startDate: current && current.startKg === profile.weightKg ? current.startDate : todayKey(),
              macroPreset: preset,
              split,
            })
          }
        >
          Start my plan
        </button>
      </div>
    );
  }

  return (
    <div className="stack lg">
      <div className="row">
        {onCancel && (
          <button className="icon-btn" onClick={onCancel} aria-label="Back">
            <Icon name="left" />
          </button>
        )}
        <div>
          <h1>Choose your deficit</h1>
          <p className="muted small" style={{ margin: 0 }}>
            {r1(profile.weightKg)} kg → {r1(profile.goalKg)} kg
          </p>
        </div>
      </div>

      <div className="card">
        <div className="grid2">
          <div className="stat"><b className="num">{r0(maintenance).toLocaleString()}</b><span>Maintenance kcal / day</span></div>
          <div className="stat"><b className="num">{r0(rmr(profile.sex, profile.weightKg, profile.heightCm, profile.age)).toLocaleString()}</b><span>Resting burn (RMR)</span></div>
          <div className="stat"><b className="num">{r0(bf)}%</b><span>Body fat {profile.bodyFatPct ? '(yours)' : '(estimated)'}</span></div>
          <div className="stat"><b className="num">{r0(maxFatDeficit(profile)).toLocaleString()}</b><span>Max deficit from fat</span></div>
        </div>
        <p className="small muted" style={{ marginBottom: 0 }}>
          Timelines use a dynamic model (after Kevin Hall, NIH), so loss slows as your body adapts instead of following the 3,500-kcal rule.
        </p>
      </div>

      <div className="stack">
        {visible.map((o) => (
          <OptionRow key={o.kcal} o={o} on={kcal === o.kcal} rec={rec?.kcal === o.kcal} onPick={() => setKcal(o.kcal)} />
        ))}
      </div>

      {unsafe.length > 0 && (
        <div>
          <button className="link-btn" onClick={() => setShowUnsafe(!showUnsafe)}>
            {showUnsafe ? 'Hide' : 'Why are lower intakes hidden?'}
          </button>
          {showUnsafe && (
            <div className="callout bad stack" style={{ marginTop: 8 }}>
              {unsafe.map((o) => (
                <div key={o.kcal}>
                  <b className="num">{o.kcal.toLocaleString()} kcal</b>: {o.reasons.join('; ')}.
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <div style={{ position: 'sticky', bottom: 0, padding: '12px 0 calc(env(safe-area-inset-bottom) + 12px)', background: 'linear-gradient(to top, var(--bg) 70%, transparent)' }}>
        <button className="btn block" disabled={!chosen} onClick={() => setStage('macros')}>
          {chosen ? `Continue with ${chosen.kcal.toLocaleString()} kcal` : 'Pick an intake'}
        </button>
      </div>
    </div>
  );
}

function OptionRow({ o, on, rec, onPick }: { o: IntakeOption; on: boolean; rec: boolean; onPick: () => void }) {
  const eta = addDays(new Date(), o.days);
  return (
    <button className={`choice ${on ? 'on' : ''}`} onClick={onPick}>
      <div className="option grow">
        <div className="row">
          <span className="kcal num">{o.kcal.toLocaleString()} kcal</span>
          {rec && <span className="badge">Recommended</span>}
        </div>
        <span className={`chip ${o.safety}`}>{SAFETY_LABEL[o.safety]}</span>
        <span className="small muted num">
          −{o.deficit} kcal ({r0(o.deficitPct * 100)}%) · ~{r1(o.weeklyLossKg)} kg/week at first
        </span>
        <span className="small num" style={{ textAlign: 'right', fontWeight: 700 }}>
          {o.reached ? formatDuration(o.days) : 'Plateaus first'}
        </span>
        {o.reached && (
          <span className="tiny muted" style={{ gridColumn: '1 / -1' }}>
            Goal around {eta.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}
          </span>
        )}
      </div>
    </button>
  );
}

function MacroStat({ label, g, color, pct }: { label: string; g: number; color: string; pct: number }) {
  return (
    <div className="stat" style={{ borderTop: `4px solid ${color}` }}>
      <b className="num">{g} g</b>
      <span>{label} · {pct}%</span>
    </div>
  );
}
