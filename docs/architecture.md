# Architecture

Grimoire has three moving parts, all in one Node process and one page, with the filesystem in the middle as the shared source of truth.

```
   you ──edit──┐                      ┌──writes── agent (Claude Code, …)
               ▼                      ▼
        ┌────────────────────────────────────┐
        │  .grimoire/                              │   the interface, as files
        │   channels/<NN-name>/<artifacts>   │
        │   themes/<theme>.css (+ .bg.js)    │
        │   focus.json  settings.json        │
        └──────────────┬─────────────────────┘
                       │ fs.watch (recursive) + one watcher per linked path
                       ▼
        ┌────────────────────────────────────┐
        │  grimoire/server.mjs  (127.0.0.1:4180)   │
        │   scan → state   render → pages    │
        │   SSE: state | reload | focus |    │
        │        theme                       │
        │   PUT: two-way writes              │
        └──────────────┬─────────────────────┘
                       │ /api/events (server-sent events)
                       ▼
        ┌────────────────────────────────────┐
        │  grimoire/ui (the app)                   │
        │   sidebar · tabs · filmstrip       │
        │   ┌──────────┐ ┌──────────┐        │
        │   │ iframe   │ │ iframe   │  …     │  one sandbox-free, same-origin
        │   │ +bridge  │ │ +bridge  │        │  document per artifact
        │   └──────────┘ └──────────┘        │
        └────────────────────────────────────┘
```

## The model

| On disk | Meaning |
|---|---|
| `channels/<NN-slug>/` | A channel. `NN` orders the sidebar; `channel.json` holds name, pin, colour, description and saved page sizes |
| `<NN-name>.html` / `.md` | An artifact rendered as a page |
| `<NN-name>/index.html` | A multi-file artifact (an app) |
| `<NN-name>.link` | A pointer: a path (relative to the link) or a URL. Folders without `index.html` render as a repo view |
| `*.kanban.json`, `*.dashboard.json` | Data rendered by a built-in viewer |
| `_anything` | Hidden data shared by a channel's artifacts; never a tab |
| `focus.json` | What every window shows; written by agents *and* by the UI |
| `settings.json` | The active theme |
| `themes/<id>.css` | A theme: design-token overrides, optional `<id>.bg.js` |

## Event flow

1. A file changes. The watcher debounces bursts (editors save via temp files and renames).
2. The server re-scans `.grimoire/` and broadcasts `state` only if the structure changed.
3. It broadcasts `reload {channel, artifact, file, by}` for the touched artifact. `by` is `ui` when the change came through the two-way API within the last two seconds, otherwise `disk`.
4. The UI forwards `grim-change` to every artifact on screen. An artifact that called `grim.onChange` handles it itself (re-reads data, morphs in place); any other artifact is reloaded, keeping its scroll position.

## Two-way artifacts

The bridge (`lib/bridge.js`) gives every artifact `window.grim`: `read`, `readJSON`, `write`, `writeJSON`, `list`, `peer(id)`, `focus(id)` and `onChange(fn)`. Writes are HTTP `PUT`s to the artifact's own URL space and are only accepted when:

- the request carries `x-grim: 1` and comes from Grimoire's own origin (blocks drive-by writes from other sites);
- the path stays inside the artifact (its folder, or the folder of its file);
- the file is data or a document: `.json .md .txt .csv .yml .yaml`, never code or HTML;
- it doesn't look like a secret (`.env*`, keys).

Markdown pages are two-way for free: task checkboxes rewrite their `- [ ]` line, and file edits morph the page without a reload.

## Sessions

A project's **session log** is how it documents itself. Each day gets one append-only file, `docs/sessions/YYYY-MM-DD.session.jsonl`, one JSON object per line:

```json
{ "t": "2026-10-02T21:27:00Z", "by": "claude", "kind": "decision", "text": "…", "files": ["…"], "refs": ["grim-030"] }
```

Kinds: `start note change decision finding question blocker done summary end`. A folder named `sessions` (or holding `*.session.jsonl` files) renders as the **Sessions** viewer: days on the left, a live timeline on the right, and a box for your own notes. The project dashboard shows today's latest entries.

Three writers keep it current:

| Writer | Writes | How |
|---|---|---|
| Claude Code hooks (`.claude/settings.json` → `grim hook …`) | `start`, `change`, `end` | automatic: every file edit is mapped to the channel whose linked folders contain it; edits within 15 minutes merge into one entry |
| The agent (`grim log "…" --kind …`) | `decision finding question blocker done summary note` | guided by the skill, and the **Stop hook**: a turn that changed a channel's files without a plain-language entry is sent back once to write one |
| You, in the Sessions viewer | `note decision question blocker …` | two-way: appended to today's file |

The session-start hook feeds today's entries back to the agent as context, so a new session picks up where the last one left off.

## Theming

`lib/tokens.css` defines every design token inside `:where()` (zero specificity). The active theme is served at `/grimoire/theme.css` and loaded after it, in the app and in every artifact, so a theme's plain `:root` rules always win. Switching themes swaps one stylesheet URL everywhere; artifacts never need to know which theme is active. See [the design system](design-system/index.html) and [ADR 0005](decisions/0005-themes-are-token-files.md).

## Security model

- Binds to `127.0.0.1` only.
- Repo views hide `.git`, `node_modules`, build output and secret-looking files, and refuse to serve them directly.
- Paths are resolved and checked against the artifact's base; `..` escapes return 403.
- Theme background scripts run in a `sandbox="allow-scripts"` iframe with an opaque origin.
- Artifacts are same-origin with the app (needed for live theme sync and scroll keeping); they are trusted local content, like files you open in an editor.
