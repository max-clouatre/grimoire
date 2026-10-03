# Roadmap

Tick a box here and it is saved straight back to `grimoire/docs/roadmap.md`. This page is a two-way artifact.

## M1 · Core loop ✓

The filesystem is the interface, and changes appear live.

- [x] Server: scan `.grimoire/`, serve artifacts, push live updates (SSE)
- [x] Channels as folders, artifacts as files, numeric ordering
- [x] `.link` pointers to files, folders and URLs
- [x] Repo view for any folder: tree, README, file views
- [x] `focus.json` shared between agent and UI
- [x] Page sizes saved in `channel.json`
- [x] Secret files hidden, path escapes blocked, local-only binding
- [x] The `Grimoire` agent skill

## M2 · Two-way + themes ✓

Artifacts write back, and anyone can restyle everything.

- [x] `window.grim` bridge API: read, write, peer, focus, onChange
- [x] Markdown task lists write back to the file
- [x] Built-in viewers: Kanban board and project dashboard
- [x] Design tokens + one-file themes with optional animated backgrounds
- [x] Theme picker; `settings.json` switches theme for every window
- [x] Eight themes: Default, Nord, Paper, Matrix, Final Fantasy, Azeroth, Synthwave, Game Boy

## M3 · Project channels

Grimoire as the place you watch a software project.

- [x] Grimoire's own channel: status, board, roadmap, architecture, decisions, learnings, design system
- [x] Sample project (Checkmate todo app) with PRD, ADRs, prototype
- [x] Sessions: each project writes its own daily log (hooks + agent + you)
- [x] Named it: Grimoire, with the grim command
- [ ] Activity view across all projects
- [ ] Git-aware repo view: recent commits, changed files, branch
- [ ] Per-repo `.grimoire/` folders merged into the workspace
- [ ] `.link` to a running dev server, with health indicator

## M4 · Polish

- [ ] Drag tabs to reorder (rewrites number prefixes)
- [ ] Syntax highlighting and search in repo views
- [ ] Keyboard navigation (channel ↑↓, tab ←→)
- [ ] Theme gallery artifact with live previews
- [ ] Packaging: `npx grimoire` with the `grim` command
- [ ] Claude plugin marketplace: install Grimoire (skill, hooks, CLI, themes) into any project
