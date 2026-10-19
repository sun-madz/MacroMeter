import { useState } from 'react';
import { PAL_LEVELS, bmi, estimateBodyFat, weightAtBmi, type Profile, type Sex } from '../lib/calc';
import { NumField, Seg, r1 } from '../components/ui';

interface Props {
  initial?: Profile | null;
  onDone: (p: Profile) => void;
  onCancel?: () => void;
}

export function Onboarding({ initial, onDone, onCancel }: Props) {
  const editing = !!initial;
  const [step, setStep] = useState(0);
  const [name, setName] = useState(initial?.name ?? '');
  const [sex, setSex] = useState<Sex>(initial?.sex ?? 'female');
  const [age, setAge] = useState(initial ? String(initial.age) : '');
  const [height, setHeight] = useState(initial ? String(initial.heightCm) : '');
  const [weight, setWeight] = useState(initial ? String(initial.weightKg) : '');
  const [goal, setGoal] = useState(initial ? String(initial.goalKg) : '');
  const [bf, setBf] = useState(initial?.bodyFatPct ? String(initial.bodyFatPct) : '');
  const [pal, setPal] = useState(initial?.pal ?? 1.4);

  const a = parseFloat(age);
  const h = parseFloat(height);
  const w = parseFloat(weight);
  const g = parseFloat(goal);
  const b = parseFloat(bf);

  const errors: Record<number, string | null> = {
    0: name.trim() ? null : 'Tell us what to call you',
    1: !(a >= 18 && a <= 100)
      ? 'MacroMeter is built for adults aged 18 and over'
      : !(h >= 120 && h <= 230)
        ? 'Enter your height in centimetres (120–230)'
        : null,
    2: !(w >= 35 && w <= 300)
      ? 'Enter your current weight in kg'
      : !(g > 0)
        ? 'Enter a goal weight'
        : g >= w
          ? 'Your goal should be below your current weight'
          : bmi(g, h) < 18.5
            ? `That goal is underweight for your height. A healthy minimum is about ${Math.ceil(weightAtBmi(18.5, h))} kg.`
            : bf && !(b >= 5 && b <= 60)
              ? 'Body fat should be between 5 and 60%'
              : null,
    3: null,
  };
  const err = errors[step];
  const last = 3;

  const finish = () =>
    onDone({
      name: name.trim(),
      sex,
      age: a,
      heightCm: h,
      weightKg: w,
      goalKg: g,
      pal,
      bodyFatPct: bf ? b : undefined,
    });

  const estBf = a && h && w ? estimateBodyFat(sex, w, h, a) : null;

  return (
    <div className="onb">
      <div className="steps">
        {[0, 1, 2, 3].map((i) => (
          <i key={i} className={i <= step ? 'on' : ''} />
        ))}
      </div>

      {step === 0 && (
        <div className="stack lg">
          <div className="hero">
            <img src="/logo.png" alt="" />
          </div>
          <div className="center">
            <h1>{editing ? 'Edit your details' : 'Welcome to MacroMeter'}</h1>
            <p className="muted">A calm, safe calorie deficit, built around your body. A few questions first.</p>
          </div>
          <label className="field">
            What should we call you?
            <input className="input" value={name} autoFocus placeholder="Your name" onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && !err && setStep(1)} />
          </label>
        </div>
      )}

      {step === 1 && (
        <div className="stack lg">
          <div>
            <h1>About you</h1>
            <p className="muted">Used to estimate how much energy your body burns.</p>
          </div>
          <div className="stack">
            <span style={{ fontWeight: 600, fontSize: 14 }}>Sex (for the metabolism formula)</span>
            <Seg value={sex} onChange={setSex} options={[{ value: 'female', label: 'Female' }, { value: 'male', label: 'Male' }]} />
          </div>
          <div className="grid2">
            <NumField label="Age" value={age} onChange={setAge} suffix="yrs" step="1" />
            <NumField label="Height" value={height} onChange={setHeight} suffix="cm" />
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="stack lg">
          <div>
            <h1>Your weight</h1>
            <p className="muted">Where you are now and where you'd like to be.</p>
          </div>
          <div className="grid2">
            <NumField label="Current weight" value={weight} onChange={setWeight} suffix="kg" />
            <NumField label="Goal weight" value={goal} onChange={setGoal} suffix="kg" />
          </div>
          {w > 0 && h > 0 && <div className="hint">Current BMI {r1(bmi(w, h))}{g > 0 ? ` · goal BMI ${r1(bmi(g, h))}` : ''}</div>}
          <NumField
            label="Body fat % (optional)"
            value={bf}
            onChange={setBf}
            suffix="%"
            hint={estBf ? `Leave blank to use an estimate from your BMI (about ${Math.round(estBf)}%). Used to work out your safe maximum deficit.` : 'Leave blank to estimate it from your BMI.'}
          />
        </div>
      )}

      {step === 3 && (
        <div className="stack lg">
          <div>
            <h1>How active are you?</h1>
            <p className="muted">Pick your typical week, not your best one.</p>
          </div>
          <div className="stack">
            {PAL_LEVELS.map((l) => (
              <button key={l.value} className={`choice ${pal === l.value ? 'on' : ''}`} onClick={() => setPal(l.value)}>
                <div className="grow">
                  <h3>{l.label}</h3>
                  <div className="small muted">{l.hint}</div>
                </div>
                <span className="chip num">{l.value.toFixed(2)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {err && step !== 0 && <p className="error" style={{ marginTop: 14 }}>{err}</p>}

      <footer>
        {(step > 0 || onCancel) && (
          <button className="btn ghost" onClick={() => (step > 0 ? setStep(step - 1) : onCancel?.())}>
            {step > 0 ? 'Back' : 'Cancel'}
          </button>
        )}
        <button className="btn grow" disabled={!!err} onClick={() => (step === last ? finish() : setStep(step + 1))}>
          {step === last ? (editing ? 'Save' : 'See my safe deficits') : 'Continue'}
        </button>
      </footer>
    </div>
  );
}
