import { useState } from 'react';
import { Lock, Unlock, Info, RefreshCw } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import Loader from '../../components/ui/Loader';
import { ActionBar, KV, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { Segmented, TextInput } from '../../components/ui/controls';
import { aesDecrypt, aesEncrypt, ivLength, PBKDF2_ITERATIONS, type AesKeySize, type AesMode, type EncryptResult, type KeySource } from '../../lib/crypto/aes';
import { randomBytes, toHex } from '../../lib/bytes';

export default function AesTool() {
  const [mode, setMode] = useState<AesMode>('AES-GCM');
  const [size, setSize] = useState<'128' | '256'>('256');
  const [keyKind, setKeyKind] = useState<'passphrase' | 'raw'>('passphrase');
  const [passphrase, setPassphrase] = useState('');
  const [rawKey, setRawKey] = useState('');
  const [plain, setPlain] = useState('');
  const [cipher, setCipher] = useState('');
  const [details, setDetails] = useState<EncryptResult | null>(null);
  const { error, status, run, reset, busy } = useAction();

  const src = (): KeySource => (keyKind === 'passphrase' ? { kind: 'passphrase', passphrase } : { kind: 'raw', keyHex: rawKey });
  const keySize = +size as AesKeySize;

  const encrypt = () =>
    run(
      async () => {
        const r = await aesEncrypt(plain, mode, keySize, src());
        setCipher(r.packed);
        setDetails(r);
      },
      { success: 'Encrypted' },
    );

  const decrypt = () => run(async () => setPlain(await aesDecrypt(cipher, mode, keySize, src())), { success: 'Decrypted' });

  return (
    <ToolShell
      onSample={() => {
        setPlain('Account 50100293812 · IFSC EXMP0001234 · limit ₹5,00,000');
        setPassphrase('demo passphrase — change me');
        setKeyKind('passphrase');
      }}
      onClear={() => {
        setPlain('');
        setCipher('');
        setPassphrase('');
        setRawKey('');
        setDetails(null);
        reset();
      }}
    >
      <ActionBar>
        <Segmented
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'AES-GCM', label: 'GCM (recommended)' },
            { value: 'AES-CBC', label: 'CBC' },
            { value: 'AES-CTR', label: 'CTR' },
          ]}
        />
        <Segmented
          label="Key size"
          value={size}
          onChange={setSize}
          options={[
            { value: '128', label: '128-bit' },
            { value: '256', label: '256-bit' },
          ]}
        />
        <Segmented
          label="Key from"
          value={keyKind}
          onChange={setKeyKind}
          options={[
            { value: 'passphrase', label: 'Passphrase' },
            { value: 'raw', label: 'Raw key (hex)' },
          ]}
        />
        {keyKind === 'passphrase' ? (
          <TextInput
            label="Passphrase"
            value={passphrase}
            onChange={setPassphrase}
            type="password"
            className="min-w-[14rem] flex-1"
            autoComplete="new-password"
          />
        ) : (
          <div className="flex min-w-[18rem] flex-1 items-end gap-2">
            <TextInput label={`Key (${keySize / 4} hex chars)`} value={rawKey} onChange={setRawKey} mono className="flex-1" />
            <button type="button" className="hud-btn mb-px" onClick={() => setRawKey(toHex(randomBytes(keySize / 8)))} title="Generate a random key">
              <RefreshCw size={14} aria-hidden="true" /> New
            </button>
          </div>
        )}
      </ActionBar>
      <div className="flex flex-wrap items-center gap-3">
        <button type="button" className="hud-btn hud-btn-accent" disabled={!plain || busy} onClick={encrypt}>
          {busy ? <Loader /> : <Lock size={15} aria-hidden="true" />} Encrypt →
        </button>
        <button type="button" className="hud-btn" disabled={!cipher || busy} onClick={decrypt}>
          <Unlock size={15} aria-hidden="true" /> ← Decrypt
        </button>
        <StatusLine status={status} />
      </div>
      <TwoPane>
        <EditorPane title="Plaintext" value={plain} onChange={setPlain} acceptFile=".txt,.json" className="h-[36vh] min-h-[200px]" />
        <EditorPane
          title="Ciphertext (Base64)"
          value={cipher}
          onChange={setCipher}
          error={error}
          downloadName="ciphertext.b64.txt"
          className="h-[36vh] min-h-[200px]"
        />
      </TwoPane>
      <TwoPane>
        <section className="hud-panel p-4 text-sm text-muted">
          <h2 className="mb-2 flex items-center gap-2 font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">
            <Info size={14} aria-hidden="true" /> How the IV and key are handled
          </h2>
          <ul className="list-disc space-y-1.5 pl-5">
            <li>
              A fresh random IV of {ivLength(mode)} bytes is generated for every encryption. Re-using an IV with the same key breaks{' '}
              {mode === 'AES-GCM' ? 'GCM completely' : mode === 'AES-CTR' ? 'CTR completely' : 'CBC confidentiality'}.
            </li>
            <li>
              Output layout:{' '}
              {keyKind === 'passphrase' ? <code>salt (16) + IV ({ivLength(mode)}) + ciphertext</code> : <code>IV ({ivLength(mode)}) + ciphertext</code>},
              Base64-encoded. Decrypt expects the same layout.
            </li>
            {keyKind === 'passphrase' && (
              <li>The key is derived with PBKDF2-HMAC-SHA256, {PBKDF2_ITERATIONS.toLocaleString()} iterations, using the random salt.</li>
            )}
            <li>
              {mode === 'AES-GCM' ? (
                'GCM authenticates the data: any change or wrong key is detected.'
              ) : (
                <span className="text-warn">{mode} has no integrity check — prefer GCM, or add an HMAC.</span>
              )}
            </li>
            <li>AES-ECB is deliberately not offered: it leaks patterns in the plaintext.</li>
          </ul>
        </section>
        {details && (
          <section className="hud-panel p-4">
            <h2 className="mb-2 font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Last encryption</h2>
            <KV
              rows={[
                ...(details.saltHex ? [['Salt (hex)', details.saltHex] as [string, string]] : []),
                ['IV (hex)', details.ivHex],
                ['Ciphertext only (Base64)', details.ciphertextB64],
              ]}
            />
          </section>
        )}
      </TwoPane>
    </ToolShell>
  );
}
