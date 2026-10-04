import { useState } from 'react';
import { Code2 } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import Loader from '../../components/ui/Loader';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { Checkbox, Segmented, TextInput } from '../../components/ui/controls';
import { generateCode, type CodeLang } from '../../lib/convert/codegen';

const SAMPLE = `{
  "customerId": 10293,
  "name": "Asha Verma",
  "email": "asha.verma@example.test",
  "kycVerified": true,
  "createdAt": "2026-09-14T10:15:00+05:30",
  "address": { "line1": "12 MG Road", "city": "Pune", "pin": "411001" },
  "loans": [
    { "id": "LN-0001", "amount": 500000.0, "tenureMonths": 60, "status": "ACTIVE" },
    { "id": "LN-0002", "amount": 125000.5, "tenureMonths": 24, "status": "CLOSED", "closedOn": "2026-08-01" }
  ]
}`;

const EXT: Record<CodeLang, string> = { typescript: 'ts', java: 'java', csharp: 'cs' };

export default function CodegenTool() {
  const [json, setJson] = useState('');
  const [code, setCode] = useState('');
  const [lang, setLang] = useState<CodeLang>('typescript');
  const [name, setName] = useState('Customer');
  const [ns, setNs] = useState('');
  const [lombok, setLombok] = useState(false);
  const [justTypes, setJustTypes] = useState(true);
  const { error, status, run, reset, busy } = useAction();
  useHandoff(setJson);

  const go = () =>
    run(async () => setCode(await generateCode(json, { lang, topLevel: name, namespace: ns, lombok, justTypes })), {
      source: json,
      success: 'Generated',
    });

  return (
    <ToolShell
      onSample={() => setJson(SAMPLE)}
      onClear={() => {
        setJson('');
        setCode('');
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>Paste one representative JSON sample. Nested objects become their own classes; arrays of objects are merged so optional fields are detected.</li>
          <li>Dates and UUIDs in strings are detected and typed where the language supports it.</li>
          <li>“Types only” leaves out JSON (de)serialisation helpers; turn it off to get converter code too.</li>
        </ul>
      }
    >
      <ActionBar>
        <Segmented
          label="Language"
          value={lang}
          onChange={(l) => (setLang(l), setCode(''))}
          options={[
            { value: 'typescript', label: 'TypeScript' },
            { value: 'java', label: 'Java' },
            { value: 'csharp', label: 'C#' },
          ]}
        />
        <TextInput label="Top-level class" value={name} onChange={setName} className="w-44" />
        {lang !== 'typescript' && (
          <TextInput
            label={lang === 'java' ? 'Package' : 'Namespace'}
            value={ns}
            onChange={setNs}
            placeholder={lang === 'java' ? 'com.example.model' : 'Example.Models'}
            className="w-56"
          />
        )}
        <div className="flex flex-col gap-1.5 pb-1">
          <Checkbox label="Types only" checked={justTypes} onChange={setJustTypes} />
          {lang === 'java' && <Checkbox label="Use Lombok" checked={lombok} onChange={setLombok} />}
        </div>
        <button type="button" className="hud-btn hud-btn-accent" onClick={go} disabled={!json || busy}>
          {busy ? <Loader /> : <Code2 size={15} aria-hidden="true" />} Generate
        </button>
        <div className="ml-auto self-center">
          <StatusLine status={status} />
        </div>
      </ActionBar>
      <TwoPane>
        <EditorPane title="Sample JSON" value={json} onChange={setJson} language="json" acceptFile=".json" error={error} />
        <EditorPane
          title={lang === 'csharp' ? 'C#' : lang === 'java' ? 'Java' : 'TypeScript'}
          value={code}
          readOnly
          language={lang}
          downloadName={`${name}.${EXT[lang]}`}
        />
      </TwoPane>
    </ToolShell>
  );
}
