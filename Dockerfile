# DevToolkit — build from source.  docker build -t devtoolkit .
# Stage 1: build the static bundle (uses your npm registry/mirror via .npmrc if present — NFR-8)
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build

# Stage 2: minimal runtime. Non-root, no build tools, qpdf for the Phase 2 PDF API.
FROM node:22-alpine
RUN apk add --no-cache qpdf && addgroup -S app && adduser -S -G app app
WORKDIR /app
COPY --from=build --chown=root:root /src/dist ./dist
COPY --chown=root:root server/server.mjs server/pdf-api.mjs ./server/
USER app
ENV HOST=0.0.0.0 PORT=8080 NODE_ENV=production
EXPOSE 8080
HEALTHCHECK --interval=30s --timeout=3s CMD wget -qO- http://127.0.0.1:8080/api/health >/dev/null || exit 1
CMD ["node", "server/server.mjs"]
