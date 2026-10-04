import { useRef, useState, type ReactNode, type DragEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Copy, Download, FolderOpen, Lightbulb } from 'lucide-react';
import CodeEditor from './CodeEditor';
import ErrorBox from './ErrorBox';
import { copyText, downloadBlob, readFileAsText } from '../../lib/files';
import { detectInput } from '../../lib/detect';
import { handoff } from '../../state/handoff';
import type { ToolError } from '../../lib/errors';

interface Props {
  title: string;
  value: string;
  onChange?: (v: string) => void;
  language?: string;
  readOnly?: boolean;
  error?: ToolError | null;
  /** Enables Open-file + drag-and-drop (FR-C2). */
  acceptFile?: string;
  /** Enables Download with this filename. */
  downloadName?: string;
  toolbar?: ReactNode;
  footer?: ReactNode;
  className?: string;
  /** Current tool id: if set, show a suggestion when the input looks like another tool's (FR-C3). */
  detectFrom?: string;
  onFileError?: (e: ToolError) => void;
}

export default function EditorPane({
  title,
  value,
  onChange,
  language,
  readOnly,
  error,
  acceptFile,
  downloadName,
  toolbar,
  footer,
  className = 'h-[60vh] min-h-[320px]',
  detectFrom,
  onFileError,
}: Props) {
  const [copied, setCopied] = useState(false);
  const [dragging, setDragging] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const detection = detectFrom && value.length < 2_000_000 ? detectInput(value) : null;
  const suggestion = detection && detection.toolId !== detectFrom ? detection : null;

  const loadFile = async (file: File | undefined) => {
    if (!file || !onChange) return;
    try {
      onChange(await readFileAsText(file));
    } catch (e) {
      onFileError?.({ message: e instanceof Error ? e.message : 'Could not read the file' });
    }
  };

  const onDrop = (e: DragEvent) => {
    if (!acceptFile) return;
    e.preventDefault();
    setDragging(false);
    void loadFile(e.dataTransfer.files[0]);
  };

  const doCopy = async () => {
    if (await copyText(value)) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1200);
    }
  };

  return (
    <section
      className={`hud-panel flex flex-col overflow-hidden ${className} ${dragging ? 'ring-2 ring-cyan' : ''}`}
      aria-label={title}
      onDragOver={(e) => {
        if (acceptFile) {
          e.preventDefault();
          setDragging(true);
        }
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={onDrop}
    >
      <div className="flex flex-wrap items-center gap-2 border-b border-primary/30 px-3 py-1.5">
        <h2 className="font-hud text-[11px] uppercase tracking-[0.2em] text-cyan">{title}</h2>
        <span className="font-mono text-[10px] text-muted">
          {value.length.toLocaleString()} chars{value ? ` · ${value.split('\n').length.toLocaleString()} lines` : ''}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {toolbar}
          {acceptFile && onChange && (
            <>
              <input
                ref={fileRef}
                type="file"
                accept={acceptFile}
                className="hidden"
                onChange={(e) => void loadFile(e.target.files?.[0]).then(() => (e.target.value = ''))}
              />
              <button
                type="button"
                className="hud-btn hud-btn-ghost px-2 py-1 text-xs"
                onClick={() => fileRef.current?.click()}
                title="Open a file (or drag one here)"
              >
                <FolderOpen size={14} aria-hidden="true" /> Open
              </button>
            </>
          )}
          <button type="button" className="hud-btn hud-btn-ghost px-2 py-1 text-xs" onClick={doCopy} disabled={!value} aria-label={`Copy ${title}`}>
            {copied ? <Check size={14} className="text-success" aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {downloadName && (
            <button
              type="button"
              className="hud-btn hud-btn-ghost px-2 py-1 text-xs"
              onClick={() => downloadBlob(value, downloadName)}
              disabled={!value}
              aria-label={`Download ${title}`}
            >
              <Download size={14} aria-hidden="true" /> Save
            </button>
          )}
        </div>
      </div>
      {suggestion && (
        <div className="flex items-center gap-2 border-b border-primary/20 bg-accent/10 px-3 py-1 text-xs">
          <Lightbulb size={13} className="text-accent" aria-hidden="true" />
          This looks like {suggestion.label}.
          <button
            type="button"
            className="text-cyan underline"
            onClick={() => {
              handoff.set(suggestion.toolId, value);
              navigate(`/tool/${suggestion.toolId}`);
            }}
          >
            Open in the right tool
          </button>
        </div>
      )}
      <div className="relative min-h-0 flex-1">
        <CodeEditor value={value} onChange={onChange} language={language} readOnly={readOnly} ariaLabel={title} error={error} />
        {dragging && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-navy/70 font-hud text-sm uppercase tracking-widest text-cyan">
            Drop file to load
          </div>
        )}
      </div>
      {error && <ErrorBox error={error} />}
      {footer}
    </section>
  );
}
