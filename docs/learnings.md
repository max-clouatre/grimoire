# Learnings

What building Grimoire taught us, newest first. Each entry: what happened, why, and what we do now.

## Renames hide in string lengths

**What happened:** after renaming tv → Grimoire, every library file would have returned 404. A post-rename audit caught it before the server restarted.
**Why:** the static route stripped its prefix with `path.slice(4)`, the length of `/tv/`. Text search can't find a magic number.
**Now:** prefixes are sliced by `"/grimoire/".length`. Back up before a rename, and test the routes, not just the text.

## Hooks make logging a habit, not a hope

A skill can *ask* an agent to keep a log; it forgets under load. Hooks make the mechanical part automatic (starts, edits, ends) and the Stop hook turns "remember to explain" into a one-time nudge exactly when it matters: the agent changed files and said nothing.

## An iframe's color-scheme must match its parent's

**What happened:** under Synthwave the top half of the wallpaper turned white.
**Why:** the sandboxed theme-background iframe had a light color-scheme inside a dark page, and browsers paint an opaque backdrop behind a frame whose scheme differs from its embedder's.
**Now:** the background frame declares the app's current mode (a `color-scheme` meta tag plus `:root { color-scheme }`). Artifacts get it automatically because they load the same tokens.

## `hidden` loses to your own display rules

The light/dark button kept showing for dark-only themes: `.glass-btn { display: inline-flex }` overrides the `hidden` attribute's built-in style. The app now has `[hidden] { display: none !important }`.

## Theme defaults must have zero specificity

**What happened:** Matrix (a dark-only theme) rendered with the *default* dark colours.
**Why:** the defaults set dark values on `:root[data-mode="dark"]`, which beats a theme's plain `:root`.
**Now:** every default in `tokens.css` sits inside `:where(...)`, so any theme rule wins. Themes can still target `:root[data-mode="dark"]` for their own dark values.

## scrollIntoView escapes iframes

**What happened:** opening a repo view shoved the whole stage 517px sideways, so the selected page sat off-centre.
**Why:** `scrollIntoView()` in a same-origin iframe also scrolls every scrollable ancestor, and `overflow: hidden` boxes are still scrollable by script.
**Now:** the stage uses `overflow: clip` (not a scroll container), and the repo view scrolls only its own tree.

## The same WindowProxy survives reloads

An iframe's `contentWindow` stays the same object across navigations. "Does this artifact handle its own changes?" can't be stored once per frame. Every document announces itself on load (`grim-live: false`), and upgrades with `grim.onChange` (`grim-live: true`).

## Editors don't "change" files, they replace them

Many editors write a temp file and rename it over the original, so watchers see `rename` events, sometimes several. We debounce per artifact (120 ms) and always re-scan instead of trusting the event type.

## Recursive fs.watch works on Windows

`fs.watch(dir, { recursive: true })` is reliable on Windows and macOS, which meant no dependency (chokidar) was needed. Linked folders get their own watcher; events under `node_modules` and `.git` are ignored.

## Pointers keep Grimoire honest

Making artifacts *pointers* (`.link`) rather than copies means docs stay in the repo, where they're versioned and reviewed, while Grimoire only arranges and renders them. This is Television's design too ("Television never deletes or mutates the filesystem paths … those artifact records point to").

## Reading the real thing first paid off

Television's open specs gave us its vocabulary (channels, pages, filmstrip, focus) and its key insight: *creating something and showing it are separate decisions*. `focus.json` is that idea as a file.

## Agents find drift for free

The first agent-written artifact (the json-render-app overview) noticed the README claimed Next 15 / Zod 3 while `package.json` had Next 16 / Zod 4. Project channels are a natural place for this "the docs disagree with the code" signal.
