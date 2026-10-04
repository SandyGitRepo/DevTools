import { ShieldCheck, Server, Cookie, EyeOff } from 'lucide-react';
import { appConfig } from '../config/app.config';

const points = [
  {
    icon: ShieldCheck,
    title: 'Processed on your device',
    text: 'Almost every tool runs entirely in your browser. Your text, files and keys are never sent anywhere.',
  },
  {
    icon: Server,
    title: 'Server-side tools keep nothing',
    text: 'The few tools marked "server" (PDF protect, unlock and compress) process files in memory on an internal server and delete them as soon as the response is sent.',
  },
  {
    icon: Cookie,
    title: 'No cookies, no analytics',
    text: 'DevToolkit sets no cookies and has no analytics or telemetry. Favourites and recent tools are kept in your browser’s local storage as tool names only.',
  },
  {
    icon: EyeOff,
    title: 'No external calls',
    text: 'Every script, style and font is self-hosted. Nothing is loaded from the internet, and the app keeps working offline once loaded.',
  },
];

export default function About() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 pt-4">
      <h1 className="font-hud text-xl font-bold uppercase tracking-widest">About & Privacy</h1>
      <p className="text-muted">
        {appConfig.name} replaces public online formatters, encoders and PDF editors so sensitive data never leaves your device or your network.
      </p>
      <div className="grid gap-3 sm:grid-cols-2">
        {points.map((p) => (
          <div key={p.title} className="hud-panel p-4">
            <p.icon className="mb-2 text-cyan" size={20} aria-hidden="true" />
            <h2 className="mb-1 font-sans text-sm font-semibold tracking-normal">{p.title}</h2>
            <p className="text-sm text-muted">{p.text}</p>
          </div>
        ))}
      </div>
      <div className="hud-panel p-4 text-sm text-muted">
        <h2 className="mb-2 font-sans text-sm font-semibold tracking-normal text-fg">Keyboard shortcuts</h2>
        <ul className="space-y-1">
          <li>
            <kbd className="font-mono text-fg">Ctrl + K</kbd> — search and jump to any tool
          </li>
          <li>
            <kbd className="font-mono text-fg">Tab / Shift + Tab</kbd> — move between controls
          </li>
          <li>
            <kbd className="font-mono text-fg">Ctrl + M</kbd> inside an editor — toggle Tab key focus trapping
          </li>
        </ul>
      </div>
      <p className="text-sm text-muted">
        Support: {appConfig.supportContact} · Version {__APP_VERSION__}
      </p>
    </div>
  );
}
