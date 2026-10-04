import './monacoSetup';
import { useEffect, useRef } from 'react';
import Editor, { DiffEditor, type OnMount } from '@monaco-editor/react';
import { monaco } from './monacoSetup';
import { usePrefs } from '../../state/prefs';
import Loader from '../ui/Loader';
import type { ToolError } from '../../lib/errors';

export interface CodeEditorProps {
  value: string;
  onChange?: (v: string) => void;
  language?: string;
  readOnly?: boolean;
  ariaLabel: string;
  height?: string;
  error?: ToolError | null;
  wordWrap?: boolean;
}

const baseOptions: monaco.editor.IStandaloneEditorConstructionOptions = {
  minimap: { enabled: false },
  fontFamily: '"JetBrains Mono", Consolas, monospace',
  fontSize: 13,
  automaticLayout: true,
  scrollBeyondLastLine: false,
  tabSize: 2,
  renderWhitespace: 'selection',
  smoothScrolling: true,
  padding: { top: 8, bottom: 8 },
  fixedOverflowWidgets: true,
  // Large inputs: keep the editor responsive.
  largeFileOptimizations: true,
  maxTokenizationLineLength: 20000,
};

export default function CodeEditor({ value, onChange, language = 'plaintext', readOnly, ariaLabel, height = '100%', error, wordWrap = true }: CodeEditorProps) {
  const { theme, reduceMotion } = usePrefs();
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null);

  const onMount: OnMount = (editor) => {
    editorRef.current = editor;
  };

  // Show the error position as a squiggle (FR-C4)
  useEffect(() => {
    const model = editorRef.current?.getModel();
    if (!model) return;
    if (error?.line) {
      const line = Math.min(error.line, model.getLineCount());
      const col = Math.max(1, error.column ?? 1);
      monaco.editor.setModelMarkers(model, 'devtoolkit', [
        { severity: monaco.MarkerSeverity.Error, message: error.message, startLineNumber: line, startColumn: col, endLineNumber: line, endColumn: col + 1 },
      ]);
      editorRef.current?.revealLineInCenterIfOutsideViewport(line);
    } else {
      monaco.editor.setModelMarkers(model, 'devtoolkit', []);
    }
  }, [error, value]);

  return (
    <Editor
      height={height}
      language={language}
      value={value}
      theme={theme === 'dark' ? 'hud-dark' : 'hud-light'}
      onChange={(v) => onChange?.(v ?? '')}
      onMount={onMount}
      loading={<Loader label="Loading editor" />}
      options={{
        ...baseOptions,
        readOnly,
        wordWrap: wordWrap ? 'on' : 'off',
        ariaLabel,
        smoothScrolling: !reduceMotion,
        cursorBlinking: reduceMotion ? 'solid' : 'smooth',
        domReadOnly: readOnly,
      }}
    />
  );
}

export function CodeDiffEditor({
  original,
  modified,
  language = 'plaintext',
  inline,
}: {
  original: string;
  modified: string;
  language?: string;
  inline: boolean;
}) {
  const { theme } = usePrefs();
  const diffRef = useRef<monaco.editor.IStandaloneDiffEditor | null>(null);

  // @monaco-editor/react disposes the models before the diff widget on unmount, which throws.
  // Keep the models, let the widget dispose first, then free the models ourselves.
  useEffect(
    () => () => {
      const models = diffRef.current?.getModel();
      setTimeout(() => {
        models?.original.dispose();
        models?.modified.dispose();
      }, 0);
    },
    [],
  );

  return (
    <DiffEditor
      height="100%"
      original={original}
      modified={modified}
      language={language}
      keepCurrentOriginalModel
      keepCurrentModifiedModel
      onMount={(editor) => {
        diffRef.current = editor;
      }}
      theme={theme === 'dark' ? 'hud-dark' : 'hud-light'}
      loading={<Loader label="Loading diff" />}
      options={{ ...baseOptions, renderSideBySide: !inline, readOnly: true, originalEditable: false, wordWrap: 'on' }}
    />
  );
}
