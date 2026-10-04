/**
 * Bundles Monaco locally. @monaco-editor/react defaults to a CDN loader, which is forbidden here
 * (no external assets at runtime), so we hand it the bundled instance and local workers.
 */
import * as monaco from 'monaco-editor';
import { loader } from '@monaco-editor/react';
import EditorWorker from 'monaco-editor/editor/editor.worker.js?worker';
import JsonWorker from 'monaco-editor/language/json/json.worker.js?worker';
import CssWorker from 'monaco-editor/language/css/css.worker.js?worker';
import HtmlWorker from 'monaco-editor/language/html/html.worker.js?worker';
import TsWorker from 'monaco-editor/language/typescript/ts.worker.js?worker';

self.MonacoEnvironment = {
  getWorker(_id: string, label: string) {
    switch (label) {
      case 'json':
        return new JsonWorker();
      case 'css':
      case 'scss':
      case 'less':
        return new CssWorker();
      case 'html':
      case 'handlebars':
      case 'razor':
        return new HtmlWorker();
      case 'typescript':
      case 'javascript':
        return new TsWorker();
      default:
        return new EditorWorker();
    }
  },
};

const base = {
  'editor.lineHighlightBackground': '#00305a55',
  'editorLineNumber.foreground': '#4a6a8c',
  'editorLineNumber.activeForeground': '#3FB6FF',
  'editorCursor.foreground': '#F37021',
};

monaco.editor.defineTheme('hud-dark', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'string', foreground: '7FD8FF' },
    { token: 'string.key.json', foreground: '3FB6FF' },
    { token: 'string.value.json', foreground: 'A8E6CF' },
    { token: 'keyword', foreground: 'F37021' },
    { token: 'number', foreground: 'FFC44D' },
    { token: 'comment', foreground: '6A8AAA', fontStyle: 'italic' },
  ],
  colors: {
    ...base,
    'editor.background': '#00142acc',
    'editorGutter.background': '#00142a00',
    'editor.selectionBackground': '#0072BC66',
    'editorWidget.background': '#001A33',
    'editorWidget.border': '#0072BC',
  },
});

monaco.editor.defineTheme('hud-light', {
  base: 'vs',
  inherit: true,
  // Token colours chosen for ≥ 4.5:1 contrast on both white and the highlighted line (WCAG 1.4.3)
  rules: [
    { token: 'keyword', foreground: 'B24A00' },
    { token: 'number', foreground: '0B6B45' },
    { token: 'comment', foreground: '3D6B40', fontStyle: 'italic' },
    { token: 'string', foreground: '9A1C1C' },
    { token: 'string.key.json', foreground: '00508A' },
    { token: 'string.value.json', foreground: '9A1C1C' },
  ],
  colors: {
    'editor.background': '#FFFFFF',
    'editor.lineHighlightBackground': '#E6F0FA',
    'editorCursor.foreground': '#F37021',
  },
});

// Diagnostics for JS/TS without project context would be noisy; keep syntax errors only.
type TsDefaults = { setDiagnosticsOptions?: (o: { noSemanticValidation: boolean; noSyntaxValidation: boolean }) => void };
const tsLang = (monaco.languages as unknown as { typescript?: { typescriptDefaults?: TsDefaults; javascriptDefaults?: TsDefaults } }).typescript;
if (tsLang) {
  for (const d of [tsLang.typescriptDefaults, tsLang.javascriptDefaults]) {
    d?.setDiagnosticsOptions?.({ noSemanticValidation: true, noSyntaxValidation: false });
  }
}

loader.config({ monaco });

export { monaco };
