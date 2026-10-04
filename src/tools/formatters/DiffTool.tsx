import { useState } from 'react';
import { GitCompare } from 'lucide-react';
import { create } from 'jsondiffpatch';
import { format as toJsonPatch } from 'jsondiffpatch/formatters/jsonpatch';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import { CodeDiffEditor } from '../../components/tool/CodeEditor';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { Checkbox, Segmented, Select } from '../../components/ui/controls';
import { formatJson } from '../../lib/formatters/json';
import { parseJson } from '../../lib/formatters/jsonError';

const LEFT = `{"id":10293,"name":"Asha Verma","limits":{"daily":50000,"monthly":200000},"tags":["salaried","priority"],"kyc":"VERIFIED"}`;
const RIGHT = `{"id":10293,"name":"Asha Verma","limits":{"daily":75000,"monthly":200000},"tags":["salaried"],"kyc":"VERIFIED","branch":"PUNE-01"}`;

const differ = create({ objectHash: (o: object, i?: number) => (o as { id?: string }).id ?? `$$index:${i}` });

export default function DiffTool() {
  const [left, setLeft] = useState('');
  const [right, setRight] = useState('');
  const [mode, setMode] = useState<'text' | 'json'>('text');
  const [inline, setInline] = useState(false);
  const [language, setLanguage] = useState('plaintext');
  const [ignoreWs, setIgnoreWs] = useState(false);
  const [view, setView] = useState<{ a: string; b: string; patch?: string } | null>(null);
  const { error, status, run, reset, setStatus } = useAction();

  const compare = () =>
    run(() => {
      if (mode === 'json') {
        let a: unknown, b: unknown;
        try {
          a = parseJson(left);
        } catch (e) {
          throw new Error(`Original: ${(e as Error).message}`, { cause: e });
        }
        try {
          b = parseJson(right);
        } catch (e) {
          throw new Error(`Changed: ${(e as Error).message}`, { cause: e });
        }
        const delta = differ.diff(a, b);
        const patch = delta ? toJsonPatch(delta) : [];
        // Normalised (sorted-key) views make the visual diff ignore key order
        setView({ a: formatJson(left, '2', true), b: formatJson(right, '2', true), patch: JSON.stringify(patch, null, 2) });
        setStatus(
          patch.length ? { kind: 'warn', text: `${patch.length} semantic change(s)` } : { kind: 'success', text: 'Documents are semantically identical' },
        );
      } else {
        const norm = (s: string) =>
          ignoreWs
            ? s
                .split('\n')
                .map((l) => l.trim().replace(/\s+/g, ' '))
                .join('\n')
            : s;
        setView({ a: norm(left), b: norm(right) });
        setStatus(norm(left) === norm(right) ? { kind: 'success', text: 'Texts are identical' } : { kind: 'info', text: 'Differences highlighted below' });
      }
    });

  return (
    <ToolShell
      onSample={() => {
        setMode('json');
        setLeft(LEFT);
        setRight(RIGHT);
        setView(null);
      }}
      onClear={() => {
        setLeft('');
        setRight('');
        setView(null);
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Text</b> mode is a line diff, side by side or inline.
          </li>
          <li>
            <b>JSON</b> mode ignores key order and formatting and lists the semantic changes as an RFC 6902 JSON Patch. Array items with an <code>id</code> are
            matched by id.
          </li>
        </ul>
      }
    >
      <ActionBar>
        <Segmented
          label="Mode"
          value={mode}
          onChange={(m) => (setMode(m), setView(null))}
          options={[
            { value: 'text', label: 'Text' },
            { value: 'json', label: 'JSON (semantic)' },
          ]}
        />
        {mode === 'text' && (
          <Select
            label="Syntax"
            value={language}
            onChange={setLanguage}
            options={['plaintext', 'json', 'xml', 'sql', 'java', 'javascript', 'typescript', 'yaml', 'html', 'css', 'markdown']}
          />
        )}
        <div className="flex flex-col gap-1.5 pb-1">
          <Checkbox label="Inline view" checked={inline} onChange={setInline} />
          {mode === 'text' && <Checkbox label="Ignore whitespace" checked={ignoreWs} onChange={setIgnoreWs} />}
        </div>
        <button type="button" className="hud-btn hud-btn-accent" onClick={compare} disabled={!left && !right}>
          <GitCompare size={15} aria-hidden="true" /> Compare
        </button>
        <div className="ml-auto self-center">
          <StatusLine status={status} />
        </div>
      </ActionBar>
      {error && (
        <p role="alert" className="text-sm text-danger">
          {error.message}
        </p>
      )}
      <TwoPane>
        <EditorPane
          title="Original"
          value={left}
          onChange={setLeft}
          language={mode === 'json' ? 'json' : language}
          acceptFile="*"
          className="h-[32vh] min-h-[200px]"
        />
        <EditorPane
          title="Changed"
          value={right}
          onChange={setRight}
          language={mode === 'json' ? 'json' : language}
          acceptFile="*"
          className="h-[32vh] min-h-[200px]"
        />
      </TwoPane>
      {view && (
        <div className={`grid gap-4 ${view.patch ? 'xl:grid-cols-[2fr_1fr]' : ''}`}>
          <section className="hud-panel h-[50vh] min-h-[300px] overflow-hidden" aria-label="Differences">
            <CodeDiffEditor original={view.a} modified={view.b} language={mode === 'json' ? 'json' : language} inline={inline} />
          </section>
          {view.patch && (
            <EditorPane
              title="JSON Patch (RFC 6902)"
              value={view.patch}
              readOnly
              language="json"
              downloadName="changes.patch.json"
              className="h-[50vh] min-h-[300px]"
            />
          )}
        </div>
      )}
    </ToolShell>
  );
}
