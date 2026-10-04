import { useState } from 'react';
import { CheckCircle2, Minimize2, Play, Search } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { Select, TextInput } from '../../components/ui/controls';
import { checkWellFormed, formatXml, minifyXml, xpathQuery } from '../../lib/formatters/xml';

const SAMPLE = `<?xml version="1.0" encoding="UTF-8"?><soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:acc="http://example.test/accounts"><soapenv:Header/><soapenv:Body><acc:GetBalanceResponse><acc:Account id="XXXX4821" type="SAVINGS"><acc:Balance currency="INR">125430.55</acc:Balance><acc:AsOf>2026-10-04T09:30:00+05:30</acc:AsOf></acc:Account><acc:Account id="XXXX9910" type="CURRENT"><acc:Balance currency="INR">8800.00</acc:Balance></acc:Account></acc:GetBalanceResponse></soapenv:Body></soapenv:Envelope>`;

export default function XmlTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [indent, setIndent] = useState('2');
  const [xpath, setXpath] = useState('//acc:Balance/@currency');
  const { error, status, run, reset, setError } = useAction();
  useHandoff(setInput);

  const wellFormed = () => {
    const err = checkWellFormed(input);
    if (err) throw Object.assign(new Error(err.message), { jsonLine: err.line, jsonColumn: err.column });
  };

  return (
    <ToolShell
      onSample={() => {
        setInput(SAMPLE);
        setXpath('//acc:Balance');
      }}
      onClear={() => {
        setInput('');
        setOutput('');
        reset();
      }}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Check</b> runs the browser’s XML parser and reports the first well-formedness error with its line.
          </li>
          <li>
            XPath namespace prefixes are taken from the document (e.g. <code>soapenv:</code>, <code>acc:</code>). A default namespace is available as{' '}
            <code>d:</code>.
          </li>
          <li>
            Examples: <code>//acc:Account/@id</code>, <code>count(//acc:Account)</code>, <code>//*[local-name()='Balance']</code>.
          </li>
        </ul>
      }
    >
      <ActionBar>
        <Select
          label="Indent"
          value={indent}
          onChange={setIndent}
          options={[
            { value: '2', label: '2 spaces' },
            { value: '4', label: '4 spaces' },
            { value: 'tab', label: 'Tab' },
          ]}
        />
        <button
          type="button"
          className="hud-btn hud-btn-accent"
          disabled={!input}
          onClick={() => run(() => setOutput(formatXml(input, indent === 'tab' ? '\t' : ' '.repeat(+indent))), { success: 'Formatted' })}
        >
          <Play size={15} aria-hidden="true" /> Format
        </button>
        <button type="button" className="hud-btn" disabled={!input} onClick={() => run(() => setOutput(minifyXml(input)), { success: 'Minified' })}>
          <Minimize2 size={15} aria-hidden="true" /> Minify
        </button>
        <button type="button" className="hud-btn" disabled={!input} onClick={() => run(wellFormed, { success: 'Well-formed XML' })}>
          <CheckCircle2 size={15} aria-hidden="true" /> Check
        </button>
        <TextInput label="XPath" value={xpath} onChange={setXpath} mono className="min-w-[16rem] flex-1" />
        <button
          type="button"
          className="hud-btn"
          disabled={!input || !xpath}
          onClick={() =>
            run(
              () => {
                const r = xpathQuery(input, xpath);
                setOutput(r.join('\n'));
                return r.length;
              },
              { success: (n) => `${n} result(s)` },
            ).catch(() => setError({ message: 'Invalid XPath expression' }))
          }
        >
          <Search size={15} aria-hidden="true" /> Query
        </button>
        <div className="self-center">
          <StatusLine status={status} />
        </div>
      </ActionBar>
      <TwoPane>
        <EditorPane title="Input" value={input} onChange={setInput} language="xml" acceptFile=".xml,.xsd,.wsdl,.svg,.txt" error={error} detectFrom="xml" />
        <EditorPane title="Output" value={output} readOnly language="xml" downloadName="formatted.xml" />
      </TwoPane>
    </ToolShell>
  );
}
