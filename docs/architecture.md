# Architecture

DevToolkit is a browser-first single-page app. The server ships static files and (from Phase 2) runs the few PDF jobs a browser cannot do well.

```
Browser (user's device)                           Server (private VM / container)
┌───────────────────────────────────────────┐     ┌──────────────────────────────────────┐
│ React SPA · HashRouter · Tailwind HUD     │     │ server/server.mjs (Node, 0 deps)     │
│  ├─ Tool registry (src/registry/tools.ts) │ GET │  ├─ static dist/ + security headers  │
│  ├─ Lazy tool chunks (src/tools/**)       │────▶│  ├─ IP allow-list, path-traversal    │
│  ├─ Pure logic (src/lib/**)               │     │  │   guard, 60 s timeouts            │
│  ├─ Monaco + 4 language workers           │     │  └─ /api/* (rate-limited, Phase 2:   │
│  ├─ WASM: hash-wasm, tree-sitter (Java)   │     │      qpdf in memory, nothing stored)  │
│  └─ Service worker (PWA, offline)         │     └──────────────────────────────────────┘
└───────────────────────────────────────────┘
```

## Source layout

| Path                    | Contents                                                                                                        |
| ----------------------- | --------------------------------------------------------------------------------------------------------------- |
| `src/registry/tools.ts` | Every module and tool (implemented or planned). Drives dashboard, nav, search and routing.                      |
| `src/tools/<module>/`   | One React component per tool, lazy-loaded.                                                                      |
| `src/lib/`              | Pure, DOM-free logic (except XML/XPath, which use the browser parser). Unit-tested.                             |
| `src/components/tool/`  | Shared tool framework: `ToolShell`, `EditorPane`, `CodeEditor` (Monaco), `FileDrop`, `useAction`, `StatusLine`. |
| `src/components/shell/` | Layout, nav rail, top bar, command palette, footer.                                                             |
| `src/state/`            | Preferences (localStorage: tool IDs and flags only) and one-shot in-memory hand-off between tools.              |
| `server/`               | `server.mjs` (Node), `pdf-api.mjs` (qpdf jobs) and `serve.py` (Python fallback, static only).                   |
| `src/workers/`          | `pdf.worker.ts` — pdf-lib operations off the main thread; `src/lib/pdf/client.ts` is its promise facade.        |
| `src/components/pdf/`   | PDF loader, lazy pdf.js thumbnails, page grid (select / drag / rotate), result preview.                         |
| `content/cheatsheets/`  | Cheat sheets as Markdown (front matter + `## cards`), bundled at build time via `import.meta.glob`.             |
| `tests/`                | Vitest unit/KAT suites; `tests/e2e/smoke.mjs` browser test.                                                     |

## Key decisions

| Decision                                             | Why                                                                                                                                                   |
| ---------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Hash routing** (`#/tool/json`)                     | The build works behind any static server or sub-path with no rewrite rules — essential for a portable zip.                                            |
| **Relative base (`./`)**                             | Same reason: deploy under `/devtoolkit/` or at the root without rebuilding.                                                                           |
| **Monaco bundled locally**                           | `@monaco-editor/react` loads from a CDN by default; we pass it the bundled instance and local workers (no external assets at runtime).                |
| **Lazy everything**                                  | Each tool, Prettier plugin, Terser, the Java parser and Monaco workers load on first use. The dashboard loads in < 1 s on LAN.                        |
| **`@cfworker/json-schema` instead of ajv**           | ajv compiles schemas with `new Function`, which the strict CSP forbids. cfworker validates by interpretation (MIT).                                   |
| **jsonpath-plus with `eval: 'safe'`**                | Filter expressions use the library's sandboxed evaluator, never `new Function`.                                                                       |
| **Own JSON error locator**                           | V8 no longer always reports positions; `jsonError.ts` gives exact line/column and plain-English messages (FR-C4).                                     |
| **Zero-dependency Node server**                      | Nothing to `npm install` on the target machine; small attack surface; same headers in dev preview and production.                                     |
| **PDF edits in a Web Worker, thumbnails via pdf.js** | pdf-lib work on 100 MB files would freeze the page; pdf.js renders thumbnails in its own worker, lazily on scroll. Every output is sanitised (SEC-3). |
| **qpdf only where the browser cannot**               | AES-256 PDF encryption and image re-compression run server-side in a private temp dir deleted in `finally`.                                           |
| **TypeScript 5.9**                                   | TypeScript 7 (native) is not yet supported by typescript-eslint; 5.9 is the mature, fully supported line.                                             |

## Performance budget (NFR-1)

- Initial load (dashboard): ~150 KB gzip of JS. Measured first load in Edge on localhost: ~0.5–0.7 s.
- Monaco loads with the first tool (~700 KB gzip); the TypeScript worker (largest asset) only when a JS/TS editor opens.
- The PWA precaches the full bundle (~19 MB) in the background after first visit so every client-side tool works offline.
