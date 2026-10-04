/// <reference lib="webworker" />
/**
 * Runs pdf-lib operations off the main thread so large PDFs never freeze the page (section 9 risk).
 * Protocol: { id, op, args } → { id, result } | { id, error }.
 */
import * as ops from '../lib/pdf/ops';

type OpName =
  | 'organize'
  | 'merge'
  | 'split'
  | 'insertPages'
  | 'imagesToPdf'
  | 'watermark'
  | 'addPageNumbers'
  | 'readMeta'
  | 'writeMeta'
  | 'zipFiles'
  | 'makeSample'
  | 'clean';

const table: Record<OpName, (...a: never[]) => unknown> = {
  organize: ops.organize,
  merge: ops.merge,
  split: ops.split,
  insertPages: ops.insertPages,
  imagesToPdf: ops.imagesToPdf,
  watermark: ops.watermark,
  addPageNumbers: ops.addPageNumbers,
  readMeta: ops.readMeta,
  writeMeta: ops.writeMeta,
  zipFiles: ops.zipFiles,
  makeSample: ops.makeSample,
  clean: ops.clean,
};

/** Collects ArrayBuffers in the result so they are transferred, not copied. */
function transferables(v: unknown, out: Transferable[] = []): Transferable[] {
  if (v instanceof Uint8Array) out.push(v.buffer as ArrayBuffer);
  else if (Array.isArray(v)) v.forEach((x) => transferables(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => transferables(x, out));
  return out;
}

self.onmessage = async (e: MessageEvent<{ id: number; op: OpName; args: unknown[] }>) => {
  const { id, op, args } = e.data;
  try {
    const fn = table[op];
    if (!fn) throw new Error(`Unknown operation ${op}`);
    const result = await (fn as (...a: unknown[]) => unknown)(...args);
    (self as unknown as DedicatedWorkerGlobalScope).postMessage({ id, result }, transferables(result));
  } catch (err) {
    self.postMessage({ id, error: err instanceof Error ? err.message : String(err) });
  }
};
