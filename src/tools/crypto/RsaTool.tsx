import { useState } from 'react';
import { Check, KeyRound, Lock, PenLine, ShieldCheck, Unlock, X } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import StatusLine from '../../components/tool/StatusLine';
import ErrorBox from '../../components/tool/ErrorBox';
import Loader from '../../components/ui/Loader';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { Segmented, TextArea } from '../../components/ui/controls';
import { generateKeyPair, rsaDecrypt, rsaEncrypt, sign, verify, type AsymAlg } from '../../lib/crypto/keys';

type Op = 'encrypt' | 'sign';

export default function RsaTool() {
  const [op, setOp] = useState<Op>('encrypt');
  const [alg, setAlg] = useState<AsymAlg>('RSA-PSS');
  const [publicPem, setPublicPem] = useState('');
  const [privatePem, setPrivatePem] = useState('');
  const [message, setMessage] = useState('');
  const [result, setResult] = useState('');
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const { error, status, run, reset, busy } = useAction();

  const algorithm: AsymAlg = op === 'encrypt' ? 'RSA-OAEP' : alg;

  const demoKeys = () =>
    run(
      async () => {
        const kp = await generateKeyPair(algorithm === 'ECDSA-P384' ? 'EC-P384' : algorithm === 'ECDSA-P256' ? 'EC-P256' : 'RSA-2048');
        setPublicPem(kp.publicPem);
        setPrivatePem(kp.privatePem);
      },
      { success: 'Generated a throw-away key pair for testing' },
    );

  return (
    <ToolShell
      onSample={() => {
        setMessage('Approve disbursement LN-0001 for ₹5,00,000');
        void demoKeys();
      }}
      onClear={() => {
        setPublicPem('');
        setPrivatePem('');
        setMessage('');
        setResult('');
        setVerdict(null);
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Encrypt</b> uses RSA-OAEP with SHA-256. RSA can only encrypt short messages (≈190 bytes for 2048-bit keys) — use AES for anything larger.
          </li>
          <li>
            <b>Sign</b> supports RSA-PSS (SHA-256, salt 32) and ECDSA P-256/P-384. Signatures are Base64 (ECDSA in raw r‖s form, as used by JWS).
          </li>
          <li>
            Keys must be PEM: public keys as SPKI (<code>BEGIN PUBLIC KEY</code>), private keys as PKCS#8 (<code>BEGIN PRIVATE KEY</code>). Use the Key
            Generator to create them.
          </li>
        </ul>
      }
    >
      <ActionBar>
        <Segmented
          label="Operation"
          value={op}
          onChange={(o) => (setOp(o), setResult(''), setVerdict(null))}
          options={[
            { value: 'encrypt', label: 'Encrypt / decrypt (RSA-OAEP)' },
            { value: 'sign', label: 'Sign / verify' },
          ]}
        />
        {op === 'sign' && (
          <Segmented
            label="Algorithm"
            value={alg}
            onChange={setAlg}
            options={[
              { value: 'RSA-PSS', label: 'RSA-PSS' },
              { value: 'ECDSA-P256', label: 'ECDSA P-256' },
              { value: 'ECDSA-P384', label: 'ECDSA P-384' },
            ]}
          />
        )}
        <button type="button" className="hud-btn" onClick={demoKeys} disabled={busy}>
          <KeyRound size={15} aria-hidden="true" /> Generate test keys
        </button>
        <div className="ml-auto self-center">
          <StatusLine status={status} />
        </div>
      </ActionBar>
      <TwoPane>
        <section className="hud-panel space-y-3 p-4">
          <TextArea label="Public key (PEM)" value={publicPem} onChange={setPublicPem} rows={6} placeholder="-----BEGIN PUBLIC KEY-----" />
          <TextArea label="Private key (PEM, PKCS#8)" value={privatePem} onChange={setPrivatePem} rows={6} placeholder="-----BEGIN PRIVATE KEY-----" />
        </section>
        <section className="hud-panel space-y-3 p-4">
          <TextArea label={op === 'encrypt' ? 'Plaintext' : 'Message'} value={message} onChange={(v) => (setMessage(v), setVerdict(null))} rows={4} />
          <div className="flex flex-wrap gap-2">
            {op === 'encrypt' ? (
              <>
                <button
                  type="button"
                  className="hud-btn hud-btn-accent"
                  disabled={!publicPem || !message || busy}
                  onClick={() => run(async () => setResult(await rsaEncrypt(publicPem, message)), { success: 'Encrypted with the public key' })}
                >
                  {busy ? <Loader /> : <Lock size={15} aria-hidden="true" />} Encrypt
                </button>
                <button
                  type="button"
                  className="hud-btn"
                  disabled={!privatePem || !result || busy}
                  onClick={() => run(async () => setMessage(await rsaDecrypt(privatePem, result)), { success: 'Decrypted with the private key' })}
                >
                  <Unlock size={15} aria-hidden="true" /> Decrypt
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className="hud-btn hud-btn-accent"
                  disabled={!privatePem || !message || busy}
                  onClick={() => run(async () => setResult(await sign(privatePem, alg, message)), { success: 'Signed with the private key' })}
                >
                  {busy ? <Loader /> : <PenLine size={15} aria-hidden="true" />} Sign
                </button>
                <button
                  type="button"
                  className="hud-btn"
                  disabled={!publicPem || !result || !message || busy}
                  onClick={() => run(async () => setVerdict(await verify(publicPem, alg, message, result)))}
                >
                  <ShieldCheck size={15} aria-hidden="true" /> Verify
                </button>
              </>
            )}
          </div>
          <TextArea
            label={op === 'encrypt' ? 'Ciphertext (Base64)' : 'Signature (Base64)'}
            value={result}
            onChange={(v) => (setResult(v), setVerdict(null))}
            rows={5}
          />
          {verdict !== null && (
            <p role="status" className={`flex items-center gap-1.5 text-sm ${verdict ? 'text-success' : 'text-danger'}`}>
              {verdict ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />} {verdict ? 'Signature is VALID' : 'Signature is INVALID'}
            </p>
          )}
          {error && <ErrorBox error={error} className="rounded border" />}
        </section>
      </TwoPane>
    </ToolShell>
  );
}
