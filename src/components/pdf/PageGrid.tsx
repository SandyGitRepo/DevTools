import { useState, type DragEvent } from 'react';
import { ChevronLeft, ChevronRight, RotateCcw, RotateCw, Check, X } from 'lucide-react';
import PdfThumb from './PdfThumb';
import type { PDFDocumentProxy } from '../../lib/pdf/render';

export interface PageItem {
  /** Stable key (survives reordering). */
  key: string;
  /** Zero-based page index in the source document. */
  index: number;
  rotate: number;
}

export const initialItems = (count: number): PageItem[] => Array.from({ length: count }, (_, i) => ({ key: `p${i}`, index: i, rotate: 0 }));

interface Props {
  doc: PDFDocumentProxy;
  items: PageItem[];
  onItemsChange?: (items: PageItem[]) => void;
  selected?: Set<string>;
  onToggle?: (key: string) => void;
  reorder?: boolean;
  rotate?: boolean;
  /** "danger" shows selected pages as marked for removal. */
  selectTone?: 'accent' | 'danger';
}

/**
 * Page thumbnails with selection, drag-and-drop reordering and per-page rotation (FR-P3/P5/P6).
 * Every drag action also has a keyboard-accessible button (UI-10).
 */
export default function PageGrid({ doc, items, onItemsChange, selected, onToggle, reorder = false, rotate = false, selectTone = 'accent' }: Props) {
  const [dragKey, setDragKey] = useState<string | null>(null);
  const [overKey, setOverKey] = useState<string | null>(null);

  const move = (from: number, to: number) => {
    if (!onItemsChange || to < 0 || to >= items.length) return;
    const next = [...items];
    const [it] = next.splice(from, 1);
    next.splice(to, 0, it);
    onItemsChange(next);
  };
  const turn = (i: number, delta: number) => {
    if (!onItemsChange) return;
    const next = [...items];
    next[i] = { ...next[i], rotate: (((next[i].rotate + delta) % 360) + 360) % 360 };
    onItemsChange(next);
  };

  const onDrop = (e: DragEvent, targetKey: string) => {
    e.preventDefault();
    setOverKey(null);
    if (!dragKey || dragKey === targetKey) return;
    move(
      items.findIndex((x) => x.key === dragKey),
      items.findIndex((x) => x.key === targetKey),
    );
    setDragKey(null);
  };

  return (
    <ul className="grid grid-cols-[repeat(auto-fill,minmax(150px,1fr))] gap-3" aria-label="Pages">
      {items.map((it, i) => {
        const isSel = selected?.has(it.key);
        const tone = selectTone === 'danger' ? 'border-danger ring-2 ring-danger/50' : 'border-accent ring-2 ring-accent/50';
        return (
          <li
            key={it.key}
            draggable={reorder}
            onDragStart={() => setDragKey(it.key)}
            onDragEnd={() => (setDragKey(null), setOverKey(null))}
            onDragOver={(e) => {
              if (!reorder) return;
              e.preventDefault();
              setOverKey(it.key);
            }}
            onDrop={(e) => onDrop(e, it.key)}
            className={`group relative flex flex-col items-center gap-1.5 rounded border bg-[var(--surface-strong)] p-2 transition-shadow ${
              isSel ? tone : 'border-primary/40'
            } ${overKey === it.key && dragKey !== it.key ? 'shadow-[0_0_0_2px_rgb(var(--hud-cyan))]' : ''} ${reorder ? 'cursor-grab active:cursor-grabbing' : ''} ${
              dragKey === it.key ? 'opacity-40' : ''
            }`}
          >
            <button
              type="button"
              className="relative overflow-hidden rounded disabled:cursor-default"
              onClick={() => onToggle?.(it.key)}
              disabled={!onToggle}
              aria-pressed={onToggle ? !!isSel : undefined}
              aria-label={`Page ${it.index + 1}${isSel ? (selectTone === 'danger' ? ', marked for removal' : ', selected') : ''}`}
            >
              <PdfThumb doc={doc} page={it.index + 1} rotate={it.rotate} />
              {isSel && (
                <span className={`absolute right-1 top-1 rounded-full p-0.5 text-white ${selectTone === 'danger' ? 'bg-danger' : 'bg-accent'}`}>
                  {selectTone === 'danger' ? <X size={14} /> : <Check size={14} />}
                </span>
              )}
            </button>
            <div className="flex w-full items-center justify-between text-xs">
              {reorder ? (
                <button
                  type="button"
                  className="rounded p-1 text-muted hover:text-cyan disabled:opacity-30"
                  onClick={() => move(i, i - 1)}
                  disabled={i === 0}
                  aria-label={`Move page ${it.index + 1} earlier`}
                >
                  <ChevronLeft size={14} />
                </button>
              ) : (
                <span />
              )}
              <span className="font-mono text-muted">
                {it.index + 1}
                {it.rotate ? <span className="text-warn"> · {it.rotate}°</span> : null}
              </span>
              {reorder ? (
                <button
                  type="button"
                  className="rounded p-1 text-muted hover:text-cyan disabled:opacity-30"
                  onClick={() => move(i, i + 1)}
                  disabled={i === items.length - 1}
                  aria-label={`Move page ${it.index + 1} later`}
                >
                  <ChevronRight size={14} />
                </button>
              ) : (
                <span />
              )}
            </div>
            {rotate && (
              <div className="flex gap-1">
                <button
                  type="button"
                  className="rounded p-1 text-muted hover:text-cyan"
                  onClick={() => turn(i, -90)}
                  aria-label={`Rotate page ${it.index + 1} left`}
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  type="button"
                  className="rounded p-1 text-muted hover:text-cyan"
                  onClick={() => turn(i, 90)}
                  aria-label={`Rotate page ${it.index + 1} right`}
                >
                  <RotateCw size={14} />
                </button>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
