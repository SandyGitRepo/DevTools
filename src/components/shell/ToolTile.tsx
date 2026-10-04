import { Link } from 'react-router-dom';
import { Server, Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { moduleById, type ToolMeta } from '../../registry/tools';
import { prefs, usePrefs } from '../../state/prefs';

export default function ToolTile({ tool }: { tool: ToolMeta }) {
  const { favourites, reduceMotion } = usePrefs();
  const mod = moduleById(tool.module)!;
  const fav = favourites.includes(tool.id);
  const planned = !tool.load;

  return (
    <motion.div whileHover={reduceMotion ? undefined : { y: -2 }} transition={{ duration: 0.15 }} className="relative">
      <Link
        to={`/tool/${tool.id}`}
        className={`hud-panel group flex h-full flex-col gap-1.5 p-3.5 pr-9 transition-shadow hover:shadow-[0_0_18px_rgb(var(--hud-cyan)/0.3)] ${
          planned ? 'opacity-60' : ''
        }`}
      >
        <div className="flex items-center gap-2">
          <mod.icon size={16} className="shrink-0 text-cyan" aria-hidden="true" />
          <span className="text-sm font-semibold text-fg">{tool.name}</span>
        </div>
        <p className="line-clamp-2 text-xs leading-snug text-muted">{tool.description}</p>
        <div className="mt-auto flex items-center gap-2 pt-1 font-mono text-[10px] uppercase tracking-wider text-muted">
          <span>{tool.frId}</span>
          {tool.runsOn === 'server' && (
            <span className="flex items-center gap-1 text-warn">
              <Server size={10} aria-hidden="true" /> server
            </span>
          )}
          {planned && <span className="text-warn">Phase {tool.phase}</span>}
        </div>
      </Link>
      <button
        type="button"
        onClick={() => prefs.toggleFavourite(tool.id)}
        className="absolute right-2 top-2.5 rounded p-1 text-muted hover:text-accent"
        aria-label={fav ? `Remove ${tool.name} from favourites` : `Add ${tool.name} to favourites`}
        aria-pressed={fav}
      >
        <Star size={15} className={fav ? 'fill-accent text-accent' : ''} />
      </button>
    </motion.div>
  );
}
