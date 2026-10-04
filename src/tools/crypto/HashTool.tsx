import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Copy, X } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import FileDrop from '../../components/tool/FileDrop';
import ErrorBox from '../../components/tool/ErrorBox';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { Segmented, TextInput } from '../../components/ui/controls';
import { hashAlgorithms, hashBytes, hashFile, normaliseExpected, type HashAlgorithm } from '../../lib/crypto/hash';
import { toBase64, toHex, utf8Encode } from '../../lib/bytes';
import { copyText, formatBytes } from '../../lib/files';

const ALL = hashAlgorithms.map((a) => a.id) as HashAlgorithm[];

export default function HashTool() {
  const [mode, setMode] = useState<'text' | 'file'>('text');
  const [text, setText] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [encoding, setEncoding] = useState<'hex' | 'HEX' | 'base64'>('hex');
  const [expected, setExpected] = useState('');
  const [results, setResults] = useState<Record<string, Uint8Array> | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [copied, setCopied] = useState('');
  const { error, run, reset } = useAction();
  useHandoff(setText);

  // Text hashes update live (debounced)
  useEffect(() => {
    if (mode !== 'text') return;
    if (!text) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => void run(async () => setResults(await hashBytes(utf8Encode(text), ALL))), 200);
    return () => clearTimeout(t);
  }, [text, mode, run]);

  const onFile = (f: File) => {
    setFile(f);
    setResults(null);
    setProgress(0);
    void run(async () => setResults(await hashFile(f, ALL, setProgress))).finally(() => setProgress(null));
  };

  const fmt = (b: Uint8Array) => (encoding === 'base64' ? toBase64(b) : encoding === 'HEX' ? toHex(b).toUpperCase() : toHex(b));
  const exp = normaliseExpected(expected);
  const matchOf = (b: Uint8Array) => !!exp && (toHex(b) === exp || toBase64(b).toLowerCase() === exp || toBase64(b, false, false).toLowerCase() === exp);
  const anyMatch = results && exp ? Object.values(results).some(matchOf) : false;

  return (
    <ToolShell
      onSample={() => {
        setMode('text');
        setText('abc');
        setExpected('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
      }}
      onClear={() => {
        setText('');
        setFile(null);
        setExpected('');
        setResults(null);
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            All algorithms are computed at once. Text is hashed as UTF-8. Files are streamed in 4 MB chunks, so multi-GB files work without loading into memory.
          </li>
          <li>Paste an expected checksum (hex or Base64, any case, with or without colons) to verify a download — the matching row lights up.</li>
          <li>
            MD5, SHA-1 and CRC32 are <b>not secure</b> against tampering; use them only to compare with legacy systems.
          </li>
        </ul>
      }
    >
      <ActionBar>
        <Segmented
          label="Input"
          value={mode}
          onChange={(m) => (setMode(m), setResults(null))}
          options={[
            { value: 'text', label: 'Text' },
            { value: 'file', label: 'File' },
          ]}
        />
        <Segmented
          label="Output"
          value={encoding}
          onChange={setEncoding}
          options={[
            { value: 'hex', label: 'hex' },
            { value: 'HEX', label: 'HEX' },
            { value: 'base64', label: 'Base64' },
          ]}
        />
        <TextInput
          label="Compare with expected hash"
          value={expected}
          onChange={setExpected}
          mono
          placeholder="Paste a checksum to verify"
          className="min-w-[18rem] flex-1"
        />
        {exp && results && (
          <span className={`flex items-center gap-1 self-center text-sm ${anyMatch ? 'text-success' : 'text-danger'}`} role="status">
            {anyMatch ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />} {anyMatch ? 'Match' : 'No algorithm matches'}
          </span>
        )}
      </ActionBar>
      <TwoPane>
        {mode === 'text' ? (
          <EditorPane title="Text" value={text} onChange={setText} acceptFile=".txt,.json,.xml,.csv" className="h-[50vh] min-h-[280px]" />
        ) : (
          <section className="hud-panel flex flex-col gap-3 p-4">
            <h2 className="font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">File</h2>
            <FileDrop onFile={onFile} file={file} label="Drop any file to hash it (it is read locally, never uploaded)" />
            {progress !== null && (
              <div
                className="h-1.5 overflow-hidden rounded bg-primary/20"
                role="progressbar"
                aria-valuenow={Math.round(progress * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <div className="h-full bg-cyan transition-[width]" style={{ width: `${progress * 100}%` }} />
              </div>
            )}
            {file && <p className="text-xs text-muted">{formatBytes(file.size)}</p>}
          </section>
        )}
        <section className="hud-panel overflow-auto p-4" aria-label="Hashes">
          <h2 className="mb-2 font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Digests</h2>
          <table className="hud-table">
            <tbody>
              {hashAlgorithms.map((a) => {
                const v = results?.[a.id];
                const match = v ? matchOf(v) : false;
                return (
                  <tr key={a.id} className={match ? 'bg-success/15' : ''}>
                    <th scope="row" className="w-32 whitespace-nowrap align-middle normal-case tracking-normal">
                      <span className="text-fg">{a.label}</span>
                      {'legacy' in a && a.legacy && (
                        <span className="mt-0.5 flex items-center gap-1 text-[10px] text-warn" title={'note' in a ? a.note : 'Legacy, not secure'}>
                          <AlertTriangle size={10} aria-hidden="true" /> {'note' in a ? 'checksum only' : 'legacy, not secure'}
                        </span>
                      )}
                    </th>
                    <td className="break-all font-mono text-xs">{v ? fmt(v) : <span className="text-muted">—</span>}</td>
                    <td className="w-10 align-middle">
                      {v && (
                        <button
                          type="button"
                          className="rounded p-1 text-muted hover:text-cyan"
                          aria-label={`Copy ${a.label}`}
                          onClick={async () => {
                            await copyText(fmt(v));
                            setCopied(a.id);
                            setTimeout(() => setCopied(''), 1000);
                          }}
                        >
                          {copied === a.id ? <Check size={14} className="text-success" /> : <Copy size={14} />}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      </TwoPane>
      {error && <ErrorBox error={error} className="rounded border" />}
    </ToolShell>
  );
}
