/// <reference lib="webworker" />
/** Runs regexes off the main thread; the UI terminates this worker after 5 s (ReDoS guard, A04). */
import { runRegex } from '../lib/utils/regex';

self.onmessage = (e: MessageEvent<{ id: number; pattern: string; flags: string; text: string; replacement?: string }>) => {
  const { id, pattern, flags, text, replacement } = e.data;
  try {
    self.postMessage({ id, result: runRegex(pattern, flags, text, replacement) });
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
