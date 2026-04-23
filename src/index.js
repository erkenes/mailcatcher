const { MailStore, startCleanup } = require('./storage');
const { createSmtpServer } = require('./mailcatcher');
const { createWebApp } = require('./web');

const smtpPort = Number(process.env.SMTP_PORT || 2525);
const webPort = Number(process.env.WEB_PORT || 3000);
const retentionDays = Number(process.env.MAIL_RETENTION_DAYS || 7);
const dataDir = process.env.MAIL_DATA_DIR || './data/mails';
const pollIntervalMs = Number(process.env.MAIL_POLL_INTERVAL_MS || 10000);
const appTitle = process.env.MAIL_APP_TITLE || 'Mailcatcher';
const pageTitle = process.env.MAIL_PAGE_TITLE || 'Mailcatcher';

const store = new MailStore(dataDir);

const loadedCount = store.loadFromDisk();
if (loadedCount > 0) {
  console.log(`Loaded ${loadedCount} mail(s) from disk (${dataDir})`);
}

const smtpServer = createSmtpServer(store);
const app = createWebApp(store, retentionDays, pollIntervalMs, appTitle, pageTitle);

const cleanupTimer = startCleanup(store, retentionDays);

smtpServer.listen(smtpPort, '0.0.0.0', () => {
  console.log(`SMTP server listening on port ${smtpPort}`);
});

const webServer = app.listen(webPort, '0.0.0.0', () => {
  console.log(`Web UI listening on port ${webPort}`);
});

function shutdown() {
  clearInterval(cleanupTimer);
  smtpServer.close(() => {
    webServer.close(() => process.exit(0));
  });
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
