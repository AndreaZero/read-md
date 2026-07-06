# read-md

**Instant, beautiful Markdown reader for projects drowning in `.md` files.**

Built for developers who work with AI agents — Cursor, Claude Code, Copilot, and similar tools that generate plans, skills, rules, specs, and docs as Markdown. Instead of opening dozens of files in a plain editor, run one command and browse everything in a clean, GitHub-style UI in your browser.

```bash
read-md
```

No setup per project. No config files. Just a local server that scans your tree and renders your docs.

---

## Why md-reader?

AI-assisted workflows produce **a lot** of Markdown:

- Agent skills (`SKILL.md`, `AGENTS.md`)
- Cursor rules (`.cursor/rules/*.md`)
- Plans, ADRs, RFCs, and handoff notes
- README sprawl across monorepos
- Generated specs and changelogs

Reading that in raw form gets tiring fast. **md-reader** gives you:

| Problem | md-reader |
|--------|-------------|
| Jumping between 20+ `.md` files | Sidebar tree + `/` search |
| Raw Markdown in the editor | GitHub-style rendering |
| Mermaid diagrams as code blocks | Rendered diagrams |
| Edits while an agent is writing | Live reload |
| Dark mode at 2 AM | Light/dark theme, remembered |

Everything runs **locally and offline** — no CDN, no cloud, no account.

---

## Quick start

### Install globally (recommended)

From this repository:

```bash
npm install
npm install -g .
```

After that, `read-md` and `md-reader` work from **any directory**, in any terminal, even after reboot.

### Use it on your project

```bash
cd my-ai-project
read-md
```

Your browser opens automatically. Pick a file from the sidebar — or start with the root `README` if one exists.

### Scope to a folder

```bash
read-md docs
read-md .cursor/rules
read-md /path/to/any/folder
```

---

## CLI reference

```
read-md [folder] [options]

Examples:
  read-md                    Scan current directory (all .md files)
  read-md docs               Only ./docs
  read-md .cursor/skills     Agent skills folder

Options:
  -p, --port <n>   Port (default: 8765; auto-increments if busy)
  -n, --no-open    Do not open the browser automatically
  -h, --help       Show help
  -v, --version    Show version
```

Press `Ctrl+C` to stop the server. You can run multiple instances on different projects — each picks a free port.

---

## Features

- **File tree sidebar** — `.md`, `.markdown`, and `.mdx`; ignores `node_modules`, `.git`, `dist`, `build`, `.venv`, and other noise
- **Fast search** — press `/` to filter files by name
- **GitHub-style rendering** — tables, lists, blockquotes, images
- **Syntax highlighting** — code blocks with a **Copy** button
- **Mermaid diagrams** — fenced ` ```mermaid ` blocks render in place
- **Table of contents** — auto-generated from headings, highlights the section in view
- **Light / dark theme** — persisted in `localStorage`
- **Live reload** — when you or an agent saves a `.md` file, the view refreshes
- **Internal links** — relative links between Markdown files open inside the app; relative images work too
- **Local-only** — server binds to `127.0.0.1`; only files under the chosen root are served

---

## Typical workflows

### Review agent output

An agent just wrote `PLAN.md`, `TODO.md`, and three skill files. From the project root:

```bash
read-md
```

Search with `/`, skim the TOC, toggle dark mode — much faster than tab-hopping in the IDE.

### Browse Cursor rules and skills

```bash
read-md .cursor
read-md .cursor/rules
```

See your entire ruleset as readable documentation instead of a flat file list.

### Docs-only view

```bash
read-md docs
```

Share one terminal window while you keep coding; live reload picks up edits as you or the agent refine the docs.

---

## Security

The server listens on **localhost only** (`127.0.0.1`). It cannot be reached from other machines on your network. File access is restricted to the directory you pass on the CLI — path traversal is blocked.

---

## Requirements

- **Node.js ≥ 18**
- For recursive live reload on Linux, **Node ≥ 20** is recommended

---

## Development

Clone, install, and link locally:

```bash
git clone https://github.com/AndreaZero/read-md.git
cd read-md
npm install
npm install -g .
```

To iterate on md-reader itself, edit the source and re-run `npm install -g .` to refresh the global command.

---

## Publishing this repo on GitHub

When you make the repository public, use these settings on GitHub:

| Field | Suggested value |
|-------|-----------------|
| **Name** | `read-md` |
| **Description** | Instant local Markdown reader for AI-heavy projects — browse skills, rules, plans & docs in a beautiful UI |
| **Topics** | `markdown`, `documentation`, `ai-agents`, `cursor`, `mermaid`, `developer-tools`, `cli`, `nodejs`, `local-server` |
| **Website** | *(optional)* link to npm if you publish the package |

**About blurb (short):**

> One command to browse all Markdown in any folder. Built for AI agent workflows — skills, rules, plans, and docs — with search, TOC, Mermaid, themes, and live reload. 100% local.

---

## License

MIT — see [LICENSE](LICENSE).
