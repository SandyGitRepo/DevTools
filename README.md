# DevToolkit

Self-hosted utilities portal — 54 tools — formatters, encoders, crypto, PDF, data converters, developer utilities, unit converters and an offline cheat-sheet library — that run **entirely in the browser**, so sensitive data never gets pasted into public websites.

- Full requirements: [docs/requirements.md](docs/requirements.md)
- Build status by requirement: [docs/progress.md](docs/progress.md)
- License: [MIT](LICENSE)

---

## Run it (from the release zip)

You need **Node.js 18+** _or_ **Python 3.8+**. No installation, no internet.

1. Unzip `devtoolkit-<version>.zip` anywhere.
2. Start it:
   - **Windows:** double-click `start.bat`
   - **macOS / Linux:** `./start.sh`
3. Your browser opens at <http://localhost:8080/>.

By default only your own computer can connect. To serve your team on your private network:

```bash
# Windows (cmd)
set HOST=0.0.0.0 && start.bat
# macOS / Linux
HOST=0.0.0.0 ./start.sh
```

| Variable               | Default     | Purpose                                                        |
| ---------------------- | ----------- | -------------------------------------------------------------- |
| `HOST`                 | `127.0.0.1` | `0.0.0.0` to accept connections from the network               |
| `PORT`                 | `8080`      | Listening port                                                 |
| `TLS_CERT` / `TLS_KEY` | –           | PEM files; enables HTTPS (TLS 1.2+) and HSTS                   |
| `ALLOW_CIDRS`          | –           | IP allow-list, e.g. `10.0.0.0/8,192.168.0.0/16`                |
| `LOG_STATIC`           | –           | `1` to log every static request (default: API and errors only) |
| `QPDF_PATH`            | auto        | Path to `qpdf` (11.7+) for PDF protect/unlock/compress         |
| `PDF_CONCURRENCY`      | `2`         | Max simultaneous server-side PDF jobs                          |

### Server-side PDF tools (optional)

PDF **Protect/Unlock** and **Compress** run on the server with qpdf (Apache-2.0). Every other tool works without it. The server finds qpdf automatically if it is on the `PATH`, in `bin/qpdf/` next to the app, or at `QPDF_PATH`:

- Windows: unzip the official qpdf release into `bin\qpdf\` (or build the zip with `QPDF_BUNDLE_DIR=<qpdf folder> npm run package`)
- Linux: `apt install qpdf` / `dnf install qpdf` · macOS: `brew install qpdf` · Docker: already included

Verify the zip before deploying: compare its SHA-256 with the `.sha256` file published next to it.

### Docker

```bash
docker build -t devtoolkit .                                 # inside the unzipped release, or the repo
docker compose -f deploy/docker-compose.yml up -d            # read-only FS, non-root, IP allow-list
```

---

## Develop

```bash
npm ci              # uses your internal registry if .npmrc points at it (NFR-8)
npm run dev         # http://localhost:5173 with hot reload
npm test            # unit + known-answer tests (Vitest)
npm run lint        # ESLint (no eval/new Function allowed in app code)
npm run typecheck
npm run build       # → dist/
npm start           # serve dist/ with production headers on :8080
npm run test:e2e    # every tool in installed Edge under the production CSP
npm run release     # all gates + build + release/devtoolkit-<version>.zip
```

### Adding a tool (NFR-6)

1. Put pure logic in `src/lib/<module>/<name>.ts` and tests in `tests/` (known-answer vectors where they exist).
2. Create the UI in `src/tools/<module>/<Name>Tool.tsx` using `ToolShell`, `EditorPane`, `useAction` and the controls in `src/components/ui`.
3. Register it in `src/registry/tools.ts` with a `load: () => import(...)` entry — it appears on the dashboard, in Ctrl+K search and in the nav automatically.
4. Add it to `TOOLS` in `tests/e2e/smoke.mjs`.

### Adding or updating a cheat sheet (FR-H7)

Create or edit a Markdown file in `content/cheatsheets/` — no code changes:

````markdown
---
title: Terraform
owner: Platform team
reviewed: 2026-10-04
version: Terraform 1.9
tags: [iac, cloud]
sources: [developer.hashicorp.com/terraform/docs]
---

One-line intro.

## Card title

- Two to five rule-of-thumb bullets

```bash
terraform plan -out tfplan
```
````

`````

Add `try` after the language (```` ```json try ````) to give a snippet a **Try it** button (json, sql, regex, base64, yaml, xml, cron, jwt). Only author content in-house or from permissive (CC BY / MIT) sources, with attribution.

### Re-branding

- Colours: the CSS variables at the top of `src/index.css` (`--primary`, `--accent`, `--hud-cyan`).
- Name, logo, support contact, footer notice: `src/config/app.config.ts` and `public/logo.svg`.

---

## Security model (summary)

- ~90% of tools run in the browser; nothing is uploaded. Server-side tools (PDF protect/unlock/compress, Phase 2) process in memory and keep nothing.
- Strict CSP: `script-src 'self' 'wasm-unsafe-eval'` — no inline scripts, no `eval`. All assets self-hosted (no CDN). Works offline after first load (PWA).
- No cookies, no analytics, no content logging. Logs are metadata only.
- Every production dependency is checked against a permissive licence allow-list (`npm run licenses`, see `LICENSES.md`).

Details: [docs/threat-model.md](docs/threat-model.md) · [docs/architecture.md](docs/architecture.md) · [docs/runbook.md](docs/runbook.md)
`````
