import type { ReactNode } from 'react';

/** Input/output side by side on wide screens, stacked on narrow ones (FR-C1). */
export function TwoPane({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">{children}</div>;
}

export function ActionBar({ children }: { children: ReactNode }) {
  return <div className="hud-panel flex flex-wrap items-end gap-x-4 gap-y-3 p-3">{children}</div>;
}

export function KV({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <table className="hud-table">
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th scope="row" className="w-48 whitespace-nowrap font-medium normal-case tracking-normal">
              {k}
            </th>
            <td className="break-all font-mono text-xs">{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
