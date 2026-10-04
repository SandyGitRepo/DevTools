import { useState } from 'react';
import { Download, Lock, Unlock, ShieldCheck } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import FileDrop from '../../components/tool/FileDrop';
import StatusLine from '../../components/tool/StatusLine';
import ErrorBox from '../../components/tool/ErrorBox';
import Loader from '../../components/ui/Loader';
import { useAction } from '../../components/tool/useAction';
import { TextInput } from '../../components/ui/controls';
import { decryptFile, encryptFile, isEncFile, MAX_FILE_BYTES, FILE_PBKDF2_ITERATIONS } from '../../lib/crypto/fileEncrypt';
import { downloadBlob, formatBytes, readFileAsBytes } from '../../lib/files';

export default function FileEncryptTool() {
  const [file, setFile] = useState<File | null>(null);
  const [isEnc, setIsEnc] = useState(false);
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [result, setResult] = useState<{ bytes: Uint8Array; name: string } | null>(null);
  const { error, status, run, reset, busy } = useAction();

  const onFile = async (f: File) => {
    setFile(f);
    setResult(null);
    reset();
    const head = new Uint8Array(await f.slice(0, 64).arrayBuffer());
    setIsEnc(isEncFile(head) || f.name.endsWith('.enc'));
  };

  const go = () =>
    run(
      async () => {
        const bytes = await readFileAsBytes(file!, MAX_FILE_BYTES);
        if (isEnc) {
          const out = await decryptFile(bytes, password);
          setResult({ bytes: out, name: file!.name.replace(/\.enc$/i, '') || 'decrypted.bin' });
        } else {
          if (password !== confirm) throw new Error('The passwords do not match');
          const out = await encryptFile(bytes, password);
          setResult({ bytes: out, name: `${file!.name}.enc` });
        }
      },
      { success: isEnc ? 'Decrypted — integrity verified' : 'Encrypted' },
    );

  const weak = !isEnc && password.length > 0 && password.length < 12;

  return (
    <ToolShell
      onClear={() => {
        setFile(null);
        setPassword('');
        setConfirm('');
        setResult(null);
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Drop any file to encrypt it into a <code>.enc</code> file, or drop a <code>.enc</code> file to decrypt it. The mode is chosen automatically.
          </li>
          <li>
            Encryption: AES-256-GCM with a key derived by PBKDF2-SHA256 ({FILE_PBKDF2_ITERATIONS.toLocaleString()} iterations) and a random salt and IV. Any
            modification is detected on decryption.
          </li>
          <li>There is no password recovery. Share the password through a different channel than the file. Max {formatBytes(MAX_FILE_BYTES)}.</li>
        </ul>
      }
    >
      <section className="hud-panel mx-auto w-full max-w-3xl space-y-4 p-5">
        <FileDrop onFile={(f) => void onFile(f)} file={file} label="Drop a file to encrypt, or a .enc file to decrypt" />
        {file && (
          <>
            <p className="flex items-center gap-2 text-sm">
              {isEnc ? <Unlock size={16} className="text-cyan" aria-hidden="true" /> : <Lock size={16} className="text-accent" aria-hidden="true" />}
              {isEnc ? 'Encrypted DevToolkit file detected — enter its password to decrypt.' : 'Choose a password to encrypt this file.'}
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <TextInput
                label="Password"
                value={password}
                onChange={setPassword}
                type="password"
                autoComplete="new-password"
                hint={weak ? 'Use 12+ characters or a passphrase' : undefined}
              />
              {!isEnc && <TextInput label="Confirm password" value={confirm} onChange={setConfirm} type="password" autoComplete="new-password" />}
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" className="hud-btn hud-btn-accent" disabled={!password || busy || (!isEnc && !confirm)} onClick={go}>
                {busy ? <Loader /> : isEnc ? <Unlock size={15} aria-hidden="true" /> : <Lock size={15} aria-hidden="true" />} {isEnc ? 'Decrypt' : 'Encrypt'}
              </button>
              <StatusLine status={status} />
            </div>
          </>
        )}
        {error && <ErrorBox error={error} className="rounded border" />}
        {result && (
          <div className="flex flex-wrap items-center gap-3 rounded border border-success/40 bg-success/10 p-3 text-sm">
            <ShieldCheck size={18} className="text-success" aria-hidden="true" />
            <span className="flex-1">
              {result.name} · {formatBytes(result.bytes.length)}
            </span>
            <button
              type="button"
              className="hud-btn hud-btn-accent"
              onClick={() => downloadBlob(new Blob([result.bytes as BlobPart], { type: 'application/octet-stream' }), result.name)}
            >
              <Download size={15} aria-hidden="true" /> Download
            </button>
          </div>
        )}
      </section>
    </ToolShell>
  );
}
