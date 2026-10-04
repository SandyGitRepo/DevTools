import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, CornerDownLeft } from 'lucide-react';
import { moduleById, searchTools } from '../../registry/tools';

export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const [q, setQ] = useState('');
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const navigate = useNavigate();
  const results = useMemo(() => searchTools(q).slice(0, 30), [q]);

  useEffect(() => inputRef.current?.focus(), []);
  useEffect(() => setActive(0), [q]);
  useEffect(() => {
    listRef.current?.querySelector(`[data-idx="${active}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  const go = (id: string) => {
    onClose();
    navigate(`/tool/${id}`);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter' && results[active]) {
      go(results[active].id);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 pt-[12vh]" onMouseDown={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Search tools"
        className="hud-panel w-full max-w-xl bg-[var(--surface-strong)]"
        onMouseDown={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-primary/30 px-3">
          <Search size={18} className="text-cyan" aria-hidden="true" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Jump to a tool… (e.g. jwt, sha256, merge pdf)"
            className="h-12 flex-1 bg-transparent text-base text-fg outline-none placeholder:text-muted"
            role="combobox"
            aria-expanded="true"
            aria-controls="palette-list"
            aria-activedescendant={results[active] ? `opt-${results[active].id}` : undefined}
          />
          <kbd className="rounded border border-primary/40 px-1.5 font-mono text-[10px] text-muted">Esc</kbd>
        </div>
        <ul ref={listRef} id="palette-list" role="listbox" className="max-h-[50vh] overflow-y-auto p-1.5">
          {results.length === 0 && <li className="p-4 text-center text-sm text-muted">No tools match “{q}”.</li>}
          {results.map((tool, i) => {
            const mod = moduleById(tool.module)!;
            return (
              <li
                key={tool.id}
                id={`opt-${tool.id}`}
                data-idx={i}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onClick={() => go(tool.id)}
                className={`flex cursor-pointer items-center gap-3 rounded px-3 py-2 ${i === active ? 'bg-primary/25' : ''}`}
              >
                <mod.icon size={16} className="shrink-0 text-cyan" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm text-fg">
                    {tool.name}
                    {!tool.load && <span className="rounded bg-warn/15 px-1.5 text-[10px] uppercase text-warn">Phase {tool.phase}</span>}
                  </div>
                  <div className="truncate text-xs text-muted">{tool.description}</div>
                </div>
                {i === active && <CornerDownLeft size={14} className="text-muted" aria-hidden="true" />}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
