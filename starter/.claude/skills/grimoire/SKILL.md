---
name: grimoire
description: Grimoire — the user's live, filesystem-driven workspace for projects and agents (channels of pages) at http://localhost:4180, with self-writing session logs. Use when a result is better as a persistent, scannable page than a chat reply (plans, tables, comparisons, dashboards, research, explainers, project status); when the user says "put it in the grimoire / on the screen / on the board"; asks what they're looking at; wants a project channel (board, roadmap, decisions, sessions) for a repo; wants to update a board, roadmap or session log; or wants a new theme. Also use at the start and end of work in any project that has a channel, to read and write its session log.
---

# Grimoire

Grimoire is a visual sidecar to this chat. **The folder `.grimoire/` (at the root of this workspace) is the entire interface:** the UI watches it and every change appears on screen within a fraction of a second. You create, update, focus, theme and remove things by writing files. The one command is `grim`, for session logs (`node grimoire/cli.mjs` if `grim` isn't on the PATH).

## The structure

```
.grimoire/
├── focus.json                 { "channel": "<channel folder>", "artifact": "<artifact file>" }
├── settings.json              { "theme": "<theme id>" }
├── themes/<id>.css            a theme (design tokens); optional <id>.bg.js animated background
└── channels/
    └── 20-research/           a folder = a channel (sidebar entry)
        ├── channel.json       { "name", "pinned", "color", "description", "layout" } (all optional)
        ├── 10-summary.html    a file = an artifact (one tab + one page on the stage)
        ├── 15-sessions.link   → a sessions folder: the channel's self-written log (see Sessions)
        ├── 20-notes.md        markdown renders as a page; its task checkboxes are clickable
        ├── 30-dashboard/      a folder with index.html = a multi-file artifact (an app)
        ├── 40-board.link      a pointer: one line, a path (relative to this file) or an http(s) URL
        ├── 50-tasks.kanban.json      rendered by the built-in board viewer
        └── _shared.json       "_" prefix = hidden data for the channel's artifacts, never a tab
```

- **Ordering:** names sort naturally; use prefixes in steps of 10. Prefix and extension are hidden in the UI ("20-notes.md" → "Notes").
- **Names:** channel = `channel.json` `name`, else prettified folder name. HTML tab = `<title>`; markdown = front-matter `title:` or first `# Heading`; links, folders and viewer files = prettified file name.
- **`.link` targets:** a folder with `index.html` renders as that app; a folder named `sessions` (or holding `*.session.jsonl`) renders as the Sessions timeline; any other folder renders as a **repo view**; files render by type; URLs are framed.
- `channel.json` `layout` holds page sizes the user dragged. Preserve it when you edit the file.

## Operations

| Goal | Do this |
|---|---|
| Create a channel | `mkdir .grimoire/channels/<NN>-<slug>` (+ `channel.json`) |
| Create an artifact | Write a file into the channel folder |
| Update an artifact | Edit the file in place: the page reloads (or morphs) and keeps its scroll position |
| Show existing work without copying it | A `.link` file containing the path, e.g. `../../../my-repo/docs/roadmap.md` |
| Move the user's attention | Write `.grimoire/focus.json` **after** the artifact exists |
| See what the user is looking at | Read `.grimoire/focus.json`. The UI writes it on every channel/tab switch (`"by": "ui"`) |
| Log what happened | `grim log "…" --kind <kind> [--channel <id>]` (see Sessions) |
| Change the theme | Write `.grimoire/settings.json` `{ "theme": "<id>" }` (ids = file names in `.grimoire/themes/`) |
| Remove an artifact | Delete its file. Deleting a `.link` only removes the pointer; deleting `.html`/`.md` inside `.grimoire/` deletes content, so ask first if the user made it |

## Focus is a separate decision

Creating something does **not** move the user's view. Decide every time:

- The user asked for it or is waiting on it → write `focus.json`: `{ "channel": "20-research", "artifact": "10-summary.html" }`
- Background or batch work, or the user is busy elsewhere → leave focus alone; the new tab appears quietly with a notification.

## When to use Grimoire (and when not)

Use an artifact when the result is long, structured, visual, or something the user will revisit or keep open while chatting. Short conversational answers stay in chat. When the artifact *is* the answer, keep the chat reply short: say what you put in the Grimoire, on which channel, and the file path; don't repeat the content. Put new artifacts on the channel that matches their subject; make a new channel only when nothing fits.

## Sessions: the project writes its own history

Every project channel has a **session log**: one append-only file per day, `<sessions>/YYYY-MM-DD.session.jsonl`, one JSON object per line (`t`, `by`, `kind`, `text`, optional `files`, `refs`). It is how the project documents itself, and how the next session (yours or another agent's) knows what happened.

**What's automatic (Claude Code hooks in `.claude/settings.json`):**
- Session start is logged, and today's entries are given to you as context.
- Every file you write or edit is logged as a `change` against the channel whose linked folders contain it (repeated edits merge).
- If a turn changed a channel's files and nobody explained them, the Stop hook sends you back **once** to log an entry. Don't wait for the nudge.

**What you log (the meaning, not the mechanics):**

| Kind | Log when | Example |
|---|---|---|
| `decision` | You or the user chose between options | `grim log "Use fractional indexes for ordering; renumbering was O(n) per drag" --kind decision --refs CM-015` |
| `finding` | You learned something non-obvious | `--kind finding` "Hook stdin arrives as one JSON object; Windows paths use backslashes" |
| `question` | You need the user, but can keep working | `--kind question` "Should due dates support times?" |
| `blocker` | Work can't continue | `--kind blocker` "Migration needs the DB password, which isn't in .env.example" |
| `done` | A meaningful unit of work finished | `--kind done` "Undo-delete toast with rollback, tested" |
| `summary` | End of a working session or day | `--kind summary` "Shipped CM-016/017; ADR 0004 still open" |
| `note` | Anything else worth remembering | |

Rules:
- **Read before you work.** At the start of work in a project, read today's log (and yesterday's last entries): `grim today --channel <id>`. Answer user questions from it.
- **Write plain sentences a teammate would understand tomorrow.** Say what and why, not "edited files". Reference card ids with `--refs`.
- **One entry per meaningful moment**, not per edit. Don't duplicate what the `change` entries already show.
- **Never log secrets**, tokens, personal data or file contents.
- Log against the right channel: `--channel` when your current path doesn't make it obvious (`grim where` shows what it would pick).
- The user can add notes in the Sessions viewer (`"by": "you"`). Treat their questions and blockers as requests.

## Project channels (SDLC)

A software project gets one channel that *points into its repo*. Docs stay in the repo (versioned, reviewed); the channel only arranges them. Standard layout (see `.grimoire/channels/20-grimoire/` and `30-checkmate/` for working examples):

| Artifact | Lives in the repo as | Notes |
|---|---|---|
| `10-status.dashboard.json` | (in the channel: it references the channel's artifact ids) | Computed live from board, decisions and today's session |
| `15-sessions.link` | `docs/sessions/` | The self-written log (above) |
| `20-board.link` | `docs/board.kanban.json` | Cards: `id title column milestone tags owner notes`; tag `blocked` marks blockers |
| `30-roadmap.link` | `docs/roadmap.md` | `## M1 · Name` sections with `- [ ]` tasks (clickable) |
| `40-PRD.link` / spec | `docs/prd.md` | Problem, goals, non-goals, user stories, metrics |
| `50-architecture.link` | `docs/architecture.md` | Diagram (fenced ASCII), components, API, data |
| `60-decisions.link` | `docs/decisions/` | ADRs `NNNN-slug.md`: Status · Date, Context, Decision, Consequences; `README.md` index |
| `70-…` | `docs/learnings.md`, `CHANGELOG.md`, `prototype/` | As useful |
| `90-code.link` | the repo root | Repo view; also what maps your edits to this channel |

**Keep the project state true.** When you finish work in a project with a channel: log it, move its card on the board (edit the JSON; keep 2-space formatting), tick roadmap boxes, add an ADR for real decisions, add learnings, update the dashboard's `health` if the risk picture changed. The user's own edits on the board or roadmap arrive as ordinary file changes in the repo: read them before assuming state.

Dashboard file:

```json
{ "title": "Checkmate", "subtitle": "…", "board": "20-board.link", "roadmap": "30-roadmap.link",
  "decisions": "60-decisions.link", "sessions": "15-sessions.link",
  "health": { "status": "on-track | at-risk | off-track", "note": "…" },
  "milestones": [{ "id": "M1", "name": "MVP", "goal": "…" }] }
```

## Authoring HTML artifacts

Write a complete document, link the house style, and use only design tokens for colour, so it follows every theme:

```html
<!doctype html>
<html><head>
<meta charset="utf-8"><title>Q3 hiring plan</title>
<link rel="stylesheet" href="/grimoire/grimoire.css">
</head><body>
<h1>Q3 hiring plan</h1>
<p class="sub">Drafted from the leadership notes · Oct 2</p>
…
</body></html>
```

Grimoire injects the tokens and the active theme into every page; never hard-code colours or fonts.

- **Text:** `h1`, `.sub`, `h2`, `.muted`
- **Containers:** `.card`, `.grid` (auto-fit columns), `.row`, `.stack`, `.callout` (`.warn` `.ok` `.danger`)
- **Data:** `<table>`; `.stat` (`<b>42</b><span>label</span>`); `.tag` + `red orange yellow green blue purple teal`; `.progress > i[style=width:60%]`; `.bars > div[style=height:60%][data-value][data-label]`; `ul.checklist`
- **Controls:** `.btn`, `.btn.primary`, `input[type=text]`
- **Tokens:** `--background --foreground --card --muted --muted-foreground --primary --primary-foreground --accent --border --radius --font-sans --font-heading --font-mono`, palette `--red … --teal` and `--<color>-soft`, surfaces `--page --surface --surface-border`
- **Components:** `<script type="module" src="/grimoire/components.js">` then `<grim-calendar day="Thu Oct 2" start="8" end="18" today><grim-event title="…" start="9:15" end="9:30" color="blue"></grim-event></grim-calendar>`

The full reference with live examples is the **Design system** tab on the Grimoire channel (`grimoire/docs/design-system/index.html`).

## Two-way artifacts

Every artifact page has `window.grim`, so interactive artifacts can save:

```js
const data = await grim.readJSON("data.json");      // a file inside this artifact ("" = its own file)
await grim.writeJSON("data.json", data);             // only .json .jsonl .md .txt .csv .yml .yaml
const board = await grim.peer("20-board.link").readJSON();   // another artifact on this channel
grim.focus("30-roadmap.link");                       // bring a tab into view
grim.onChange(({ artifact, self, by }) => load());   // re-read on change instead of a full reload
```

Make interactive artifacts a **folder** (`index.html` + data file) so data sits beside the page. Writes outside the artifact, to code/HTML, or to secret-looking files are refused.

## Themes

A theme is one CSS file in `.grimoire/themes/` that overrides design tokens. To make one: copy `.grimoire/themes/default.css` (it documents every token), set `@name`, `@description`, `@modes` (`light dark`, or one) in the header comment, change values, optionally `@import` a Google Font. Surfaces accept any CSS background (gradients, translucency). An optional `<id>.bg.js` runs sandboxed behind the stage with a full-size `<canvas id="c">` and `window.GRIM = { mode, tokens }`; respect `prefers-reduced-motion`. Then set it active in `settings.json`.

## Checking your work

The server must be running (`node grimoire/server.mjs`, port 4180). If it isn't, tell the user how to start it rather than starting long-running processes yourself, unless asked. To verify, fetch `http://localhost:4180/api/state` (channels, artifacts with `kind`, themes, settings as the UI sees them). A `kind` of `missing` means a `.link` points nowhere. Session logging works without the server.
