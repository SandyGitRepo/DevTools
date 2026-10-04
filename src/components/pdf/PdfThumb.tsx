import { useEffect, useRef, useState } from 'react';
import { renderPage, type PDFDocumentProxy } from '../../lib/pdf/render';

/** Renders one page lazily, only when scrolled into view (keeps 2,000-page files responsive). */
export default function PdfThumb({ doc, page, rotate = 0, width = 132 }: { doc: PDFDocumentProxy; page: number; rotate?: number; width?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const holder = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const el = holder.current;
    if (!el) return;
    const io = new IntersectionObserver(([entry]) => entry.isIntersecting && setVisible(true), { rootMargin: '300px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  useEffect(() => {
    if (!visible || !ref.current) return;
    let cancelled = false;
    renderPage(doc, page, ref.current, width, rotate).catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [visible, doc, page, rotate, width]);

  return (
    <div ref={holder} className="flex items-center justify-center bg-white/90" style={{ width, minHeight: width * 1.3 }}>
      {failed ? <span className="p-2 text-center text-[10px] text-danger">Preview unavailable</span> : <canvas ref={ref} aria-hidden="true" />}
    </div>
  );
}
