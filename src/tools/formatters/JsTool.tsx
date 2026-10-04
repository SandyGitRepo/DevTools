import { useState } from 'react';
import { Minimize2, Play } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import Loader from '../../components/ui/Loader';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { Checkbox, Segmented, Select } from '../../components/ui/controls';
import { prettierFormat } from '../../lib/formatters/prettier';
import { minifyJs } from '../../lib/formatters/minify';

const SAMPLE = `import {format} from 'date-fns'
export async function fetchStatement(accountId:string,opts:{from:Date,to:Date}={from:new Date(),to:new Date()}){
const res=await fetch(\`/api/accounts/\${accountId}/statement?from=\${format(opts.from,'yyyy-MM-dd')}\`,{headers:{"Accept":"application/json"}})
if(!res.ok){throw new Error("Statement failed: "+res.status)}
return (await res.json()).items.filter((i:any)=>i.amount!==0).map((i:any)=>({...i,amount:Number(i.amount)}))}`;

export default function JsTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [lang, setLang] = useState<'typescript' | 'babel'>('typescript');
  const [indent, setIndent] = useState('2');
  const [quotes, setQuotes] = useState<'single' | 'double'>('single');
  const [semi, setSemi] = useState(true);
  const [mangle, setMangle] = useState(true);
  const { error, status, run, reset, busy } = useAction();
  useHandoff(setInput);

  const format = () =>
    run(async () => setOutput(await prettierFormat(input, lang, { tabWidth: +indent, singleQuote: quotes === 'single', semi, printWidth: 100 })), {
      success: 'Formatted',
    });

  const minify = () =>
    run(
      async () => {
        // Terser only understands JavaScript; TypeScript input will report a syntax error.
        const out = await minifyJs(input, { mangle, module: /^\s*(import|export)\s/m.test(input) });
        setOutput(out);
        return out;
      },
      { success: (out) => `Minified: ${input.length.toLocaleString()} → ${out.length.toLocaleString()} chars` },
    );

  return (
    <ToolShell
      onSample={() => setInput(SAMPLE)}
      onClear={() => {
        setInput('');
        setOutput('');
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Format</b> uses Prettier. Choose TypeScript for .ts/.tsx (it also accepts plain JS) or JavaScript for JSX/Flow.
          </li>
          <li>
            <b>Minify</b> uses Terser and accepts JavaScript only (remove TypeScript types first). ES modules are detected automatically.
          </li>
        </ul>
      }
    >
      <ActionBar>
        <Segmented
          label="Language"
          value={lang}
          onChange={setLang}
          options={[
            { value: 'typescript', label: 'TypeScript' },
            { value: 'babel', label: 'JavaScript' },
          ]}
        />
        <Select
          label="Indent"
          value={indent}
          onChange={setIndent}
          options={[
            { value: '2', label: '2 spaces' },
            { value: '4', label: '4 spaces' },
          ]}
        />
        <Select
          label="Quotes"
          value={quotes}
          onChange={setQuotes}
          options={[
            { value: 'single', label: "'single'" },
            { value: 'double', label: '"double"' },
          ]}
        />
        <div className="flex flex-col gap-1.5 pb-1">
          <Checkbox label="Semicolons" checked={semi} onChange={setSemi} />
          <Checkbox label="Mangle names (minify)" checked={mangle} onChange={setMangle} />
        </div>
        <button type="button" className="hud-btn hud-btn-accent" disabled={!input || busy} onClick={format}>
          {busy ? <Loader /> : <Play size={15} aria-hidden="true" />} Format
        </button>
        <button type="button" className="hud-btn" disabled={!input || busy} onClick={minify}>
          <Minimize2 size={15} aria-hidden="true" /> Minify
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
          language={lang === 'typescript' ? 'typescript' : 'javascript'}
          acceptFile=".js,.mjs,.cjs,.ts,.tsx,.jsx"
          error={error}
        />
        <EditorPane
          title="Output"
          value={output}
          readOnly
          language={lang === 'typescript' ? 'typescript' : 'javascript'}
          downloadName={lang === 'typescript' ? 'output.ts' : 'output.js'}
        />
      </TwoPane>
    </ToolShell>
  );
}
