import { useRef, useState } from 'react';
import { MACRO_PRESETS, PAL_LEVELS, macrosFor } from '../lib/calc';
import { cookbookReady, sendToCookbook } from '../lib/cookbook';
import { getState, replaceState, resetState, setState, useStore, type Settings as S, type State } from '../lib/store';
import { Icon, Seg, Toggle, r1, toast } from '../components/ui';

export function Settings({ onEditProfile, onChangePlan }: { onEditProfile: () => void; onChangePlan: () => void }) {
  const s = useStore();
  const p = s.profile!;
  const plan = s.plan!;
  const m = macrosFor(plan.kcal, plan.split);
  const set = (patch: Partial<S>) => setState((st) => ({ ...st, settings: { ...st.settings, ...patch } }));
  const [showHow, setShowHow] = useState(false);
  const [testing, setTesting] = useState(false);
  const file = useRef<HTMLInputElement>(null);
  const presetLabel = plan.macroPreset === 'custom' ? 'Custom' : MACRO_PRESETS[plan.macroPreset].label;

  return (
    <div>
      <div className="topbar">
        <h1>Settings</h1>
      </div>

      <div className="card">
        <div className="list">
          <div className="list-item tap" onClick={onEditProfile}>
            <div className="grow">
              <div className="title">{p.name}</div>
              <div className="small muted">
                {p.age} yrs · {p.heightCm} cm · goal {r1(p.goalKg)} kg · {PAL_LEVELS.find((l) => l.value === p.pal)?.label ?? `PAL ${p.pal}`}
              </div>
            </div>
            <Icon name="right" size={18} />
          </div>
          <div className="list-item tap" onClick={onChangePlan}>
            <div className="grow">
              <div className="title">Deficit & macros</div>
              <div className="small muted num">
                {s.settings.intuitive ? `${presetLabel} split · numbers hidden` : `${plan.kcal.toLocaleString()} kcal · P ${m.protein} g · C ${m.carbs} g · F ${m.fat} g`}
              </div>
            </div>
            <Icon name="right" size={18} />
          </div>
        </div>
      </div>

      <div className="section-title"><h3>Tracking</h3></div>
      <div className="card stack">
        <div className="row">
          <div className="grow">
            <div style={{ fontWeight: 700 }}>Intuitive eating</div>
            <div className="small muted">Hide calorie numbers. Your day and each food show as a filling circle instead.</div>
          </div>
          <Toggle checked={s.settings.intuitive} onChange={(v) => set({ intuitive: v })} label="Intuitive eating" />
        </div>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 8 }}>Appearance</div>
          <Seg value={s.settings.theme} onChange={(v) => set({ theme: v })} options={[{ value: 'system', label: 'System' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]} />
        </div>
      </div>

      <div className="section-title"><h3>Cookbook (Google Doc)</h3></div>
      <div className="card stack">
        <p className="small muted" style={{ margin: 0 }}>
          Meals you send are added to the end of your doc with their name and ingredient list, ready for you to write the method.
        </p>
        <label className="field">
          Google Doc link
          <input className="input" placeholder="https://docs.google.com/document/d/…" value={s.settings.cookbookDocUrl} onChange={(e) => set({ cookbookDocUrl: e.target.value })} />
        </label>
        <label className="field">
          Apps Script web app URL
          <input className="input" placeholder="https://script.google.com/macros/s/…/exec" value={s.settings.cookbookScriptUrl} onChange={(e) => set({ cookbookScriptUrl: e.target.value })} />
          {s.settings.cookbookScriptUrl && !cookbookReady(s.settings) && <span className="error">This should be the web app URL ending in /exec.</span>}
        </label>
        <label className="field">
          Secret (optional)
          <input className="input" placeholder="Only if you set SECRET in the script" value={s.settings.cookbookToken} onChange={(e) => set({ cookbookToken: e.target.value })} />
        </label>
        <div className="row wrap">
          <button
            className="btn sm"
            disabled={!cookbookReady(s.settings) || testing}
            onClick={async () => {
              setTesting(true);
              try {
                const r = await sendToCookbook(s.settings, { title: 'MacroMeter test (you can delete this)', ingredients: ['1 cucumber'] });
                toast(r === 'sent' ? 'It works! Check your doc.' : 'Sent. Check your doc.');
              } catch (e) {
                toast((e as Error).message);
              } finally {
                setTesting(false);
              }
            }}
          >
            {testing ? 'Sending…' : 'Send a test'}
          </button>
          {s.settings.cookbookDocUrl && (
            <a className="btn sm ghost" href={s.settings.cookbookDocUrl} target="_blank" rel="noreferrer">
              <Icon name="external" size={16} /> Open doc
            </a>
          )}
          <button className="link-btn" onClick={() => setShowHow(!showHow)}>{showHow ? 'Hide setup' : 'How to set up'}</button>
        </div>
        {showHow && (
          <div className="callout small">
            <ol className="steps-list">
              <li>Open your cookbook Google Doc, then <b>Extensions → Apps Script</b>.</li>
              <li>Delete what's there and paste the code from <b>google-apps-script/Cookbook.gs</b> in the MacroMeter repo. Save.</li>
              <li><b>Deploy → New deployment</b>, choose type <b>Web app</b>, set <i>Execute as: Me</i> and <i>Who has access: Anyone</i>.</li>
              <li>Approve the Google permissions, copy the <b>Web app URL</b> (ends in /exec) and paste it above.</li>
              <li>Tap <b>Send a test</b>.</li>
            </ol>
          </div>
        )}
      </div>

      <div className="section-title"><h3>Your data</h3></div>
      <div className="card stack">
        <p className="small muted" style={{ margin: 0 }}>Everything is stored on this device only. Export a backup to move it to another phone.</p>
        <div className="row wrap">
          <button
            className="btn sm ghost"
            onClick={() => {
              const blob = new Blob([JSON.stringify(getState(), null, 2)], { type: 'application/json' });
              const a = document.createElement('a');
              a.href = URL.createObjectURL(blob);
              a.download = `macrometer-backup-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(a.href);
            }}
          >
            <Icon name="download" size={16} /> Export backup
          </button>
          <button className="btn sm ghost" onClick={() => file.current?.click()}>
            <Icon name="upload" size={16} /> Import backup
          </button>
          <input
            ref={file}
            type="file"
            accept="application/json"
            hidden
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              try {
                const data = JSON.parse(await f.text()) as State;
                if (data.version !== 1) throw new Error();
                if (confirm('Replace everything on this device with this backup?')) {
                  replaceState(data);
                  toast('Backup restored');
                }
              } catch {
                toast("That file isn't a MacroMeter backup");
              }
              e.target.value = '';
            }}
          />
        </div>
        <button
          className="btn danger"
          onClick={() => {
            if (confirm('Delete all MacroMeter data on this device? This cannot be undone.')) resetState();
          }}
        >
          Reset app
        </button>
      </div>

      <p className="tiny muted center" style={{ marginTop: 24 }}>
        MacroMeter gives estimates, not medical advice. If you're pregnant, breastfeeding, under 18, or managing a health condition, check with a doctor before starting a deficit.
        Food data from Open Food Facts.
      </p>
    </div>
  );
}
