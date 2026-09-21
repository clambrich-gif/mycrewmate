# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build

WORKDIR /app
RUN corepack enable

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile

COPY . .
RUN pnpm build

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    LOCAL_STORAGE_PATH=/app/data/uploads

RUN corepack enable && mkdir -p /app/data/uploads

# Drizzle Kit is intentionally retained at runtime: every deployment applies
# the committed, additive migrations before the web server starts.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json /app/pnpm-lock.yaml ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts
COPY --from=build /app/client/public ./client/public

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e 'fetch("http://127.0.0.1:3000/healthz").then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))'

CMD ["pnpm", "start:coolify"]
