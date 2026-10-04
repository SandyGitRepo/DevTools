import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { marked, type Token, type Tokens } from 'marked';
import DOMPurify from 'dompurify';
import MiniSearch from 'minisearch';
import { BookOpen, Check, Copy, Play, Printer, Search, UserRound, CalendarCheck, Tag } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import { parseSheet, tryTargets, type Sheet } from '../../lib/cheatsheets/parse';
import { handoff } from '../../state/handoff';
import { copyText } from '../../lib/files';
import { highlight } from './highlight';

// FR-H7: every Markdown file in content/cheatsheets/ becomes a sheet — no code change needed to add one.
const files = import.meta.glob('../../../content/cheatsheets/*.md', { query: '?raw', import: 'default', eager: true }) as Record<string, string>;

const SHEETS: Sheet[] = Object.entries(files)
  .map(([path, raw]) => parseSheet(path, raw))
  .sort((a, b) => a.title.localeCompare(b.title));

interface Doc {
  id: string;
  sheetId: string;
  sheetTitle: string;
  title: string;
  text: string;
}

function buildIndex() {
  const ms = new MiniSearch<Doc>({
    fields: ['title', 'text', 'sheetTitle'],
    storeFields: ['sheetId', 'sheetTitle', 'title'],
    searchOptions: { boost: { title: 3, sheetTitle: 2 }, prefix: true, fuzzy: 0.15, combineWith: 'AND' },
  });
  ms.addAll(SHEETS.flatMap((s) => s.cards.map((c) => ({ id: c.id, sheetId: s.id, sheetTitle: s.title, title: c.title, text: c.text }))));
  return ms;
}

function CodeBlock({ code, lang, tryable }: { code: string; lang: string; tryable: boolean }) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const target = tryable ? tryTargets[lang] : undefined;
  return (
    <div className="cs-code group relative">
      <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-80 group-hover:opacity-100 print:hidden">
        {target && (
          <button
            type="button"
            className="hud-btn hud-btn-accent px-2 py-0.5 text-[11px]"
            onClick={() => {
              handoff.set(target, code.trim());
              navigate(`/tool/${target}`);
            }}
            aria-label={`Try this ${lang} snippet in its tool`}
          >
            <Play size={12} aria-hidden="true" /> Try it
          </button>
        )}
        <button
          type="button"
          className="hud-btn px-2 py-0.5 text-[11px]"
          aria-label="Copy snippet"
          onClick={async () => {
            if (await copyText(code.trim())) {
              setCopied(true);
              setTimeout(() => setCopied(false), 1000);
            }
          }}
        >
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />} {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      {/* Focusable so keyboard users can scroll long lines (WCAG 2.1.1) */}
      <pre className={`language-${lang}`} tabIndex={0} aria-label={`${lang} code example`}>
        {/* Prism escapes the code; the result is sanitised to <span class> only */}
        <code dangerouslySetInnerHTML={{ __html: highlight(code.replace(/\n$/, ''), lang) }} />
      </pre>
    </div>
  );
}

/** Renders a card body: fenced code via CodeBlock, everything else via marked + DOMPurify. */
function CardBody({ md }: { md: string }) {
  const parts = useMemo(() => {
    const tokens = marked.lexer(md);
    const out: ({ kind: 'html'; html: string } | { kind: 'code'; code: string; lang: string; tryable: boolean })[] = [];
    let buffer: Token[] = [];
    const flush = () => {
      if (!buffer.length) return;
      const html = marked.parser(Object.assign(buffer, { links: {} }) as unknown as Parameters<typeof marked.parser>[0]);
      out.push({ kind: 'html', html: DOMPurify.sanitize(html, { FORBID_TAGS: ['style', 'form', 'input', 'iframe'], FORBID_ATTR: ['style'] }) });
      buffer = [];
    };
    for (const t of tokens) {
      if (t.type === 'code') {
        flush();
        const [lang = 'text', flag] = ((t as Tokens.Code).lang ?? '').split(/\s+/);
        out.push({ kind: 'code', code: (t as Tokens.Code).text, lang, tryable: flag === 'try' });
      } else buffer.push(t);
    }
    flush();
    return out;
  }, [md]);
  return (
    <>
      {parts.map((p, i) =>
        p.kind === 'html' ? <div key={i} className="md-preview cs-prose" dangerouslySetInnerHTML={{ __html: p.html }} /> : <CodeBlock key={i} {...p} />,
      )}
    </>
  );
}

export default function CheatSheetTool() {
  const [params, setParams] = useSearchParams();
  const index = useMemo(buildIndex, []);
  const [query, setQuery] = useState('');
  const sheetId = params.get('sheet') ?? SHEETS[0]?.id;
  const cardId = params.get('card');
  const sheet = SHEETS.find((s) => s.id === sheetId) ?? SHEETS[0];
  const cardRefs = useRef(new Map<string, HTMLElement>());

  const search = useMemo(() => {
    if (query.trim().length < 2) return null;
    const t0 = performance.now();
    const hits = index.search(query).slice(0, 30);
    return { hits, ms: performance.now() - t0 };
  }, [query, index]);

  // Jump to a card from search results or a deep link
  useEffect(() => {
    if (!cardId) return;
    const el = cardRefs.current.get(cardId);
    if (el) {
      el.scrollIntoView({ block: 'start', behavior: 'smooth' });
      el.focus({ preventScroll: true });
    }
  }, [cardId, sheetId]);

  const open = (id: string, card?: string) => {
    setQuery('');
    setParams(card ? { sheet: id, card } : { sheet: id });
  };

  if (!sheet) return <p className="text-muted">No cheat sheets found in content/cheatsheets/.</p>;

  return (
    <ToolShell
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>Search across every sheet (e.g. “list comprehension”, “git rebase”, “window function”) and jump straight to the card.</li>
          <li>
            <b>Try it</b> opens JSON, SQL, regex and cron snippets in the matching tool. <b>Print</b> gives an A4 layout you can save as PDF.
          </li>
          <li>
            Sheets are Markdown files in <code>content/cheatsheets/</code>; add or update one with a reviewed pull request — no code changes needed.
          </li>
        </ul>
      }
    >
      <div className="relative print:hidden">
        <label htmlFor="cs-search" className="sr-only">
          Search cheat sheets
        </label>
        <Search size={18} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-cyan" aria-hidden="true" />
        <input
          id="cs-search"
          className="hud-input h-11 pl-11 text-base"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${SHEETS.reduce((n, s) => n + s.cards.length, 0)} cards in ${SHEETS.length} sheets…`}
          autoComplete="off"
        />
        {search && (
          <div
            className="hud-panel absolute left-0 right-0 top-12 z-20 max-h-[60vh] overflow-auto bg-[var(--surface-strong)] p-1.5"
            role="listbox"
            aria-label="Search results"
          >
            <p className="px-2 py-1 text-[11px] text-muted" role="status">
              {search.hits.length} result{search.hits.length === 1 ? '' : 's'} in {search.ms.toFixed(1)} ms
            </p>
            {search.hits.map((h) => (
              <button
                key={h.id}
                type="button"
                role="option"
                aria-selected="false"
                className="flex w-full flex-col items-start rounded px-3 py-2 text-left hover:bg-primary/20 focus:bg-primary/20"
                onClick={() => open(h.sheetId as string, h.id as string)}
              >
                <span className="text-sm text-fg">{h.title as string}</span>
                <span className="text-xs text-muted">{h.sheetTitle as string}</span>
              </button>
            ))}
            {!search.hits.length && <p className="px-3 py-2 text-sm text-muted">No cards match “{query}”.</p>}
          </div>
        )}
      </div>

      <div className="grid gap-4 lg:grid-cols-[14rem_1fr]">
        <nav aria-label="Cheat sheets" className="print:hidden">
          <ul className="hud-panel space-y-0.5 p-2 lg:sticky lg:top-0">
            {SHEETS.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => open(s.id)}
                  aria-current={s.id === sheet.id ? 'page' : undefined}
                  className={`flex w-full items-center gap-2 rounded px-2.5 py-1.5 text-left text-sm ${
                    s.id === sheet.id ? 'bg-primary/25 text-fg shadow-[inset_2px_0_0_rgb(var(--hud-cyan))]' : 'text-muted hover:bg-primary/10 hover:text-fg'
                  }`}
                >
                  <BookOpen size={14} aria-hidden="true" /> {s.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>

        <article className="cs-sheet space-y-4" aria-labelledby="cs-title">
          <header className="hud-panel flex flex-wrap items-start gap-3 p-4">
            <div className="min-w-0 flex-1">
              <h2 id="cs-title" className="font-hud text-xl font-bold uppercase tracking-widest text-fg">
                {sheet.title}
              </h2>
              {sheet.intro && <p className="mt-1 text-sm text-muted">{sheet.intro}</p>}
              <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
                <span className="flex items-center gap-1">
                  <Tag size={12} aria-hidden="true" /> {sheet.version}
                </span>
                <span className="flex items-center gap-1">
                  <UserRound size={12} aria-hidden="true" /> Owner: {sheet.owner}
                </span>
                <span className="flex items-center gap-1">
                  <CalendarCheck size={12} aria-hidden="true" /> Reviewed {sheet.reviewed}
                </span>
              </p>
            </div>
            <button type="button" className="hud-btn print:hidden" onClick={() => window.print()}>
              <Printer size={15} aria-hidden="true" /> Print / PDF
            </button>
          </header>
          <div className="cs-cards grid gap-4 xl:grid-cols-2">
            {sheet.cards.map((c) => (
              <section
                key={c.id}
                id={c.id}
                tabIndex={-1}
                ref={(el) => {
                  if (el) cardRefs.current.set(c.id, el);
                }}
                className={`cs-card hud-panel min-w-0 space-y-2 p-4 outline-none ${c.id === cardId ? 'ring-2 ring-accent' : ''}`}
                aria-labelledby={`${c.id}-h`}
              >
                <h3 id={`${c.id}-h`} className="font-sans text-base font-semibold tracking-normal text-cyan">
                  {c.title}
                </h3>
                <CardBody md={c.body} />
              </section>
            ))}
          </div>
          {sheet.sources.length > 0 && (
            <p className="text-xs text-muted">References (offline — copy into a browser on an internet-connected device): {sheet.sources.join(' · ')}</p>
          )}
        </article>
      </div>
    </ToolShell>
  );
}
