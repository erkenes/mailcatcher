const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

function safeName(name) {
  return String(name)
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/^\.+/, '_')
    .slice(0, 100) || 'file';
}

class MailStore {
  constructor(dataDir) {
    this.mails = [];
    this.dataDir = dataDir || null;
  }

  addMail(parsedMail) {
    const id = randomUUID();
    const headers = parsedMail.headerLines?.length
      ? parsedMail.headerLines.map((line) => ({
          key: line.key,
          value: line.line
        }))
      : Array.from(parsedMail.headers, ([key, value]) => ({
          key,
          value: formatHeaderValue(value)
        }));

    const attachments = (parsedMail.attachments || []).map((attachment) => ({
      filename: attachment.filename || 'attachment',
      contentType: attachment.contentType || 'application/octet-stream',
      size: attachment.size || attachment.content?.length || 0,
      content: attachment.content
    }));

    const mail = {
      id,
      receivedAt: new Date(),
      from: parsedMail.from?.text || '',
      to: parsedMail.to?.text || '',
      cc: parsedMail.cc?.text || '',
      bcc: parsedMail.bcc?.text || '',
      subject: parsedMail.subject || '',
      text: parsedMail.text || '',
      html: parsedMail.html || '',
      headers,
      attachments
    };

    this.mails.unshift(mail);

    if (this.dataDir) {
      this._persistMail(mail);
    }

    return mail;
  }

  _persistMail(mail) {
    const mailDir = path.join(this.dataDir, mail.id);
    fs.mkdirSync(mailDir, { recursive: true });

    const attachmentMeta = mail.attachments.map((att, index) => {
      const file = `attachment_${index}_${safeName(att.filename)}`;
      if (att.content) {
        fs.writeFileSync(path.join(mailDir, file), att.content);
      }
      return {
        filename: att.filename,
        contentType: att.contentType,
        size: att.size,
        file: att.content ? file : null
      };
    });

    const meta = {
      id: mail.id,
      receivedAt: mail.receivedAt.toISOString(),
      from: mail.from,
      to: mail.to,
      cc: mail.cc,
      bcc: mail.bcc,
      subject: mail.subject,
      text: mail.text,
      html: mail.html,
      headers: mail.headers,
      attachments: attachmentMeta
    };

    fs.writeFileSync(path.join(mailDir, 'meta.json'), JSON.stringify(meta, null, 2));
  }

  loadFromDisk() {
    if (!this.dataDir) return 0;
    if (!fs.existsSync(this.dataDir)) return 0;

    const entries = fs.readdirSync(this.dataDir, { withFileTypes: true });
    const loaded = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const mailDir = path.join(this.dataDir, entry.name);
      const metaPath = path.join(mailDir, 'meta.json');
      if (!fs.existsSync(metaPath)) continue;

      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

        const attachments = (meta.attachments || []).map((att) => {
          let content = null;
          if (att.file) {
            const filePath = path.join(mailDir, att.file);
            if (fs.existsSync(filePath)) {
              content = fs.readFileSync(filePath);
            }
          }
          return {
            filename: att.filename,
            contentType: att.contentType,
            size: att.size,
            content
          };
        });

        loaded.push({
          id: meta.id,
          receivedAt: new Date(meta.receivedAt),
          from: meta.from || '',
          to: meta.to || '',
          cc: meta.cc || '',
          bcc: meta.bcc || '',
          subject: meta.subject || '',
          text: meta.text || '',
          html: meta.html || '',
          headers: meta.headers || [],
          attachments
        });
      } catch (error) {
        console.error(`Failed to load mail from ${mailDir}:`, error.message);
      }
    }

    loaded.sort((a, b) => b.receivedAt.getTime() - a.receivedAt.getTime());
    this.mails = loaded;
    return loaded.length;
  }

  listMails() {
    return this.mails.map((mail) => ({
      id: mail.id,
      receivedAt: mail.receivedAt,
      from: mail.from,
      to: mail.to,
      cc: mail.cc,
      bcc: mail.bcc,
      subject: mail.subject,
      attachmentCount: mail.attachments.length
    }));
  }

  getMail(id) {
    return this.mails.find((mail) => mail.id === id);
  }

  deleteMail(id) {
    const index = this.mails.findIndex((mail) => mail.id === id);
    if (index === -1) {
      return false;
    }

    const [removed] = this.mails.splice(index, 1);

    if (this.dataDir) {
      const mailDir = path.join(this.dataDir, removed.id);
      try {
        fs.rmSync(mailDir, { recursive: true, force: true });
      } catch (_error) {
        // ignore cleanup errors
      }
    }

    return true;
  }

  deleteOlderThanDays(days, now = new Date()) {
    const retentionMs = Math.max(0, Number(days) || 0) * 24 * 60 * 60 * 1000;
    const cutoff = now.getTime() - retentionMs;
    const beforeCount = this.mails.length;

    const removed = this.mails.filter((mail) => mail.receivedAt.getTime() < cutoff);
    this.mails = this.mails.filter((mail) => mail.receivedAt.getTime() >= cutoff);

    if (this.dataDir) {
      for (const mail of removed) {
        const mailDir = path.join(this.dataDir, mail.id);
        try {
          fs.rmSync(mailDir, { recursive: true, force: true });
        } catch (_error) {
          // ignore cleanup errors
        }
      }
    }

    return beforeCount - this.mails.length;
  }
}

function formatHeaderValue(value) {
  if (value === null || value === undefined) {
    return '';
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => formatHeaderValue(entry)).join(', ');
  }

  if (typeof value === 'object') {
    if (typeof value.text === 'string') {
      return value.text;
    }

    if (Array.isArray(value.value)) {
      const addresses = value.value
        .map((entry) => entry?.address || entry?.name)
        .filter(Boolean);
      if (addresses.length > 0) {
        return addresses.join(', ');
      }
    }

    try {
      return JSON.stringify(value);
    } catch (_error) {
      return String(value);
    }
  }

  return String(value);
}

function startCleanup(store, retentionDays, intervalMs = 60 * 60 * 1000) {
  const runCleanup = () => store.deleteOlderThanDays(retentionDays);
  runCleanup();
  return setInterval(runCleanup, intervalMs);
}

module.exports = {
  MailStore,
  startCleanup,
  safeName
};
