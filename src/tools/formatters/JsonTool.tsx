import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, Play, Minimize2, CheckCircle2 } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import CodeEditor from '../../components/tool/CodeEditor';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import Tabs from '../../components/ui/Tabs';
import { Checkbox, Select, TextInput } from '../../components/ui/controls';
import { formatJson, minifyJson, queryJson, toTree, validateSchema, type Indent, type JsonNode, type SchemaIssue } from '../../lib/formatters/json';
import { locateJsonError } from '../../lib/formatters/jsonError';
import type { ToolError } from '../../lib/errors';

const SAMPLE = `{"customer":{"id":10293,"name":"Asha Verma","email":"asha.verma@example.test","kyc":{"status":"VERIFIED","verifiedOn":"2026-09-14"}},"loans":[{"id":"LN-0001","amount":500000,"tenureMonths":60,"active":true},{"id":"LN-0002","amount":125000,"tenureMonths":24,"active":false}],"tags":["priority","salaried"],"notes":null}`;

const SAMPLE_SCHEMA = `{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "required": ["customer", "loans"],
  "properties": {
    "customer": {
      "type": "object",
      "required": ["id", "name"],
      "properties": { "id": { "type": "integer" }, "email": { "type": "string", "format": "email" } }
    },
    "loans": { "type": "array", "items": { "type": "object", "required": ["id", "amount"] } }
  }
}`;

type Tab = 'output' | 'tree' | 'query' | 'schema';

function TreeNode({ node, depth = 0 }: { node: JsonNode; depth?: number }) {
  const [open, setOpen] = useState(depth < 2);
  if (!node.children) {
    return (
      <div className="flex gap-2 py-0.5 pl-5 font-mono text-xs" title={node.path}>
        <span className="text-cyan">{node.key}:</span>
        <span className={node.type === 'string' ? 'text-success' : node.type === 'number' ? 'text-warn' : 'text-accent'}>{node.value}</span>
      </div>
    );
  }
  return (
    <div className="font-mono text-xs">
      <button type="button" onClick={() => setOpen(!open)} className="flex items-center gap-1 py-0.5 hover:text-cyan" aria-expanded={open} title={node.path}>
        <ChevronRight size={13} className={`transition-transform ${open ? 'rotate-90' : ''}`} aria-hidden="true" />
        <span className="text-cyan">{node.key}</span>
        <span className="text-muted">{node.type}</span>
      </button>
      {open && (
        <div className="ml-2 border-l border-primary/25 pl-2">
          {node.children.slice(0, 1000).map((c) => (
            <TreeNode key={c.path} node={c} depth={depth + 1} />
          ))}
          {node.children.length > 1000 && <div className="pl-5 text-muted">… {node.children.length - 1000} more</div>}
        </div>
      )}
    </div>
  );
}

export default function JsonTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [indent, setIndent] = useState<Indent>('2');
  const [sortKeys, setSortKeys] = useState(false);
  const [tab, setTab] = useState<Tab>('output');
  const [path, setPath] = useState('$..id');
  const [schema, setSchema] = useState('');
  const [schemaIssues, setSchemaIssues] = useState<SchemaIssue[] | null>(null);
  const [liveError, setLiveError] = useState<ToolError | null>(null);
  const { error, status, run, reset, setStatus } = useAction();

  useHandoff(setInput);

  // Live validation, debounced
  useEffect(() => {
    if (!input.trim()) {
      setLiveError(null);
      return;
    }
    const t = setTimeout(() => {
      try {
        JSON.parse(input);
        setLiveError(null);
      } catch {
        setLiveError(locateJsonError(input));
      }
    }, 300);
    return () => clearTimeout(t);
  }, [input]);

  const parsed = useMemo(() => {
    if (tab !== 'tree' || liveError || !input.trim()) return null;
    try {
      return toTree(JSON.parse(input));
    } catch {
      return null;
    }
  }, [tab, input, liveError]);

  const queryResult = useMemo(() => {
    if (tab !== 'query' || !input.trim() || !path.trim()) return { text: '', error: null as string | null };
    try {
      const r = queryJson(input, path);
      return { text: JSON.stringify(r, null, 2), error: null, count: r.length };
    } catch (e) {
      return { text: '', error: (e as Error).message };
    }
  }, [tab, input, path]);

  const format = () => run(() => setOutput(formatJson(input, indent, sortKeys)), { source: input, success: 'Formatted' }).then(() => setTab('output'));
  const minify = () =>
    run(
      () => {
        const out = minifyJson(input, sortKeys);
        setOutput(out);
        return out;
      },
      {
        source: input,
        success: (out) => `Minified to ${out.length.toLocaleString()} chars (${Math.round((1 - out.length / Math.max(1, input.length)) * 100)}% smaller)`,
      },
    ).then(() => setTab('output'));
  const validate = () => run(() => void formatJson(input), { source: input, success: 'Valid JSON' });
  const runSchema = () =>
    run(
      () => {
        const issues = validateSchema(input, schema);
        setSchemaIssues(issues);
        setStatus(issues.length ? { kind: 'warn', text: `${issues.length} schema violation(s)` } : { kind: 'success', text: 'Document matches the schema' });
      },
      { source: input },
    );

  const clear = () => {
    setInput('');
    setOutput('');
    setSchema('');
    setSchemaIssues(null);
    setLiveError(null);
    reset();
  };

  return (
    <ToolShell
      onSample={() => {
        setInput(SAMPLE);
        setSchema(SAMPLE_SCHEMA);
        reset();
      }}
      onClear={clear}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Paste JSON, type it, or drop a <code>.json</code> file on the input pane. It is validated as you type.
          </li>
          <li>
            <b>Format</b> pretty-prints; <b>Minify</b> removes whitespace; <b>Sort keys</b> orders object keys alphabetically at every level.
          </li>
          <li>
            <b>Tree</b> lets you browse large documents; hover a node to see its JSONPath.
          </li>
          <li>
            <b>JSONPath</b> examples: <code>$.loans[*].id</code>, <code>$..amount</code>, <code>$.loans[?(@.active)]</code>.
          </li>
          <li>
            <b>Schema</b> validates against JSON Schema drafts 4, 7, 2019-09 and 2020-12.
          </li>
        </ul>
      }
    >
      <ActionBar>
        <Select
          label="Indent"
          value={indent}
          onChange={setIndent}
          options={[
            { value: '2', label: '2 spaces' },
            { value: '4', label: '4 spaces' },
            { value: 'tab', label: 'Tab' },
          ]}
        />
        <div className="pb-2">
          <Checkbox label="Sort keys" checked={sortKeys} onChange={setSortKeys} />
        </div>
        <button type="button" className="hud-btn hud-btn-accent" onClick={format} disabled={!input}>
          <Play size={15} aria-hidden="true" /> Format
        </button>
        <button type="button" className="hud-btn" onClick={minify} disabled={!input}>
          <Minimize2 size={15} aria-hidden="true" /> Minify
        </button>
        <button type="button" className="hud-btn" onClick={validate} disabled={!input}>
          <CheckCircle2 size={15} aria-hidden="true" /> Validate
        </button>
        <div className="ml-auto self-center">
          <StatusLine status={status ?? (input && !liveError ? { kind: 'info', text: 'Valid JSON' } : null)} />
        </div>
      </ActionBar>
      <TwoPane>
        <EditorPane
          title="Input"
          value={input}
          onChange={setInput}
          language="json"
          acceptFile=".json,.txt,application/json"
          error={error ?? liveError}
          detectFrom="json"
        />
        <section className="hud-panel flex h-[60vh] min-h-[320px] flex-col overflow-hidden">
          <Tabs
            value={tab}
            onChange={setTab}
            className="h-full"
            tabs={[
              { id: 'output', label: 'Output' },
              { id: 'tree', label: 'Tree' },
              { id: 'query', label: 'JSONPath' },
              { id: 'schema', label: 'Schema' },
            ]}
          >
            {tab === 'output' && (
              <EditorPane
                title="Output"
                value={output}
                readOnly
                language="json"
                downloadName="formatted.json"
                className="h-full border-0 shadow-none before:hidden after:hidden"
              />
            )}
            {tab === 'tree' && (
              <div className="h-full overflow-auto p-3">
                {parsed ? (
                  <TreeNode node={parsed} />
                ) : (
                  <p className="text-sm text-muted">{input ? 'Fix the JSON errors to see the tree.' : 'Paste JSON to browse it as a tree.'}</p>
                )}
              </div>
            )}
            {tab === 'query' && (
              <div className="flex h-full flex-col gap-2 p-3">
                <TextInput label="JSONPath expression" value={path} onChange={setPath} mono placeholder="$.store.book[*].author" />
                {queryResult.error ? (
                  <p role="alert" className="text-sm text-danger">
                    {queryResult.error}
                  </p>
                ) : (
                  <p className="text-xs text-muted">{'count' in queryResult ? `${queryResult.count} match(es)` : ''}</p>
                )}
                <div className="min-h-0 flex-1 overflow-hidden rounded border border-primary/30">
                  <CodeEditor value={queryResult.text} readOnly language="json" ariaLabel="JSONPath result" />
                </div>
              </div>
            )}
            {tab === 'schema' && (
              <div className="flex h-full flex-col gap-2 p-3">
                <div className="min-h-0 flex-1 overflow-hidden rounded border border-primary/30">
                  <CodeEditor value={schema} onChange={setSchema} language="json" ariaLabel="JSON Schema" />
                </div>
                <div className="flex items-center gap-3">
                  <button type="button" className="hud-btn hud-btn-accent" onClick={runSchema} disabled={!input || !schema}>
                    Validate against schema
                  </button>
                  {!schema && <span className="text-xs text-muted">Paste a JSON Schema above.</span>}
                </div>
                {schemaIssues && schemaIssues.length > 0 && (
                  <ul className="max-h-40 overflow-auto rounded border border-danger/40 bg-danger/10 p-2 text-xs">
                    {schemaIssues.map((s, i) => (
                      <li key={i} className="py-0.5">
                        <span className="font-mono text-warn">{s.path}</span> — {s.message}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </Tabs>
        </section>
      </TwoPane>
    </ToolShell>
  );
}
