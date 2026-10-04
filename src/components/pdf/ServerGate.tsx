import { useEffect, useState, type ReactNode } from 'react';
import { ServerOff } from 'lucide-react';
import Loader from '../ui/Loader';
import { pdfServiceHealth, type PdfServiceHealth } from '../../lib/pdf/serverApi';

/** Renders children only when the server-side PDF service is reachable; otherwise explains why. */
export default function ServerGate({ children }: { children: ReactNode }) {
  const [health, setHealth] = useState<PdfServiceHealth | null>(null);
  useEffect(() => {
    void pdfServiceHealth().then(setHealth);
  }, []);
  if (!health)
    return (
      <p className="flex items-center gap-2 text-sm text-muted">
        <Loader /> Checking the PDF service…
      </p>
    );
  if (!health.available)
    return (
      <div className="hud-panel flex items-start gap-3 p-5 text-sm">
        <ServerOff size={22} className="shrink-0 text-warn" aria-hidden="true" />
        <div className="space-y-1">
          <p className="font-medium text-fg">The server-side PDF service is not available.</p>
          <p className="text-muted">
            This tool needs qpdf 11.7+ on the DevToolkit server. Ask your administrator to install it (it is included in the Docker image), or set{' '}
            <code className="font-mono text-cyan">QPDF_PATH</code> to its location and restart. All other PDF tools work without it.
          </p>
        </div>
      </div>
    );
  return <>{children}</>;
}
