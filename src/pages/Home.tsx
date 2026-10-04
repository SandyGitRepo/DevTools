import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Search, ShieldCheck, Star, History } from 'lucide-react';
import { modules, searchTools, toolById, toolsInModule, tools, type ToolMeta } from '../registry/tools';
import { usePrefs } from '../state/prefs';
import ToolTile from '../components/shell/ToolTile';
import { appConfig } from '../config/app.config';

const Grid = ({ items }: { items: ToolMeta[] }) => (
  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
    {items.map((t) => (
      <ToolTile key={t.id} tool={t} />
    ))}
  </div>
);

export default function Home() {
  const [q, setQ] = useState('');
  const { favourites, recent } = usePrefs();
  const results = useMemo(() => (q.trim() ? searchTools(q) : null), [q]);
  const favTools = favourites.map(toolById).filter((t): t is ToolMeta => !!t);
  const recentTools = recent.map(toolById).filter((t): t is ToolMeta => !!t);
  const live = tools.filter((t) => t.load).length;

  return (
    <div className="mx-auto max-w-[1600px] space-y-8">
      <section className="flex flex-col items-center gap-4 pt-6 text-center">
        <h1 className="font-hud text-2xl font-bold uppercase tracking-[0.2em] text-fg md:text-3xl">
          Mission <span className="text-accent">Control</span>
        </h1>
        <p className="flex items-center gap-2 text-sm text-muted">
          <ShieldCheck size={16} className="text-success" aria-hidden="true" />
          {live} tools online · processed on your device · nothing is uploaded
        </p>
        <label className="relative w-full max-w-2xl">
          <span className="sr-only">Search all tools</span>
          <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan" aria-hidden="true" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tools — json, jwt, sha256, base64, merge pdf…"
            className="hud-input h-12 pl-11 text-base shadow-[0_0_24px_rgb(var(--hud-cyan)/0.15)]"
          />
        </label>
      </section>

      {results ? (
        <section aria-label="Search results">
          <h2 className="mb-3 text-sm uppercase tracking-widest text-muted">{results.length} results</h2>
          {results.length ? <Grid items={results} /> : <p className="text-muted">No tools match “{q}”.</p>}
        </section>
      ) : (
        <>
          {favTools.length > 0 && (
            <section aria-labelledby="fav-h">
              <h2 id="fav-h" className="mb-3 flex items-center gap-2 text-sm uppercase tracking-widest text-muted">
                <Star size={15} className="text-accent" aria-hidden="true" /> Favourites
              </h2>
              <Grid items={favTools} />
            </section>
          )}
          {recentTools.length > 0 && (
            <section aria-labelledby="recent-h">
              <h2 id="recent-h" className="mb-3 flex items-center gap-2 text-sm uppercase tracking-widest text-muted">
                <History size={15} className="text-cyan" aria-hidden="true" /> Recent
              </h2>
              <Grid items={recentTools.slice(0, 4)} />
            </section>
          )}
          {modules.map((m) => (
            <section key={m.id} aria-labelledby={`m-${m.id}`}>
              <div className="mb-3 flex items-baseline gap-3">
                <h2 id={`m-${m.id}`} className="flex items-center gap-2 font-hud text-sm uppercase tracking-widest text-fg">
                  <m.icon size={16} className="text-cyan" aria-hidden="true" />
                  {m.name}
                </h2>
                <span className="hidden text-xs text-muted sm:inline">{m.blurb}</span>
                <Link to={`/module/${m.id}`} className="ml-auto text-xs text-cyan hover:underline">
                  View module
                </Link>
              </div>
              <Grid items={toolsInModule(m.id)} />
            </section>
          ))}
        </>
      )}
      <p className="sr-only">{appConfig.name}</p>
    </div>
  );
}
