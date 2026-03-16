# ── Stage 1: Install production dependencies ──
FROM node:20-slim AS deps
WORKDIR /app

COPY package.json ./
RUN npm install --omit=dev

# ── Stage 2: Build ──
FROM node:20-slim AS builder
WORKDIR /app

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY prisma ./prisma
RUN npx prisma generate

COPY . .
RUN npm run build

# ── Stage 3: Production ──
FROM node:20-slim AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

RUN addgroup --system --gid 1001 nestjs && \
    adduser --system --uid 1001 nestjs

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/package.json ./package.json

USER nestjs
EXPOSE 4000

CMD ["node", "dist/src/main.js"]
