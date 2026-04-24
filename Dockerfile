# ── Stage 1: install production dependencies ─────────────────────────────────
FROM dhi.io/node:24-dev AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM dhi.io/node:24

WORKDIR /app

# Copy dependency tree from previous stage
COPY --from=deps /app/node_modules ./node_modules

# Copy application source
COPY src ./src
COPY package.json ./

ENV SMTP_PORT=2525 \
    WEB_PORT=3000 \
    MAIL_RETENTION_DAYS=7 \
    MAIL_DATA_DIR=/data/mails

EXPOSE 2525
EXPOSE 3000

CMD ["node", "src/index.js"]
