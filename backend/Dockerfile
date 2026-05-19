FROM node:20-slim AS builder
WORKDIR /app
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npx prisma generate
RUN npx tsc -p tsconfig.json

FROM node:20-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci && npm cache clean --force
RUN npx prisma generate
COPY --from=builder /app/dist ./dist
# Asseturi statice citite de seed (chest visual SVG-uri). Editand fisierele si
# re-deploy → seed-ul detecteaza schimbarea si re-scrie continutul in DB.
COPY assets ./assets
EXPOSE 4000
# Seed-ul are guard intern: pe DB deja populata se opreste imediat (1 query).
# Pe DB virgina populeaza catalogul. Pentru re-aplicare seed (dupa adaugare
# item-uri/carduri/challenges noi): FORCE_SEED=1 docker compose up -d backend
# o singura data, apoi scoate flagul.
CMD ["sh", "-c", "npx prisma migrate deploy && npx prisma db seed && node dist/server.js"]
