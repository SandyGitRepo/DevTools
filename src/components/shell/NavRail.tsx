import { useEffect, useState } from 'react';
import { NavLink } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight, LayoutDashboard, Info } from 'lucide-react';
import { modules } from '../../registry/tools';
import { prefs, usePrefs } from '../../state/prefs';
import { appConfig } from '../../config/app.config';

const linkClass =
  (collapsed: boolean) =>
  ({ isActive }: { isActive: boolean }) =>
    [
      'group relative flex items-center gap-3 rounded px-2.5 py-2 text-sm transition-colors',
      collapsed ? 'justify-center' : '',
      isActive ? 'bg-primary/25 text-fg shadow-[inset_2px_0_0_rgb(var(--hud-cyan))]' : 'text-muted hover:bg-primary/10 hover:text-fg',
    ].join(' ');

function useNarrow() {
  const query = '(max-width: 1023px)';
  const [narrow, setNarrow] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const on = () => setNarrow(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return narrow;
}

export default function NavRail() {
  const { navCollapsed } = usePrefs();
  const narrow = useNarrow();
  // Tablet widths (UI-9) always use the icon rail so the workspace keeps its room
  const collapsed = navCollapsed || narrow;
  return (
    <nav
      aria-label="Modules"
      className={`no-print flex shrink-0 flex-col border-r border-primary/30 bg-[var(--surface-glass)] backdrop-blur-md transition-[width] duration-200 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      <NavLink to="/" className="flex h-14 items-center gap-2.5 border-b border-primary/30 px-3" aria-label={`${appConfig.name} home`}>
        <img src={appConfig.logoUrl} alt="" className="h-8 w-8 shrink-0" />
        {!collapsed && (
          <span className="font-hud text-base font-bold tracking-widest text-fg">
            Dev<span className="text-accent">Toolkit</span>
          </span>
        )}
      </NavLink>
      <div className="flex-1 space-y-1 overflow-y-auto p-2">
        <NavLink to="/" end className={linkClass(collapsed)} title="Mission control">
          <LayoutDashboard size={18} aria-hidden="true" />
          {!collapsed && <span>Mission Control</span>}
        </NavLink>
        <div className="my-2 border-t border-primary/20" />
        {modules.map((m) => (
          <NavLink key={m.id} to={`/module/${m.id}`} className={linkClass(collapsed)} title={m.name}>
            <m.icon size={18} aria-hidden="true" />
            {!collapsed && <span>{m.name}</span>}
            {collapsed && <span className="sr-only">{m.name}</span>}
          </NavLink>
        ))}
        <div className="my-2 border-t border-primary/20" />
        <NavLink to="/about" className={linkClass(collapsed)} title="About & privacy">
          <Info size={18} aria-hidden="true" />
          {!collapsed && <span>About & Privacy</span>}
        </NavLink>
      </div>
      {!narrow && (
        <button
          type="button"
          onClick={prefs.toggleNav}
          className="m-2 flex items-center justify-center gap-2 rounded p-2 text-muted hover:bg-primary/10 hover:text-fg"
          aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          aria-expanded={!collapsed}
        >
          {collapsed ? <ChevronsRight size={18} /> : <ChevronsLeft size={18} />}
          {!collapsed && <span className="text-xs">Collapse</span>}
        </button>
      )}
    </nav>
  );
}
