/** Lightweight input sniffing for FR-C3. Returns the tool that best fits the text, if confident. */
export interface Detection {
  toolId: string;
  label: string;
}

export function detectInput(text: string): Detection | null {
  const s = text.trim();
  if (s.length < 4) return null;
  if (/^-----BEGIN (CERTIFICATE|CERTIFICATE REQUEST|NEW CERTIFICATE REQUEST)-----/.test(s)) return { toolId: 'cert', label: 'a PEM certificate' };
  if (/^eyJ[\w-]+\.eyJ[\w-]+\.[\w-]*$/.test(s)) return { toolId: 'jwt', label: 'a JWT' };
  if (/^[{[]/.test(s)) {
    try {
      JSON.parse(s);
      return { toolId: 'json', label: 'JSON' };
    } catch {
      /* not JSON */
    }
  }
  if (/^<\?xml|^<([a-zA-Z_][\w:.-]*)[\s>][\s\S]*<\/\1>$/.test(s)) {
    if (/^<!doctype html|^<html/i.test(s)) return { toolId: 'html-css', label: 'HTML' };
    return { toolId: 'xml', label: 'XML' };
  }
  if (/^\s*(select|insert|update|delete|create|alter|with|merge)\s/i.test(s) && /\b(from|into|table|set|values)\b/i.test(s))
    return { toolId: 'sql', label: 'SQL' };
  if (/^(package |import java\.|public (final )?(class|interface|enum|record) )/m.test(s)) return { toolId: 'java', label: 'Java' };
  if (/^H4sI[A-Za-z0-9+/=]+$/.test(s)) return { toolId: 'gzip', label: 'Gzip data in Base64' };
  if (s.length >= 16 && s.length % 4 === 0 && /^[A-Za-z0-9+/]+={0,2}$/.test(s) && /[A-Z]/.test(s) && /[a-z]/.test(s))
    return { toolId: 'base64', label: 'Base64' };
  if (/%[0-9A-Fa-f]{2}/.test(s) && !/\s/.test(s)) return { toolId: 'url', label: 'URL-encoded text' };
  if (/^[\w-]+:\s.+(\n[\w-]+:\s.*|\n\s+- .*)+/m.test(s) && !s.includes('{')) return { toolId: 'yaml-md', label: 'YAML' };
  return null;
}
