/**
 * Deployment-level settings. Change these to re-brand the portal (UI-5, UI-13).
 * Colours live in src/index.css as CSS variables.
 */
export const appConfig = {
  name: 'DevToolkit',
  tagline: 'Developer utilities · zero data egress',
  /** Path relative to the site root; replace public/logo.svg or point elsewhere. */
  logoUrl: './logo.svg',
  supportContact: 'github.com/SandyGitRepo/DevTools/issues',
  footerNotice: 'Processed on your device · Do not upload data you are not authorised to handle',
  /** Base URL of the optional PDF API (server-side tools). Same origin by default. */
  apiBase: './api',
  limits: {
    maxTextBytes: 10 * 1024 * 1024,
    maxPdfBytes: 100 * 1024 * 1024,
    maxPdfPages: 2000,
  },
} as const;
