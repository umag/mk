# syntax=docker/dockerfile:1

# ── Stage 1: build the frontend (Vite → /app/dist) ──────────────────────────
FROM node:22-alpine AS web
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json vite.config.ts index.html ./
COPY public ./public
COPY src ./src
RUN npm run build

# ── Stage 2: runtime — Deno serves the REST API + the built frontend ────────
FROM denoland/deno:2.8.3
WORKDIR /app
COPY deno.json ./
COPY src ./src
COPY server ./server
COPY --from=web /app/dist ./dist

ENV MK_STATIC=/app/dist \
    MK_DB=/data/mk.db \
    MK_PORT=8787

# Run as the non-root `deno` user (uid 1000). A FRESH named volume inherits this
# ownership so the DB stays writable; an existing root-owned volume needs a one-time
# `chown -R 1000:1000` (see README → Exposing it publicly).
RUN mkdir -p /data && chown -R deno:deno /data
EXPOSE 8787
VOLUME ["/data"]
USER deno

# node:sqlite needs FFI; the static dir + DB need read/write.
CMD ["deno", "run", "--allow-net", "--allow-read", "--allow-write", "--allow-env", "--allow-ffi", "server/main.ts"]
