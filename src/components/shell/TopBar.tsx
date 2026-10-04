import { Moon, Search, Sun, Zap, ZapOff } from 'lucide-react';
import { prefs, usePrefs } from '../../state/prefs';
import { appConfig } from '../../config/app.config';

export default function TopBar({ onOpenPalette }: { onOpenPalette: () => void }) {
  const p = usePrefs();
  return (
    <header className="no-print flex h-14 shrink-0 items-center gap-3 border-b border-primary/30 bg-[var(--surface-glass)] px-4 backdrop-blur-md lg:px-6">
      <p className="hidden truncate font-hud text-[11px] uppercase tracking-[0.25em] text-muted md:block">{appConfig.tagline}</p>
      <button
        type="button"
        onClick={onOpenPalette}
        className="ml-auto flex w-full max-w-sm items-center gap-2 rounded border border-primary/40 bg-[var(--surface-strong)] px-3 py-1.5 text-sm text-muted hover:border-cyan"
        aria-label="Search tools (Ctrl+K)"
      >
        <Search size={15} aria-hidden="true" />
        <span className="flex-1 text-left">Search tools…</span>
        <kbd className="rounded border border-primary/40 px-1.5 font-mono text-[10px]">Ctrl K</kbd>
      </button>
      <button
        type="button"
        onClick={prefs.toggleReduceMotion}
        className="hud-btn hud-btn-ghost px-2"
        aria-pressed={p.reduceMotion}
        aria-label={p.reduceMotion ? 'Enable animations' : 'Reduce motion'}
        title={p.reduceMotion ? 'Animations off' : 'Animations on'}
      >
        {p.reduceMotion ? <ZapOff size={17} /> : <Zap size={17} />}
      </button>
      <button
        type="button"
        onClick={prefs.toggleTheme}
        className="hud-btn hud-btn-ghost px-2"
        aria-label={p.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        title="Toggle theme"
      >
        {p.theme === 'dark' ? <Sun size={17} /> : <Moon size={17} />}
      </button>
    </header>
  );
}
