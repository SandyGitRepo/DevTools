/** Prism (MIT) with only the grammars the cheat sheets use. Output is escaped by Prism and sanitised again. */
import Prism from 'prismjs';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-typescript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-sql';
import 'prismjs/components/prism-plsql';
import 'prismjs/components/prism-bash';
import 'prismjs/components/prism-docker';
import 'prismjs/components/prism-yaml';
import 'prismjs/components/prism-json';
import 'prismjs/components/prism-regex';
import 'prismjs/components/prism-http';
import 'prismjs/components/prism-apex';
import 'prismjs/components/prism-groovy';
import DOMPurify from 'dompurify';

const ALIASES: Record<string, string> = {
  sh: 'bash',
  shell: 'bash',
  dockerfile: 'docker',
  yml: 'yaml',
  xml: 'markup',
  html: 'markup',
  ts: 'typescript',
  js: 'javascript',
  gradle: 'groovy',
};

export function highlight(code: string, lang: string): string {
  const id = ALIASES[lang] ?? lang;
  const grammar = Prism.languages[id];
  const html = grammar ? Prism.highlight(code, grammar, id) : code.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]!);
  return DOMPurify.sanitize(html, { ALLOWED_TAGS: ['span'], ALLOWED_ATTR: ['class'] });
}
