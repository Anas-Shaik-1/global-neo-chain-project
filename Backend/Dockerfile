# syntax=docker/dockerfile:1.7
# ─── build stage ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app

RUN corepack enable && corepack prepare pnpm@latest --activate

# Install with frozen lockfile against the Backend lockfile only.
COPY package.json pnpm-lock.yaml ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

COPY tsconfig.json ./
COPY src ./src
RUN pnpm exec tsc -p tsconfig.json

# Drop dev deps for the runtime image.
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --prod --frozen-lockfile

# ─── runtime stage ────────────────────────────────────────────────────────────
FROM node:22-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production \
    UPLOADS_DIR=/app/uploads \
    PORT=3000

# bcrypt is a native module; node:alpine ships musl so the prebuild for x64 is
# already valid. No extra build deps needed once /node_modules is copied.

COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY package.json ./

RUN mkdir -p /app/uploads \
    && addgroup -S app && adduser -S app -G app \
    && chown -R app:app /app
USER app

EXPOSE 3000
VOLUME ["/app/uploads"]

# Liveness probe: hit /health/live (no DB roundtrip). Orchestrators that want
# readiness should hit /health/ready.
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD node -e "require('http').get('http://127.0.0.1:'+ (process.env.PORT||3000) +'/health/live', r => { process.exit(r.statusCode === 200 ? 0 : 1); }).on('error', () => process.exit(1));"

CMD ["node", "dist/server.js"]
