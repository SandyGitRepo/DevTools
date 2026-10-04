import { useRef, useState } from 'react';
import { Upload } from 'lucide-react';
import { formatBytes } from '../../lib/files';

/** Drag-and-drop / picker for binary files (FR-C2). Never uploads: the File stays in the browser. */
export default function FileDrop({
  onFile,
  onFiles,
  multiple = false,
  accept,
  label = 'Drop a file here or click to choose',
  file,
  compact = false,
}: {
  onFile?: (f: File) => void;
  /** Receives every dropped/picked file when `multiple` is set. */
  onFiles?: (fs: File[]) => void;
  multiple?: boolean;
  accept?: string;
  label?: string;
  file?: File | null;
  compact?: boolean;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const deliver = (list: FileList | null | undefined) => {
    const files = Array.from(list ?? []);
    if (!files.length) return;
    if (multiple && onFiles) onFiles(files);
    else onFile?.(files[0]);
  };
  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={label}
      onClick={() => ref.current?.click()}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), ref.current?.click())}
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        deliver(e.dataTransfer.files);
      }}
      className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded border-2 border-dashed text-center text-sm transition-colors ${
        compact ? 'p-3' : 'p-6'
      } ${over ? 'border-cyan bg-cyan/10' : 'border-primary/50 hover:border-cyan hover:bg-primary/10'}`}
    >
      <Upload size={compact ? 18 : 22} className="text-cyan" aria-hidden="true" />
      {file ? (
        <span className="text-fg">
          {file.name} <span className="text-muted">· {formatBytes(file.size)}</span>
        </span>
      ) : (
        <span className="text-muted">{label}</span>
      )}
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        data-testid="file-input"
        onChange={(e) => {
          deliver(e.target.files);
          e.target.value = '';
        }}
      />
    </div>
  );
}
