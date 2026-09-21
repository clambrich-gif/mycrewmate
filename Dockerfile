# syntax=docker/dockerfile:1
FROM node:22-bookworm-slim AS build

WORKDIR /app
# Begrenzt Speicherspitzen beim lokalen Build auf einem kleinen Coolify-Host.
# Das Produktionssystem selbst erhält kein künstliches Heap-Limit.
ENV NODE_OPTIONS=--max-old-space-size=512
# Einige Node-22-Basisimages enthalten eine veraltete Corepack-Schlüsselliste.
# Die exakt gepinnte pnpm-Version wird daher direkt installiert, statt beim
# Build eine fehleranfällige Corepack-Signaturprüfung auszulösen.
RUN npm install --global pnpm@10.4.1

COPY package.json pnpm-lock.yaml ./
COPY patches ./patches
RUN pnpm install --frozen-lockfile --reporter=append-only

COPY . .
RUN pnpm build && pnpm prune --prod --reporter=append-only

FROM node:22-bookworm-slim AS runtime

WORKDIR /app
ENV NODE_ENV=production \
    PORT=3000 \
    LOCAL_STORAGE_PATH=/app/data/uploads

RUN mkdir -p /app/data/uploads

# Der eigene Runner ist in dist/migrate.js gebündelt. Er benötigt weder pnpm
# noch Drizzle Kit im Runtime-Image und behandelt ausschließlich nachgewiesene
# historische Doppelspalten kompatibel.
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/client/public ./client/public

EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e 'fetch("http://127.0.0.1:3000/healthz").then(response => process.exit(response.ok ? 0 : 1)).catch(() => process.exit(1))'

CMD ["sh", "-c", "node dist/migrate.js && exec node dist/index.js"]
