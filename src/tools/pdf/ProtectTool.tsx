import { useState } from 'react';
import { Download, Lock, Unlock, ShieldCheck } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import FileDrop from '../../components/tool/FileDrop';
import ErrorBox from '../../components/tool/ErrorBox';
import Loader from '../../components/ui/Loader';
import ServerGate from '../../components/pdf/ServerGate';
import PdfResult, { type OutputFile } from '../../components/pdf/PdfResult';
import { useAction } from '../../components/tool/useAction';
import { ActionBar } from '../../components/tool/layout';
import { Checkbox, Segmented, TextInput } from '../../components/ui/controls';
import { callPdfService } from '../../lib/pdf/serverApi';
import { pdfOps, sampleFile } from '../../lib/pdf/client';
import { assertPdf, MAX_PDF_BYTES } from '../../lib/pdf/ops';
import { downloadBlob, formatBytes, readFileAsBytes } from '../../lib/files';

export default function ProtectTool() {
  const [mode, setMode] = useState<'protect' | 'unlock'>('protect');
  const [file, setFile] = useState<File | null>(null);
  const [pw, setPw] = useState('');
  const [pw2, setPw2] = useState('');
  const [ownerPw, setOwnerPw] = useState('');
  const [allowPrint, setAllowPrint] = useState(true);
  const [allowCopy, setAllowCopy] = useState(false);
  const [allowModify, setAllowModify] = useState(false);
  const [protectedOut, setProtectedOut] = useState<{ name: string; bytes: Uint8Array } | null>(null);
  const [unlocked, setUnlocked] = useState<OutputFile[] | null>(null);
  const { error, run, busy, reset, status } = useAction();

  const base = file?.name.replace(/\.pdf$/i, '') ?? 'document';

  const go = () =>
    run(
      async () => {
        const bytes = await readFileAsBytes(file!, MAX_PDF_BYTES);
        assertPdf(bytes, file!.name);
        if (mode === 'protect') {
          if (pw.length < 6) throw new Error('Use an open password of at least 6 characters');
          if (pw !== pw2) throw new Error('The passwords do not match');
          // SEC-3: remove scripts/attachments in the browser before the file is encrypted
          const cleaned = await pdfOps.clean(bytes);
          const r = await callPdfService('protect', cleaned, { userPassword: pw, ownerPassword: ownerPw, allowPrint, allowCopy, allowModify });
          setProtectedOut({ name: `${base}_protected.pdf`, bytes: r.bytes });
        } else {
          const r = await callPdfService('unlock', bytes, { password: pw });
          setUnlocked([{ name: `${base}_unlocked.pdf`, bytes: await pdfOps.clean(r.bytes) }]);
        }
      },
      { success: mode === 'protect' ? 'Protected with AES-256' : 'Password removed' },
    );

  return (
    <ToolShell
      onSample={async () => {
        setMode('protect');
        setFile(await sampleFile(2));
      }}
      onClear={() => {
        setFile(null);
        setPw('');
        setPw2('');
        setOwnerPw('');
        setProtectedOut(null);
        setUnlocked(null);
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Protect</b> encrypts with AES-256. The <b>open password</b> is needed to view the file. The optional <b>permissions password</b> controls
            printing, copying and editing — if left blank a random one is used, so the restrictions still apply.
          </li>
          <li>
            <b>Unlock</b> removes a password you know. It cannot recover a forgotten password.
          </li>
          <li>The file is processed in memory on the internal server and deleted immediately; passwords are never logged.</li>
        </ul>
      }
    >
      <ServerGate>
        <ActionBar>
          <Segmented
            label="Action"
            value={mode}
            onChange={(m) => (setMode(m), setProtectedOut(null), setUnlocked(null), reset())}
            options={[
              { value: 'protect', label: 'Add password' },
              { value: 'unlock', label: 'Remove password' },
            ]}
          />
        </ActionBar>
        <FileDrop
          onFile={(f) => (setFile(f), setProtectedOut(null), setUnlocked(null))}
          file={file}
          accept=".pdf,application/pdf"
          label="Drop a PDF here or click to choose (max 100 MB)"
        />
        {file && (
          <section className="hud-panel space-y-3 p-4">
            {mode === 'protect' ? (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <TextInput label="Open password" value={pw} onChange={setPw} type="password" autoComplete="new-password" />
                  <TextInput label="Confirm open password" value={pw2} onChange={setPw2} type="password" autoComplete="new-password" />
                  <TextInput label="Permissions password (optional)" value={ownerPw} onChange={setOwnerPw} type="password" autoComplete="new-password" />
                </div>
                <div className="flex flex-wrap gap-5">
                  <Checkbox label="Allow printing" checked={allowPrint} onChange={setAllowPrint} />
                  <Checkbox label="Allow copying text" checked={allowCopy} onChange={setAllowCopy} />
                  <Checkbox label="Allow editing" checked={allowModify} onChange={setAllowModify} />
                </div>
              </>
            ) : (
              <TextInput label="Current password" value={pw} onChange={setPw} type="password" autoComplete="current-password" className="max-w-sm" />
            )}
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="hud-btn hud-btn-accent" onClick={go} disabled={busy || !pw}>
                {busy ? <Loader /> : mode === 'protect' ? <Lock size={15} aria-hidden="true" /> : <Unlock size={15} aria-hidden="true" />}
                {mode === 'protect' ? 'Protect PDF' : 'Unlock PDF'}
              </button>
              {status && <span className="text-sm text-success">{status.text}</span>}
            </div>
          </section>
        )}
        {error && <ErrorBox error={error} className="rounded border" />}
        {protectedOut && (
          <div className="hud-panel flex flex-wrap items-center gap-3 p-4 text-sm">
            <ShieldCheck size={18} className="text-success" aria-hidden="true" />
            <span className="flex-1">
              {protectedOut.name} · {formatBytes(protectedOut.bytes.length)} · encrypted (preview needs the password)
            </span>
            <button
              type="button"
              className="hud-btn hud-btn-accent"
              onClick={() => downloadBlob(new Blob([protectedOut.bytes as BlobPart], { type: 'application/pdf' }), protectedOut.name)}
            >
              <Download size={15} aria-hidden="true" /> Download
            </button>
          </div>
        )}
        {unlocked && <PdfResult files={unlocked} />}
      </ServerGate>
    </ToolShell>
  );
}
