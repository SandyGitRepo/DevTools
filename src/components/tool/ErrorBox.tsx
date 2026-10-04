import { AlertCircle } from 'lucide-react';
import type { ToolError } from '../../lib/errors';

export default function ErrorBox({ error, className = '' }: { error: ToolError; className?: string }) {
  return (
    <div role="alert" className={`flex items-start gap-2 border-t border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger ${className}`}>
      <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" />
      <span>
        {error.line !== undefined && (
          <span className="mr-2 font-mono text-xs">
            Line {error.line}
            {error.column !== undefined ? `, col ${error.column}` : ''}
          </span>
        )}
        {error.message}
      </span>
    </div>
  );
}
