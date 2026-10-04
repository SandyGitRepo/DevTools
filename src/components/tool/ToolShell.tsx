import { useState, type ReactNode } from 'react';
import { HelpCircle, Laptop, Server, Sparkles, Star, Trash2 } from 'lucide-react';
import { useToolMeta } from './ToolContext';
import { prefs, usePrefs } from '../../state/prefs';

interface Props {
  children: ReactNode;
  /** Loads safe sample data (UI-12). */
  onSample?: () => void;
  /** Wipes input, output and in-memory state (FR-C7). */
  onClear?: () => void;
  /** In-app guide shown under the "?" button (NFR-9). */
  help?: ReactNode;
}

export function LocalBadge({ server = false }: { server?: boolean }) {
  return server ? (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-warn/50 bg-warn/10 px-2.5 py-0.5 text-xs text-warn">
      <Server size={12} aria-hidden="true" /> Processed on internal server, not stored
    </span>
  ) : (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-success/50 bg-success/10 px-2.5 py-0.5 text-xs text-success">
      <Laptop size={12} aria-hidden="true" /> Processed locally — nothing leaves your device
    </span>
  );
}

export default function ToolShell({ children, onSample, onClear, help }: Props) {
  const tool = useToolMeta();
  const { favourites } = usePrefs();
  const [showHelp, setShowHelp] = useState(false);
  const fav = favourites.includes(tool.id);

  return (
    <div className="mx-auto flex max-w-[1800px] flex-col gap-4">
      <header className="tool-header flex flex-wrap items-start gap-x-4 gap-y-2">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-hud text-lg font-bold uppercase tracking-widest text-fg">{tool.name}</h1>
            <span className="font-mono text-[11px] text-muted">{tool.frId}</span>
            <LocalBadge server={tool.runsOn === 'server'} />
          </div>
          <p className="mt-1 text-sm text-muted">{tool.description}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onSample && (
            <button type="button" className="hud-btn" onClick={onSample}>
              <Sparkles size={15} aria-hidden="true" /> Try sample
            </button>
          )}
          {onClear && (
            <button type="button" className="hud-btn" onClick={onClear}>
              <Trash2 size={15} aria-hidden="true" /> Clear all
            </button>
          )}
          {help && (
            <button type="button" className="hud-btn px-2" onClick={() => setShowHelp((s) => !s)} aria-expanded={showHelp} aria-label="How to use this tool">
              <HelpCircle size={16} />
            </button>
          )}
          <button
            type="button"
            className="hud-btn px-2"
            onClick={() => prefs.toggleFavourite(tool.id)}
            aria-pressed={fav}
            aria-label={fav ? 'Remove from favourites' : 'Add to favourites'}
          >
            <Star size={16} className={fav ? 'fill-accent text-accent' : ''} />
          </button>
        </div>
      </header>
      {help && showHelp && <div className="hud-panel p-4 text-sm leading-relaxed text-muted [&_b]:text-fg [&_code]:font-mono [&_code]:text-cyan">{help}</div>}
      {children}
    </div>
  );
}
