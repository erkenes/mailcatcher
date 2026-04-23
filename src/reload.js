#!/usr/bin/env node
'use strict';

const http = require('http');

const port = Number(process.env.WEB_PORT || 3000);
const host = process.env.WEB_HOST || '127.0.0.1';

const url = `http://${host}:${port}/reload`;

console.log(`Triggering mail reload via ${url} ...`);

const req = http.get(url, (res) => {
  if (res.statusCode === 302 || res.statusCode === 301) {
    const location = res.headers.location || '/';
    const reloaded = new URL(location, url).searchParams.get('reloaded');
    const count = reloaded !== null ? reloaded : '?';
    console.log(`Reload successful – ${count} mail(s) loaded from disk.`);
  } else if (res.statusCode >= 200 && res.statusCode < 300) {
    console.log(`Reload successful (HTTP ${res.statusCode}).`);
  } else {
    console.error(`Unexpected response: HTTP ${res.statusCode}`);
    process.exitCode = 1;
  }
  res.resume();
});

req.on('error', (err) => {
  console.error(`Could not connect to ${url}: ${err.message}`);
  console.error('Make sure the mailcatcher is running.');
  process.exitCode = 1;
});
