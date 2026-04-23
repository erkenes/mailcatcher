# ── Stage 1: install production dependencies ─────────────────────────────────
FROM node:20-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:20-alpine

WORKDIR /app

# Copy dependency tree from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src ./src
COPY package.json ./

# Create a non-root user and own the workdir
RUN addgroup -S mailcatcher && adduser -S -G mailcatcher mailcatcher \
    && mkdir -p /data/mails \
    && chown -R mailcatcher:mailcatcher /app /data

USER mailcatcher

ENV SMTP_PORT=2525 \
    WEB_PORT=3000 \
    MAIL_RETENTION_DAYS=7 \
    MAIL_DATA_DIR=/data/mails

EXPOSE 2525
EXPOSE 3000

CMD ["node", "src/index.js"]
