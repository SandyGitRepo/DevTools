import { useId, useRef, type ReactNode } from 'react';

export interface TabDef<T extends string> {
  id: T;
  label: ReactNode;
}

/** WAI-ARIA tabs with arrow-key navigation. */
export default function Tabs<T extends string>({
  tabs,
  value,
  onChange,
  children,
  className = '',
}: {
  tabs: TabDef<T>[];
  value: T;
  onChange: (t: T) => void;
  children: ReactNode;
  className?: string;
}) {
  const base = useId();
  const refs = useRef<(HTMLButtonElement | null)[]>([]);
  const idx = tabs.findIndex((t) => t.id === value);
  const onKey = (e: React.KeyboardEvent) => {
    const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
    if (!d) return;
    e.preventDefault();
    const next = (idx + d + tabs.length) % tabs.length;
    onChange(tabs[next].id);
    refs.current[next]?.focus();
  };
  return (
    <div className={`flex min-h-0 flex-col ${className}`}>
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-primary/30 px-2" onKeyDown={onKey}>
        {tabs.map((t, i) => (
          <button
            key={t.id}
            ref={(el) => {
              refs.current[i] = el;
            }}
            role="tab"
            type="button"
            id={`${base}-tab-${t.id}`}
            aria-selected={t.id === value}
            aria-controls={`${base}-panel`}
            tabIndex={t.id === value ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={`-mb-px border-b-2 px-3 py-2 font-hud text-[11px] uppercase tracking-[0.15em] transition-colors ${
              t.id === value ? 'border-cyan text-cyan' : 'border-transparent text-muted hover:text-fg'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div role="tabpanel" id={`${base}-panel`} aria-labelledby={`${base}-tab-${value}`} className="min-h-0 flex-1">
        {children}
      </div>
    </div>
  );
}
