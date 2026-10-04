import { useState } from 'react';
import { ArrowDown, ArrowUp } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { Segmented, Select } from '../../components/ui/controls';
import { decodeToBytes, encodeText, type BaseN } from '../../lib/encoding/basen';
import { toHex, utf8Decode } from '../../lib/bytes';

export default function BaseNTool() {
  const [enc, setEnc] = useState<BaseN>('hex');
  const [sep, setSep] = useState('');
  const [plain, setPlain] = useState('');
  const [encoded, setEncoded] = useState('');
  const { error, status, run, reset, setStatus } = useAction();
  useHandoff(setEncoded);

  const decode = () =>
    run(() => {
      const bytes = decodeToBytes(encoded, enc);
      try {
        setPlain(utf8Decode(bytes, true));
        setStatus({ kind: 'success', text: `Decoded ${bytes.length} bytes` });
      } catch {
        setPlain(toHex(bytes, ' '));
        setStatus({ kind: 'warn', text: 'Decoded bytes are not valid UTF-8 text — shown as hex' });
      }
    });

  return (
    <ToolShell
      onSample={() => setPlain('DevToolkit ✓ 2026')}
      onClear={() => {
        setPlain('');
        setEncoded('');
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>Text is converted to UTF-8 bytes, then to the chosen encoding.</li>
          <li>
            <b>Hex</b> decoding ignores spaces, colons, dashes and <code>0x</code> prefixes. <b>Base32</b> follows RFC 4648 (used by TOTP secrets).{' '}
            <b>Base58</b> uses the Bitcoin alphabet.
          </li>
        </ul>
      }
    >
      <ActionBar>
        <Segmented
          label="Encoding"
          value={enc}
          onChange={setEnc}
          options={[
            { value: 'hex', label: 'Hex' },
            { value: 'binary', label: 'Binary' },
            { value: 'base32', label: 'Base32' },
            { value: 'base58', label: 'Base58' },
          ]}
        />
        {enc === 'hex' && (
          <Select
            label="Byte separator"
            value={sep}
            onChange={setSep}
            options={[
              { value: '', label: 'None' },
              { value: ' ', label: 'Space' },
              { value: ':', label: 'Colon' },
            ]}
          />
        )}
        <button
          type="button"
          className="hud-btn hud-btn-accent"
          disabled={!plain}
          onClick={() => run(() => setEncoded(encodeText(plain, enc, sep)), { success: 'Encoded' })}
        >
          <ArrowDown size={15} aria-hidden="true" /> Encode
        </button>
        <button type="button" className="hud-btn" disabled={!encoded} onClick={decode}>
          <ArrowUp size={15} aria-hidden="true" /> Decode
        </button>
        <div className="ml-auto self-center">
          <StatusLine status={status} />
        </div>
      </ActionBar>
      <TwoPane>
        <EditorPane title="Text" value={plain} onChange={setPlain} acceptFile=".txt" />
        <EditorPane
          title={enc === 'hex' ? 'Hex' : enc === 'binary' ? 'Binary' : enc === 'base32' ? 'Base32' : 'Base58'}
          value={encoded}
          onChange={setEncoded}
          error={error}
        />
      </TwoPane>
    </ToolShell>
  );
}
