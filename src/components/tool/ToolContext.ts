import { createContext, useContext } from 'react';
import type { ToolMeta } from '../../registry/tools';

export const ToolContext = createContext<ToolMeta | null>(null);

export function useToolMeta(): ToolMeta {
  const meta = useContext(ToolContext);
  if (!meta) throw new Error('useToolMeta must be used inside a tool route');
  return meta;
}
