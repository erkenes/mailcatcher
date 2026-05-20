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
    deleteMail(id) {
      const index = mails.findIndex((mail) => mail.id === id);
      if (index === -1) {
        return false;
      }
      mails.splice(index, 1);
      return true;
    }
  };
}

function escapeRegex(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function withServer(mails, callback) {
  const app = createWebApp(createStore(mails), 7);
  const server = app.listen(0);
  try {
    const { port } = server.address();
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

async function fetchHtml(path, headers = {}, mails = []) {
  return withServer(mails, async (baseUrl) => {
    const response = await fetch(`${baseUrl}${path}`, { headers });
    return response.text();
  });
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
  assert.match(html, /<select id="theme-select"/);
  assert.match(html, /<option value="auto">Auto \(System\)<\/option>/);
  assert.match(html, /<option value="dark">Dark<\/option>/);
  assert.match(html, /<option value="light">Light<\/option>/);
  assert.match(html, /href="https:\/\/github\.com\/erkenes\/mailcatcher"/);
  assert.match(html, /mailcatcher/);
  assert.match(html, /Copyright ©/);
});

test('template persists language and theme preferences in localStorage', async () => {
  const html = await fetchHtml('/');

  assert.match(html, /mailcatcher-language/);
  assert.match(html, /mailcatcher-theme/);
  assert.match(html, /localStorage\.setItem\(languageStorageKey/);
  assert.match(html, /localStorage\.setItem\(themeStorageKey/);
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
  assert.match(html, /id="delete-all-button"/);
  assert.match(html, /id="delete-all-modal-backdrop"/);
  assert.match(html, /id="delete-all-modal-title"/);
  assert.match(html, /id="delete-all-modal-cancel"/);
  assert.match(html, /id="delete-all-modal-confirm"/);
  assert.match(html, /Delete all emails/);
  assert.match(html, /Do you really want to delete all emails\?/);
});

test('delete-all endpoint removes all mails and redirects to index', async () => {
  const mails = [
    {
      id: 'mail-1',
      subject: 'First mail',
      to: 'one@example.com',
      cc: '',
      bcc: '',
      from: 'sender@example.com',
      text: 'One',
      html: '',
      receivedAt: '2026-01-01T10:00:00.000Z',
      attachmentCount: 0,
      attachments: [],
      headers: []
    },
    {
      id: 'mail-2',
      subject: 'Second mail',
      to: 'two@example.com',
      cc: '',
      bcc: '',
      from: 'sender@example.com',
      text: 'Two',
      html: '',
      receivedAt: '2026-01-01T11:00:00.000Z',
      attachmentCount: 0,
      attachments: [],
      headers: []
    }
  ];

  await withServer(mails, async (baseUrl) => {
    const pageResponse = await fetch(`${baseUrl}/?lang=en`);
    const pageHtml = await pageResponse.text();
    const csrfToken = pageHtml.match(/name="csrf" value="([^"]+)"/)?.[1];
    assert.ok(csrfToken, 'CSRF token should be present in page');

    const response = await fetch(`${baseUrl}/mail/delete-all?lang=en`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ csrf: csrfToken }).toString(),
      redirect: 'manual'
    });

    assert.equal(response.status, 302);
    assert.equal(response.headers.get('location'), '/?lang=en');
    assert.equal(mails.length, 0);
  });
});
