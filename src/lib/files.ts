import { appConfig } from '../config/app.config';

export class InputTooLargeError extends Error {}

const fmt = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.ceil(n / 1024)} KB`);
export const formatBytes = (n: number) => (n < 1024 ? `${n} B` : fmt(n));

export async function readFileAsText(file: File, maxBytes: number = appConfig.limits.maxTextBytes): Promise<string> {
  if (file.size > maxBytes) throw new InputTooLargeError(`${file.name} is ${fmt(file.size)}; the limit is ${fmt(maxBytes)}.`);
  return file.text();
}

export async function readFileAsBytes(file: File, maxBytes: number): Promise<Uint8Array> {
  if (file.size > maxBytes) throw new InputTooLargeError(`${file.name} is ${fmt(file.size)}; the limit is ${fmt(maxBytes)}.`);
  return new Uint8Array(await file.arrayBuffer());
}

export function downloadBlob(data: Blob | string | Uint8Array, filename: string, type = 'text/plain;charset=utf-8') {
  const blob = data instanceof Blob ? data : new Blob([data as BlobPart], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for non-secure contexts (plain http on the intranet)
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
