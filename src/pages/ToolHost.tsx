import { Component, Suspense, lazy, useEffect, useMemo, type ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Construction, AlertTriangle } from 'lucide-react';
import { toolById, type ToolMeta } from '../registry/tools';
import { prefs } from '../state/prefs';
import { ToolContext } from '../components/tool/ToolContext';
import Loader from '../components/ui/Loader';
import NotFound from './NotFound';

/** Keeps a crashing tool from taking down the page (FR-C4). */
class ToolErrorBoundary extends Component<{ children: ReactNode; toolName: string }, { error: Error | null }> {
  state = { error: null as Error | null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    if (this.state.error) {
      return (
        <div className="hud-panel mx-auto mt-10 max-w-xl p-6 text-center">
          <AlertTriangle className="mx-auto mb-3 text-danger" size={32} aria-hidden="true" />
          <h2 className="mb-2 text-lg">{this.props.toolName} hit an unexpected error</h2>
          <p className="mb-4 text-sm text-muted">The rest of DevToolkit is unaffected. Reload the tool to continue.</p>
          <button type="button" className="hud-btn" onClick={() => this.setState({ error: null })}>
            Reload tool
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const lazyCache = new Map<string, ReturnType<typeof lazy>>();
function getLazy(tool: ToolMeta) {
  if (!lazyCache.has(tool.id)) lazyCache.set(tool.id, lazy(tool.load!));
  return lazyCache.get(tool.id)!;
}

export default function ToolHost() {
  const { toolId } = useParams();
  const tool = toolById(toolId);

  useEffect(() => {
    if (tool) {
      prefs.pushRecent(tool.id);
      document.title = `${tool.name} · DevToolkit`;
    }
    return () => {
      document.title = 'DevToolkit';
    };
  }, [tool]);

  const LazyTool = useMemo(() => (tool?.load ? getLazy(tool) : null), [tool]);

  if (!tool) return <NotFound />;

  if (!LazyTool) {
    return (
      <div className="hud-panel mx-auto mt-10 max-w-xl p-8 text-center">
        <Construction className="mx-auto mb-3 text-warn" size={36} aria-hidden="true" />
        <h1 className="mb-2 font-hud text-lg uppercase tracking-widest">{tool.name}</h1>
        <p className="mb-1 text-sm text-muted">{tool.description}</p>
        <p className="mb-5 text-sm text-muted">
          Scheduled for <span className="text-warn">Phase {tool.phase}</span> ({tool.frId}).
        </p>
        <Link to="/" className="hud-btn">
          Back to Mission Control
        </Link>
      </div>
    );
  }

  return (
    <ToolContext.Provider value={tool}>
      <ToolErrorBoundary key={tool.id} toolName={tool.name}>
        <Suspense
          fallback={
            <div className="flex h-64 items-center justify-center gap-3 text-muted">
              <Loader /> Loading {tool.name}…
            </div>
          }
        >
          <LazyTool />
        </Suspense>
      </ToolErrorBoundary>
    </ToolContext.Provider>
  );
}
