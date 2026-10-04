import { FileText, RefreshCw } from 'lucide-react';
import FileDrop from '../tool/FileDrop';
import Loader from '../ui/Loader';
import ErrorBox from '../tool/ErrorBox';
import { formatBytes } from '../../lib/files';
import type { usePdfFile } from './usePdfFile';

/** File chooser for single-PDF tools: drop zone, then a compact bar with the loaded file's details. */
export default function PdfPicker({
  state,
  label = 'Drop a PDF here or click to choose (max 100 MB)',
}: {
  state: ReturnType<typeof usePdfFile>;
  label?: string;
}) {
  const { pdf, load, loading, error } = state;
  return (
    <div className="space-y-2">
      {pdf ? (
        <div className="hud-panel flex flex-wrap items-center gap-3 px-4 py-2.5 text-sm">
          <FileText size={18} className="text-cyan" aria-hidden="true" />
          <span className="font-medium text-fg">{pdf.file.name}</span>
          <span className="text-muted">
            {pdf.pageCount} page{pdf.pageCount === 1 ? '' : 's'} · {formatBytes(pdf.bytes.length)}
          </span>
          <label className="hud-btn ml-auto cursor-pointer">
            <RefreshCw size={14} aria-hidden="true" /> Change file
            <input
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={(e) => (e.target.files?.[0] && load(e.target.files[0]), (e.target.value = ''))}
            />
          </label>
        </div>
      ) : (
        <FileDrop onFile={(f) => void load(f)} accept=".pdf,application/pdf" label={label} />
      )}
      {loading && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader /> Opening PDF…
        </p>
      )}
      {error && <ErrorBox error={{ message: error }} className="rounded border" />}
    </div>
  );
}
