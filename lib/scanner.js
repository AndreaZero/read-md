'use strict';

const fs = require('fs');
const path = require('path');

const IGNORED_DIRS = new Set([
  'node_modules', '.git', '.hg', '.svn',
  'dist', 'build', 'out', 'coverage',
  '.next', '.nuxt', '.svelte-kit', '.turbo', '.cache', '.parcel-cache',
  '.venv', 'venv', 'env', '__pycache__', '.pytest_cache', '.mypy_cache',
  '.idea', '.vscode', '.vs',
  'target', 'bin', 'obj', 'vendor', 'bower_components',
]);

const MD_EXTENSIONS = new Set(['.md', '.markdown', '.mdx']);

function isMarkdown(name) {
  return MD_EXTENSIONS.has(path.extname(name).toLowerCase());
}

/**
 * Costruisce l'albero dei file markdown sotto `root`.
 * Le cartelle che non contengono (anche indirettamente) file .md vengono escluse.
 */
function scanTree(root) {
  let fileCount = 0;

  function walk(dir, relBase) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return [];
    }

    const dirs = [];
    const files = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.') && entry.name !== '.github') continue;
      const rel = relBase ? `${relBase}/${entry.name}` : entry.name;

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name.toLowerCase())) continue;
        const children = walk(path.join(dir, entry.name), rel);
        if (children.length > 0) {
          dirs.push({ type: 'dir', name: entry.name, path: rel, children });
        }
      } else if (entry.isFile() && isMarkdown(entry.name)) {
        fileCount++;
        files.push({ type: 'file', name: entry.name, path: rel });
      }
    }

    const byName = (a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' });
    dirs.sort(byName);
    files.sort((a, b) => {
      // README sempre in cima alla propria cartella
      const ra = /^readme\./i.test(a.name) ? 0 : 1;
      const rb = /^readme\./i.test(b.name) ? 0 : 1;
      return ra - rb || byName(a, b);
    });

    return [...files, ...dirs];
  }

  const tree = walk(root, '');
  return { tree, fileCount };
}

module.exports = { scanTree, isMarkdown };
