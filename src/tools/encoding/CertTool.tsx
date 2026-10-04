import { useState } from 'react';
import { FileSearch, ShieldAlert, ShieldCheck } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import Loader from '../../components/ui/Loader';
import { KV } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { decodeCertificates, type CertInfo } from '../../lib/encoding/cert';
import SAMPLE_CERT from './samples/sample-cert.pem?raw';

export default function CertTool() {
  const [pem, setPem] = useState('');
  const [certs, setCerts] = useState<CertInfo[]>([]);
  const { error, status, run, reset, busy } = useAction();
  useHandoff((t) => {
    setPem(t);
    void decode(t);
  });

  const decode = (text = pem) =>
    run(
      async () => {
        const r = await decodeCertificates(text);
        setCerts(r);
        return r.length;
      },
      { success: (n) => `Decoded ${n} block(s)` },
    );

  return (
    <ToolShell
      onSample={() => {
        setPem(SAMPLE_CERT);
        void decode(SAMPLE_CERT);
      }}
      onClear={() => {
        setPem('');
        setCerts([]);
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Paste one or more PEM blocks (a full chain works) or drop a <code>.pem</code>, <code>.crt</code> or <code>.csr</code> file. DER files: convert with{' '}
            <code>openssl x509 -inform der -in cert.der</code>.
          </li>
          <li>Shows subject, issuer, SANs, validity (with days remaining), key type and size, extensions and SHA-1/SHA-256 fingerprints.</li>
          <li>Never paste private keys — the tool refuses them.</li>
        </ul>
      }
    >
      <EditorPane
        title="PEM certificate or CSR"
        value={pem}
        onChange={setPem}
        acceptFile=".pem,.crt,.cer,.csr,.txt"
        error={error}
        className="h-[30vh] min-h-[180px]"
        toolbar={
          <button type="button" className="hud-btn hud-btn-accent px-2 py-1 text-xs" disabled={!pem || busy} onClick={() => decode()}>
            {busy ? <Loader /> : <FileSearch size={14} aria-hidden="true" />} Decode
          </button>
        }
      />
      <StatusLine status={status} />
      {certs.map((c, i) => {
        const v = c.validity;
        const expired = v && v.daysLeft < 0;
        const soon = v && v.daysLeft >= 0 && v.daysLeft < 30;
        return (
          <section key={i} className="hud-panel space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="font-hud text-sm uppercase tracking-widest text-cyan">
                {certs.length > 1 ? `#${i + 1} · ` : ''}
                {c.kind}
              </h2>
              {v && (
                <span
                  className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs ${
                    expired ? 'border-danger/50 text-danger' : soon ? 'border-warn/50 text-warn' : 'border-success/50 text-success'
                  }`}
                >
                  {expired ? <ShieldAlert size={12} aria-hidden="true" /> : <ShieldCheck size={12} aria-hidden="true" />}
                  {expired ? `Expired ${-v.daysLeft} days ago` : v.notBefore > new Date() ? 'Not yet valid' : `Valid · ${v.daysLeft} days left`}
                </span>
              )}
            </div>
            <KV rows={c.fields} />
            {c.extensions.length > 0 && (
              <>
                <h3 className="pt-2 font-sans text-xs font-semibold uppercase tracking-wider text-muted">Extensions</h3>
                <KV rows={c.extensions.map(([n, val, crit]) => [`${n}${crit ? ' (critical)' : ''}`, val || <span className="text-muted">present</span>])} />
              </>
            )}
          </section>
        );
      })}
    </ToolShell>
  );
}
