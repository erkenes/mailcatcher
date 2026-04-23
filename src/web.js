const express = require('express');
const path = require('path');
const { randomBytes, timingSafeEqual } = require('crypto');
const { safeName } = require('./storage');
const de = require('./locales/de.json');
const en = require('./locales/en.json');
const { version: appVersion, name: projectName } = require('../package.json');

const locales = { de, en };
const projectRepositoryUrl = 'https://github.com/erkenes/mailcatcher';

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatDate(date, locale) {
  const localeTag = locale === 'en' ? 'en-US' : 'de-DE';
  return new Intl.DateTimeFormat(localeTag, {
    dateStyle: 'medium',
    timeStyle: 'medium'
  }).format(new Date(date));
}

function contentDispositionFilename(filename) {
  const safeAscii = String(filename).replace(/["\\\r\n;]/g, '_');
  const encoded = encodeURIComponent(String(filename));
  return `attachment; filename="${safeAscii}"; filename*=UTF-8''${encoded}`;
}

function normalizeMode(value) {
  return value === 'html' || value === 'headers' || value === 'split' || value === 'text'
    ? value
    : 'html';
}

function normalizeViewport(value) {
  const viewportOptions = ['pc', 'laptop', 'tablet', 'handy'];
  return viewportOptions.includes(value) ? value : 'pc';
}

function normalizeHtmlView(value) {
  return value === 'source' ? 'source' : 'rendered';
}

function normalizeHeaderFilename(value) {
  return String(value || 'attachment').replace(/["\\\r\n;]/g, '_');
}

function hasContent(value) {
  return typeof value === 'string' ? value.trim().length > 0 : Boolean(value);
}

function defaultModeForMail(mail) {
  const hasHtml = hasContent(mail?.html);
  const hasText = hasContent(mail?.text);
  if (hasHtml) return 'html';
  if (hasText) return 'text';
  return 'headers';
}

function normalizePollInterval(value) {
  return Math.max(1000, Number(value) || 10000);
}

function normalizeLanguage(value) {
  return value === 'de' || value === 'en' || value === 'auto' ? value : 'auto';
}

function detectBrowserLanguage(acceptLanguageHeader) {
  const entries = String(acceptLanguageHeader || '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

  for (const entry of entries) {
    const languageTag = entry.split(';')[0];
    if (languageTag.startsWith('de')) return 'de';
    if (languageTag.startsWith('en')) return 'en';
  }

  return 'de';
}

function resolveLocale(selectedLanguage, acceptLanguageHeader) {
  if (selectedLanguage === 'de' || selectedLanguage === 'en') {
    return selectedLanguage;
  }

  return detectBrowserLanguage(acceptLanguageHeader);
}

function translate(locale, key) {
  return locales[locale]?.[key] || locales.de[key] || key;
}

function requestLocale(req) {
  const selectedLanguage = normalizeLanguage(req.query.lang);
  return resolveLocale(selectedLanguage, req.headers['accept-language']);
}

function toBase64Lines(buffer, lineLength = 76) {
  if (!buffer || buffer.length === 0) {
    return [];
  }
  const encoded = Buffer.from(buffer).toString('base64');
  return encoded.match(new RegExp(`.{1,${lineLength}}`, 'g')) || [];
}

function appendTextPart(lines, contentType, content) {
  lines.push(`Content-Type: ${contentType}; charset=UTF-8`);
  lines.push('Content-Transfer-Encoding: 8bit');
  lines.push('');
  lines.push(String(content || ''));
}

function normalizeContentType(value) {
  const candidate = String(value || '').trim().toLowerCase();
  if (/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(candidate)) {
    return candidate;
  }
  return 'application/octet-stream';
}

function makeBoundary(prefix, mailId) {
  return `${prefix}_${String(mailId || '').replace(/[^a-zA-Z0-9]/g, '') || randomBytes(8).toString('hex')}`;
}

function isValidCsrfToken(received, expected) {
  if (typeof received !== 'string' || received.length !== expected.length) {
    return false;
  }
  try {
    return timingSafeEqual(Buffer.from(received), Buffer.from(expected));
  } catch (_error) {
    return false;
  }
}

function createWebApp(
  store,
  retentionDays,
  pollIntervalMs = 10000,
  appTitle = 'Mailcatcher',
  pageTitle = 'Mailcatcher'
) {
  const app = express();
  app.use(express.urlencoded({ extended: false }));
  app.set('views', path.join(__dirname, 'templates'));
  app.set('view engine', 'ejs');
  const csrfToken = randomBytes(32).toString('hex');
  const safePollIntervalMs = normalizePollInterval(pollIntervalMs);

  app.get('/', (req, res) => {
    const mails = store.listMails();
    const requestedMode = typeof req.query.mode === 'string'
      ? normalizeMode(req.query.mode)
      : null;
    const viewport = normalizeViewport(req.query.viewport);
    const htmlView = normalizeHtmlView(req.query.htmlView);
    const selectedLanguage = normalizeLanguage(req.query.lang);
    const locale = resolveLocale(selectedLanguage, req.headers['accept-language']);
    const t = (key) => translate(locale, key);
    const requestedMailId = typeof req.query.mail === 'string' ? req.query.mail : null;
    const selectedMailSummary = requestedMailId
      ? mails.find((mail) => mail.id === requestedMailId)
      : mails[0];
    const selectedMail = selectedMailSummary ? store.getMail(selectedMailSummary.id) : null;
    const hasHtml = hasContent(selectedMail?.html);
    const hasText = hasContent(selectedMail?.text);
    const hasBodyContent = hasHtml || hasText;
    const isDesktopViewport = viewport === 'pc' || viewport === 'laptop';
    const mode = selectedMail
      ? (requestedMode === 'headers'
        || (requestedMode === 'html' && hasHtml)
        || (requestedMode === 'text' && hasText)
        || (requestedMode === 'split' && hasHtml && hasText)
          ? requestedMode
          : defaultModeForMail(selectedMail))
      : (requestedMode || 'html');

    const viewportClassMap = {
      pc: 'w-full',
      laptop: 'w-full max-w-6xl',
      tablet: 'w-full max-w-[860px]',
      handy: 'w-full max-w-[430px]'
    };

    const splitPaneClassMap = {
      pc: 'min-w-[320px] flex-1 basis-[48%]',
      laptop: 'min-w-[320px] flex-1 basis-[48%]',
      tablet: 'w-[768px] max-w-full',
      handy: 'w-[390px] max-w-full'
    };

    const buildUrlWithParams = (overrides = {}) => {
      const params = new URLSearchParams();
      const mailId = selectedMail?.id || requestedMailId;
      const nextMode = overrides.mode ?? mode;
      const nextViewport = overrides.viewport ?? viewport;
      const nextHtmlView = overrides.htmlView ?? htmlView;
      const nextLanguage = overrides.lang ?? selectedLanguage;
      if (mailId) params.set('mail', mailId);
      if (nextMode) params.set('mode', nextMode);
      if (nextViewport) params.set('viewport', nextViewport);
      if (nextHtmlView) params.set('htmlView', nextHtmlView);
      if (nextLanguage) params.set('lang', nextLanguage);
      const query = params.toString();
      return query ? `/?${query}` : '/';
    };

    res.type('html');
    res.render('index', {
      appTitle,
      appVersion,
      buildUrlWithParams,
      csrfToken,
      formatDate,
      hasBodyContent,
      hasHtml,
      hasText,
      htmlView,
      isDesktopViewport,
      locale,
      mails,
      mode,
      pageTitle,
      projectName,
      projectRepositoryUrl,
      retentionDays,
      safePollIntervalMs,
      selectedLanguage,
      selectedMail,
      splitPaneClass: splitPaneClassMap[viewport],
      t,
      viewport,
      viewportClass: viewportClassMap[viewport]
    });
  });

  app.get('/status', (_req, res) => {
    const mails = store.listMails();
    res.json({
      count: mails.length,
      latestId: mails[0]?.id || null
    });
  });

  app.get('/reload', (req, res) => {
    store.loadFromDisk();
    const language = normalizeLanguage(req.query.lang);
    res.redirect(`/?lang=${encodeURIComponent(language)}`);
  });

  app.get('/mail/:id', (req, res) => {
    const language = normalizeLanguage(req.query.lang);
    res.redirect(`/?mail=${encodeURIComponent(req.params.id)}&lang=${encodeURIComponent(language)}`);
  });

  app.post('/mail/:id/delete', (req, res) => {
    const locale = requestLocale(req);
    const t = (key) => translate(locale, key);
    if (!isValidCsrfToken(req.body.csrf, csrfToken)) {
      res.status(403).type('text').send(t('invalidCsrfToken'));
      return;
    }
    store.deleteMail(req.params.id);
    const language = normalizeLanguage(req.query.lang);
    res.redirect(`/?lang=${encodeURIComponent(language)}`);
  });

  app.get('/mail/:id/download', (req, res) => {
    const locale = requestLocale(req);
    const t = (key) => translate(locale, key);
    const mail = store.getMail(req.params.id);
    if (!mail) {
      res.status(404).type('text').send(t('mailNotFound'));
      return;
    }

    const lines = [];
    lines.push(`From: ${mail.from || ''}`);
    lines.push(`To: ${mail.to || ''}`);
    if (mail.cc) lines.push(`Cc: ${mail.cc}`);
    if (mail.bcc) lines.push(`Bcc: ${mail.bcc}`);
    lines.push(`Subject: ${mail.subject || ''}`);
    lines.push(`Date: ${new Date(mail.receivedAt).toUTCString()}`);
    lines.push('MIME-Version: 1.0');

    const hasHtml = Boolean(mail.html);
    const hasAttachments = mail.attachments.length > 0;

    if (hasAttachments) {
      const mixedBoundary = makeBoundary('mixed', mail.id);
      lines.push(`Content-Type: multipart/mixed; boundary="${mixedBoundary}"`);
      lines.push('');
      lines.push(`--${mixedBoundary}`);

      if (hasHtml) {
        const altBoundary = makeBoundary('alt', mail.id);
        lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
        lines.push('');
        lines.push(`--${altBoundary}`);
        appendTextPart(lines, 'text/plain', mail.text || '');
        lines.push(`--${altBoundary}`);
        appendTextPart(lines, 'text/html', mail.html);
        lines.push(`--${altBoundary}--`);
      } else {
        appendTextPart(lines, 'text/plain', mail.text || '');
      }

      for (const attachment of mail.attachments) {
        lines.push(`--${mixedBoundary}`);
        lines.push(`Content-Type: ${normalizeContentType(attachment.contentType)}; name="${normalizeHeaderFilename(attachment.filename)}"`);
        lines.push('Content-Transfer-Encoding: base64');
        lines.push(`Content-Disposition: attachment; filename="${normalizeHeaderFilename(attachment.filename)}"`);
        lines.push('');
        lines.push(...toBase64Lines(attachment.content || Buffer.alloc(0)));
      }
      lines.push(`--${mixedBoundary}--`);
    } else if (hasHtml) {
      const altBoundary = makeBoundary('alt', mail.id);
      lines.push(`Content-Type: multipart/alternative; boundary="${altBoundary}"`);
      lines.push('');
      lines.push(`--${altBoundary}`);
      appendTextPart(lines, 'text/plain', mail.text || '');
      lines.push(`--${altBoundary}`);
      appendTextPart(lines, 'text/html', mail.html);
      lines.push(`--${altBoundary}--`);
    } else {
      appendTextPart(lines, 'text/plain', mail.text || '');
    }

    const eml = `${lines.join('\r\n')}\r\n`;

    const filenameBase = safeName(mail.subject || `mail-${mail.id}`);
    res.setHeader('Content-Type', 'message/rfc822; charset=UTF-8');
    res.setHeader('Content-Disposition', contentDispositionFilename(`${filenameBase}.eml`));
    res.send(eml);
  });

  app.get('/mail/:id/attachment/:index', (req, res) => {
    const locale = requestLocale(req);
    const t = (key) => translate(locale, key);
    const mail = store.getMail(req.params.id);
    if (!mail) {
      res.status(404).type('text').send(t('mailNotFound'));
      return;
    }

    const index = Number(req.params.index);
    const attachment = mail.attachments[index];
    if (!attachment) {
      res.status(404).type('text').send(t('attachmentNotFound'));
      return;
    }

    res.setHeader('Content-Type', attachment.contentType);
    res.setHeader('Content-Disposition', contentDispositionFilename(attachment.filename));
    res.send(attachment.content);
  });

  return app;
}

module.exports = { createWebApp };
