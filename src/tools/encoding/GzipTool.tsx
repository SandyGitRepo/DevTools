import { useState } from 'react';
import { ArrowDown, ArrowUp, Download } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import FileDrop from '../../components/tool/FileDrop';
import ErrorBox from '../../components/tool/ErrorBox';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { Segmented, Select } from '../../components/ui/controls';
import { compress, decompress, type CompressionFormat } from '../../lib/encoding/gzip';
import { fromBase64, isLikelyText, toBase64, utf8Decode, utf8Encode } from '../../lib/bytes';
import { downloadBlob, formatBytes, readFileAsBytes } from '../../lib/files';

export default function GzipTool() {
  const [format, setFormat] = useState<CompressionFormat | 'auto'>('gzip');
  const [level, setLevel] = useState('6');
  const [plain, setPlain] = useState('');
  const [packed, setPacked] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [binaryOut, setBinaryOut] = useState<Uint8Array | null>(null);
  const { error, status, run, reset, setStatus } = useAction();
  useHandoff(setPacked);

  const fmt = (format === 'auto' ? 'gzip' : format) as CompressionFormat;

  const doCompress = () =>
    run(() => {
      const input = utf8Encode(plain);
      const out = compress(input, fmt, +level as 6);
      setPacked(toBase64(out));
      setStatus({
        kind: 'success',
        text: `${formatBytes(input.length)} → ${formatBytes(out.length)} (${Math.round((out.length / Math.max(1, input.length)) * 100)}%)`,
      });
    });

  const showDecompressed = (bytes: Uint8Array, inLen: number) => {
    if (isLikelyText(bytes)) {
      setPlain(utf8Decode(bytes));
      setBinaryOut(null);
    } else {
      setPlain('');
      setBinaryOut(bytes);
    }
    setStatus({ kind: 'success', text: `${formatBytes(inLen)} → ${formatBytes(bytes.length)}${isLikelyText(bytes) ? '' : ' (binary — download below)'}` });
  };

  const doDecompress = () =>
    run(() => {
      const input = fromBase64(packed);
      showDecompressed(decompress(input, format), input.length);
    });

  const onFile = (f: File) => {
    setFile(f);
    run(async () => {
      const bytes = await readFileAsBytes(f, 100 * 1024 * 1024);
      showDecompressed(decompress(bytes, 'auto'), bytes.length);
    });
  };

  return (
    <ToolShell
      onSample={() =>
        setPlain(JSON.stringify({ event: 'statement.generated', items: Array.from({ length: 20 }, (_, i) => ({ id: i, amount: 1000 + i, currency: 'INR' })) }))
      }
      onClear={() => {
        setPlain('');
        setPacked('');
        setFile(null);
        setBinaryOut(null);
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Gzip</b> (RFC 1952) is what HTTP and <code>.gz</code> files use; <b>Zlib</b> (RFC 1950) is common in APIs and PDFs; <b>Raw deflate</b> has no
            header.
          </li>
          <li>
            Compressed data is shown as Base64. You can also drop a <code>.gz</code> file to decompress it.
          </li>
          <li>Decompression is capped (10× the input, at least 10 MB, never over 200 MB) to stop decompression bombs.</li>
        </ul>
      }
    >
      <ActionBar>
        <Segmented
          label="Format"
          value={format}
          onChange={setFormat}
          options={[
            { value: 'gzip', label: 'Gzip' },
            { value: 'zlib', label: 'Zlib' },
            { value: 'deflate', label: 'Raw deflate' },
            { value: 'auto', label: 'Auto-detect' },
          ]}
        />
        <Select label="Level" value={level} onChange={setLevel} options={['1', '3', '6', '9']} />
        <button type="button" className="hud-btn hud-btn-accent" disabled={!plain} onClick={doCompress}>
          <ArrowDown size={15} aria-hidden="true" /> Compress
        </button>
        <button type="button" className="hud-btn" disabled={!packed} onClick={doDecompress}>
          <ArrowUp size={15} aria-hidden="true" /> Decompress
        </button>
        <div className="ml-auto self-center">
          <StatusLine status={status} />
        </div>
      </ActionBar>
      <TwoPane>
        <EditorPane title="Plain text" value={plain} onChange={setPlain} acceptFile=".txt,.json,.xml,.csv,.log" />
        <EditorPane title="Compressed (Base64)" value={packed} onChange={setPacked} downloadName="compressed.b64.txt" detectFrom="gzip" />
      </TwoPane>
      {error && <ErrorBox error={error} className="rounded border" />}
      <div className="grid gap-4 lg:grid-cols-2">
        <FileDrop onFile={onFile} file={file} accept=".gz,.gzip,.zz,.z,application/gzip" label="Or drop a .gz file to decompress it" />
        {binaryOut && (
          <div className="hud-panel flex items-center gap-3 p-4 text-sm">
            Binary output · {formatBytes(binaryOut.length)}
            <button
              type="button"
              className="hud-btn hud-btn-accent"
              onClick={() =>
                downloadBlob(new Blob([binaryOut as BlobPart]), file ? file.name.replace(/\.(gz|gzip|zz|z)$/i, '') || 'decompressed.bin' : 'decompressed.bin')
              }
            >
              <Download size={15} aria-hidden="true" /> Download
            </button>
          </div>
        )}
      </div>
    </ToolShell>
  );
}
