import { useMemo, useState } from 'react';
import { ShieldCheck, ShieldX, AlertTriangle } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import CodeEditor from '../../components/tool/CodeEditor';
import { KV, TwoPane } from '../../components/tool/layout';
import { useHandoff } from '../../components/tool/useHandoff';
import { Checkbox, TextArea } from '../../components/ui/controls';
import Loader from '../../components/ui/Loader';
import { decodeJwt, verifyJwt } from '../../lib/encoding/jwt';
import { toToolError } from '../../lib/errors';
import { hmac } from '../../lib/crypto/hmac';
import { toBase64, utf8Encode } from '../../lib/bytes';

const SAMPLE_SECRET = 'devtoolkit-demo-secret';

/** Builds a fresh HS256 sample so the expiry is always relative to now. */
async function makeSample(): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => toBase64(utf8Encode(JSON.stringify(o)), true, false);
  const body = `${b64({ alg: 'HS256', typ: 'JWT' })}.${b64({ sub: 'emp-10293', name: 'Asha Verma', role: 'credit-analyst', iss: 'https://sso.example.internal', iat: now, exp: now + 3600 })}`;
  return `${body}.${toBase64(await hmac(body, SAMPLE_SECRET, 'text', 'SHA-256'), true, false)}`;
}

export default function JwtTool() {
  const [token, setToken] = useState('');
  const [key, setKey] = useState('');
  const [keyB64, setKeyB64] = useState(false);
  const [verdict, setVerdict] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);
  useHandoff(setToken);

  const decoded = useMemo(() => {
    if (!token.trim()) return null;
    try {
      return { ok: true as const, d: decodeJwt(token) };
    } catch (e) {
      return { ok: false as const, error: toToolError(e) };
    }
  }, [token]);

  const alg = decoded?.ok ? String(decoded.d.header.alg ?? '') : '';
  const isHmac = alg.startsWith('HS');

  const verify = async () => {
    setBusy(true);
    setVerdict(null);
    try {
      await verifyJwt(token, isHmac ? { kind: 'secret', value: key, base64: keyB64 } : { kind: 'pem-or-jwk', value: key });
      setVerdict({ ok: true, text: `Signature VALID (${alg})` });
    } catch (e) {
      setVerdict({ ok: false, text: e instanceof Error ? e.message : 'Verification failed' });
    } finally {
      setBusy(false);
    }
  };

  return (
    <ToolShell
      onSample={async () => {
        setToken(await makeSample());
        setKey(SAMPLE_SECRET);
        setVerdict(null);
      }}
      onClear={() => {
        setToken('');
        setKey('');
        setVerdict(null);
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Decoding is instant and needs no key. Times (<code>iat</code>, <code>nbf</code>, <code>exp</code>) are shown in IST with how long ago / until.
          </li>
          <li>
            To verify: HS256/384/512 need the shared secret; RS*, PS* and ES* need the issuer’s <b>public</b> key as PEM, X.509 certificate or JWK.
          </li>
          <li>
            Decoding a token does not mean it is trustworthy — always verify the signature. Tokens with <code>alg: none</code> are rejected.
          </li>
        </ul>
      }
    >
      <TwoPane>
        <EditorPane
          title="Encoded token"
          value={token}
          onChange={(v) => (setToken(v), setVerdict(null))}
          error={decoded && !decoded.ok ? decoded.error : null}
          className="h-[28vh] min-h-[160px]"
          detectFrom="jwt"
        />
        <section className="hud-panel flex flex-col gap-3 p-4">
          <h2 className="font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Verify signature {alg && <span className="text-muted">· {alg}</span>}</h2>
          <TextArea
            label={isHmac || !alg ? 'Shared secret' : 'Public key (PEM, certificate or JWK)'}
            value={key}
            onChange={(v) => (setKey(v), setVerdict(null))}
            rows={isHmac || !alg ? 2 : 5}
            placeholder={isHmac || !alg ? 'your-256-bit-secret' : '-----BEGIN PUBLIC KEY-----'}
          />
          {isHmac && <Checkbox label="Secret is Base64-encoded" checked={keyB64} onChange={setKeyB64} />}
          <div className="flex items-center gap-3">
            <button type="button" className="hud-btn hud-btn-accent" disabled={!decoded?.ok || !key || busy} onClick={verify}>
              {busy ? <Loader /> : <ShieldCheck size={15} aria-hidden="true" />} Verify
            </button>
            {verdict && (
              <p role="status" className={`flex items-center gap-1.5 text-sm ${verdict.ok ? 'text-success' : 'text-danger'}`}>
                {verdict.ok ? <ShieldCheck size={16} aria-hidden="true" /> : <ShieldX size={16} aria-hidden="true" />} {verdict.text}
              </p>
            )}
          </div>
        </section>
      </TwoPane>
      {decoded?.ok && (
        <>
          {decoded.d.claims.length > 0 && (
            <section className="hud-panel p-4">
              <h2 className="mb-2 font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Claims</h2>
              <KV
                rows={decoded.d.claims.map((c) => [
                  c.name,
                  <span key={c.name}>
                    {c.value}
                    {c.note && (
                      <span className={`ml-2 ${/EXPIRED|NOT YET/.test(c.note) ? 'text-danger' : 'text-muted'}`}>
                        {/EXPIRED|NOT YET/.test(c.note) && <AlertTriangle size={12} className="mr-1 inline" aria-hidden="true" />}({c.note})
                      </span>
                    )}
                  </span>,
                ])}
              />
            </section>
          )}
          <div className="grid gap-4 lg:grid-cols-2">
            <section className="hud-panel h-[30vh] min-h-[180px] overflow-hidden">
              <h2 className="border-b border-primary/30 px-3 py-1.5 font-hud text-[11px] uppercase tracking-[0.2em] text-accent">Header</h2>
              <div className="h-[calc(100%-2rem)]">
                <CodeEditor value={JSON.stringify(decoded.d.header, null, 2)} readOnly language="json" ariaLabel="JWT header" />
              </div>
            </section>
            <section className="hud-panel h-[30vh] min-h-[180px] overflow-hidden">
              <h2 className="border-b border-primary/30 px-3 py-1.5 font-hud text-[11px] uppercase tracking-[0.2em] text-accent">Payload</h2>
              <div className="h-[calc(100%-2rem)]">
                <CodeEditor
                  value={typeof decoded.d.payload === 'string' ? decoded.d.payload : JSON.stringify(decoded.d.payload, null, 2)}
                  readOnly
                  language="json"
                  ariaLabel="JWT payload"
                />
              </div>
            </section>
          </div>
        </>
      )}
    </ToolShell>
  );
}
