/**
 * One-shot, in-memory hand-off of text into a tool (e.g. cheat sheet "Try it", FR-H6, or the
 * auto-detect suggestion, FR-C3). Never persisted; consumed on first read.
 */
const pending = new Map<string, string>();

export const handoff = {
  set(toolId: string, text: string) {
    pending.set(toolId, text);
  },
  take(toolId: string): string | undefined {
    const v = pending.get(toolId);
    pending.delete(toolId);
    return v;
  },
};
