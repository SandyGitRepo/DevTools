import { useEffect, useState } from 'react';
import { Check, X } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import ErrorBox from '../../components/tool/ErrorBox';
import { ActionBar, KV, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { Segmented, TextInput } from '../../components/ui/controls';
import { hmac, type HmacHash } from '../../lib/crypto/hmac';
import { toBase64, toHex, type KeyEncoding } from '../../lib/bytes';
import { matchesExpected } from '../../lib/crypto/hash';

export default function HmacTool() {
  const [message, setMessage] = useState('');
  const [key, setKey] = useState('');
  const [keyEnc, setKeyEnc] = useState<KeyEncoding>('text');
  const [hash, setHash] = useState<HmacHash>('SHA-256');
  const [expected, setExpected] = useState('');
  const [mac, setMac] = useState<Uint8Array | null>(null);
  const { error, run, reset } = useAction();

  useEffect(() => {
    if (!key) {
      setMac(null);
      return;
    }
    const t = setTimeout(() => void run(async () => setMac(await hmac(message, key, keyEnc, hash))), 150);
    return () => clearTimeout(t);
  }, [message, key, keyEnc, hash, run]);

  const exp = expected.trim();
  const match = mac && exp ? matchesExpected(mac, expected) : null;

  return (
    <ToolShell
      onSample={() => {
        setMessage('what do ya want for nothing?');
        setKey('Jefe');
        setKeyEnc('text');
        setHash('SHA-256');
        setExpected('5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843');
      }}
      onClear={() => {
        setMessage('');
        setKey('');
        setExpected('');
        setMac(null);
        reset();
      }}
      help={
        <p>
          Computes HMAC as you type — handy for checking webhook signatures (e.g. <code>X-Signature: sha256=…</code>). The message is used exactly as entered,
          including trailing newlines. Paste the received signature in <b>Compare</b> to check it. The sample is RFC 4231 test case 2.
        </p>
      }
    >
      <ActionBar>
        <Segmented label="Hash" value={hash} onChange={setHash} options={['SHA-256', 'SHA-384', 'SHA-512', 'SHA-1']} />
        <Segmented
          label="Key format"
          value={keyEnc}
          onChange={setKeyEnc}
          options={[
            { value: 'text', label: 'Text' },
            { value: 'hex', label: 'Hex' },
            { value: 'base64', label: 'Base64' },
          ]}
        />
        <TextInput label="Secret key" value={key} onChange={setKey} type="password" mono className="min-w-[14rem] flex-1" autoComplete="new-password" />
      </ActionBar>
      <TwoPane>
        <EditorPane title="Message" value={message} onChange={setMessage} acceptFile="*" className="h-[40vh] min-h-[240px]" />
        <section className="hud-panel space-y-3 p-4">
          <h2 className="font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">HMAC-{hash}</h2>
          <KV
            rows={[
              ['Hex', mac ? toHex(mac) : '—'],
              ['Base64', mac ? toBase64(mac) : '—'],
              ['Base64URL', mac ? toBase64(mac, true, false) : '—'],
            ]}
          />
          <TextInput label="Compare with received signature" value={expected} onChange={setExpected} mono placeholder="hex or Base64" />
          {match !== null && (
            <p role="status" className={`flex items-center gap-1.5 text-sm ${match ? 'text-success' : 'text-danger'}`}>
              {match ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />} {match ? 'Signature matches' : 'Signature does NOT match'}
            </p>
          )}
          {error && <ErrorBox error={error} className="rounded border" />}
        </section>
      </TwoPane>
    </ToolShell>
  );
}
