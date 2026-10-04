#!/usr/bin/env python3
"""
DevToolkit fallback server for machines without Node.js (Python 3.8+, standard library only).
Serves dist/ with the same security headers as server/server.mjs. Static files only — the
server-side PDF API is available through the Node server or the Docker image.

Environment: HOST (default 127.0.0.1), PORT (default 8080).
"""
import http.server
import os
import socketserver
import sys
from functools import partial

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "dist"))
HOST = os.environ.get("HOST", "127.0.0.1")
PORT = int(os.environ.get("PORT", "8080"))

CSP = "; ".join([
    "default-src 'self'",
    "script-src 'self' 'wasm-unsafe-eval'",
    "worker-src 'self' blob:",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
    "frame-ancestors 'none'",
])

HEADERS = {
    "Content-Security-Policy": CSP,
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "no-referrer",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Cross-Origin-Resource-Policy": "same-origin",
}


class Handler(http.server.SimpleHTTPRequestHandler):
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript", ".mjs": "text/javascript", ".wasm": "application/wasm",
        ".webmanifest": "application/manifest+json", ".woff2": "font/woff2", ".svg": "image/svg+xml",
    }

    def end_headers(self):
        for k, v in HEADERS.items():
            self.send_header(k, v)
        immutable = self.path.startswith("/assets/")
        self.send_header("Cache-Control", "public, max-age=31536000, immutable" if immutable else "no-cache")
        super().end_headers()

    def list_directory(self, path):  # never expose directory listings
        self.send_error(404, "Not found")
        return None

    def log_message(self, fmt, *args):  # metadata only, no query strings
        if len(args) >= 2 and str(args[1]).startswith(("4", "5")):
            sys.stderr.write("%s %s %s\n" % (self.address_string(), self.command, self.path.split("?")[0]))

    def do_POST(self):
        self.send_error(405, "Method not allowed")


if not os.path.isfile(os.path.join(ROOT, "index.html")):
    sys.exit("[devtoolkit] No build found at %s. Run 'npm run build' first." % ROOT)

socketserver.TCPServer.allow_reuse_address = True
with http.server.ThreadingHTTPServer((HOST, PORT), partial(Handler, directory=ROOT)) as httpd:
    shown = "localhost" if HOST in ("0.0.0.0", "::") else HOST
    print("\n  DevToolkit is running ->  http://%s:%d/\n  Press Ctrl+C to stop.\n" % (shown, PORT))
    try:
        httpd.serve_forever()
    except KeyboardInterrupt:
        pass
