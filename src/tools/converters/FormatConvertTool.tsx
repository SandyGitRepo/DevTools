import { useState } from 'react';
import { ArrowRight, ArrowLeftRight } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { Segmented, Select, TextInput } from '../../components/ui/controls';
import { convertData, type DataFormat } from '../../lib/convert/formats';

const SAMPLES: Record<DataFormat, string> = {
  json: `{"service":{"name":"loan-origination","version":"2.4.1","ports":[8080,8443],"tls":true,"database":{"host":"db.internal","pool":20},"owners":["platform-team","credit-tech"]}}`,
  yaml: `service:
  name: loan-origination
  version: 2.4.1
  ports: [8080, 8443]
  tls: true
  database:
    host: db.internal
    pool: 20`,
  xml: `<?xml version="1.0" encoding="UTF-8"?>
<service name="loan-origination" version="2.4.1">
  <port>8080</port>
  <port>8443</port>
  <tls>true</tls>
  <database host="db.internal" pool="20"/>
</service>`,
};

const FORMATS: { value: DataFormat; label: string }[] = [
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
  { value: 'xml', label: 'XML' },
];

export default function FormatConvertTool() {
  const [from, setFrom] = useState<DataFormat>('json');
  const [to, setTo] = useState<DataFormat>('yaml');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [indent, setIndent] = useState('2');
  const [root, setRoot] = useState('root');
  const { error, status, run, reset } = useAction();
  useHandoff(setInput);

  const convert = () =>
    run(() => setOutput(convertData(input, from, to, Number(indent), root)), {
      source: input,
      success: `Converted ${from.toUpperCase()} → ${to.toUpperCase()}`,
    });

  const swap = () => {
    setFrom(to);
    setTo(from);
    setInput(output);
    setOutput('');
    reset();
  };

  return (
    <ToolShell
      onSample={() => {
        setInput(SAMPLES[from]);
        setOutput('');
      }}
      onClear={() => {
        setInput('');
        setOutput('');
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            XML attributes map to keys prefixed with <code>@_</code> (e.g. <code>@_id</code>) so they survive a round trip; repeated elements become arrays.
          </li>
          <li>When converting to XML, data with several top-level keys is wrapped in a root element (name it below).</li>
          <li>
            For safety, XML containing <code>&lt;!ENTITY&gt;</code> declarations is refused, and YAML is loaded with the safe schema (no custom types).
          </li>
        </ul>
      }
    >
      <ActionBar>
        <Segmented label="From" value={from} onChange={(f) => (setFrom(f), f === to && setTo(f === 'json' ? 'yaml' : 'json'))} options={FORMATS} />
        <button type="button" className="hud-btn hud-btn-ghost mb-0.5 px-2" onClick={swap} aria-label="Swap direction" title="Swap direction">
          <ArrowLeftRight size={16} />
        </button>
        <Segmented label="To" value={to} onChange={setTo} options={FORMATS.filter((f) => f.value !== from)} />
        <Select label="Indent" value={indent} onChange={setIndent} options={['2', '4']} />
        {to === 'xml' && <TextInput label="Root element" value={root} onChange={setRoot} className="w-36" />}
        <button type="button" className="hud-btn hud-btn-accent" onClick={convert} disabled={!input}>
          Convert <ArrowRight size={15} aria-hidden="true" />
        </button>
        <div className="ml-auto self-center">
          <StatusLine status={status} />
        </div>
      </ActionBar>
      <TwoPane>
        <EditorPane title={from.toUpperCase()} value={input} onChange={setInput} language={from} acceptFile=".json,.yaml,.yml,.xml,.txt" error={error} />
        <EditorPane title={to.toUpperCase()} value={output} readOnly language={to} downloadName={`converted.${to === 'yaml' ? 'yaml' : to}`} />
      </TwoPane>
    </ToolShell>
  );
}
