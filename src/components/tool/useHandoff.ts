import { useEffect } from 'react';
import { handoff } from '../../state/handoff';
import { useToolMeta } from './ToolContext';

/** Pre-loads text passed from another tool or a cheat sheet, once, on mount. */
export function useHandoff(apply: (text: string) => void) {
  const { id } = useToolMeta();
  useEffect(() => {
    const text = handoff.take(id);
    if (text !== undefined) apply(text);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
}
