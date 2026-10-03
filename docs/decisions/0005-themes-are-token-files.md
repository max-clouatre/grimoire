# 0005 · Themes are token files

**Status:** Accepted · **Date:** 2026-10-02

## Context

Users should be able to restyle everything easily, the way shadcn/ui themes swap CSS variables. The first build hard-coded a cloud wallpaper that not everyone liked.

## Decision

`grimoire/lib/tokens.css` defines every design token (shadcn-style names plus app-chrome tokens) inside `:where()`. A theme is one file, `.grimoire/themes/<id>.css`, that overrides any subset on `:root` / `:root[data-mode="dark"]`, with metadata in a header comment (`@name`, `@description`, `@modes`). An optional `<id>.bg.js` draws an animated background in a sandboxed canvas. The app and every artifact load the active theme, so one swap restyles everything.

## Consequences

- A new theme is a copied file with changed values; agents can write themes too.
- Surfaces are background *shorthands*, so themes can use gradients (Final Fantasy windows) or translucency (Matrix rain showing through).
- Artifacts must use tokens, not hard-coded colours, to follow themes; the skill says so.
