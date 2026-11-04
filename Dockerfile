# Orcanva as one self-contained image: the Next.js standalone server, plus
# the database migrations, which run each time the container starts.
# Build: docker build -t orcanva .
# Run:   docker run --env-file .env -p 3000:3000 orcanva

ARG NODE_MAJOR=24
# The runner is plain Alpine with node copied in, so both stages use the
# same Alpine release and node finds the libraries it was built against
ARG ALPINE_VERSION=3.24

FROM node:${NODE_MAJOR}-alpine${ALPINE_VERSION} AS base
ARG PNPM_VERSION=11.28.9
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm install --global corepack@latest && corepack enable \
  && corepack prepare pnpm@${PNPM_VERSION} --activate
WORKDIR /app

FROM base AS dependencies
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN --mount=type=cache,id=pnpm,target=/root/.local/share/pnpm/store \
  pnpm install --frozen-lockfile

FROM base AS builder
# Canonical URLs, the sitemap and share images in prerendered pages use the
# address at build time; links in emails read SITE_URL when the server runs
ARG SITE_URL
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .
ENV NODE_ENV=production
RUN pnpm build
# One file with its dependencies, so the runner needs no drizzle-kit
RUN pnpm dlx esbuild@0.28.2 scripts/migrate.ts --bundle --platform=node \
  --format=esm --target=node24 --outfile=migrate.mjs

FROM node:${NODE_MAJOR}-alpine${ALPINE_VERSION} AS node

# Plain Alpine with only the node binary: no npm, yarn, corepack or headers
FROM alpine:${ALPINE_VERSION} AS runner
RUN apk add --no-cache libstdc++ \
  && addgroup -g 1000 node && adduser -u 1000 -G node -s /bin/sh -D node
COPY --from=node /usr/local/bin/node /usr/local/bin/node
WORKDIR /app
ENV NODE_ENV=production \
  NEXT_TELEMETRY_DISABLED=1 \
  PORT=3000 \
  HOSTNAME=0.0.0.0
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/migrate.mjs ./migrate.mjs
USER node
EXPOSE 3000
# robots.txt is prerendered, so this asks nothing of the database
HEALTHCHECK --interval=30s --timeout=5s --start-period=60s \
  CMD wget -q --spider "http://127.0.0.1:${PORT}/robots.txt" || exit 1
# SKIP_MIGRATIONS=1 starts the server without touching the schema
CMD ["sh", "-c", "[ \"$SKIP_MIGRATIONS\" = 1 ] || node migrate.mjs && exec node server.js"]
