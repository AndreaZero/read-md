'use strict';

/* ---------- Stato ---------- */

const state = {
  tree: [],
  files: [], // lista piatta di path per la ricerca
  currentPath: null,
  theme: localStorage.getItem('md-reader-theme') ||
    (window.matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark'),
};

const els = {
  tree: document.getElementById('tree'),
  search: document.getElementById('search'),
  content: document.getElementById('content'),
  toc: document.getElementById('toc'),
  tocPanel: document.getElementById('toc-panel'),
  currentPath: document.getElementById('current-path'),
  projectName: document.getElementById('project-name'),
  fileCount: document.getElementById('file-count'),
  themeToggle: document.getElementById('theme-toggle'),
  sidebarToggle: document.getElementById('sidebar-toggle'),
  liveDot: document.getElementById('live-dot'),
};

/* ---------- Tema ---------- */

function applyTheme(theme) {
  state.theme = theme;
  localStorage.setItem('md-reader-theme', theme);
  document.body.dataset.theme = theme;
  document.getElementById('markdown-theme').href = `/vendor/markdown-${theme}.css`;
  document.getElementById('hljs-theme').href = `/vendor/hljs-${theme}.css`;
  els.themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
  mermaid.initialize({
    startOnLoad: false,
    securityLevel: 'loose',
    theme: theme === 'dark' ? 'dark' : 'default',
  });
}

els.themeToggle.addEventListener('click', () => {
  applyTheme(state.theme === 'dark' ? 'light' : 'dark');
  if (state.currentPath) loadFile(state.currentPath, { preserveScroll: true });
});

els.sidebarToggle.addEventListener('click', () => {
  document.body.classList.toggle('sidebar-hidden');
});

/* ---------- Albero file ---------- */

async function fetchTree() {
  const res = await fetch('/api/tree');
  const data = await res.json();
  state.tree = data.tree;
  state.files = flattenFiles(data.tree);
  els.projectName.textContent = data.name;
  els.projectName.title = data.root;
  els.fileCount.textContent = `${data.fileCount} file markdown`;
  document.title = `${data.name} — md-reader`;
  renderTree();
  return data;
}

function flattenFiles(nodes, acc = []) {
  for (const node of nodes) {
    if (node.type === 'file') acc.push(node.path);
    else flattenFiles(node.children, acc);
  }
  return acc;
}

function renderTree() {
  const query = els.search.value.trim().toLowerCase();
  els.tree.innerHTML = '';

  if (query) {
    const matches = state.files.filter((p) => p.toLowerCase().includes(query));
    if (matches.length === 0) {
      els.tree.innerHTML = '<div class="no-results">Nessun file trovato.</div>';
      return;
    }
    for (const p of matches) {
      els.tree.appendChild(fileItem(p, p)); // mostra il path completo nei risultati
    }
  } else {
    buildNodes(state.tree, els.tree);
  }
  highlightActive();
}

function buildNodes(nodes, container) {
  for (const node of nodes) {
    if (node.type === 'file') {
      container.appendChild(fileItem(node.path, node.name));
    } else {
      const wrap = document.createElement('div');
      wrap.className = 'tree-dir';

      const item = document.createElement('div');
      item.className = 'tree-item';
      item.innerHTML = `<span class="icon">📁</span>`;
      item.appendChild(document.createTextNode(node.name));
      item.addEventListener('click', () => wrap.classList.toggle('collapsed'));

      const children = document.createElement('div');
      children.className = 'tree-children';
      buildNodes(node.children, children);

      wrap.append(item, children);
      container.appendChild(wrap);
    }
  }
}

function fileItem(path, label) {
  const item = document.createElement('a');
  item.className = 'tree-item tree-file';
  item.dataset.path = path;
  item.href = `#/${path}`;
  item.innerHTML = `<span class="icon">📄</span>`;
  item.appendChild(document.createTextNode(label));
  item.title = path;
  return item;
}

function highlightActive() {
  for (const el of els.tree.querySelectorAll('.tree-item.active')) {
    el.classList.remove('active');
  }
  if (!state.currentPath) return;
  const el = els.tree.querySelector(`[data-path="${CSS.escape(state.currentPath)}"]`);
  if (el) {
    el.classList.add('active');
    // espandi le cartelle antenate
    let parent = el.parentElement;
    while (parent && parent !== els.tree) {
      if (parent.classList.contains('tree-dir')) parent.classList.remove('collapsed');
      parent = parent.parentElement;
    }
  }
}

els.search.addEventListener('input', renderTree);

document.addEventListener('keydown', (e) => {
  if (e.key === '/' && document.activeElement !== els.search) {
    e.preventDefault();
    els.search.focus();
    els.search.select();
  }
  if (e.key === 'Escape' && document.activeElement === els.search) {
    els.search.value = '';
    renderTree();
    els.search.blur();
  }
});

/* ---------- Rendering markdown ---------- */

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\u00C0-\u024F\s-]/g, '')
    .replace(/\s+/g, '-');
}

function resolveRelative(baseDir, href) {
  const parts = (baseDir ? baseDir.split('/') : []).filter(Boolean);
  for (const seg of href.split('/')) {
    if (seg === '' || seg === '.') continue;
    if (seg === '..') parts.pop();
    else parts.push(seg);
  }
  return parts.join('/');
}

function isExternal(href) {
  return /^(https?:|mailto:|data:|tel:|#)/i.test(href);
}

async function loadFile(path, { preserveScroll = false } = {}) {
  const scrollTop = preserveScroll ? els.content.scrollTop : 0;

  let data;
  try {
    const res = await fetch(`/api/file?path=${encodeURIComponent(path)}`);
    if (!res.ok) throw new Error();
    data = await res.json();
  } catch {
    els.content.innerHTML = `<div class="placeholder"><h1>⚠️</h1><p>Impossibile leggere <code>${path}</code></p></div>`;
    return;
  }

  state.currentPath = path;
  els.currentPath.textContent = path;
  els.content.innerHTML = marked.parse(data.content, { gfm: true });

  const baseDir = path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
  postProcess(baseDir);
  buildToc();
  highlightActive();

  els.content.scrollTop = scrollTop;
}

function postProcess(baseDir) {
  // ID e anchor per i titoli
  const used = new Map();
  for (const h of els.content.querySelectorAll('h1, h2, h3, h4, h5, h6')) {
    let id = slugify(h.textContent) || 'sezione';
    const n = used.get(id) || 0;
    used.set(id, n + 1);
    if (n > 0) id = `${id}-${n}`;
    h.id = id;

    const anchor = document.createElement('a');
    anchor.className = 'heading-anchor';
    anchor.href = `#${id}`;
    anchor.textContent = '#';
    anchor.addEventListener('click', (e) => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth' });
    });
    h.appendChild(anchor);
  }

  // Diagrammi mermaid
  const mermaidNodes = [];
  for (const code of els.content.querySelectorAll('pre > code.language-mermaid')) {
    const div = document.createElement('div');
    div.className = 'mermaid';
    div.textContent = code.textContent;
    code.parentElement.replaceWith(div);
    mermaidNodes.push(div);
  }
  if (mermaidNodes.length > 0) {
    mermaid.run({ nodes: mermaidNodes }).catch(() => {});
  }

  // Syntax highlighting + pulsante copia
  for (const code of els.content.querySelectorAll('pre > code')) {
    hljs.highlightElement(code);
    const pre = code.parentElement;
    const wrap = document.createElement('div');
    wrap.className = 'code-block';
    pre.replaceWith(wrap);
    wrap.appendChild(pre);

    const btn = document.createElement('button');
    btn.className = 'copy-btn';
    btn.textContent = 'Copia';
    btn.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(code.textContent);
        btn.textContent = 'Copiato ✓';
        btn.classList.add('copied');
        setTimeout(() => {
          btn.textContent = 'Copia';
          btn.classList.remove('copied');
        }, 1500);
      } catch { /* clipboard non disponibile */ }
    });
    wrap.appendChild(btn);
  }

  // Immagini relative → servite dal progetto
  for (const img of els.content.querySelectorAll('img')) {
    const src = img.getAttribute('src') || '';
    if (src && !isExternal(src) && !src.startsWith('/')) {
      img.src = `/api/raw?path=${encodeURIComponent(resolveRelative(baseDir, src))}`;
    }
  }

  // Link
  for (const a of els.content.querySelectorAll('a:not(.heading-anchor)')) {
    const href = a.getAttribute('href') || '';
    if (!href) continue;

    if (href.startsWith('#')) {
      // anchor interno al documento
      a.addEventListener('click', (e) => {
        e.preventDefault();
        const target = document.getElementById(href.slice(1)) ||
          document.getElementById(slugify(decodeURIComponent(href.slice(1))));
        if (target) target.scrollIntoView({ behavior: 'smooth' });
      });
    } else if (isExternal(href)) {
      a.target = '_blank';
      a.rel = 'noopener';
    } else {
      // link relativo: se .md naviga nell'app, altrimenti servi il file
      const clean = href.split('#')[0];
      const resolved = resolveRelative(baseDir, clean);
      if (/\.(md|markdown|mdx)$/i.test(clean)) {
        a.href = `#/${resolved}`;
      } else {
        a.href = `/api/raw?path=${encodeURIComponent(resolved)}`;
        a.target = '_blank';
      }
    }
  }
}

/* ---------- Indice (TOC) ---------- */

function buildToc() {
  els.toc.innerHTML = '';
  const headings = els.content.querySelectorAll('h1, h2, h3');
  if (headings.length < 2) {
    els.tocPanel.classList.add('empty');
    return;
  }
  els.tocPanel.classList.remove('empty');

  for (const h of headings) {
    const link = document.createElement('a');
    link.textContent = h.textContent.replace(/#$/, '');
    link.className = `toc-${h.tagName.toLowerCase()}`;
    link.href = `#${h.id}`;
    link.addEventListener('click', (e) => {
      e.preventDefault();
      h.scrollIntoView({ behavior: 'smooth' });
    });
    els.toc.appendChild(link);
  }

  // evidenzia la sezione visibile
  const links = [...els.toc.querySelectorAll('a')];
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const idx = [...headings].indexOf(entry.target);
        links.forEach((l, i) => l.classList.toggle('active', i === idx));
      }
    },
    { root: els.content, rootMargin: '0px 0px -80% 0px' }
  );
  headings.forEach((h) => observer.observe(h));
}

/* ---------- Routing ---------- */

function routeFromHash() {
  const hash = decodeURIComponent(location.hash);
  if (hash.startsWith('#/')) {
    const path = hash.slice(2);
    if (path && path !== state.currentPath) loadFile(path);
  }
}

window.addEventListener('hashchange', routeFromHash);

/* ---------- Live reload ---------- */

function connectSSE() {
  const source = new EventSource('/api/events');
  source.onopen = () => els.liveDot.classList.remove('off');
  source.onerror = () => els.liveDot.classList.add('off');
  source.onmessage = async () => {
    await fetchTree();
    if (state.currentPath) loadFile(state.currentPath, { preserveScroll: true });
  };
}

/* ---------- Avvio ---------- */

async function init() {
  applyTheme(state.theme);
  await fetchTree();
  connectSSE();

  if (location.hash.startsWith('#/')) {
    routeFromHash();
  } else {
    // apri il README di root se esiste, altrimenti il primo file
    const readme = state.files.find((p) => /^readme\.(md|markdown|mdx)$/i.test(p));
    const first = readme || state.files[0];
    if (first) location.hash = `#/${first}`;
  }
}

init();
