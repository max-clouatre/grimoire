# Start here

This screen is drawn entirely from files. Everything you see lives in **`.grimoire/`** at the root of your project, and any change to those files appears here immediately, whether you make it or your agent does. Some pages also save back to their files.

## The rules

| On disk | On screen |
|---|---|
| `.grimoire/channels/20-my-app/` | a **channel** in the sidebar |
| `channel.json` | name, pin, colour, saved page sizes |
| `10-notes.md`, `20-plan.html` | **pages**: one tab each |
| a folder with `index.html` | an app (can save its own data) |
| `30-roadmap.link` | a **pointer** into your repo: docs stay where they belong |
| `board.kanban.json`, `status.dashboard.json` | data shown by a built-in **viewer** |
| a `sessions/` folder of `*.session.jsonl` | the project's self-written **session log** |
| `.grimoire/focus.json` | what every window is showing |
| `.grimoire/themes/*.css` + `settings.json` | the **theme** |

## Try it

- [ ] Tick this box. It just saved itself into `10-start-here.md`.
- [ ] Click the palette button (top right) and try **Matrix**, **Final Fantasy** or **Azeroth**.
- [ ] Ask your agent: *"set up a Grimoire project channel for this repo"*. It will create a board, roadmap, decisions and a session log.
- [ ] Ask your agent: *"what happened in this project today?"*. It will answer from the session log.

> Your agent writes files. Grimoire watches files. You click, Grimoire writes files. That's the whole protocol.
