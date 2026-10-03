# Grimoire

**A living book for your projects and the agents that work on them.**

Grimoire is a visual workspace that sits beside your chat with Claude Code (or any agent). Plans, boards, roadmaps, decisions and docs become pages you can see, click and edit, and every project quietly writes its own history as work happens.

The trick is that there's no API. **The folder `.grimoire/` is the interface.** A channel is a folder, a page is a file, and when anything changes on disk, every open screen updates within a fraction of a second. Agents already live in files, so they can drive Grimoire with the tools they already have.

```
.grimoire/channels/20-my-app/          →  a channel in the sidebar
  10-status.dashboard.json             →  live project dashboard
  15-sessions.link  → docs/sessions/   →  the project's self-written log
  20-board.link     → docs/board.kanban.json   →  a Kanban board (drag cards, it saves)
  30-roadmap.link   → docs/roadmap.md  →  a roadmap (tick boxes, it saves)
  60-decisions.link → docs/decisions/  →  architecture decision records
  90-code.link      → ./               →  a browsable view of the repo
```

> Your agent writes files. Grimoire watches files. You click, Grimoire writes files. That's the whole protocol.

## Why

- **Chat scrolls away; work shouldn't.** Agent output that matters (plans, status, decisions) deserves a place you can glance at and come back to.
- **Agents are file-native; people aren't.** An agent will happily keep `board.kanban.json` up to date. Grimoire turns that into a board you can drag, and your drags back into a file the agent reads.
- **Trust needs a record.** As agents run longer, the question becomes "what did it do, and what does it need from me?" Sessions answer that without reading transcripts.

## Quickstart

Requires Node 22+ and a browser. No dependencies to install.

```bash
# 1. Put Grimoire in your project
git clone https://github.com/max-clouatre/grimoire.git

# 2. Give your project the skill, the session hooks and the themes
cp -r grimoire/starter/.claude grimoire/starter/.grimoire .

# 3. Start it
node grimoire/server.mjs        # → http://localhost:4180
```

Then ask your agent: *"set up a Grimoire project channel for this repo."*

> If you already have `.claude/settings.json`, merge the `hooks` block from `starter/.claude/settings.json` instead of overwriting it. A one-step install via a Claude plugin marketplace is on the roadmap.

## Concepts

| Concept | On disk | What it does |
|---|---|---|
| **Channel** | a folder in `.grimoire/channels/` | A workspace, usually one per project. Number prefixes set the order. |
| **Page** | an `.html`, `.md` or viewer file | One tab and one page on the stage. Markdown checklists are clickable. |
| **Link** | a `.link` file holding a path or URL | Shows something that lives elsewhere (your repo's docs) without copying it. Folders become a browsable repo view. |
| **Viewer** | `*.kanban.json`, `*.dashboard.json`, a `sessions/` folder | Data rendered as a board, a dashboard or a timeline, all two-way. |
| **Focus** | `.grimoire/focus.json` | What every window shows. Agents write it to show you something; the UI writes it so agents know what you're looking at. |
| **Theme** | `.grimoire/themes/<name>.css` | One file of design tokens restyles the app and every page. |

## Sessions: projects that document themselves

Each project keeps one append-only log per day in its repo, `docs/sessions/YYYY-MM-DD.session.jsonl`:

- **Automatic.** Claude Code hooks log session starts and every file edit against the right project (worked out from the file's path), and hand today's log back to the agent as context when a session starts.
- **Meaningful.** The agent logs decisions, findings, questions, blockers and what got done in plain sentences. If a turn changes files without explaining them, a Stop hook asks once.
- **Yours too.** Add notes from the Sessions viewer; they land in the same file.

## The `grim` command

```bash
grim log "Chose fractional indexes for ordering" --kind decision --refs CM-015
grim today --channel 20-my-app
grim where
```

Run `npm link` inside `grimoire/` to get `grim` (and `grimoire`) on your PATH, or call `node grimoire/cli.mjs`. Kinds: `note decision finding question blocker done summary`. `grim hook …` is what the Claude Code hooks call.

## Themes

Eight themes ship in `starter/.grimoire/themes/`: Default, Nord and Paper, plus Matrix (with digital rain), Final Fantasy, Azeroth, Synthwave and Game Boy. Switch from the palette button or `settings.json`.

To make your own, copy `default.css` (it documents every token, shadcn-style), change the values, and it appears in the picker instantly. Add `<name>.bg.js` for an animated background. Or ask your agent to make one.

## Two-way pages

Every page gets `window.grim`:

```js
const todos = await grim.readJSON("todos.json");   // a file inside this page's folder
await grim.writeJSON("todos.json", todos);          // .json .jsonl .md .txt .csv .yml only
const board = await grim.peer("20-board.link").readJSON();
grim.onChange(({ self }) => self && load());        // live updates without a reload
```

Writes are limited to data files inside the page's own folder, must come from Grimoire itself, and never touch secret-looking files.

## Repository layout

| Path | What it is |
|---|---|
| `server.mjs` | Watches `.grimoire/` and linked paths, serves pages, pushes live updates (SSE), accepts two-way writes |
| `cli.mjs` | `grim`: session logs and Claude Code hook handlers |
| `markdown.mjs` | Dependency-free Markdown renderer |
| `ui/index.html` | The app: channel sidebar, tabs, filmstrip stage, theme picker |
| `lib/` | Design tokens, house stylesheet, page bridge (`window.grim`), components, viewers |
| `starter/` | What a project needs: the agent skill, session hooks, themes, a welcome channel |
| `docs/` | Grimoire's own project docs: architecture, roadmap, board, decisions, learnings, sessions, ideas |
| `examples/todo-app/` | Checkmate, a sample project showing a full project channel |

## Security

The server binds to `127.0.0.1` only. Repo views hide `.git`, `node_modules`, build output and secret-looking files (`.env*`, keys), and won't serve them. Path escapes are rejected. Theme scripts run in a sandboxed iframe. Pages are trusted local content, like files you open in an editor. See [ADR 0006](docs/decisions/0006-scoped-two-way-writes.md) and [0007](docs/decisions/0007-localhost-only.md).

## Status

An early proof of concept, built and dogfooded on Windows. Grimoire tracks itself: its own board, roadmap, decisions and session logs are in [`docs/`](docs/), and open as a channel when you run it here.

- [Architecture](docs/architecture.md) · [Roadmap](docs/roadmap.md) · [Decisions](docs/decisions/README.md) · [Learnings](docs/learnings.md) · [Ideas](docs/ideas/index.html)

## Credits

Inspired by [Television](https://github.com/telepath-computer/television) by Telepath, whose open specs introduced the channel, stage and focus ideas that Grimoire grew from. Grimoire is an independent project with a different architecture (files as the interface) and focus (projects and agent sessions).

## License

Not yet chosen. MIT is the plan (see the [Ideas](docs/ideas/index.html) page); until a `LICENSE` file is added, all rights are reserved.
