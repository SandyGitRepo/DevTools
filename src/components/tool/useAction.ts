import { useCallback, useState } from 'react';
import { toToolError, type ToolError } from '../../lib/errors';
import type { Status } from './StatusLine';

/** Runs a (possibly async) tool action with busy, error and status handling; never throws (FR-C4). */
export function useAction() {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ToolError | null>(null);
  const [status, setStatus] = useState<Status>(null);

  const run = useCallback(async <T>(fn: () => T | Promise<T>, opts: { source?: string; success?: string | ((r: T) => string) } = {}) => {
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const r = await fn();
      if (opts.success) setStatus({ kind: 'success', text: typeof opts.success === 'function' ? opts.success(r) : opts.success });
      return r;
    } catch (e) {
      setError(toToolError(e, opts.source));
      return undefined;
    } finally {
      setBusy(false);
    }
  }, []);

  const reset = useCallback(() => {
    setError(null);
    setStatus(null);
  }, []);

  return { busy, error, status, run, reset, setError, setStatus };
}
