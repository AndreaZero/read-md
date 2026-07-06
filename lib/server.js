'use strict';

const http = require('http');
const fs = require('fs');
const path = require('path');
const { scanTree, isMarkdown } = require('./scanner');

const PUBLIC_DIR = path.join(__dirname, '..', 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.md': 'text/plain; charset=utf-8',
  '.markdown': 'text/plain; charset=utf-8',
  '.mdx': 'text/plain; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.pdf': 'application/pdf',
};

/** Trova la cartella di un pacchetto risalendo i node_modules (gestisce install globali e hoisting). */
function resolvePkgDir(pkg) {
  let dir = path.join(__dirname, '..');
  for (let i = 0; i < 10; i++) {
    const candidate = path.join(dir, 'node_modules', pkg);
    if (fs.existsSync(candidate)) return candidate;
    const parent = path.dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  throw new Error(`Dipendenza non trovata: ${pkg}. Esegui "npm install" nella cartella di md-reader.`);
}

function vendorMap() {
  return {
    'marked.min.js': [resolvePkgDir('marked'), 'marked.min.js'],
    'highlight.min.js': [resolvePkgDir('@highlightjs/cdn-assets'), 'highlight.min.js'],
    'hljs-light.css': [resolvePkgDir('@highlightjs/cdn-assets'), 'styles', 'github.min.css'],
    'hljs-dark.css': [resolvePkgDir('@highlightjs/cdn-assets'), 'styles', 'github-dark.min.css'],
    'markdown-light.css': [resolvePkgDir('github-markdown-css'), 'github-markdown-light.css'],
    'markdown-dark.css': [resolvePkgDir('github-markdown-css'), 'github-markdown-dark.css'],
    'mermaid.min.js': [resolvePkgDir('mermaid'), 'dist', 'mermaid.min.js'],
  };
}

function send(res, status, body, contentType) {
  res.writeHead(status, {
    'Content-Type': contentType || 'text/plain; charset=utf-8',
    'Cache-Control': 'no-cache',
  });
  res.end(body);
}

function sendJson(res, status, obj) {
  send(res, status, JSON.stringify(obj), 'application/json; charset=utf-8');
}

function sendFile(res, filePath) {
  fs.readFile(filePath, (err, data) => {
    if (err) return send(res, 404, 'Not found');
    const type = MIME[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
    send(res, 200, data, type);
  });
}

/** Risolve un percorso relativo dentro `root` impedendo path traversal. */
function safeResolve(root, relPath) {
  if (typeof relPath !== 'string' || relPath.length === 0) return null;
  const abs = path.resolve(root, relPath);
  const normalizedRoot = path.resolve(root);
  if (abs !== normalizedRoot && !abs.startsWith(normalizedRoot + path.sep)) return null;
  return abs;
}

function startServer(root, preferredPort) {
  const vendors = vendorMap();
  const sseClients = new Set();

  // Live reload: notifica i client quando i file del progetto cambiano
  let watcher = null;
  try {
    let timer = null;
    watcher = fs.watch(root, { recursive: true }, (_event, filename) => {
      if (filename && !isMarkdown(filename)) return;
      clearTimeout(timer);
      timer = setTimeout(() => {
        for (const client of sseClients) client.write('data: change\n\n');
      }, 300);
    });
  } catch {
    /* watch ricorsivo non supportato: si continua senza live reload */
  }

  const server = http.createServer((req, res) => {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);

    if (pathname === '/' || pathname === '/index.html') {
      return sendFile(res, path.join(PUBLIC_DIR, 'index.html'));
    }

    if (pathname === '/app.js' || pathname === '/app.css') {
      return sendFile(res, path.join(PUBLIC_DIR, pathname.slice(1)));
    }

    if (pathname.startsWith('/vendor/')) {
      const key = pathname.slice('/vendor/'.length);
      const parts = vendors[key];
      if (!parts) return send(res, 404, 'Not found');
      return sendFile(res, path.join(...parts));
    }

    if (pathname === '/api/tree') {
      const { tree, fileCount } = scanTree(root);
      return sendJson(res, 200, {
        name: path.basename(root),
        root,
        fileCount,
        tree,
      });
    }

    if (pathname === '/api/file') {
      const abs = safeResolve(root, url.searchParams.get('path'));
      if (!abs || !isMarkdown(abs)) return sendJson(res, 400, { error: 'Percorso non valido' });
      return fs.readFile(abs, 'utf8', (err, content) => {
        if (err) return sendJson(res, 404, { error: 'File non trovato' });
        const stat = fs.statSync(abs);
        sendJson(res, 200, {
          path: url.searchParams.get('path'),
          content,
          mtime: stat.mtime.toISOString(),
          size: stat.size,
        });
      });
    }

    // Asset del progetto referenziati dai markdown (immagini, ecc.)
    if (pathname === '/api/raw') {
      const abs = safeResolve(root, url.searchParams.get('path'));
      if (!abs) return send(res, 400, 'Percorso non valido');
      return sendFile(res, abs);
    }

    if (pathname === '/api/events') {
      res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      res.write(': connected\n\n');
      sseClients.add(res);
      req.on('close', () => sseClients.delete(res));
      return;
    }

    send(res, 404, 'Not found');
  });

  server.on('close', () => {
    if (watcher) watcher.close();
  });

  // Se la porta è occupata prova le successive
  return new Promise((resolve, reject) => {
    let port = preferredPort;
    let attempts = 0;

    const tryListen = () => {
      server.once('error', (err) => {
        if (err.code === 'EADDRINUSE' && attempts < 50) {
          attempts++;
          port++;
          tryListen();
        } else {
          reject(err);
        }
      });
      server.listen(port, '127.0.0.1', () => {
        server.removeAllListeners('error');
        const { fileCount } = scanTree(root);
        resolve({ server, port, url: `http://localhost:${port}`, fileCount });
      });
    };

    tryListen();
  });
}

module.exports = { startServer };
