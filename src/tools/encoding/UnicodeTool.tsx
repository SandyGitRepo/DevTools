import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { Checkbox } from '../../components/ui/controls';
import { inspect, unicodeEscape, unicodeUnescape } from '../../lib/encoding/unicode';

const FLAG = new Set(['Control', 'Invisible / zero-width', 'Lone surrogate']);

export default function UnicodeTool() {
  const [plain, setPlain] = useState('');
  const [escaped, setEscaped] = useState('');
  const [all, setAll] = useState(false);
  const [braces, setBraces] = useState(false);
  const { error, status, run, reset } = useAction();
  useHandoff(setEscaped);

  const info = useMemo(() => inspect(plain, 500), [plain]);
  const flagged = info.filter((c) => FLAG.has(c.category)).length;

  return (
    <ToolShell
      onSample={() => setPlain('Café ₹500 — नमस्ते 👋🏽​(zero-width space before this bracket)')}
      onClear={() => {
        setPlain('');
        setEscaped('');
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Escaping turns non-ASCII characters into <code>\uXXXX</code> (Java/JSON/JS style). Characters beyond U+FFFF become surrogate pairs, or{' '}
            <code>
              \u{'{'}…{'}'}
            </code>{' '}
            with ES6 braces.
          </li>
          <li>
            Unescaping also understands <code>\xXX</code>, <code>\n</code>, <code>\t</code> and friends.
          </li>
          <li>The inspector flags invisible characters (zero-width spaces, BOMs, control codes) that often break parsers and comparisons.</li>
        </ul>
      }
    >
      <ActionBar>
        <div className="flex flex-col gap-1.5 pb-1">
          <Checkbox label="Escape ASCII too" checked={all} onChange={setAll} />
          <Checkbox label="ES6 \u{…} for emoji" checked={braces} onChange={setBraces} />
        </div>
        <button
          type="button"
          className="hud-btn hud-btn-accent"
          disabled={!plain}
          onClick={() => run(() => setEscaped(unicodeEscape(plain, { all, braces })), { success: 'Escaped' })}
        >
          <ArrowDown size={15} aria-hidden="true" /> Escape
        </button>
        <button type="button" className="hud-btn" disabled={!escaped} onClick={() => run(() => setPlain(unicodeUnescape(escaped)), { success: 'Unescaped' })}>
          <ArrowUp size={15} aria-hidden="true" /> Unescape
        </button>
        <div className="ml-auto self-center">
          <StatusLine status={status ?? (flagged ? { kind: 'warn', text: `${flagged} invisible/control character(s) found` } : null)} />
        </div>
      </ActionBar>
      <TwoPane>
        <EditorPane title="Text" value={plain} onChange={setPlain} acceptFile=".txt" className="h-[34vh] min-h-[200px]" />
        <EditorPane title="Escaped" value={escaped} onChange={setEscaped} error={error} className="h-[34vh] min-h-[200px]" />
      </TwoPane>
      {info.length > 0 && (
        <section className="hud-panel max-h-[40vh] overflow-auto p-4" aria-label="Character inspector">
          <h2 className="mb-2 font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">
            Character inspector {plain.length > 500 ? '(first 500 characters)' : ''}
          </h2>
          <table className="hud-table">
            <thead>
              <tr>
                <th>Char</th>
                <th>Code point</th>
                <th>Decimal</th>
                <th>UTF-8 bytes</th>
                <th>UTF-16</th>
                <th>Category</th>
              </tr>
            </thead>
            <tbody>
              {info.map((c, i) => (
                <tr key={i} className={FLAG.has(c.category) ? 'bg-warn/10' : ''}>
                  <td className="text-base">{c.char || <span className="text-xs text-muted">—</span>}</td>
                  <td className="font-mono text-xs text-cyan">{c.codePoint}</td>
                  <td className="font-mono text-xs">{c.decimal}</td>
                  <td className="font-mono text-xs">{c.utf8}</td>
                  <td className="font-mono text-xs">{c.utf16}</td>
                  <td className={`text-xs ${FLAG.has(c.category) ? 'text-warn' : 'text-muted'}`}>{c.category}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </ToolShell>
  );
}
