---
title: REST / HTTP status codes
owner: DevToolkit maintainers
reviewed: 2026-10-04
version: RFC 9110 (HTTP Semantics)
tags: [http, rest, api]
sources: [rfc-editor.org/rfc/rfc9110]
---

Status codes, methods and conventions for designing and debugging REST APIs.

## Methods

- `GET` reads (safe, idempotent); never changes state
- `PUT` replaces (idempotent); `PATCH` partially updates
- `POST` creates or triggers actions (not idempotent); `DELETE` removes (idempotent)

```http
GET    /api/v1/loans?status=ACTIVE&page=2
POST   /api/v1/loans
PUT    /api/v1/loans/LN-1
PATCH  /api/v1/loans/LN-1
DELETE /api/v1/loans/LN-1
```

## 2xx success

- `200 OK` — body contains the result
- `201 Created` — include a `Location` header for the new resource
- `202 Accepted` — queued for async processing; `204 No Content` — success, empty body

```http
HTTP/1.1 201 Created
Location: /api/v1/loans/LN-2
Content-Type: application/json
```

## 3xx redirection

- `301` permanent, `302`/`303` temporary (303 forces `GET`)
- `304 Not Modified` — client cache is still valid (`ETag` / `If-None-Match`)
- `307`/`308` redirect while keeping the method and body

```http
GET /api/v1/loans/LN-1
If-None-Match: "v42"

HTTP/1.1 304 Not Modified
```

## 4xx client errors

- `400` malformed request · `401` not authenticated · `403` authenticated but not allowed
- `404` not found · `405` method not allowed · `409` conflict (e.g. duplicate, version clash)
- `413` payload too large · `415` wrong content type · `422` valid syntax but failed validation · `429` too many requests

```json try
{
  "type": "https://errors.example/validation",
  "title": "Validation failed",
  "status": 422,
  "errors": [{ "field": "pan", "message": "PAN must match AAAAA9999A" }]
}
```

## 5xx server errors

- `500` unexpected error — log details server-side, return a generic message
- `502` bad gateway (upstream failed) · `503` unavailable (maintenance/overload, add `Retry-After`)
- `504` gateway timeout — upstream too slow

```http
HTTP/1.1 503 Service Unavailable
Retry-After: 120
```

## Headers that matter

- `Content-Type` / `Accept` — `application/json; charset=utf-8`
- `Authorization: Bearer <token>`; never put tokens in URLs
- `Idempotency-Key` makes `POST` retries safe

```http
POST /api/v1/payments
Content-Type: application/json
Authorization: Bearer eyJhbGciOi...
Idempotency-Key: 5d1a9a3e-2b8f-4c41-9a43-71f0c2b7e1aa
```

## Pagination and filtering

- Cursor pagination is stable under inserts; offset is simpler
- Return paging metadata or `Link` headers
- Use query parameters for filtering and sorting

```json try
{
  "items": [{ "id": "LN-1" }, { "id": "LN-2" }],
  "page": { "size": 2, "next": "/api/v1/loans?cursor=eyJpZCI6IkxOLTIifQ" }
}
```

## Security headers

- `Strict-Transport-Security` forces HTTPS
- `Content-Security-Policy` blocks injected scripts
- `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer`

```http
Strict-Transport-Security: max-age=31536000; includeSubDomains
Content-Security-Policy: default-src 'self'; object-src 'none'; frame-ancestors 'none'
X-Content-Type-Options: nosniff
Referrer-Policy: no-referrer
```
