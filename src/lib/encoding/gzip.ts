import { Gunzip, Inflate, Unzlib, gzipSync, deflateSync, zlibSync } from 'fflate';

export type CompressionFormat = 'gzip' | 'zlib' | 'deflate';

export function compress(data: Uint8Array, format: CompressionFormat, level: 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 = 6): Uint8Array {
  if (format === 'gzip') return gzipSync(data, { level });
  if (format === 'zlib') return zlibSync(data, { level });
  return deflateSync(data, { level });
}

export function detectFormat(b: Uint8Array): CompressionFormat {
  if (b[0] === 0x1f && b[1] === 0x8b) return 'gzip';
  if ((b[0] & 0x0f) === 8 && ((b[0] << 8) | b[1]) % 31 === 0) return 'zlib';
  return 'deflate';
}

export class DecompressionBombError extends Error {}

/**
 * Streaming decompression with a bomb guard (SEC-4). Stops as soon as the output passes the cap,
 * so a malicious payload never fully expands in memory. The cap is the larger of 10x the input or
 * `floorBytes` (so small legitimate payloads with high ratios still work), and never above `maxBytes`.
 */
export function decompress(
  data: Uint8Array,
  format: CompressionFormat | 'auto' = 'auto',
  limits: { ratio?: number; floorBytes?: number; maxBytes?: number } = {},
): Uint8Array {
  const { ratio = 10, floorBytes = 10 * 1024 * 1024, maxBytes = 200 * 1024 * 1024 } = limits;
  const cap = Math.min(maxBytes, Math.max(data.length * ratio, floorBytes));
  const fmt = format === 'auto' ? detectFormat(data) : format;
  const chunks: Uint8Array[] = [];
  let total = 0;
  let aborted = false;
  const ondata = (chunk: Uint8Array) => {
    if (aborted) return;
    total += chunk.length;
    if (total > cap) {
      aborted = true;
      return;
    }
    chunks.push(chunk);
  };
  const stream = fmt === 'gzip' ? new Gunzip(ondata) : fmt === 'zlib' ? new Unzlib(ondata) : new Inflate(ondata);
  // The cap is only checked between pushes and deflate expands up to ~1032x, so size each push to keep
  // the overshoot within about one cap. A 64 KB push could otherwise inflate ~64 MB past a 1 MB cap.
  const step = Math.min(64 * 1024, Math.max(1024, Math.floor(cap / 1032)));
  try {
    for (let i = 0; i < data.length && !aborted; i += step) {
      stream.push(data.subarray(i, i + step), i + step >= data.length);
    }
  } catch (e) {
    throw new Error(`Not valid ${fmt} data (${e instanceof Error ? e.message : 'corrupt stream'})`, { cause: e });
  }
  if (aborted) {
    throw new DecompressionBombError(`Stopped: output exceeded ${Math.round(cap / 1048576)} MB (possible decompression bomb)`);
  }
  if (!chunks.length && data.length) throw new Error(`Not valid ${fmt} data, or the stream is truncated`);
  const out = new Uint8Array(total);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}
