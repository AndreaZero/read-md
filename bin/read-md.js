#!/usr/bin/env node
'use strict';

const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const { startServer } = require('../lib/server');

const HELP = `
read-md — visualizzatore di documentazione Markdown

Uso:
  read-md [cartella] [opzioni]

Esempi:
  read-md              Scansiona il progetto corrente (tutti i file .md)
  read-md docs         Mostra solo la cartella ./docs
  read-md C:\\proj      Scansiona un'altra cartella

Opzioni:
  -p, --port <n>   Porta del server (default: 8765, se occupata usa la successiva)
  -n, --no-open    Non aprire automaticamente il browser
  -h, --help       Mostra questo aiuto
  -v, --version    Mostra la versione
`;

function parseArgs(argv) {
  const opts = { root: process.cwd(), port: 8765, open: true };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '-h' || a === '--help') {
      console.log(HELP);
      process.exit(0);
    } else if (a === '-v' || a === '--version') {
      console.log(require('../package.json').version);
      process.exit(0);
    } else if (a === '-n' || a === '--no-open') {
      opts.open = false;
    } else if (a === '-p' || a === '--port') {
      const n = parseInt(argv[++i], 10);
      if (!Number.isInteger(n) || n < 1 || n > 65535) {
        console.error('Porta non valida.');
        process.exit(1);
      }
      opts.port = n;
    } else if (!a.startsWith('-')) {
      opts.root = path.resolve(process.cwd(), a);
    } else {
      console.error(`Opzione sconosciuta: ${a}\n${HELP}`);
      process.exit(1);
    }
  }
  return opts;
}

function openBrowser(url) {
  const platform = process.platform;
  let cmd, args;
  if (platform === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '', url];
  } else if (platform === 'darwin') {
    cmd = 'open';
    args = [url];
  } else {
    cmd = 'xdg-open';
    args = [url];
  }
  try {
    spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref();
  } catch {
    /* il browser non si apre: l'URL resta stampato in console */
  }
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));

  if (!fs.existsSync(opts.root) || !fs.statSync(opts.root).isDirectory()) {
    console.error(`Cartella non trovata: ${opts.root}`);
    process.exit(1);
  }

  const { url, fileCount } = await startServer(opts.root, opts.port);

  console.log('');
  console.log('  \x1b[1m\x1b[36mmd-reader\x1b[0m');
  console.log(`  Progetto:  \x1b[1m${opts.root}\x1b[0m`);
  console.log(`  File .md:  \x1b[1m${fileCount}\x1b[0m`);
  console.log(`  In ascolto su  \x1b[4m\x1b[36m${url}\x1b[0m`);
  console.log('');
  console.log('  Premi Ctrl+C per uscire.');
  console.log('');

  if (opts.open) openBrowser(url);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
