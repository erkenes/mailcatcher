const { SMTPServer } = require('smtp-server');
const { simpleParser } = require('mailparser');

function createSmtpServer(store) {
  return new SMTPServer({
    disabledCommands: ['AUTH', 'STARTTLS'],
    authOptional: true,
    onData(stream, _session, callback) {
      simpleParser(stream)
        .then((parsed) => {
          store.addMail(parsed);
          callback();
        })
        .catch((error) => callback(error));
    }
  });
}

module.exports = { createSmtpServer };
