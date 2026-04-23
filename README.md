# Mailcatcher

Node.js project that simulates a mailcatcher.

## Features

- SMTP server without TLS/STARTTLS and without authentication
- Incoming emails are stored on disk (one directory per email)
- Existing emails are automatically loaded from disk on startup
- Web UI to display:
  - Sender/recipient/subject/time
  - Headers
  - Text and HTML content
  - Attachments (including download)
- Automatic deletion of old emails after `MAIL_RETENTION_DAYS` (including files)
- Emails can be reloaded from disk via a GET request **or** a CLI command

## Start

### With Docker Compose

```yaml
services:
  mailcatcher:
    image: erkenes/mailcatcher
    container_name: mailcatcher
    restart: unless-stopped
    ports:
      - "${SMTP_PORT:-2525}:2525"
      - "${WEB_PORT:-3000}:3000"
    networks:
      - mailcatcher
    volumes:
      - mail-data:/data/mails
    environment:
      SMTP_PORT: 2525
      WEB_PORT: 3000
      MAIL_RETENTION_DAYS: ${MAIL_RETENTION_DAYS:-7}
      MAIL_DATA_DIR: /data/mails

volumes:
  mail-data:

networks:
  mailcatcher:
    name: mailcatcher
    driver: bridge
```

### From Source-Code

#### Directly (Node.js)

```bash
npm install
npm start
```

#### Docker Compose (recommended)

```bash
# Build image and start containers
docker compose up --build -d

# Show logs
docker compose logs -f

# Stop containers
docker compose down
```

Mail data is persisted in a named Docker volume (`mail-data`) and survives container restarts.

#### Docker (without Compose)

```bash
# Build image
docker build -t mailcatcher .

# Start container
docker run -d \
  --name mailcatcher \
  -p 2525:2525 \
  -p 3000:3000 \
  -v mail-data:/data/mails \
  mailcatcher
```

## Reload emails

### Via browser / GET request

```
GET http://localhost:3000/reload
```

Or click the **"Reload mails"** link on the start page in the browser.

### Via command line

```bash
npm run reload
```

The script calls the running server at `WEB_HOST:WEB_PORT/reload` and prints the number of emails loaded.

## Disk storage structure

```
<MAIL_DATA_DIR>/
  <uuid>/
    meta.json                   # Metadata (From, To, Subject, Headers, Text, HTML)
    attachment_0_filename.ext   # Attachments as raw files
    attachment_1_…
```

## Environment variables

| Variable                | Default        | Description                                  |
|-------------------------|----------------|----------------------------------------------|
| `SMTP_PORT`             | `2525`         | SMTP server port                             |
| `WEB_PORT`              | `3000`         | Web UI port                                  |
| `MAIL_RETENTION_DAYS`   | `7`            | Retention time in days                       |
| `MAIL_DATA_DIR`         | `./data/mails` | Directory for persisted emails               |
| `MAIL_POLL_INTERVAL_MS` | `10000`        | Frontend polling interval in milliseconds    |
| `MAIL_APP_TITLE`        | `Mailcatcher`  | Heading in the page header (H1)              |
| `MAIL_PAGE_TITLE`       | `Mailcatcher`  | Content of the HTML `<title>` tag            |
| `WEB_HOST`              | `127.0.0.1`    | Host for `npm run reload` (CLI script only)  |

The UI supports German and English. Translations are stored as JSON files in `src/locales/`.
