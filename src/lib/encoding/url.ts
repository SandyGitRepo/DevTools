export type UrlMode = 'component' | 'full';

export function urlEncode(s: string, mode: UrlMode, spaceAsPlus = false): string {
  const out = mode === 'component' ? encodeURIComponent(s) : encodeURI(s);
  return spaceAsPlus ? out.replace(/%20/g, '+') : out;
}

export function urlDecode(s: string, mode: UrlMode, plusAsSpace = true): string {
  const input = plusAsSpace ? s.replace(/\+/g, ' ') : s;
  try {
    return mode === 'component' ? decodeURIComponent(input) : decodeURI(input);
  } catch {
    const bad = input.match(/%(?![0-9a-fA-F]{2})|%[0-9a-fA-F]{2}/g);
    throw new Error(`Malformed percent-encoding${bad ? ` near “${bad[0]}”` : ''} — check for a stray % or an incomplete UTF-8 sequence`);
  }
}

export interface ParsedUrl {
  parts: [string, string][];
  params: [string, string][];
}

export function parseUrl(s: string): ParsedUrl {
  let url: URL;
  try {
    url = new URL(s.trim());
  } catch {
    throw new Error('Not an absolute URL (it needs a scheme such as https://)');
  }
  return {
    parts: [
      ['Protocol', url.protocol],
      ['Username', url.username],
      ['Password', url.password ? '•'.repeat(url.password.length) : ''],
      ['Host', url.hostname],
      ['Port', url.port],
      ['Path', decodeURIComponentSafe(url.pathname)],
      ['Query', url.search],
      ['Fragment', url.hash],
      ['Origin', url.origin],
    ].filter(([, v]) => v) as [string, string][],
    params: Array.from(url.searchParams.entries()),
  };
}

function decodeURIComponentSafe(s: string) {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}
