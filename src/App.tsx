import { useEffect, useState } from 'react';
import { todayKey, type Profile } from './lib/calc';
import { latestWeight, setState, useStore, type MealSlot } from './lib/store';
import { Icon, ToastHost } from './components/ui';
import { Onboarding } from './screens/Onboarding';
import { PlanPicker } from './screens/PlanPicker';
import { Today } from './screens/Today';
import { AddFood } from './screens/AddFood';
import { Kitchen } from './screens/Kitchen';
import { Progress } from './screens/Progress';
import { Settings } from './screens/Settings';

type View = 'today' | 'kitchen' | 'progress' | 'settings';

export default function App() {
  const s = useStore();
  const [view, setView] = useState<View>('today');
  const [date, setDate] = useState(todayKey());
  const [adding, setAdding] = useState<{ slot?: MealSlot } | null>(null);
  const [editingProfile, setEditingProfile] = useState(false);
  const [choosingPlan, setChoosingPlan] = useState(false);

  // Theme
  useEffect(() => {
    const root = document.documentElement;
    const apply = () => {
      const dark = s.settings.theme === 'dark' || (s.settings.theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches);
      root.dataset.theme = dark ? 'dark' : 'light';
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', dark ? '#15171b' : '#8DC63F');
    };
    apply();
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [s.settings.theme]);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [view, editingProfile, choosingPlan]);

  const saveProfile = (p: Profile) => {
    setState((st) => ({
      ...st,
      profile: p,
      weighIns: st.weighIns.some((w) => w.date === todayKey()) || (st.profile && st.profile.weightKg === p.weightKg)
        ? st.weighIns
        : [...st.weighIns, { date: todayKey(), kg: p.weightKg }],
    }));
  };

  let screen;
  if (!s.profile) {
    screen = <Onboarding onDone={saveProfile} />;
  } else if (editingProfile) {
    screen = (
      <Onboarding
        initial={s.profile}
        onCancel={() => setEditingProfile(false)}
        onDone={(p) => {
          const old = s.profile!;
          saveProfile(p);
          setEditingProfile(false);
          const changed = old.weightKg !== p.weightKg || old.goalKg !== p.goalKg || old.pal !== p.pal || old.age !== p.age || old.heightCm !== p.heightCm || old.sex !== p.sex || old.bodyFatPct !== p.bodyFatPct;
          if (changed) setChoosingPlan(true);
        }}
      />
    );
  } else if (!s.plan || choosingPlan) {
    screen = (
      <PlanPicker
        profile={s.profile}
        current={s.plan}
        onCancel={s.plan ? () => setChoosingPlan(false) : () => setEditingProfile(true)}
        onDone={(plan) => {
          setState((st) => ({ ...st, plan }));
          setChoosingPlan(false);
          setView('today');
        }}
      />
    );
  } else {
    screen = (
      <>
        {view === 'today' && <Today date={date} setDate={setDate} onAdd={(slot) => setAdding({ slot })} goProgress={() => setView('progress')} />}
        {view === 'kitchen' && <Kitchen goSettings={() => setView('settings')} />}
        {view === 'progress' && (
          <Progress
            onRecalc={() => {
              const kg = latestWeight(s);
              setState((st) => ({ ...st, profile: { ...st.profile!, weightKg: kg } }));
              setChoosingPlan(true);
            }}
          />
        )}
        {view === 'settings' && <Settings onEditProfile={() => setEditingProfile(true)} onChangePlan={() => setChoosingPlan(true)} />}

        <nav className="nav" aria-label="Main">
          <NavBtn icon="home" label="Today" on={view === 'today'} onClick={() => setView('today')} />
          <NavBtn icon="pot" label="Kitchen" on={view === 'kitchen'} onClick={() => setView('kitchen')} />
          <button className="fab" aria-label="Log food" onClick={() => setAdding({})}>
            <Icon name="plus" size={28} stroke={2.5} />
          </button>
          <NavBtn icon="chart" label="Progress" on={view === 'progress'} onClick={() => setView('progress')} />
          <NavBtn icon="gear" label="Settings" on={view === 'settings'} onClick={() => setView('settings')} />
        </nav>

        {adding && <AddFood mode="log" date={view === 'today' ? date : todayKey()} slot={adding.slot} onClose={() => setAdding(null)} />}
      </>
    );
  }

  return (
    <div className="app">
      {screen}
      <ToastHost />
    </div>
  );
}

function NavBtn({ icon, label, on, onClick }: { icon: string; label: string; on: boolean; onClick: () => void }) {
  return (
    <button className={on ? 'on' : ''} onClick={onClick} aria-current={on ? 'page' : undefined}>
      <Icon name={icon} size={22} />
      {label}
    </button>
  );
}
