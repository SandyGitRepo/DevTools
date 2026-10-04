import { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import { ActionBar, KV, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { Checkbox, Segmented } from '../../components/ui/controls';
import { parseUrl, urlDecode, urlEncode, type UrlMode } from '../../lib/encoding/url';

const SAMPLE = 'https://portal.example.internal/loans/search?customer=Asha Verma&city=पुणे&status=ACTIVE&from=2026-04-01#results';

export default function UrlTool() {
  const [mode, setMode] = useState<UrlMode>('component');
  const [plain, setPlain] = useState('');
  const [encoded, setEncoded] = useState('');
  const [plus, setPlus] = useState(false);
  const { error, status, run, reset } = useAction();
  useHandoff(setEncoded);

  const parsed = useMemo(() => {
    const candidate = (plain || encoded).trim();
    if (!/^[a-z][a-z0-9+.-]*:\/\//i.test(candidate)) return null;
    try {
      return parseUrl(candidate);
    } catch {
      return null;
    }
  }, [plain, encoded]);

  return (
    <ToolShell
      onSample={() => {
        setPlain(SAMPLE);
        setMode('full');
      }}
      onClear={() => {
        setPlain('');
        setEncoded('');
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Component</b> (encodeURIComponent) escapes everything except letters, digits and <code>-_.!~*'()</code> — use it for a single query value.
          </li>
          <li>
            <b>Full URL</b> (encodeURI) keeps <code>: / ? # &amp; =</code> so the URL structure survives.
          </li>
          <li>Any absolute URL is broken down below, with the query string as a table. Passwords in URLs are masked.</li>
        </ul>
      }
    >
      <ActionBar>
        <Segmented
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'component', label: 'Component' },
            { value: 'full', label: 'Full URL' },
          ]}
        />
        <div className="pb-2">
          <Checkbox label="Space as + (form encoding)" checked={plus} onChange={setPlus} />
        </div>
        <button
          type="button"
          className="hud-btn hud-btn-accent"
          disabled={!plain}
          onClick={() => run(() => setEncoded(urlEncode(plain, mode, plus)), { success: 'Encoded' })}
        >
          <ArrowDown size={15} aria-hidden="true" /> Encode
        </button>
        <button
          type="button"
          className="hud-btn"
          disabled={!encoded}
          onClick={() => run(() => setPlain(urlDecode(encoded, mode, plus)), { success: 'Decoded' })}
        >
          <ArrowUp size={15} aria-hidden="true" /> Decode
        </button>
        <div className="ml-auto self-center">
          <StatusLine status={status} />
        </div>
      </ActionBar>
      <TwoPane>
        <EditorPane title="Decoded" value={plain} onChange={setPlain} className="h-[30vh] min-h-[180px]" />
        <EditorPane title="Encoded" value={encoded} onChange={setEncoded} className="h-[30vh] min-h-[180px]" error={error} />
      </TwoPane>
      {parsed && (
        <TwoPane>
          <section className="hud-panel p-4">
            <h2 className="mb-2 font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">URL parts</h2>
            <KV rows={parsed.parts} />
          </section>
          <section className="hud-panel p-4">
            <h2 className="mb-2 font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Query parameters ({parsed.params.length})</h2>
            {parsed.params.length ? (
              <table className="hud-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Value (decoded)</th>
                  </tr>
                </thead>
                <tbody>
                  {parsed.params.map(([k, v], i) => (
                    <tr key={i}>
                      <td className="font-mono text-xs text-cyan">{k}</td>
                      <td className="break-all font-mono text-xs">{v}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="text-sm text-muted">No query string.</p>
            )}
          </section>
        </TwoPane>
      )}
    </ToolShell>
  );
}
