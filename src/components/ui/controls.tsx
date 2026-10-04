import { useId, type ReactNode } from 'react';

export function Field({ label, children, className = '', hint }: { label: string; children: (id: string) => ReactNode; className?: string; hint?: string }) {
  const id = useId();
  return (
    <div className={className}>
      <label htmlFor={id} className="hud-label">
        {label}
      </label>
      {children(id)}
      {hint && <p className="mt-1 text-[11px] text-muted">{hint}</p>}
    </div>
  );
}

export function Select<T extends string>({
  label,
  value,
  onChange,
  options,
  className = '',
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly (T | { value: T; label: string })[];
  className?: string;
}) {
  return (
    <Field label={label} className={className}>
      {(id) => (
        <select id={id} className="hud-input" value={value} onChange={(e) => onChange(e.target.value as T)}>
          {options.map((o) => {
            const v = typeof o === 'string' ? o : o.value;
            const l = typeof o === 'string' ? o : o.label;
            return (
              <option key={v} value={v} className="bg-navy text-fg">
                {l}
              </option>
            );
          })}
        </select>
      )}
    </Field>
  );
}

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  type = 'text',
  className = '',
  mono = false,
  hint,
  autoComplete = 'off',
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
  mono?: boolean;
  hint?: string;
  autoComplete?: string;
}) {
  return (
    <Field label={label} className={className} hint={hint}>
      {(id) => (
        <input
          id={id}
          type={type}
          className={`hud-input ${mono ? 'font-mono' : ''}`}
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
          autoComplete={autoComplete}
          spellCheck={false}
        />
      )}
    </Field>
  );
}

export function TextArea({
  label,
  value,
  onChange,
  placeholder,
  rows = 4,
  className = '',
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (v: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
  readOnly?: boolean;
}) {
  return (
    <Field label={label} className={className}>
      {(id) => (
        <textarea
          id={id}
          rows={rows}
          readOnly={readOnly}
          className="hud-input resize-y font-mono text-xs"
          value={value}
          placeholder={placeholder}
          onChange={(e) => onChange?.(e.target.value)}
          spellCheck={false}
        />
      )}
    </Field>
  );
}

export function Checkbox({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label className="inline-flex cursor-pointer select-none items-center gap-2 text-sm text-fg">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className="h-4 w-4 accent-[rgb(var(--accent))]" />
      {label}
    </label>
  );
}

/** Segmented control rendered as a radio group (keyboard accessible). */
export function Segmented<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: T;
  onChange: (v: T) => void;
  options: readonly (T | { value: T; label: string })[];
}) {
  const name = useId();
  return (
    <fieldset>
      <legend className="hud-label">{label}</legend>
      <div className="inline-flex flex-wrap overflow-hidden rounded border border-primary/50">
        {options.map((o) => {
          const v = typeof o === 'string' ? o : o.value;
          const l = typeof o === 'string' ? o : o.label;
          const on = v === value;
          return (
            <label
              key={v}
              className={`cursor-pointer px-3 py-1.5 text-sm transition-colors focus-within:outline focus-within:outline-2 focus-within:outline-accent ${
                on ? 'bg-primary/40 text-fg shadow-[inset_0_-2px_0_rgb(var(--hud-cyan))]' : 'text-muted hover:bg-primary/15 hover:text-fg'
              }`}
            >
              <input type="radio" name={name} value={v} checked={on} onChange={() => onChange(v)} className="sr-only" />
              {l}
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="hud-panel flex flex-wrap items-end gap-3 p-3">{children}</div>;
}
