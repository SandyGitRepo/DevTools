# Progress and traceability

Status of every requirement ID. ✅ done and verified · 🟡 partial · ⏳ planned (phase) · ⚠ deviation (see notes)

Verification: **U** = unit / known-answer test (`tests/*.test.ts`), **E** = browser smoke test under the production CSP (`tests/e2e/smoke.mjs`).

## Phase 0 — Foundation ✅

| Item                                                             | Status   | Notes                                                               |
| ---------------------------------------------------------------- | -------- | ------------------------------------------------------------------- |
| HUD shell, theme tokens, dark/light, reduce-motion               | ✅       | `src/index.css`, `Layout.tsx` (UI-1…UI-11)                          |
| Tool plugin registry, lazy loading                               | ✅       | `src/registry/tools.ts` (NFR-6)                                     |
| Command palette Ctrl+K, favourites, recent                       | ✅ E     | FR-C5, FR-C6                                                        |
| Standalone server with OWASP headers                             | ✅       | `server/server.mjs`; traversal, 405, headers verified with curl     |
| Python fallback server, start scripts, release zip               | ✅       | `server/serve.py`, `start.bat/.sh`, `npm run package`               |
| CI gates (lint, types, tests, licences, audit, build, e2e, SBOM) | ✅       | `.github/workflows/ci.yml`                                          |
| Threat model                                                     | ✅ draft | `docs/threat-model.md` — needs security review                      |
| Docker / compose                                                 | ✅       | Helm chart deferred until hosting target is decided (open question) |

## Common behaviour (3.0)

| ID    | Status | Notes                                              |
| ----- | ------ | -------------------------------------------------- |
| FR-C1 | ✅     | Side by side ≥1024 px, stacked below               |
| FR-C2 | ✅     | Paste/type, drag-drop, file picker, copy, download |
| FR-C3 | ✅ U   | `lib/detect.ts`; suggestion banner on input panes  |
| FR-C4 | ✅ U E | Line/col + plain English; per-tool error boundary  |
| FR-C5 | ✅ E   |                                                    |
| FR-C6 | ✅     | Tool IDs only, validated on read                   |
| FR-C7 | ✅     | "Clear all" on every tool                          |
| FR-C8 | ✅ E   | Badge on every tool page                           |

## Phase 1 — Formatters, encoding, crypto ✅ (23/23 tools)

| ID    | Tool                     | Status                                                                                                                     |
| ----- | ------------------------ | -------------------------------------------------------------------------------------------------------------------------- |
| FR-F1 | JSON                     | ✅ U E — format/minify/validate/sort/tree/JSONPath/Schema ⚠ schema validator: `@cfworker/json-schema` instead of ajv (CSP) |
| FR-F2 | SQL                      | ✅ U E                                                                                                                     |
| FR-F3 | Java                     | ✅ E                                                                                                                       |
| FR-F4 | JS/TS                    | ✅ U E                                                                                                                     |
| FR-F5 | HTML/CSS/SCSS            | ✅ U E (also Less)                                                                                                         |
| FR-F6 | XML/SOAP                 | ✅ U E — format/minify/well-formed/XPath                                                                                   |
| FR-F7 | YAML/Markdown/GraphQL    | ✅ U E                                                                                                                     |
| FR-F8 | Text diff                | ✅ E — text + semantic JSON (RFC 6902 patch)                                                                               |
| FR-E1 | Base64                   | ✅ U E — RFC 4648 vectors                                                                                                  |
| FR-E2 | URL                      | ✅ U E                                                                                                                     |
| FR-E3 | HTML entities            | ✅ E                                                                                                                       |
| FR-E4 | Hex/Binary/Base32/Base58 | ✅ U E                                                                                                                     |
| FR-E5 | Unicode                  | ✅ U E                                                                                                                     |
| FR-E6 | JWT                      | ✅ U E — IST times, HS/RS/PS/ES verify                                                                                     |
| FR-E7 | Certificate/CSR          | ✅ U E                                                                                                                     |
| FR-E8 | Gzip/Deflate             | ✅ U E — bomb guard (SEC-4)                                                                                                |
| FR-K1 | Hash                     | ✅ U E — NIST vectors, streamed files                                                                                      |
| FR-K2 | HMAC                     | ✅ U E — RFC 4231                                                                                                          |
| FR-K3 | Password hashing         | ✅ U E                                                                                                                     |
| FR-K4 | AES                      | ✅ U E — GCM test vector                                                                                                   |
| FR-K5 | RSA/ECDSA                | ✅ U E                                                                                                                     |
| FR-K6 | Keys/secrets/UUID        | ✅ U E                                                                                                                     |
| FR-K7 | File encryption          | ✅ U E — header authenticated as AAD                                                                                       |

## Phase 2 — PDF tools and data converters ✅ (16/16 tools)

| ID     | Tool                  | Status                                                                                                                  |
| ------ | --------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| FR-P1  | Merge                 | ✅ U E — 2–50 files, drag or arrow reorder                                                                              |
| FR-P2  | Split                 | ✅ U E — ranges / every N / per page; ZIP via fflate                                                                    |
| FR-P3  | Delete pages          | ✅ U E — thumbnails or ranges                                                                                           |
| FR-P4  | Insert pages          | ✅ U E — blank, from another PDF, images                                                                                |
| FR-P5  | Reorder & rotate      | ✅ U E — drag-and-drop + keyboard buttons                                                                               |
| FR-P6  | Extract pages         | ✅ U E                                                                                                                  |
| FR-P7  | Image ↔ PDF           | ✅ U E — JPG/PNG → PDF (size, orientation, margin); PDF → PNG at 72/150/300 DPI                                         |
| FR-P8  | Watermark & numbering | ✅ U E — correct on rotated pages                                                                                       |
| FR-P9  | Metadata              | ✅ U E — view, edit, strip (info dictionary + XMP); flags active content                                                |
| FR-P10 | Protect / unlock      | ✅ E (with qpdf) — AES-256 + permissions; API tested for wrong password, re-encryption, newline injection, cross-origin |
| FR-P11 | Compress              | ✅ E (with qpdf) — object streams, Flate 9, unused resources removed, `--optimize-images`                               |
| FR-D1  | CSV ↔ JSON            | ✅ U E — delimiter auto-detect, typing toggle, flatten, CSV-injection escaping, preview grid                            |
| FR-D2  | JSON ↔ YAML ↔ XML     | ✅ U E — attributes as `@_x`, root wrapping, entity declarations refused                                                |
| FR-D3  | Excel → CSV / JSON    | ✅ U E — sheet picker, preview, ISO dates, zip-bomb guard                                                               |
| FR-D4  | JSON → classes        | ✅ U E — TypeScript, Java (package, Lombok), C# (namespace)                                                             |
| FR-D5  | SQL INSERT generator  | ✅ U E — 6 dialects, Oracle `INSERT ALL`, T-SQL 1,000-row cap, optional inferred `CREATE TABLE`                         |

| Control                                | Status | Where                                                                                           |
| -------------------------------------- | ------ | ----------------------------------------------------------------------------------------------- |
| SEC-1 magic bytes, 100 MB, 2,000 pages | ✅ U   | `lib/pdf/ops.ts` (browser) and `server/pdf-api.mjs` (server)                                    |
| SEC-3 strip JavaScript / attachments   | ✅ U   | `sanitize()` on every output, including before and after server jobs; pdf.js 6 has no eval path |
| SEC-4 Excel zip bomb                   | ✅ U   | Central-directory size check before SheetJS parses                                              |
| Large-file responsiveness              | ✅     | pdf-lib runs in a Web Worker; thumbnails render lazily on scroll                                |

## Phase 3 — Utilities, unit converters, cheat sheets ✅ (15/15)

| ID       | Tool                | Status                                                                                                                                                          |
| -------- | ------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| FR-U1    | Regex tester        | ✅ U E — live highlighting, named groups, replace, quick reference; Web Worker killed after 5 s (ReDoS guard)                                                   |
| FR-U2    | Timestamp converter | ✅ U E — s/ms/µs/ns auto-detect, IST/UTC/any zone with DST, ISO-8601, RFC 2822                                                                                  |
| FR-U3    | Cron explainer      | ✅ U E — Unix, Quartz, AWS EventBridge; correct Sunday=1 weekday conversion; next 10 runs                                                                       |
| FR-U4    | Case & text tools   | ✅ U E — 11 cases, 12 line operations, stats (Devanagari-aware word count)                                                                                      |
| FR-U5    | Number base         | ✅ U E — BigInt any size, two's complement 8–64 bit, byte sizes (1000 vs 1024)                                                                                  |
| FR-U6    | QR code             | ✅ E — generate PNG/SVG; read from image or clipboard; links shown as text with phishing warning                                                                |
| FR-U7    | Colour converter    | ✅ U E — HEX/RGB/HSL (+alpha), picker, WCAG 2.1 contrast AA/AAA                                                                                                 |
| FR-U8    | Data masker         | ✅ U E — PAN, Aadhaar (Verhoeff), card (Luhn), mobile, email, account, IFSC; JSON mode hides secret keys                                                        |
| FR-U9    | Test data           | ✅ U E — en_IN names/addresses, PAN-format, `test_record: true`, `.test` emails, `TEST` IFSC; JSON/CSV/SQL; seedable                                            |
| FR-M1    | Length              | ✅ U E — NIST exact factors; mixed input `5' 8"`, `5 ft 8 in`                                                                                                   |
| FR-M2    | Height quick view   | ✅ U E — ft/in ↔ cm, 4′0″–7′0″ table                                                                                                                            |
| FR-M3    | Area & land units   | ✅ U E — guntha, cent, 13 state bigha factors + custom; factor and state always displayed                                                                       |
| FR-M4    | Carpet / built-up   | ✅ U E — estimate from any one value; labelled "estimate, not a valuation"                                                                                      |
| FR-M5    | Other units         | ✅ U E — weight (incl. tola, quintal), temperature, data size, volume                                                                                           |
| FR-H1…H8 | Cheat sheet library | ✅ U E — 14 sheets / 125 cards, MiniSearch (results in < 5 ms), Prism highlighting, copy, Try it, A4 print, owner/version/review date, Markdown content-as-code |

| Quality gate                                                | Status                                                                                  |
| ----------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Accessibility (axe-core, WCAG 2.1 A/AA, serious + critical) | ✅ 0 issues on 9 key screens × dark and light themes, enforced in `tests/e2e/smoke.mjs` |
| Unit tests                                                  | ✅ 147 (NIST factors to 4 dp, checksums, time zones, cron)                              |
| Browser test                                                | ✅ 54/54 tools under the production CSP                                                 |

## Upcoming

| Phase | Scope                                                                                               |
| ----- | --------------------------------------------------------------------------------------------------- |
| 4     | SRI hashes, signed images, Helm chart (once hosting is decided), Lighthouse budget in CI, VAPT, UAT |

## Deviations from the requirements document

| Requirement                    | Change                                                    | Reason                                                                          |
| ------------------------------ | --------------------------------------------------------- | ------------------------------------------------------------------------------- |
| FR-F1 "ajv"                    | `@cfworker/json-schema` (MIT)                             | ajv uses `new Function`, which the mandated CSP (A03) blocks                    |
| §7 "Nginx static server"       | Zero-dependency Node server (Nginx still usable in front) | Single portable artefact for the zip; same headers everywhere                   |
| §7 "distroless" image          | `node:22-alpine` + qpdf, non-root, read-only FS           | qpdf is needed for Phase 2; distroless has no package manager for it            |
| NFR-6 TypeScript               | Pinned to 5.9                                             | TypeScript 7 is not yet supported by typescript-eslint                          |
| FR-D3 "SheetJS CE"             | SheetJS 0.20.3 from the official SheetJS distribution     | The npm `xlsx` package is the abandoned 0.18.5 with High-severity CVEs          |
| FR-P5 "SortableJS"             | Native HTML5 drag-and-drop plus move buttons              | One less dependency; buttons give keyboard access (UI-10)                       |
| FR-P2 "JSZip"                  | fflate (already used for Gzip)                            | JSZip is dual MIT/GPL; fflate is MIT and smaller                                |
| FR-P10/P11 qpdf version        | qpdf 11.7+ required                                       | Named `--user-password=` syntax avoids argument-parsing ambiguity               |
| FR-U2 "date-fns + date-fns-tz" | Platform `Intl` API                                       | Same results, zero bytes shipped; DST handled by the browser time-zone database |
| FR-M1/M5 "convert-units"       | Own exact factor table                                    | Guarantees NIST factors and Indian units (tola, quintal, guntha, cent, bigha)   |
| FR-H "Shiki or Prism"          | Prism with 16 grammars                                    | Small, no WASM; output sanitised to `<span class>`                              |
