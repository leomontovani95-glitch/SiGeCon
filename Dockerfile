# ── Estágio 1: build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS builder
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npx prisma generate
RUN npm run build

# ── Estágio 2: produção ───────────────────────────────────────────────────────
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S sigecon && adduser -S sigecon -G sigecon

COPY --from=builder /app/public          ./public
COPY --from=builder /app/.next           ./.next
COPY --from=builder /app/node_modules    ./node_modules
COPY --from=builder /app/package.json    ./package.json
COPY --from=builder /app/prisma          ./prisma
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

# Diretório persistente para o banco de dados SQLite
RUN mkdir -p /app/data && chown sigecon:sigecon /app/data

USER sigecon

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0
# Banco de dados armazenado no volume montado em /app/data
ENV DATABASE_URL=file:./data/db.sqlite

# Aplica migrações pendentes e inicia o servidor
CMD ["sh", "-c", "npx prisma migrate deploy && npm start"]
