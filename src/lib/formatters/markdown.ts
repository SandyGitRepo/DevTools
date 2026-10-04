import { marked } from 'marked';
import DOMPurify from 'dompurify';

/** Renders Markdown to sanitised HTML for preview only (A03: DOMPurify on every preview). */
export function renderMarkdown(md: string): string {
  const html = marked.parse(md, { async: false, gfm: true, breaks: false }) as string;
  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ['style', 'form', 'input', 'button', 'iframe', 'object', 'embed'],
    FORBID_ATTR: ['style'],
  });
}
