import { useState } from 'react';
import ToolShell from '../../components/tool/ToolShell';
import UnitFields, { DecimalPlaces } from '../../components/tool/UnitFields';
import { ActionBar } from '../../components/tool/layout';
import { Segmented } from '../../components/ui/controls';
import { otherCategories, toBase } from '../../lib/units/units';

export default function OtherUnitsTool() {
  const [cat, setCat] = useState(otherCategories[0].id);
  const [values, setValues] = useState<Record<string, number | null>>({});
  const [dp, setDp] = useState(4);
  const category = otherCategories.find((c) => c.id === cat)!;

  return (
    <ToolShell
      onSample={() => {
        setCat('temperature');
        setValues({ ...values, temperature: toBase(otherCategories[1].units[0], 37) });
      }}
      onClear={() => setValues({})}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>Type in any box and the others update. 1 lb = 0.45359237 kg exactly; 1 tola = 11.6638 g; 1 quintal = 100 kg.</li>
          <li>Data sizes: KB/MB/GB use 1000 (disk makers, network speeds); KiB/MiB/GiB use 1024 (RAM, Windows “GB”).</li>
        </ul>
      }
    >
      <ActionBar>
        <Segmented label="Category" value={cat} onChange={setCat} options={otherCategories.map((c) => ({ value: c.id, label: c.label }))} />
        <DecimalPlaces value={dp} onChange={setDp} />
      </ActionBar>
      <UnitFields
        key={cat}
        units={category.units}
        base={values[cat] ?? null}
        onBase={(v) => setValues({ ...values, [cat]: v })}
        dp={dp}
        columns="sm:grid-cols-2 xl:grid-cols-4"
      />
    </ToolShell>
  );
}
