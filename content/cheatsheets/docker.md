---
title: Docker
owner: DevToolkit maintainers
reviewed: 2026-10-04
version: Docker Engine 27 · Compose v2
tags: [containers, docker, devops]
sources: [docs.docker.com]
---

Build, run and debug containers — with the secure defaults we expect in production.

## Images

- Tag images with a version, not just `latest`
- `--pull` refreshes the base image when building
- Remove dangling images regularly

```bash
docker build --pull -t registry.internal/devtoolkit:1.2.0 .
docker images
docker tag devtoolkit:1.2.0 registry.internal/devtoolkit:1.2.0
docker push registry.internal/devtoolkit:1.2.0
docker image prune
```

## Run containers

- `-d` detached, `--name` for a stable name, `-p host:container` to publish ports
- `--rm` removes the container when it stops
- Pass configuration with `-e` or `--env-file`, never bake secrets into images

```bash
docker run -d --name devtoolkit -p 8080:8080 --env-file .env registry.internal/devtoolkit:1.2.0
docker run --rm -it alpine:3.20 sh
docker ps
docker stop devtoolkit && docker rm devtoolkit
```

## Debug

- `logs -f` follows output; `exec` opens a shell inside
- `inspect` shows config, mounts and networking as JSON
- `stats` shows live CPU/memory

```bash
docker logs -f --tail 200 devtoolkit
docker exec -it devtoolkit sh
docker inspect devtoolkit --format '{{json .State.Health}}'
docker stats --no-stream
```

## Dockerfile

- Multi-stage builds keep build tools out of the final image
- Copy dependency manifests first to make layer caching work
- Run as a non-root user and add a health check

```dockerfile
FROM node:22-alpine AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM node:22-alpine
RUN addgroup -S app && adduser -S -G app app
WORKDIR /app
COPY --from=build /src/dist ./dist
COPY server ./server
USER app
EXPOSE 8080
HEALTHCHECK CMD wget -qO- http://127.0.0.1:8080/api/health || exit 1
CMD ["node", "server/server.mjs"]
```

## Volumes and networks

- Named volumes persist data; bind mounts map host folders
- Mount config read-only with `:ro`
- Containers on the same user-defined network reach each other by name

```bash
docker volume create pgdata
docker network create backend
docker run -d --name db --network backend -v pgdata:/var/lib/postgresql/data postgres:16
docker run -d --network backend -v "$PWD/config:/app/config:ro" myapp:1.0
```

## Compose

- Define multi-container apps in `compose.yaml`
- `up -d` starts, `down` stops and removes
- `--build` rebuilds images that changed

```yaml
services:
  app:
    image: registry.internal/devtoolkit:1.2.0
    ports: ["8080:8080"]
    read_only: true
    cap_drop: [ALL]
    security_opt: ["no-new-privileges:true"]
    tmpfs: ["/tmp"]
    restart: unless-stopped
```

## Clean up

- `system df` shows what uses disk space
- `system prune` removes stopped containers, unused networks and dangling images
- Add `--volumes` only if you are sure — it deletes data

```bash
docker system df
docker container prune
docker system prune
```

## Security checklist

- Non-root `USER`, read-only filesystem, dropped capabilities
- Scan images (e.g. Trivy) and pin base image versions
- Never put secrets in `ENV` or image layers

```bash
docker run --read-only --cap-drop ALL --security-opt no-new-privileges:true --tmpfs /tmp myapp:1.0
trivy image registry.internal/devtoolkit:1.2.0
```
