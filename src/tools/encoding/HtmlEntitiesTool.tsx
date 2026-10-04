import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import * as he from 'he';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { Checkbox, Segmented } from '../../components/ui/controls';

export default function HtmlEntitiesTool() {
  const [plain, setPlain] = useState('');
  const [encoded, setEncoded] = useState('');
  const [style, setStyle] = useState<'named' | 'decimal' | 'hex'>('named');
  const [onlyUnsafe, setOnlyUnsafe] = useState(true);
  const { status, run, reset, error } = useAction();
  useHandoff(setEncoded);

  const encode = () =>
    run(
      () => {
        let out: string;
        if (onlyUnsafe) {
          out = he.escape(plain);
          if (style !== 'named')
            out = out.replace(/&(amp|lt|gt|quot|#x27|#x60);/g, (m) => he.encode(he.decode(m), { useNamedReferences: false, decimal: style === 'decimal' }));
        } else {
          out = he.encode(plain, { useNamedReferences: style === 'named', decimal: style === 'decimal', encodeEverything: false, allowUnsafeSymbols: false });
        }
        setEncoded(out);
      },
      { success: 'Encoded' },
    );

  return (
    <ToolShell
      onSample={() => setPlain(`<a href="/search?q=loan&type=home">Rates — ₹ 8.5% © "Internal" 'Only'</a>`)}
      onClear={() => {
        setPlain('');
        setEncoded('');
        reset();
      }}
      help={
        <p>
          <b>Only unsafe characters</b> escapes just <code>&amp; &lt; &gt; " ' `</code> — enough to make text safe inside HTML. Turn it off to also encode every
          non-ASCII character (₹, ©, accented letters). Decoding understands all 2,000+ named entities plus decimal and hex forms.
        </p>
      }
    >
      <ActionBar>
        <Segmented
          label="Entity style"
          value={style}
          onChange={setStyle}
          options={[
            { value: 'named', label: '&amp; named' },
            { value: 'decimal', label: '&#38; decimal' },
            { value: 'hex', label: '&#x26; hex' },
          ]}
        />
        <div className="pb-2">
          <Checkbox label="Only unsafe characters" checked={onlyUnsafe} onChange={setOnlyUnsafe} />
        </div>
        <button type="button" className="hud-btn hud-btn-accent" disabled={!plain} onClick={encode}>
          <ArrowDown size={15} aria-hidden="true" /> Encode
        </button>
        <button type="button" className="hud-btn" disabled={!encoded} onClick={() => run(() => setPlain(he.decode(encoded)), { success: 'Decoded' })}>
          <ArrowUp size={15} aria-hidden="true" /> Decode
        </button>
        <div className="ml-auto self-center">
          <StatusLine status={status} />
        </div>
      </ActionBar>
      <TwoPane>
        <EditorPane title="Text" value={plain} onChange={setPlain} acceptFile=".txt,.html" />
        <EditorPane title="HTML-encoded" value={encoded} onChange={setEncoded} acceptFile=".txt,.html" error={error} />
      </TwoPane>
    </ToolShell>
  );
}
