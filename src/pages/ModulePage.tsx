import { useParams } from 'react-router-dom';
import { moduleById, toolsInModule } from '../registry/tools';
import ToolTile from '../components/shell/ToolTile';
import NotFound from './NotFound';

export default function ModulePage() {
  const { moduleId } = useParams();
  const mod = moduleById(moduleId);
  if (!mod) return <NotFound />;
  return (
    <div className="mx-auto max-w-[1600px] space-y-5">
      <header className="flex items-center gap-3">
        <mod.icon size={26} className="text-cyan" aria-hidden="true" />
        <div>
          <h1 className="font-hud text-xl font-bold uppercase tracking-widest">{mod.name}</h1>
          <p className="text-sm text-muted">{mod.blurb}</p>
        </div>
      </header>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
        {toolsInModule(mod.id).map((t) => (
          <ToolTile key={t.id} tool={t} />
        ))}
      </div>
    </div>
  );
}
