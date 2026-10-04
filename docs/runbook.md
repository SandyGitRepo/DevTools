# Runbook

## Start / stop

| Where             | Start                                               | Stop                        |
| ----------------- | --------------------------------------------------- | --------------------------- |
| Laptop / VM (zip) | `start.bat` or `./start.sh`                         | Ctrl+C                      |
| Node directly     | `node server/server.mjs`                            | Ctrl+C / SIGTERM (graceful) |
| Docker            | `docker compose -f deploy/docker-compose.yml up -d` | `docker compose ... down`   |

Health check: `GET /api/health` → `{"status":"ok","pdfService":true,"qpdf":"12.4.2"}`. `pdfService:false` means qpdf was not found; only PDF protect/unlock/compress are affected.

## Upgrade

1. Verify the new zip's SHA-256 against its `.sha256` file.
2. Unzip next to the current version, stop the old one, start the new one (blue-green: run the new one on another port, switch the proxy, then stop the old one).
3. Users get the new version on their next page load; the service worker updates automatically.

## Logs

One JSON line per API request and per error, on stdout:

```json
{ "ts": "2026-10-04T12:46:23.444Z", "method": "GET", "path": "/api/health", "status": 200, "ms": 0, "bytes": 34, "ip": "10.1.2.3" }
```

Never contains request bodies, query strings, filenames or content (A09). Alert on spikes of `status >= 500` or `status = 429`.

## Troubleshooting

| Symptom                                          | Cause / fix                                                                                                                                               |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Port 8080 is already in use`                    | Set `PORT=8090` (or stop the other process).                                                                                                              |
| `No build found at …/dist`                       | Running from the source repo: `npm run build` first. Release zips include `dist/`.                                                                        |
| Colleagues cannot connect                        | Started with the default `HOST=127.0.0.1`. Restart with `HOST=0.0.0.0`; check the Windows firewall prompt.                                                |
| 403 "restricted to the corporate network"        | Client IP is outside `ALLOW_CIDRS`. Behind a proxy, the proxy's IP is what counts — add it.                                                               |
| Copy button does nothing on plain HTTP           | Browsers restrict the clipboard API outside HTTPS/localhost; the app falls back to `execCommand`. Use TLS for the intranet deployment.                    |
| Offline mode not working                         | Service workers need HTTPS or `localhost`. Deploy with TLS.                                                                                               |
| PDF Protect/Compress say "service not available" | qpdf 11.7+ not found. Install it, put it in `bin/qpdf/`, or set `QPDF_PATH`, then restart. The startup banner shows `PDF service: qpdf x.y.z` when found. |
| 503 "PDF service is busy"                        | More than 20 queued jobs. Raise `PDF_CONCURRENCY` (CPU permitting) or add instances.                                                                      |
| A tool shows an error box                        | Expected for invalid input. If a tool crashes, its error boundary keeps the rest of the app running — use "Reload tool".                                  |

## Security checks to run per release

- `npm run release` (lint, types, tests, licences, build, zip)
- `npm audit --omit=dev --audit-level=high`
- `npm run test:e2e` (all tools under the production CSP)
- Security headers: `curl -sI http://host:8080/` — expect CSP, X-Frame-Options DENY, nosniff, no-referrer, Permissions-Policy, HSTS (with TLS).
