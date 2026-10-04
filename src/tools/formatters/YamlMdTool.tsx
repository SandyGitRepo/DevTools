import { useMemo, useState } from 'react';
import { CheckCircle2, Play } from 'lucide-react';
import { loadAll } from 'js-yaml';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import Loader from '../../components/ui/Loader';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { Segmented } from '../../components/ui/controls';
import { prettierFormat } from '../../lib/formatters/prettier';
import { renderMarkdown } from '../../lib/formatters/markdown';

type Lang = 'yaml' | 'markdown' | 'graphql';

const SAMPLES: Record<Lang, string> = {
  yaml: `apiVersion: apps/v1
kind: Deployment
metadata:
    name: devtoolkit
    labels: {app: devtoolkit,  tier: web}
spec:
  replicas: 2
  template:
    spec:
      containers:
      - name: web
        image: registry.internal/devtoolkit:1.0.0
        ports:
          - containerPort: 8080
        resources: {limits: {cpu: "500m", memory: 512Mi}}`,
  markdown: `# Release notes
DevToolkit **1.0** is live.
* JSON, SQL and Java formatters
* JWT decoder with IST expiry
1. Open the portal
2. Press \`Ctrl+K\`
| Tool | Runs in |
|---|---|
| Hash | Browser |
> Nothing leaves your device.`,
  graphql: `query Customer($id:ID!){customer(id:$id){id name accounts(first:5){edges{node{number balance{amount currency}}}}}}`,
};

export default function YamlMdTool() {
  const [lang, setLang] = useState<Lang>('yaml');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const { error, status, run, reset, busy } = useAction();
  useHandoff(setInput);

  const preview = useMemo(() => (lang === 'markdown' ? renderMarkdown(input) : ''), [lang, input]);

  const validate = () =>
    run(
      async () => {
        if (lang === 'yaml') {
          const docs: unknown[] = [];
          loadAll(input, (d) => docs.push(d));
          return `Valid YAML (${docs.length} document${docs.length === 1 ? '' : 's'})`;
        }
        await prettierFormat(input, lang);
        return `Valid ${lang === 'graphql' ? 'GraphQL' : 'Markdown'}`;
      },
      { success: (m) => m },
    );

  return (
    <ToolShell
      onSample={() => setInput(SAMPLES[lang])}
      onClear={() => {
        setInput('');
        setOutput('');
        reset();
      }}
      help={
        <p>
          YAML is validated with js-yaml (multi-document files supported) and formatted with Prettier, which keeps comments. The Markdown preview is sanitised
          with DOMPurify, so embedded scripts and event handlers never run.
        </p>
      }
    >
      <ActionBar>
        <Segmented
          label="Language"
          value={lang}
          onChange={(l) => {
            setLang(l);
            setOutput('');
            reset();
          }}
          options={[
            { value: 'yaml', label: 'YAML' },
            { value: 'markdown', label: 'Markdown' },
            { value: 'graphql', label: 'GraphQL' },
          ]}
        />
        <button
          type="button"
          className="hud-btn hud-btn-accent"
          disabled={!input || busy}
          onClick={() => run(async () => setOutput(await prettierFormat(input, lang)), { success: 'Formatted' })}
        >
          {busy ? <Loader /> : <Play size={15} aria-hidden="true" />} Format
        </button>
        <button type="button" className="hud-btn" disabled={!input || busy} onClick={validate}>
          <CheckCircle2 size={15} aria-hidden="true" /> Validate
        </button>
        <div className="ml-auto self-center">
          <StatusLine status={status} />
        </div>
      </ActionBar>
      <TwoPane>
        <EditorPane
          title="Input"
          value={input}
          onChange={setInput}
          language={lang}
          acceptFile=".yaml,.yml,.md,.markdown,.graphql,.gql,.txt"
          error={error}
          detectFrom="yaml-md"
        />
        {lang === 'markdown' && !output ? (
          <section className="hud-panel h-[60vh] min-h-[320px] overflow-auto p-5" aria-label="Markdown preview">
            <h2 className="mb-3 font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Live preview</h2>
            {/* Sanitised by DOMPurify in renderMarkdown (A03) */}
            <div className="md-preview" dangerouslySetInnerHTML={{ __html: preview }} />
          </section>
        ) : (
          <EditorPane
            title="Output"
            value={output}
            readOnly
            language={lang}
            downloadName={`output.${lang === 'markdown' ? 'md' : lang === 'yaml' ? 'yaml' : 'graphql'}`}
          />
        )}
      </TwoPane>
    </ToolShell>
  );
}
