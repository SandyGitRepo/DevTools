import { format, type SqlLanguage, type KeywordCase } from 'sql-formatter';

export const dialects = [
  { value: 'plsql', label: 'Oracle PL/SQL' },
  { value: 'postgresql', label: 'PostgreSQL' },
  { value: 'mysql', label: 'MySQL' },
  { value: 'mariadb', label: 'MariaDB' },
  { value: 'transactsql', label: 'T-SQL (SQL Server)' },
  { value: 'sql', label: 'Standard SQL' },
] as const;
export type Dialect = (typeof dialects)[number]['value'];

export function formatSql(text: string, dialect: Dialect, keywordCase: KeywordCase = 'upper', tabWidth = 2): string {
  return format(text, { language: dialect as SqlLanguage, keywordCase, tabWidth, linesBetweenQueries: 1 });
}

/**
 * Minifies SQL: drops comments and collapses whitespace without touching string literals or
 * quoted identifiers ('...', "...", `...`, [...]).
 */
export function minifySql(text: string): string {
  let out = '';
  let i = 0;
  let pendingSpace = false;
  const n = text.length;
  const push = (s: string) => {
    if (pendingSpace && out && !/[\s(,;]$/.test(out) && !/^[),;]/.test(s)) out += ' ';
    pendingSpace = false;
    out += s;
  };
  while (i < n) {
    const c = text[i];
    const next = text[i + 1];
    if (c === '-' && next === '-') {
      while (i < n && text[i] !== '\n') i++;
      pendingSpace = true;
    } else if (c === '/' && next === '*') {
      const end = text.indexOf('*/', i + 2);
      if (end < 0) throw new Error('Unterminated /* comment */');
      i = end + 2;
      pendingSpace = true;
    } else if (c === "'" || c === '"' || c === '`' || c === '[') {
      const close = c === '[' ? ']' : c;
      let j = i + 1;
      while (j < n) {
        if (text[j] === close) {
          if (text[j + 1] === close && c !== '[')
            j += 2; // doubled-quote escape
          else break;
        } else j++;
      }
      if (j >= n) throw new Error(`Unterminated ${c === "'" ? 'string literal' : 'quoted identifier'}`);
      push(text.slice(i, j + 1));
      i = j + 1;
    } else if (/\s/.test(c)) {
      pendingSpace = true;
      i++;
    } else {
      let j = i;
      while (j < n && !/[\s'"`[]/.test(text[j]) && !(text[j] === '-' && text[j + 1] === '-') && !(text[j] === '/' && text[j + 1] === '*')) j++;
      push(text.slice(i, j));
      i = j;
    }
  }
  return out.trim();
}
