import { useEffect, useState } from 'react';
import { ArrowDown, ArrowUp, Download } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import FileDrop from '../../components/tool/FileDrop';
import ErrorBox from '../../components/tool/ErrorBox';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { Checkbox, Segmented } from '../../components/ui/controls';
import { fromBase64, isLikelyText, sniffMime, toBase64, utf8Decode, utf8Encode } from '../../lib/bytes';
import { downloadBlob, formatBytes, readFileAsBytes } from '../../lib/files';

const MAX_FILE = 50 * 1024 * 1024;
const PREVIEWABLE = new Set(['image/png', 'image/jpeg', 'image/gif', 'image/webp']);

export default function Base64Tool() {
  const [mode, setMode] = useState<'text' | 'file'>('text');
  const [text, setText] = useState('');
  const [b64, setB64] = useState('');
  const [urlSafe, setUrlSafe] = useState(false);
  const [noPad, setNoPad] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [decoded, setDecoded] = useState<{ bytes: Uint8Array; mime: string; ext: string } | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const { error, status, run, reset, setStatus } = useAction();
  useHandoff((t) => setB64(t));

  // Object URL for image preview; revoked on change (no data lingers)
  useEffect(() => {
    if (decoded && PREVIEWABLE.has(decoded.mime)) {
      const url = URL.createObjectURL(new Blob([decoded.bytes as BlobPart], { type: decoded.mime }));
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    }
    setPreviewUrl(null);
  }, [decoded]);

  const encode = () => run(() => setB64(toBase64(utf8Encode(text), urlSafe, !noPad)), { success: 'Encoded' });

  const decode = () =>
    run(() => {
      const bytes = fromBase64(b64);
      const sniff = sniffMime(bytes);
      if (isLikelyText(bytes)) {
        setText(utf8Decode(bytes));
        setDecoded(null);
        setStatus({ kind: 'success', text: `Decoded ${formatBytes(bytes.length)} of text` });
      } else {
        setText('');
        setDecoded({ bytes, ...sniff });
        setStatus({ kind: 'info', text: `Binary data: ${sniff.mime}, ${formatBytes(bytes.length)} — download it below` });
      }
    });

  const encodeFile = (f: File) => {
    setFile(f);
    run(
      async () => {
        const bytes = await readFileAsBytes(f, MAX_FILE);
        setB64(toBase64(bytes, urlSafe, !noPad));
      },
      { success: `Encoded ${f.name}` },
    );
  };

  return (
    <ToolShell
      onSample={() => {
        setMode('text');
        setText('Hello from DevToolkit — नमस्ते 👋');
        setB64('');
      }}
      onClear={() => {
        setText('');
        setB64('');
        setFile(null);
        setDecoded(null);
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>Text is encoded as UTF-8 first, so any language and emoji round-trip correctly.</li>
          <li>
            Decoding accepts standard and URL-safe alphabets, missing padding, line breaks and <code>data:</code> URI prefixes.
          </li>
          <li>If decoded data is binary (an image, PDF, ZIP…), the type is detected and you can preview images or download the file.</li>
        </ul>
      }
    >
      <ActionBar>
        <Segmented
          label="Source"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'text', label: 'Text' },
            { value: 'file', label: 'File' },
          ]}
        />
        <div className="flex flex-col gap-1.5 pb-1">
          <Checkbox label="URL-safe alphabet (- _)" checked={urlSafe} onChange={setUrlSafe} />
          <Checkbox label="Omit padding (=)" checked={noPad} onChange={setNoPad} />
        </div>
        {mode === 'text' && (
          <button type="button" className="hud-btn hud-btn-accent" onClick={encode} disabled={!text}>
            <ArrowDown size={15} aria-hidden="true" /> Encode
          </button>
        )}
        <button type="button" className="hud-btn" onClick={decode} disabled={!b64}>
          <ArrowUp size={15} aria-hidden="true" /> Decode
        </button>
        <div className="ml-auto self-center">
          <StatusLine status={status} />
        </div>
      </ActionBar>
      <TwoPane>
        {mode === 'text' ? (
          <EditorPane title="Text" value={text} onChange={setText} acceptFile=".txt,.json,.xml,.csv" />
        ) : (
          <section className="hud-panel flex flex-col gap-3 p-4">
            <h2 className="font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">File → Base64</h2>
            <FileDrop onFile={encodeFile} file={file} label={`Drop any file (max ${formatBytes(MAX_FILE)}) to encode it`} />
          </section>
        )}
        <EditorPane title="Base64" value={b64} onChange={setB64} acceptFile=".txt,.b64" downloadName="encoded.b64.txt" detectFrom="base64" />
      </TwoPane>
      {error && <ErrorBox error={error} className="rounded border" />}
      {decoded && (
        <section className="hud-panel flex flex-wrap items-center gap-4 p-4">
          {previewUrl && <img src={previewUrl} alt="Decoded preview" className="max-h-64 max-w-full rounded border border-primary/40 bg-white/5" />}
          <div className="space-y-2 text-sm">
            <p>
              Detected <span className="font-mono text-cyan">{decoded.mime}</span> · {formatBytes(decoded.bytes.length)}
            </p>
            <button
              type="button"
              className="hud-btn hud-btn-accent"
              onClick={() => downloadBlob(new Blob([decoded.bytes as BlobPart], { type: decoded.mime }), `decoded.${decoded.ext}`)}
            >
              <Download size={15} aria-hidden="true" /> Download file
            </button>
          </div>
        </section>
      )}
    </ToolShell>
  );
}
