import { useState } from 'react';
import { Check, Hash, X } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import StatusLine from '../../components/tool/StatusLine';
import ErrorBox from '../../components/tool/ErrorBox';
import Loader from '../../components/ui/Loader';
import { TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { Segmented, Select, TextArea, TextInput } from '../../components/ui/controls';
import { argon2Check, argon2Defaults, argon2Hash, bcryptCheck, bcryptHash, pbkdf2Check, pbkdf2Hash, type PbkdfHash } from '../../lib/crypto/password';

type Alg = 'argon2id' | 'bcrypt' | 'pbkdf2';

export default function PasswordHashTool() {
  const [alg, setAlg] = useState<Alg>('argon2id');
  const [password, setPassword] = useState('');
  const [hash, setHash] = useState('');
  const [cost, setCost] = useState('12');
  const [mem, setMem] = useState(String(argon2Defaults.memoryKiB));
  const [iters, setIters] = useState(String(argon2Defaults.iterations));
  const [pbIters, setPbIters] = useState('600000');
  const [pbHash, setPbHash] = useState<PbkdfHash>('SHA-256');
  const [verifyPw, setVerifyPw] = useState('');
  const [verifyHash, setVerifyHash] = useState('');
  const [verdict, setVerdict] = useState<boolean | null>(null);
  const gen = useAction();
  const ver = useAction();

  const generate = () =>
    gen.run(
      async () => {
        const t0 = performance.now();
        const h =
          alg === 'bcrypt'
            ? await bcryptHash(password, +cost)
            : alg === 'argon2id'
              ? await argon2Hash(password, { ...argon2Defaults, memoryKiB: +mem, iterations: +iters })
              : await pbkdf2Hash(password, +pbIters, pbHash);
        setHash(h);
        setVerifyHash(h);
        return Math.round(performance.now() - t0);
      },
      { success: (ms) => `Generated in ${ms} ms (aim for 250–1000 ms on servers)` },
    );

  const verify = () =>
    ver.run(async () => {
      setVerdict(null);
      const h = verifyHash.trim();
      const ok = h.startsWith('$2')
        ? await bcryptCheck(verifyPw, h)
        : h.startsWith('$argon2')
          ? await argon2Check(verifyPw, h)
          : await pbkdf2Check(verifyPw, h);
      setVerdict(ok);
    });

  return (
    <ToolShell
      onSample={() => {
        setPassword('Correct-Horse-Battery-9');
        setVerifyPw('Correct-Horse-Battery-9');
      }}
      onClear={() => {
        setPassword('');
        setHash('');
        setVerifyPw('');
        setVerifyHash('');
        setVerdict(null);
        gen.reset();
        ver.reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Argon2id</b> is the current OWASP first choice (defaults: 19 MiB memory, 2 iterations). <b>bcrypt</b> is widely supported (cost 12 recommended;
            only the first 72 bytes count). <b>PBKDF2</b> is FIPS-friendly (600,000 iterations for SHA-256).
          </li>
          <li>Each hash uses a fresh random salt, so the same password gives a different hash every time — that is expected.</li>
          <li>
            Verify auto-detects the algorithm from the hash prefix. PBKDF2 hashes use the format <code>pbkdf2-sha256$iterations$salt$hash</code>.
          </li>
        </ul>
      }
    >
      <TwoPane>
        <section className="hud-panel space-y-3 p-4">
          <h2 className="font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Generate</h2>
          <Segmented
            label="Algorithm"
            value={alg}
            onChange={setAlg}
            options={[
              { value: 'argon2id', label: 'Argon2id' },
              { value: 'bcrypt', label: 'bcrypt' },
              { value: 'pbkdf2', label: 'PBKDF2' },
            ]}
          />
          <TextInput label="Password" value={password} onChange={setPassword} type="password" autoComplete="new-password" />
          <div className="flex flex-wrap gap-3">
            {alg === 'bcrypt' && <Select label="Cost factor" value={cost} onChange={setCost} options={['10', '11', '12', '13', '14']} />}
            {alg === 'argon2id' && (
              <>
                <Select
                  label="Memory (KiB)"
                  value={mem}
                  onChange={setMem}
                  options={[
                    { value: '19456', label: '19 MiB (OWASP)' },
                    { value: '47104', label: '46 MiB' },
                    { value: '65536', label: '64 MiB' },
                  ]}
                />
                <Select label="Iterations" value={iters} onChange={setIters} options={['1', '2', '3', '4']} />
              </>
            )}
            {alg === 'pbkdf2' && (
              <>
                <Select label="Hash" value={pbHash} onChange={setPbHash} options={['SHA-256', 'SHA-512']} />
                <Select label="Iterations" value={pbIters} onChange={setPbIters} options={['210000', '310000', '600000', '1000000']} />
              </>
            )}
          </div>
          <button type="button" className="hud-btn hud-btn-accent" disabled={!password || gen.busy} onClick={generate}>
            {gen.busy ? <Loader /> : <Hash size={15} aria-hidden="true" />} Generate hash
          </button>
          <StatusLine status={gen.status} />
          {hash && <TextArea label="Hash" value={hash} readOnly rows={3} />}
          {gen.error && <ErrorBox error={gen.error} className="rounded border" />}
        </section>
        <section className="hud-panel space-y-3 p-4">
          <h2 className="font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">Verify</h2>
          <TextInput label="Password" value={verifyPw} onChange={(v) => (setVerifyPw(v), setVerdict(null))} type="password" autoComplete="off" />
          <TextArea label="Hash ($2b$…, $argon2id$…, or pbkdf2-sha256$…)" value={verifyHash} onChange={(v) => (setVerifyHash(v), setVerdict(null))} rows={3} />
          <button type="button" className="hud-btn" disabled={!verifyPw || !verifyHash || ver.busy} onClick={verify}>
            {ver.busy ? <Loader /> : <Check size={15} aria-hidden="true" />} Verify
          </button>
          {verdict !== null && (
            <p role="status" className={`flex items-center gap-1.5 text-sm ${verdict ? 'text-success' : 'text-danger'}`}>
              {verdict ? <Check size={16} aria-hidden="true" /> : <X size={16} aria-hidden="true" />}{' '}
              {verdict ? 'Password matches the hash' : 'Password does NOT match'}
            </p>
          )}
          {ver.error && <ErrorBox error={ver.error} className="rounded border" />}
        </section>
      </TwoPane>
    </ToolShell>
  );
}
