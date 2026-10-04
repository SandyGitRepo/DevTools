/** Client for the server-side PDF service (FR-P10, FR-P11). Only these tools ever send file content to the server. */
import { appConfig } from '../../config/app.config';

export interface PdfServiceHealth {
  available: boolean;
  qpdf: string | null;
}

export async function pdfServiceHealth(): Promise<PdfServiceHealth> {
  try {
    const r = await fetch(`${appConfig.apiBase}/health`, { cache: 'no-store' });
    if (!r.ok) return { available: false, qpdf: null };
    const j = (await r.json()) as { pdfService?: boolean; qpdf?: string };
    return { available: !!j.pdfService, qpdf: j.qpdf ?? null };
  } catch {
    // Opened from a static host without the API, or offline
    return { available: false, qpdf: null };
  }
}

export interface ServerResult {
  bytes: Uint8Array;
  originalSize: number;
  noGain: boolean;
}

export async function callPdfService(op: 'protect' | 'unlock' | 'compress', pdf: Uint8Array, options: Record<string, unknown> = {}): Promise<ServerResult> {
  const json = new TextEncoder().encode(JSON.stringify(options));
  const head = new Uint8Array(4);
  new DataView(head.buffer).setUint32(0, json.length);
  const body = new Blob([head, json, pdf as BlobPart], { type: 'application/octet-stream' });
  let r: Response;
  try {
    r = await fetch(`${appConfig.apiBase}/pdf/${op}`, { method: 'POST', body, cache: 'no-store', credentials: 'omit' });
  } catch {
    throw new Error('Could not reach the DevToolkit server. Check your network connection.');
  }
  if (!r.ok) {
    let msg = `Server error (${r.status})`;
    try {
      msg = ((await r.json()) as { error?: string }).error ?? msg;
    } catch {
      /* non-JSON error */
    }
    throw new Error(msg);
  }
  return {
    bytes: new Uint8Array(await r.arrayBuffer()),
    originalSize: Number(r.headers.get('X-Original-Size') || pdf.length),
    noGain: r.headers.get('X-No-Gain') === '1',
  };
}
