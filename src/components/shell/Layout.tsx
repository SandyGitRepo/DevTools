import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { usePrefs } from '../../state/prefs';
import NavRail from './NavRail';
import TopBar from './TopBar';
import Footer from './Footer';
import CommandPalette from './CommandPalette';

export default function Layout() {
  const p = usePrefs();
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [hidden, setHidden] = useState(false);
  const location = useLocation();

  // Theme + reduce-motion classes on <html>
  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('dark', p.theme === 'dark');
    root.classList.toggle('light', p.theme === 'light');
    root.classList.toggle('reduce-motion', p.reduceMotion);
  }, [p.theme, p.reduceMotion]);

  // Pause background animation when the tab is hidden (UI-1)
  useEffect(() => {
    const onVis = () => setHidden(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, []);

  // Warm the editor (Monaco, ~2.7 MB) once the dashboard is idle so the first tool opens instantly (NFR-1)
  useEffect(() => {
    // Start only after a quiet period, so a fast first click never competes with the warm-up
    let idle = 0;
    const warm = () => void import('../tool/MonacoEditors');
    const timer = setTimeout(() => {
      if ('requestIdleCallback' in window) idle = window.requestIdleCallback(warm, { timeout: 3000 });
      else warm();
    }, 2500);
    return () => {
      clearTimeout(timer);
      if (idle) window.cancelIdleCallback(idle);
    };
  }, []);

  // Global Ctrl/Cmd+K (FR-C5)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setPaletteOpen((o) => !o);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <div className="flex h-full min-h-0">
      <div className={`hud-grid ${hidden ? 'paused' : ''}`} aria-hidden="true" />
      <div key={location.pathname} className="scanline" aria-hidden="true" />
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 hud-btn">
        Skip to content
      </a>
      <NavRail />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onOpenPalette={() => setPaletteOpen(true)} />
        <main id="main" className="min-h-0 flex-1 overflow-auto px-4 pb-6 pt-4 lg:px-6">
          <Outlet />
        </main>
        <Footer />
      </div>
      {paletteOpen && <CommandPalette onClose={() => setPaletteOpen(false)} />}
    </div>
  );
}
