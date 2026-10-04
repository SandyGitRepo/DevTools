/**
 * Lazy wrappers around the Monaco editors. Monaco is ~2.7 MB of JavaScript, so it loads after the
 * tool's own UI has rendered: controls are usable at once and the editor streams in (NFR-1).
 */
import { lazy, Suspense } from 'react';
import Loader from '../ui/Loader';
import type { CodeEditorProps } from './MonacoEditors';

export type { CodeEditorProps };

const MonacoEditor = lazy(() => import('./MonacoEditors'));
const MonacoDiff = lazy(() => import('./MonacoEditors').then((m) => ({ default: m.CodeDiffEditor })));

function Placeholder({ label }: { label: string }) {
  return (
    <div className="flex h-full min-h-[120px] items-center justify-center gap-2 text-xs text-muted" role="status" aria-label={label}>
      <Loader label={label} /> Loading editor…
    </div>
  );
}

export default function CodeEditor(props: CodeEditorProps) {
  return (
    <Suspense fallback={<Placeholder label={`Loading ${props.ariaLabel}`} />}>
      <MonacoEditor {...props} />
    </Suspense>
  );
}

export function CodeDiffEditor(props: { original: string; modified: string; language?: string; inline: boolean }) {
  return (
    <Suspense fallback={<Placeholder label="Loading diff editor" />}>
      <MonacoDiff {...props} />
    </Suspense>
  );
}
