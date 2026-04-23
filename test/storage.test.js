const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { MailStore, safeName } = require('../src/storage');

// ── helpers ────────────────────────────────────────────────────────────────

function makeTmpDir() {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'mailstore-test-'));
}

function makeParsedMail(overrides = {}) {
  return {
    headers: new Map(),
    headerLines: [{ key: 'subject', line: 'Subject: hello' }],
    attachments: [],
    subject: 'hello',
    from: { text: 'a@example.com' },
    to: { text: 'b@example.com' },
    text: 'body',
    html: '',
    ...overrides
  };
}

// ── existing behaviour ─────────────────────────────────────────────────────

test('deleteOlderThanDays removes mails older than retention', () => {
  const store = new MailStore();

  const oldMail = store.addMail({ headers: new Map(), attachments: [], subject: 'old' });
  const newMail = store.addMail({ headers: new Map(), attachments: [], subject: 'new' });

  oldMail.receivedAt = new Date('2026-01-01T00:00:00.000Z');
  newMail.receivedAt = new Date('2026-01-10T00:00:00.000Z');

  const removed = store.deleteOlderThanDays(5, new Date('2026-01-10T00:00:00.000Z'));

  assert.equal(removed, 1);
  assert.equal(store.listMails().length, 1);
  assert.equal(store.listMails()[0].subject, 'new');
});

test('addMail stores headers and attachment metadata', () => {
  const store = new MailStore();
  const mail = store.addMail({
    headerLines: [{ key: 'from', line: 'From: alice@example.com' }],
    headers: new Map([
      ['x-test', 'value'],
      ['from', { text: 'alice@example.com' }]
    ]),
    attachments: [{ filename: 'a.txt', contentType: 'text/plain', size: 4, content: Buffer.from('test') }],
    subject: 'subject'
  });

  assert.equal(mail.headers[0].key, 'from');
  assert.equal(mail.headers[0].value, 'From: alice@example.com');
  assert.equal(mail.attachments[0].filename, 'a.txt');
  assert.equal(mail.attachments[0].size, 4);
});

test('addMail stores cc and bcc fields', () => {
  const store = new MailStore();
  const mail = store.addMail(
    makeParsedMail({
      cc: { text: 'cc@example.com' },
      bcc: { text: 'bcc@example.com' }
    })
  );

  assert.equal(mail.cc, 'cc@example.com');
  assert.equal(mail.bcc, 'bcc@example.com');
});

// ── disk persistence ────────────────────────────────────────────────────────

test('addMail persists meta.json to disk when dataDir is configured', () => {
  const dir = makeTmpDir();
  try {
    const store = new MailStore(dir);
    const mail = store.addMail(makeParsedMail());

    const metaPath = path.join(dir, mail.id, 'meta.json');
    assert.ok(fs.existsSync(metaPath), 'meta.json should exist');

    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    assert.equal(meta.id, mail.id);
    assert.equal(meta.subject, 'hello');
    assert.equal(meta.from, 'a@example.com');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('addMail writes attachment file to disk', () => {
  const dir = makeTmpDir();
  try {
    const store = new MailStore(dir);
    const mail = store.addMail(
      makeParsedMail({
        attachments: [
          { filename: 'hello.txt', contentType: 'text/plain', size: 5, content: Buffer.from('world') }
        ]
      })
    );

    const mailDir = path.join(dir, mail.id);
    const meta = JSON.parse(fs.readFileSync(path.join(mailDir, 'meta.json'), 'utf8'));

    assert.equal(meta.attachments.length, 1);
    const attFile = meta.attachments[0].file;
    assert.ok(attFile, 'file field should be set');

    const content = fs.readFileSync(path.join(mailDir, attFile));
    assert.equal(content.toString(), 'world');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('loadFromDisk restores mails from persisted files', () => {
  const dir = makeTmpDir();
  try {
    const store1 = new MailStore(dir);
    store1.addMail(makeParsedMail({ subject: 'first' }));
    store1.addMail(makeParsedMail({ subject: 'second' }));

    const store2 = new MailStore(dir);
    const count = store2.loadFromDisk();

    assert.equal(count, 2);
    const subjects = store2.listMails().map((m) => m.subject);
    assert.ok(subjects.includes('first'));
    assert.ok(subjects.includes('second'));
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('loadFromDisk restores attachment content', () => {
  const dir = makeTmpDir();
  try {
    const store1 = new MailStore(dir);
    const original = store1.addMail(
      makeParsedMail({
        attachments: [
          { filename: 'data.bin', contentType: 'application/octet-stream', size: 3, content: Buffer.from([1, 2, 3]) }
        ]
      })
    );

    const store2 = new MailStore(dir);
    store2.loadFromDisk();
    const loaded = store2.getMail(original.id);

    assert.ok(loaded, 'mail should be found');
    assert.equal(loaded.attachments.length, 1);
    assert.deepEqual([...loaded.attachments[0].content], [1, 2, 3]);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('deleteOlderThanDays removes mail directory from disk', () => {
  const dir = makeTmpDir();
  try {
    const store = new MailStore(dir);
    const mail = store.addMail(makeParsedMail({ subject: 'old' }));
    mail.receivedAt = new Date('2026-01-01T00:00:00.000Z');

    const mailDir = path.join(dir, mail.id);
    assert.ok(fs.existsSync(mailDir), 'directory should exist before deletion');

    store.deleteOlderThanDays(5, new Date('2026-01-10T00:00:00.000Z'));

    assert.ok(!fs.existsSync(mailDir), 'directory should be removed after deletion');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('deleteMail removes mail from store and disk', () => {
  const dir = makeTmpDir();
  try {
    const store = new MailStore(dir);
    const mail = store.addMail(makeParsedMail({ subject: 'delete me' }));
    const mailDir = path.join(dir, mail.id);
    assert.ok(fs.existsSync(mailDir), 'directory should exist before deletion');

    const deleted = store.deleteMail(mail.id);
    assert.equal(deleted, true);
    assert.equal(store.getMail(mail.id), undefined);
    assert.ok(!fs.existsSync(mailDir), 'directory should be removed after deletion');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

// ── safeName ────────────────────────────────────────────────────────────────

test('safeName replaces unsafe characters', () => {
  assert.equal(safeName('my file?.txt'), 'my_file_.txt');
  // slashes are replaced, dots are kept (safe within a mailDir)
  assert.equal(safeName('../../etc/passwd'), '__.._etc_passwd');
  assert.ok(safeName('').length > 0, 'empty name should not be empty string');
});
