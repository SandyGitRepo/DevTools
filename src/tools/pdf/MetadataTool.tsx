import { useEffect, useState } from 'react';
import { AlertTriangle, Eraser, Save } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import ErrorBox from '../../components/tool/ErrorBox';
import Loader from '../../components/ui/Loader';
import PdfPicker from '../../components/pdf/PdfPicker';
import PdfResult, { type OutputFile } from '../../components/pdf/PdfResult';
import { usePdfFile } from '../../components/pdf/usePdfFile';
import { useAction } from '../../components/tool/useAction';
import { KV } from '../../components/tool/layout';
import { TextInput } from '../../components/ui/controls';
import { pdfOps, sampleFile } from '../../lib/pdf/client';
import type { PdfMeta } from '../../lib/pdf/ops';

const FIELDS = ['title', 'author', 'subject', 'keywords', 'creator'] as const;
type Field = (typeof FIELDS)[number];

export default function MetadataTool() {
  const state = usePdfFile();
  const { pdf } = state;
  const [meta, setMeta] = useState<PdfMeta | null>(null);
  const [form, setForm] = useState<Record<Field, string>>({ title: '', author: '', subject: '', keywords: '', creator: '' });
  const [result, setResult] = useState<OutputFile[] | null>(null);
  const read = useAction();
  const write = useAction();
  const { run: readRun, reset: readReset } = read;

  useEffect(() => {
    setMeta(null);
    setResult(null);
    readReset();
    if (!pdf) return;
    void readRun(async () => {
      const m = await pdfOps.readMeta(pdf.bytes);
      setMeta(m);
      setForm({ title: m.title ?? '', author: m.author ?? '', subject: m.subject ?? '', keywords: m.keywords ?? '', creator: m.creator ?? '' });
    });
  }, [pdf, readRun, readReset]);

  const base = pdf?.file.name.replace(/\.pdf$/i, '') ?? 'document';
  const save = (strip: boolean) =>
    write.run(async () => {
      const bytes = await pdfOps.writeMeta(pdf!.bytes, strip ? {} : form, strip);
      setResult([{ name: `${base}_${strip ? 'clean' : 'edited'}.pdf`, bytes }]);
    });

  const fmtDate = (d?: string) => (d ? new Date(d).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) + ' IST' : '—');

  return (
    <ToolShell
      onSample={async () => await state.load(await sampleFile(2))}
      onClear={() => {
        state.clear();
        write.reset();
      }}
      help={
        <p>
          Shows the document information (title, author, producer, dates) that travels with a PDF and can reveal internal names or software. Edit the fields, or{' '}
          <b>Strip all metadata</b> to remove the info dictionary and XMP packet before sharing a file externally. Scripts and attachments are always removed.
        </p>
      }
    >
      <PdfPicker state={state} />
      {read.busy && (
        <p className="flex items-center gap-2 text-sm text-muted">
          <Loader /> Reading metadata…
        </p>
      )}
      {read.error && <ErrorBox error={read.error} className="rounded border" />}
      {pdf && meta && (
        <div className="grid gap-4 lg:grid-cols-2">
          <section className="hud-panel space-y-3 p-4">
            <h2 className="font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Edit</h2>
            {FIELDS.map((f) => (
              <TextInput
                key={f}
                label={f[0].toUpperCase() + f.slice(1)}
                value={form[f]}
                onChange={(v) => setForm({ ...form, [f]: v })}
                hint={f === 'keywords' ? 'Comma-separated' : undefined}
              />
            ))}
            <div className="flex flex-wrap gap-2 pt-1">
              <button type="button" className="hud-btn hud-btn-accent" onClick={() => save(false)} disabled={write.busy}>
                {write.busy ? <Loader /> : <Save size={15} aria-hidden="true" />} Save changes
              </button>
              <button type="button" className="hud-btn" onClick={() => save(true)} disabled={write.busy}>
                <Eraser size={15} aria-hidden="true" /> Strip all metadata
              </button>
            </div>
          </section>
          <section className="hud-panel space-y-3 p-4">
            <h2 className="font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Current values</h2>
            <KV
              rows={[
                ['Title', meta.title || '—'],
                ['Author', meta.author || '—'],
                ['Subject', meta.subject || '—'],
                ['Keywords', meta.keywords || '—'],
                ['Creator (application)', meta.creator || '—'],
                ['Producer (library)', meta.producer || '—'],
                ['Created', fmtDate(meta.creationDate)],
                ['Modified', fmtDate(meta.modificationDate)],
                ['Pages', String(meta.pageCount)],
                ['XMP metadata packet', meta.hasXmp ? 'present' : 'none'],
              ]}
            />
            {meta.risky.length > 0 && (
              <p className="flex items-start gap-2 rounded border border-warn/40 bg-warn/10 p-2 text-sm text-warn">
                <AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
                This file contains active content ({meta.risky.join(', ')}). It is removed from anything you save here.
              </p>
            )}
          </section>
        </div>
      )}
      {write.error && <ErrorBox error={write.error} className="rounded border" />}
      {result && <PdfResult files={result} />}
    </ToolShell>
  );
}
