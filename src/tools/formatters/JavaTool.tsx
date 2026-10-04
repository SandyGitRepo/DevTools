import { useState } from 'react';
import { Play } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import EditorPane from '../../components/tool/EditorPane';
import StatusLine from '../../components/tool/StatusLine';
import Loader from '../../components/ui/Loader';
import { ActionBar, TwoPane } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { useHandoff } from '../../components/tool/useHandoff';
import { Select } from '../../components/ui/controls';
import { prettierFormat } from '../../lib/formatters/prettier';

const SAMPLE = `package com.example.loans;
import java.math.BigDecimal;import java.util.List;
public class EmiCalculator{private final BigDecimal rate;
public EmiCalculator(BigDecimal annualRatePercent){this.rate=annualRatePercent.divide(BigDecimal.valueOf(1200),10,java.math.RoundingMode.HALF_UP);}
public double emi(double principal,int months){double r=rate.doubleValue();if(r==0)return principal/months;
double f=Math.pow(1+r,months);return principal*r*f/(f-1);}
public List<String> describe(){return List.of("rate="+rate,"type=reducing");}}`;

export default function JavaTool() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [width, setWidth] = useState('100');
  const [indent, setIndent] = useState('2');
  const { error, status, run, reset, busy } = useAction();
  useHandoff(setInput);

  const format = () =>
    run(async () => setOutput(await prettierFormat(input, 'java', { printWidth: +width, tabWidth: +indent })), { success: 'Formatted — syntax OK' });

  return (
    <ToolShell
      onSample={() => setInput(SAMPLE)}
      onClear={() => {
        setInput('');
        setOutput('');
        reset();
      }}
      help={
        <p>
          Formats Java with Google-style 2-space indentation by default (use 4 for the common IDE style). If the source does not parse, the error and its line
          are shown and nothing is changed. The parser loads on first use (about 1 MB).
        </p>
      }
    >
      <ActionBar>
        <Select
          label="Indent"
          value={indent}
          onChange={setIndent}
          options={[
            { value: '2', label: '2 spaces (Google)' },
            { value: '4', label: '4 spaces' },
          ]}
        />
        <Select label="Line width" value={width} onChange={setWidth} options={['80', '100', '120']} />
        <button type="button" className="hud-btn hud-btn-accent" disabled={!input || busy} onClick={format}>
          {busy ? <Loader /> : <Play size={15} aria-hidden="true" />} Format
        </button>
        <div className="ml-auto self-center">
          <StatusLine status={status} />
        </div>
      </ActionBar>
      <TwoPane>
        <EditorPane title="Input" value={input} onChange={setInput} language="java" acceptFile=".java,.txt" error={error} detectFrom="java" />
        <EditorPane title="Output" value={output} readOnly language="java" downloadName="Formatted.java" />
      </TwoPane>
    </ToolShell>
  );
}
