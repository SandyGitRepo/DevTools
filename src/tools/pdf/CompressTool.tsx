import { useState } from 'react';
import { Minimize2 } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import FileDrop from '../../components/tool/FileDrop';
import ErrorBox from '../../components/tool/ErrorBox';
import Loader from '../../components/ui/Loader';
import StatusLine from '../../components/tool/StatusLine';
import ServerGate from '../../components/pdf/ServerGate';
import PdfResult, { type OutputFile } from '../../components/pdf/PdfResult';
import { useAction } from '../../components/tool/useAction';
import { callPdfService } from '../../lib/pdf/serverApi';
import { pdfOps, sampleFile } from '../../lib/pdf/client';
import { assertPdf, MAX_PDF_BYTES } from '../../lib/pdf/ops';
import { formatBytes, readFileAsBytes } from '../../lib/files';

export default function CompressTool() {
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<OutputFile[] | null>(null);
  const { error, run, busy, reset, status, setStatus } = useAction();

  const go = () =>
    run(async () => {
      const bytes = await readFileAsBytes(file!, MAX_PDF_BYTES);
      assertPdf(bytes, file!.name);
      const r = await callPdfService('compress', await pdfOps.clean(bytes));
      setResult([{ name: `${file!.name.replace(/\.pdf$/i, '')}_compressed.pdf`, bytes: r.bytes }]);
      const pct = Math.round((1 - r.bytes.length / bytes.length) * 100);
      setStatus(
        r.noGain || pct <= 0
          ? { kind: 'info', text: `Already well compressed — ${formatBytes(bytes.length)}, no further saving` }
          : { kind: 'success', text: `${formatBytes(bytes.length)} → ${formatBytes(r.bytes.length)} (${pct}% smaller)` },
      );
    });

  return (
    <ToolShell
      onSample={async () => setFile(await sampleFile(6))}
      onClear={() => {
        setFile(null);
        setResult(null);
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Lossless structural compression (object streams, maximum Flate, unused resources removed) plus re-encoding of uncompressed images as JPEG where that
            is smaller.
          </li>
          <li>Scanned documents shrink the most; text-only PDFs are often already compact. If nothing can be saved, you get the original back.</li>
          <li>Processed in memory on the internal server and deleted immediately.</li>
        </ul>
      }
    >
      <ServerGate>
        <FileDrop
          onFile={(f) => (setFile(f), setResult(null), reset())}
          file={file}
          accept=".pdf,application/pdf"
          label="Drop a PDF here or click to choose (max 100 MB)"
        />
        {file && (
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" className="hud-btn hud-btn-accent" onClick={go} disabled={busy}>
              {busy ? <Loader /> : <Minimize2 size={15} aria-hidden="true" />} Compress
            </button>
            <StatusLine status={status} />
          </div>
        )}
        {error && <ErrorBox error={error} className="rounded border" />}
        {result && <PdfResult files={result} />}
      </ServerGate>
    </ToolShell>
  );
}
