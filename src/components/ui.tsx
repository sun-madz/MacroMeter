import { useEffect, useId, useState, type ReactNode } from 'react';

// ---------- Icons (inline, stroke-based) ----------
const paths: Record<string, ReactNode> = {
  home: <path d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  pot: <><path d="M4 10h16v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4z" /><path d="M2 10h20M9 6c0-1 1-1 1-2M13 6c0-1 1-1 1-2" /></>,
  chart: <><path d="M4 20V10M10 20V4M16 20v-7M22 20H2" /></>,
  gear: <><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  minus: <path d="M5 12h14" />,
  x: <path d="M6 6l12 12M18 6 6 18" />,
  check: <path d="m5 12 5 5L20 7" />,
  left: <path d="m15 18-6-6 6-6" />,
  right: <path d="m9 18 6-6-6-6" />,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  barcode: <path d="M3 5v14M7 5v14M10 5v14M14 5v14M17 5v14M21 5v14" />,
  bolt: <path d="M13 2 4 14h7l-1 8 9-12h-7z" />,
  book: <><path d="M4 4h11a3 3 0 0 1 3 3v13H7a3 3 0 0 1-3-3z" /><path d="M4 17a3 3 0 0 1 3-3h11" /></>,
  trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
  scale: <><rect x="3" y="4" width="18" height="16" rx="4" /><path d="M8 9a5 5 0 0 1 8 0l-3 3" /></>,
  sparkle: <path d="M12 3v4M12 17v4M3 12h4M17 12h4M6 6l2.5 2.5M15.5 15.5 18 18M6 18l2.5-2.5M15.5 8.5 18 6" />,
  edit: <path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />,
  external: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  leaf: <path d="M5 21c0-9 5-15 15-16-1 10-7 15-15 16zM5 21l8-8" />,
  calendar: <><rect x="3" y="5" width="18" height="16" rx="3" /><path d="M3 10h18M8 3v4M16 3v4" /></>,
  basket: <path d="M3 10h18l-2 10H5zM8 10l3-6M16 10l-3-6" />,
  download: <path d="M12 4v11M7 10l5 5 5-5M5 20h14" />,
  upload: <path d="M12 16V5M7 10l5-5 5 5M5 20h14" />,
};

export function Icon({ name, size = 22, stroke = 2 }: { name: keyof typeof paths | string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      {paths[name]}
    </svg>
  );
}

// ---------- Ring (numeric mode) ----------
export function Ring({ value, max, size = 180, stroke = 16, color = 'var(--green)', children }: { value: number; max: number; size?: number; stroke?: number; color?: string; children?: ReactNode }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const f = max > 0 ? Math.min(value / max, 1) : 0;
  const over = max > 0 && value > max;
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--card-2)" strokeWidth={stroke} fill="none" />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={over ? 'var(--amber)' : color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - f)}
          style={{ transition: 'stroke-dashoffset .6s ease' }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center' }}>{children}</div>
    </div>
  );
}

// ---------- Filling circle (intuitive mode) ----------
export function FillCircle({ fraction, size = 200, color = 'var(--green)', children, label }: { fraction: number; size?: number; color?: string; children?: ReactNode; label?: string }) {
  const id = useId().replace(/:/g, '');
  const f = Math.max(0, Math.min(fraction, 1));
  const r = size / 2 - 4;
  const level = size - 4 - f * (size - 8); // y of liquid surface
  const amp = f > 0.02 && f < 0.98 ? Math.max(3, size * 0.025) : 0;
  const w = size;
  const wave = `M0 ${level} Q ${w / 8} ${level - amp} ${w / 4} ${level} T ${w / 2} ${level} T ${(3 * w) / 4} ${level} T ${w} ${level} T ${(5 * w) / 4} ${level} T ${(3 * w) / 2} ${level} T ${(7 * w) / 4} ${level} T ${2 * w} ${level} V ${size} H 0 Z`;
  return (
    <div style={{ position: 'relative', width: size, height: size }} role="img" aria-label={label}>
      <svg width={size} height={size}>
        <defs>
          <clipPath id={`c${id}`}>
            <circle cx={size / 2} cy={size / 2} r={r} />
          </clipPath>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="var(--card-2)" />
        <g clipPath={`url(#c${id})`}>
          <path d={wave} fill={color} opacity={0.35} style={{ transition: 'd .8s ease' }}>
            {amp > 0 && <animateTransform attributeName="transform" type="translate" from={`${-w} 0`} to="0 0" dur="6s" repeatCount="indefinite" />}
          </path>
          <path d={wave} fill={color} style={{ transition: 'd .8s ease' }} transform={`translate(0 ${amp * 0.8})`}>
            {amp > 0 && <animateTransform attributeName="transform" type="translate" from={`0 ${amp * 0.8}`} to={`${-w} ${amp * 0.8}`} dur="4s" repeatCount="indefinite" />}
          </path>
        </g>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={3} opacity={0.6} />
      </svg>
      {children && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', textAlign: 'center', padding: 12 }}>{children}</div>}
    </div>
  );
}

/** Small static fill indicator used next to foods in intuitive mode. */
export function FillDot({ fraction, size = 26, color = 'var(--green)' }: { fraction: number; size?: number; color?: string }) {
  const f = Math.max(0, Math.min(fraction, 1));
  const r = size / 2 - 1.5;
  const h = f * (size - 3);
  return (
    <svg className="fill-dot" width={size} height={size} aria-label={`fills about ${Math.round(f * 100)}% of today`}>
      <defs>
        <clipPath id={`fd${size}-${Math.round(f * 1000)}`}>
          <circle cx={size / 2} cy={size / 2} r={r} />
        </clipPath>
      </defs>
      <circle cx={size / 2} cy={size / 2} r={r} fill="var(--card-2)" />
      <rect x={0} y={size - 1.5 - h} width={size} height={h + 2} fill={color} clipPath={`url(#fd${size}-${Math.round(f * 1000)})`} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={1.5} opacity={0.7} />
    </svg>
  );
}

export function fullnessPhrase(f: number) {
  if (f < 0.05) return 'Ready for the day';
  if (f < 0.35) return 'Plenty of room';
  if (f < 0.6) return 'About half full';
  if (f < 0.85) return 'Filling up';
  if (f <= 1.05) return 'Full for today';
  return "A little over, that's okay";
}

export function portionWord(f: number) {
  if (f < 0.04) return 'A nibble';
  if (f < 0.1) return 'A light bite';
  if (f < 0.2) return 'A snack-sized share';
  if (f < 0.35) return 'A meal-sized share';
  return 'A big share of your day';
}

// ---------- Sheet ----------
export function Sheet({ title, onClose, children, right }: { title: string; onClose: () => void; children: ReactNode; right?: ReactNode }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="grab" />
        <div className="sheet-head">
          <h2>{title}</h2>
          <div className="row">
            {right}
            <button className="icon-btn" onClick={onClose} aria-label="Close">
              <Icon name="x" />
            </button>
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// ---------- Toast ----------
let pushToast: ((msg: string) => void) | null = null;
export function toast(msg: string) {
  pushToast?.(msg);
}
export function ToastHost() {
  const [msg, setMsg] = useState<string | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    pushToast = (m) => {
      setMsg(m);
      clearTimeout(t);
      t = setTimeout(() => setMsg(null), 2600);
    };
    return () => {
      pushToast = null;
    };
  }, []);
  return msg ? <div className="toast" role="status">{msg}</div> : null;
}

// ---------- Inputs ----------
export function NumField({ label, value, onChange, suffix, hint, step = 'any', min, max, placeholder }: { label: string; value: string; onChange: (v: string) => void; suffix?: string; hint?: string; step?: string; min?: number; max?: number; placeholder?: string }) {
  return (
    <label className="field">
      {label}
      <div className="input-suffix">
        <input className="input num" inputMode="decimal" type="number" step={step} min={min} max={max} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
        {suffix && <span>{suffix}</span>}
      </div>
      {hint && <span className="hint">{hint}</span>}
    </label>
  );
}

export function Seg<T extends string>({ value, options, onChange }: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div className="seg" role="tablist">
      {options.map((o) => (
        <button key={o.value} role="tab" aria-selected={value === o.value} className={value === o.value ? 'on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </label>
  );
}

export const r0 = (n: number) => Math.round(n);
export const r1 = (n: number) => Math.round(n * 10) / 10;
