import { useState } from 'react';
import { Minimize2, Play } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import Loader from '../../components/ui/Loader';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { Segmented, Select } from '../../components/ui/controls';
import { prettierFormat } from '../../lib/formatters/prettier';
import { minifyCss, minifyHtml } from '../../lib/formatters/minify';

type Lang = 'html' | 'css' | 'scss' | 'less';

const SAMPLES: Record<Lang, string> = {
  html: `<!doctype html><html><head><title>Statement</title><style>body{font-family:Inter;margin:0}.row{display:flex;gap:8px}</style></head><body><div class="row"><span>Account</span><b>XXXX-4821</b></div><table><tr><th>Date</th><th>Amount</th></tr><tr><td>2026-10-01</td><td>₹ 12,500.00</td></tr></table></body></html>`,
  css: `.card{background:rgba(0,114,188,.08);border:1px solid #0072BC;border-radius:6px}.card:hover{box-shadow:0 0 12px #3FB6FF}@media (max-width:768px){.card{padding:8px}}`,
  scss: `$primary:#0072BC;.panel{border:1px solid $primary;&__title{font-weight:600;&:hover{color:lighten($primary,20%)}}@include respond(md){padding:8px}}`,
  less: `@primary:#0072BC;.panel{border:1px solid @primary;.title{font-weight:600;&:hover{color:lighten(@primary,20%)}}}`,
};

export default function HtmlCssTool() {
  const [lang, setLang] = useState<Lang>('html');
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [indent, setIndent] = useState('2');
  const { error, status, run, reset, busy } = useAction();
  useHandoff((t) => {
    setInput(t);
    if (!/^\s*</.test(t)) setLang('css');
  });

  const format = () => run(async () => setOutput(await prettierFormat(input, lang, { tabWidth: +indent, printWidth: 120 })), { success: 'Formatted' });
  const minify = () =>
    run(
      () => {
        const out = lang === 'html' ? minifyHtml(input) : minifyCss(input);
        setOutput(out);
        return out;
      },
      { success: (out) => `Minified: ${input.length.toLocaleString()} → ${out.length.toLocaleString()} chars` },
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
          Formatting uses Prettier (HTML formatting also tidies embedded <code>&lt;style&gt;</code> and <code>&lt;script&gt;</code>). Minification is
          conservative: it removes comments and redundant whitespace but leaves <code>&lt;pre&gt;</code>, <code>&lt;textarea&gt;</code>, scripts and strings
          untouched. Output is shown as text only and is never rendered.
        </p>
      }
    >
      <ActionBar>
        <Segmented
          label="Language"
          value={lang}
          onChange={setLang}
          options={[
            { value: 'html', label: 'HTML' },
            { value: 'css', label: 'CSS' },
            { value: 'scss', label: 'SCSS' },
            { value: 'less', label: 'Less' },
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
          language={lang}
          acceptFile=".html,.htm,.css,.scss,.less"
          error={error}
          detectFrom="html-css"
        />
        <EditorPane title="Output" value={output} readOnly language={lang} downloadName={`output.${lang}`} />
      </TwoPane>
    </ToolShell>
  );
}
