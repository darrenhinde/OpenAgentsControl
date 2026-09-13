#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const cliDist = path.join(__dirname, '..', 'packages', 'cli', 'dist', 'index.js');

if (!fs.existsSync(cliDist)) {
  console.error('Error: OAC CLI not built yet. Run: npm run build -w packages/cli');
  process.exit(1);
}

// Re-exec the bundled CLI on the SAME Node binary that is running this shim, so
// `oac` works wherever `npm i -g` could install it — no Bun, no PATH lookup.
try {
  execFileSync(process.execPath, [cliDist, ...process.argv.slice(2)], { stdio: 'inherit' });
} catch (err) {
  process.exitCode = err.status ?? 1;
}
