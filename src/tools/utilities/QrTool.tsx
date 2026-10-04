import { useEffect, useState } from 'react';
import { Download, ScanLine, AlertTriangle } from 'lucide-react';
import ToolShell from '../../components/tool/ToolShell';
import FileDrop from '../../components/tool/FileDrop';
import ErrorBox from '../../components/tool/ErrorBox';
import { ActionBar } from '../../components/tool/layout';
import { useAction } from '../../components/tool/useAction';
import { Segmented, Select, TextArea } from '../../components/ui/controls';
import { downloadBlob } from '../../lib/files';

type Level = 'L' | 'M' | 'Q' | 'H';

function Generate() {
  const [text, setText] = useState('https://github.com/SandyGitRepo/DevTools');
  const [level, setLevel] = useState<Level>('M');
  const [size, setSize] = useState('512');
  const [dark, setDark] = useState('#001a33');
  const [light, setLight] = useState('#ffffff');
  const [svg, setSvg] = useState('');
  const [pngUrl, setPngUrl] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let url = '';
    if (!text) {
      setSvg('');
      setPngUrl('');
      return;
    }
    (async () => {
      try {
        const QR = await import('qrcode');
        const opts = { errorCorrectionLevel: level, margin: 2, width: Number(size), color: { dark, light } };
        const s = await QR.toString(text, { ...opts, type: 'svg' });
        const canvas = document.createElement('canvas');
        await QR.toCanvas(canvas, text, opts);
        const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/png'));
        if (cancelled || !blob) return;
        url = URL.createObjectURL(blob);
        setSvg(s);
        setPngUrl(url);
        setError(null);
      } catch (e) {
        if (!cancelled)
          setError((e as Error).message.includes('big') ? 'Too much data for a QR code — shorten the text or lower error correction' : (e as Error).message);
      }
    })();
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [text, level, size, dark, light]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
      <section className="hud-panel space-y-3 p-4">
        <TextArea label="Text or URL" value={text} onChange={setText} rows={4} />
        <div className="flex flex-wrap items-end gap-4">
          <Select
            label="Error correction"
            value={level}
            onChange={setLevel}
            options={[
              { value: 'L', label: 'Low (7%)' },
              { value: 'M', label: 'Medium (15%)' },
              { value: 'Q', label: 'Quartile (25%)' },
              { value: 'H', label: 'High (30%)' },
            ]}
          />
          <Select label="PNG size (px)" value={size} onChange={setSize} options={['256', '512', '1024']} />
          <label className="flex flex-col">
            <span className="hud-label">Dark</span>
            <input
              type="color"
              value={dark}
              onChange={(e) => setDark(e.target.value)}
              className="h-9 w-14 rounded border border-primary/50 bg-transparent"
              aria-label="Dark colour"
            />
          </label>
          <label className="flex flex-col">
            <span className="hud-label">Light</span>
            <input
              type="color"
              value={light}
              onChange={(e) => setLight(e.target.value)}
              className="h-9 w-14 rounded border border-primary/50 bg-transparent"
              aria-label="Light colour"
            />
          </label>
        </div>
        <p className="text-xs text-muted">{text.length} characters · higher error correction survives damage/logos but holds less data.</p>
        {error && <ErrorBox error={{ message: error }} className="rounded border" />}
      </section>
      {pngUrl && (
        <section className="hud-panel flex flex-col items-center gap-3 p-4">
          <img src={pngUrl} alt="Generated QR code" className="h-64 w-64 rounded bg-white" />
          <div className="flex gap-2">
            <a className="hud-btn hud-btn-accent" href={pngUrl} download="qr-code.png">
              <Download size={15} aria-hidden="true" /> PNG
            </a>
            <button type="button" className="hud-btn" onClick={() => downloadBlob(svg, 'qr-code.svg', 'image/svg+xml')}>
              <Download size={15} aria-hidden="true" /> SVG
            </button>
          </div>
        </section>
      )}
    </div>
  );
}

function Read() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState('');
  const [decoded, setDecoded] = useState<string | null>(null);
  const { error, run } = useAction();

  useEffect(() => () => void (preview && URL.revokeObjectURL(preview)), [preview]);

  const decodeImage = (f: File) => {
    setFile(f);
    setDecoded(null);
    const url = URL.createObjectURL(f);
    setPreview(url);
    void run(async () => {
      const img = new Image();
      img.src = url;
      await img.decode();
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(img.naturalWidth * scale);
      canvas.height = Math.round(img.naturalHeight * scale);
      const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const data = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const { default: jsQR } = await import('jsqr');
      const code = jsQR(data.data, data.width, data.height, { inversionAttempts: 'attemptBoth' });
      if (!code) throw new Error('No QR code found. Try a sharper, well-lit image with the whole code visible.');
      setDecoded(code.data);
    });
  };

  // Paste an image from the clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      const item = Array.from(e.clipboardData?.files ?? []).find((f) => f.type.startsWith('image/'));
      if (item) decodeImage(item);
    };
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  });

  const isUrl = decoded ? /^[a-z][a-z0-9+.-]*:/i.test(decoded) : false;

  return (
    <div className="space-y-4">
      <FileDrop
        onFile={decodeImage}
        file={file}
        accept="image/*"
        label="Drop a photo or screenshot of a QR code, click to choose, or paste an image (Ctrl+V)"
      />
      {error && <ErrorBox error={error} className="rounded border" />}
      {(preview || decoded !== null) && (
        <div className="grid gap-4 lg:grid-cols-[auto_1fr]">
          {preview && <img src={preview} alt="Uploaded QR code" className="max-h-64 rounded border border-primary/40 bg-white object-contain" />}
          {decoded !== null && (
            <section className="hud-panel space-y-2 p-4">
              <h2 className="flex items-center gap-2 font-hud text-[11px] uppercase tracking-[0.2em] text-success">
                <ScanLine size={14} aria-hidden="true" /> Decoded
              </h2>
              <TextArea label="Content" value={decoded} readOnly rows={4} />
              {isUrl && (
                <p className="flex items-center gap-1.5 text-xs text-warn">
                  <AlertTriangle size={13} aria-hidden="true" /> This is a link. Check the address carefully before opening it — QR codes are a common phishing
                  route.
                </p>
              )}
            </section>
          )}
        </div>
      )}
    </div>
  );
}

export default function QrTool() {
  const [mode, setMode] = useState<'generate' | 'read'>('generate');
  const [nonce, setNonce] = useState(0);
  return (
    <ToolShell
      onClear={() => setNonce((n) => n + 1)}
      help={
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <b>Generate</b> creates a QR code you can download as PNG or SVG (SVG stays sharp at any print size).
          </li>
          <li>
            <b>Read</b> decodes a QR code from an image in your browser — the image is never uploaded. Links are shown as text, not opened.
          </li>
        </ul>
      }
    >
      <ActionBar>
        <Segmented
          label="Mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'generate', label: 'Generate' },
            { value: 'read', label: 'Read from image' },
          ]}
        />
      </ActionBar>
      <div key={`${mode}-${nonce}`}>{mode === 'generate' ? <Generate /> : <Read />}</div>
    </ToolShell>
  );
}
