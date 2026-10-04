import { useMemo, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useHandoff } from '../../components/tool/useHandoff';
import { Checkbox, Segmented, Select } from '../../components/ui/controls';
import { defaultMaskOptions, maskJson, maskText, ruleLabels, type MaskCounts, type MaskOptions, type RuleId } from '../../lib/utils/masker';
import { parseJson } from '../../lib/formatters/jsonError';
import { toToolError } from '../../lib/errors';

const SAMPLE = `{
  "requestId": "c0a8-77f1",
  "customer": {
    "name": "Asha Verma",
    "pan": "ABCPE1234F",
    "aadhaar": "2341 2341 2346",
    "mobile": "+91 98765 43210",
    "email": "asha.verma@example.in",
    "password": "S3cret!",
    "card": "4111 1111 1111 1111"
  },
  "account": { "number": 50100293812345, "ifsc": "HDFC0001234" },
  "note": "Called from 9876543210 regarding a/c 50100293812345"
}`;

export default function MaskerTool() {
  const [input, setInput] = useState('');
  const [mode, setMode] = useState<'auto' | 'text' | 'json'>('auto');
  const [opts, setOpts] = useState<MaskOptions>(defaultMaskOptions);
  useHandoff(setInput);

  const result = useMemo(() => {
    if (!input.trim()) return null;
    const counts: MaskCounts = {};
    const asJson = mode === 'json' || (mode === 'auto' && /^\s*[{[]/.test(input));
    try {
      if (asJson) return { text: JSON.stringify(maskJson(parseJson(input), opts, counts), null, 2), counts, json: true };
      return { text: maskText(input, opts, counts).text, counts, json: false };
    } catch (e) {
      return { error: toToolError(e, input), counts };
    }
  }, [input, mode, opts]);

  const setRule = (id: RuleId, v: boolean) => setOpts({ ...opts, rules: { ...opts.rules, [id]: v } });
  const total = result ? Object.values(result.counts).reduce((a, b) => a + (b ?? 0), 0) : 0;

  return (
    <ToolShell
      onSample={() => setInput(SAMPLE)}
      onClear={() => setInput('')}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Masks PAN, Aadhaar (Verhoeff-checked), card numbers (Luhn-checked), Indian mobiles, emails, account numbers and optionally IFSC — in logs, emails or
            JSON — before you share them.
          </li>
          <li>
            JSON mode keeps the structure and also hides values of keys like <code>password</code>, <code>token</code>, <code>secret</code>, <code>otp</code>,{' '}
            <code>cvv</code>.
          </li>
          <li>Pattern-based masking can miss unusual formats. Always review the output before sharing.</li>
        </ul>
      }
    >
      <ActionBar>
        <Segmented
          label="Input"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'auto', label: 'Auto' },
            { value: 'text', label: 'Text' },
            { value: 'json', label: 'JSON' },
          ]}
        />
        <fieldset>
          <legend className="hud-label">Mask</legend>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {(Object.keys(ruleLabels) as RuleId[]).map((id) => (
              <Checkbox key={id} label={ruleLabels[id]} checked={opts.rules[id]} onChange={(v) => setRule(id, v)} />
            ))}
            <Checkbox label="Secret keys (JSON)" checked={opts.sensitiveKeys} onChange={(v) => setOpts({ ...opts, sensitiveKeys: v })} />
          </div>
        </fieldset>
        <Select label="Keep last" value={String(opts.keepLast)} onChange={(v) => setOpts({ ...opts, keepLast: Number(v) })} options={['0', '2', '4']} />
        <Select label="Mask with" value={opts.maskChar} onChange={(v) => setOpts({ ...opts, maskChar: v })} options={['X', '*', '•', '#']} />
      </ActionBar>
      {result && !('error' in result && result.error) && (
        <p className="flex flex-wrap items-center gap-2 text-sm text-success" role="status">
          <ShieldCheck size={16} aria-hidden="true" /> {total} item{total === 1 ? '' : 's'} masked
          {Object.entries(result.counts).map(([k, n]) => (
            <span key={k} className="rounded border border-success/40 px-2 py-0.5 text-xs">
              {k === 'key' ? 'secret keys' : ruleLabels[k as RuleId]}: {n}
            </span>
          ))}
        </p>
      )}
      <TwoPane>
        <EditorPane
          title="Original (stays in your browser)"
          value={input}
          onChange={setInput}
          language={result && 'json' in result && result.json ? 'json' : 'plaintext'}
          acceptFile=".txt,.log,.json,.csv"
          error={result && 'error' in result ? result.error : null}
        />
        <EditorPane
          title="Masked — safe to share"
          value={result && 'text' in result ? result.text! : ''}
          readOnly
          language={result && 'json' in result && result.json ? 'json' : 'plaintext'}
          downloadName="masked.txt"
        />
      </TwoPane>
    </ToolShell>
  );
}
