import { addDays, todayKey } from '../lib/calc';
import { visibleAdvice } from '../lib/advice';
import { latestWeight, setState, useStore } from '../lib/store';
import { Icon, toast } from './ui';

/** "Plan check-in" card: suggests easing the deficit (or a break / recalculation) when it's time. */
export function CheckInCard({ onRecalc }: { onRecalc: () => void }) {
  const s = useStore();
  const a = visibleAdvice(s);
  if (!a) return null;
  const intuitive = s.settings.intuitive;

  const apply = () => {
    if (!a.suggestKcal) return;
    const kcal = a.suggestKcal;
    const breakUntil = a.kind === 'break' ? todayKey(addDays(new Date(), 14)) : undefined;
    setState((st) => ({ ...st, plan: { ...st.plan!, kcal, calcKg: latestWeight(st), calcDate: todayKey(), breakUntil } }));
    toast(a.kind === 'break' ? "Enjoy your 2-week break. You'll get a check-in when it's over." : intuitive ? 'Plan updated' : `Target updated to ${kcal.toLocaleString()} kcal`);
  };
  const snooze = () => setState((st) => ({ ...st, settings: { ...st.settings, checkinSnoozeUntil: todayKey(addDays(new Date(), 14)) } }));

  return (
    <div className="card stack" style={{ border: '1.5px solid var(--green)', marginTop: 14 }}>
      <div className="row" style={{ alignItems: 'flex-start' }}>
        <span style={{ color: 'var(--green-strong)', display: 'inline-flex', marginTop: 2 }}><Icon name="sparkle" size={20} /></span>
        <div className="grow">
          <div className="tiny muted" style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '.04em' }}>Plan check-in</div>
          <h3 style={{ marginTop: 2 }}>{a.title}</h3>
          <p className="small" style={{ margin: '6px 0 0' }}>{intuitive ? a.bodyIntuitive : a.body}</p>
        </div>
      </div>
      <div className="row">
        {a.kind === 'recalc' ? (
          <button className="btn sm grow" onClick={onRecalc}>Recalculate</button>
        ) : (
          <button className="btn sm grow" onClick={apply}>
            {a.kind === 'break' ? 'Start a 2-week break' : intuitive ? 'Update my plan' : `Update to ${a.suggestKcal!.toLocaleString()} kcal`}
          </button>
        )}
        <button className="btn sm ghost" onClick={snooze}>Not now</button>
      </div>
    </div>
  );
}

/** Shows a phone notification for a new check-in (once per situation) when the app is opened. */
export async function notifyCheckIn(s: ReturnType<typeof useStore>) {
  const a = visibleAdvice(s);
  if (!a || !s.settings.checkinNotify) return;
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  if (s.settings.checkinNotified?.[a.id]) return;
  const body = s.settings.intuitive ? a.bodyIntuitive : a.body;
  // Mark as sent first, so it's never repeated even if the browser refuses to show it.
  setState((st) => ({ ...st, settings: { ...st.settings, checkinNotified: { ...st.settings.checkinNotified, [a.id]: todayKey() } } }));
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(`MacroMeter: ${a.title}`, { body, icon: '/icon-192.png', badge: '/icon-192.png', tag: 'checkin' });
    else new Notification(`MacroMeter: ${a.title}`, { body, icon: '/icon-192.png' });
  } catch {
    /* notifications blocked or unsupported */
  }
}
