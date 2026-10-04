/**
 * FR-H7 content as code: each cheat sheet is a Markdown file in content/cheatsheets/ with YAML
 * front matter. "## Heading" starts a card. Fenced code blocks may add `try` after the language
 * (```json try) to get a "Try it" button that opens the matching tool (FR-H6).
 */
import { load as yamlLoad } from 'js-yaml';

export interface SheetMeta {
  id: string;
  title: string;
  owner: string;
  reviewed: string;
  version: string;
  icon?: string;
  tags: string[];
  sources: string[];
}

export interface Card {
  id: string;
  title: string;
  /** Markdown body (bullets, prose and fenced code). */
  body: string;
  /** Plain text for search. */
  text: string;
}

export interface Sheet extends SheetMeta {
  intro: string;
  cards: Card[];
}

const slug = (s: string) =>
  s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

export function parseSheet(fileName: string, raw: string): Sheet {
  const src = raw.replace(/\r\n/g, '\n');
  const fm = src.match(/^---\n([\s\S]*?)\n---\n/);
  if (!fm) throw new Error(`${fileName}: missing front matter (--- title: … ---)`);
  const meta = (yamlLoad(fm[1]) ?? {}) as Partial<SheetMeta> & { reviewed?: string | Date };
  for (const k of ['title', 'owner', 'reviewed', 'version'] as const) {
    if (!meta[k]) throw new Error(`${fileName}: front matter needs "${k}"`);
  }
  const id = slug(fileName.replace(/^.*[\\/]/, '').replace(/\.md$/, ''));
  const body = src.slice(fm[0].length);
  const parts = body.split(/^## +/m);
  const intro = parts.shift()?.trim() ?? '';
  const cards = parts.map((p) => {
    const nl = p.indexOf('\n');
    const title = (nl < 0 ? p : p.slice(0, nl)).trim();
    const md = nl < 0 ? '' : p.slice(nl + 1).trim();
    return {
      id: `${id}--${slug(title)}`,
      title,
      body: md,
      // Strip Markdown syntax but keep characters that matter in commands (e.g. the "-" in "git switch -c")
      text: `${title} ${md
        .replace(/```[a-z]*( try)?/g, ' ')
        .replace(/^\s*(?:[-*+]|\d+\.)\s+/gm, ' ')
        .replace(/[*_`#>|]/g, ' ')}`.replace(/\s+/g, ' '),
    };
  });
  return {
    id,
    title: meta.title!,
    owner: meta.owner!,
    // js-yaml turns unquoted dates into Date objects
    reviewed: (meta.reviewed as unknown) instanceof Date ? (meta.reviewed as unknown as Date).toISOString().slice(0, 10) : String(meta.reviewed),
    version: String(meta.version),
    icon: meta.icon,
    tags: meta.tags ?? [],
    sources: meta.sources ?? [],
    intro,
    cards,
  };
}

/** Which tool a "Try it" snippet opens, by code-fence language. */
export const tryTargets: Record<string, string> = {
  json: 'json',
  sql: 'sql',
  regex: 'regex',
  base64: 'base64',
  yaml: 'yaml-md',
  xml: 'xml',
  cron: 'cron',
  jwt: 'jwt',
};
