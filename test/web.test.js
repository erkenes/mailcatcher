const test = require('node:test');
const assert = require('node:assert/strict');
const { createWebApp } = require('../src/web');
const { version } = require('../package.json');
const de = require('../src/locales/de.json');

function createStore(mails = []) {
  return {
    listMails() {
      return mails;
    },
    getMail(id) {
      return mails.find((mail) => mail.id === id) || null;
    },
    loadFromDisk() {
      return 0;
    },
    deleteMail() {
      return undefined;
    }
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function fetchHtml(path, headers = {}, mails = []) {
  const app = createWebApp(createStore(mails), 7);
  const server = app.listen(0);
  try {
    const { port } = server.address();
    const response = await fetch(`http://127.0.0.1:${port}${path}`, { headers });
    return response.text();
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

test('auto language uses browser language', async () => {
  const html = await fetchHtml('/?lang=auto', { 'Accept-Language': 'en-US,en;q=0.9,de;q=0.8' });

  assert.match(html, /<html lang="en">/);
  assert.match(html, /Language/);
  assert.match(html, /<select name="lang"/);
  assert.match(html, /Retention: 7 days/);
  assert.match(html, /Received mails/);
});

test('explicit german language overrides browser language', async () => {
  const html = await fetchHtml('/?lang=de', { 'Accept-Language': 'en-US,en;q=0.9' });

  assert.match(html, /<html lang="de">/);
  assert.match(html, new RegExp(escapeRegex(de.languageLabel)));
  assert.match(html, new RegExp(`${escapeRegex(de.retentionLabel)}: 7 ${escapeRegex(de.days)}`));
  assert.match(html, new RegExp(escapeRegex(de.sidebarTitle)));
  assert.match(
    html,
    new RegExp(`<option value="de" selected>${escapeRegex(de.languageGerman)}<\\/option>`)
  );
});

test('explicit english language selection is applied', async () => {
  const html = await fetchHtml('/?lang=en', { 'Accept-Language': 'de-DE,de;q=0.9' });

  assert.match(html, /<html lang="en">/);
  assert.match(html, /<option value="en" selected>English<\/option>/);
  assert.match(html, /Reload mails/);
});

test('footer contains version, project link and copyright', async () => {
  const html = await fetchHtml('/');
  const versionPattern = version.replaceAll('.', '\\.');

  assert.match(html, new RegExp(`Version: ${versionPattern}`));
  assert.match(html, /href="https:\/\/github\.com\/erkenes\/mailcatcher"/);
  assert.match(html, /mailcatcher/);
  assert.match(html, /Copyright ©/);
});

test('mail detail is rendered from template with attachment and html toggle', async () => {
  const mail = {
    id: 'mail-1',
    subject: 'Template Mail',
    to: 'user@example.com',
    cc: '',
    bcc: '',
    from: 'sender@example.com',
    text: 'Plain body',
    html: '<p>Hello</p>',
    receivedAt: '2026-01-01T10:00:00.000Z',
    attachmentCount: 1,
    attachments: [
      {
        filename: 'a.txt',
        size: 5,
        contentType: 'text/plain',
        content: Buffer.from('hello')
      }
    ],
    headers: [{ key: 'Message-ID', value: '<abc@example.com>' }]
  };

  const html = await fetchHtml('/?mail=mail-1&mode=html&lang=en', {}, [mail]);

  assert.match(html, /Template Mail/);
  assert.match(html, /href="\/mail\/mail-1\/attachment\/0\?lang=en"/);
  assert.match(html, /href="\/\?mail=mail-1&amp;mode=html&amp;viewport=pc&amp;htmlView=source&amp;lang=en"/);
  assert.match(html, /class="mail-html-frame [^"]*"/);
  assert.match(html, /sandbox="allow-same-origin"/);
  assert.match(html, /id="link-modal-backdrop"/);
  assert.match(html, /role="dialog"/);
  assert.match(html, /aria-modal="true"/);
  assert.match(html, /aria-hidden="true"/);
  assert.match(html, /aria-labelledby="link-modal-title"/);
  assert.match(html, /id="link-modal-title"/);
  assert.match(html, /id="link-modal-url"/);
  assert.match(html, /id="link-modal-open"/);
  assert.match(html, /id="link-modal-cancel"/);
  assert.match(html, /Do you want to open this link\?/);
});
