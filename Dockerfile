FROM node:22-alpine AS base

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
# libc6-compat provides glibc compatibility shims needed by some native modules
RUN apk add --no-cache libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs \
 && adduser  --system --uid 1001 nextjs

# Standalone bundle + static assets (public/uploads is provided via volume)
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Seed an empty pins file so the app starts cleanly without a volume mounted
RUN mkdir -p data \
 && echo "[]" > data/pins.json \
 && chown -R nextjs:nodejs data public/uploads 2>/dev/null || true

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
