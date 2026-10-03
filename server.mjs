// Grimoire — a filesystem-driven Television. The folder structure under .grimoire/ is the
// whole interface: a channel is a folder, an artifact is a file (or folder, or
// .link pointer) inside it, and editing a file reloads it on every open screen.
// Artifacts can also write back to their own files (two-way artifacts), and the
// look of everything comes from a swappable theme file in .grimoire/themes/.
//
//   node grimoire/server.mjs            → http://localhost:4180
//   GRIMOIRE_HOME=/path/to/.grimoire PORT=4180 node grimoire/server.mjs

import { createServer } from "node:http";
import { watch } from "node:fs";
import { readFile, readdir, stat, writeFile, mkdir } from "node:fs/promises";
import { existsSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { renderMarkdown, escapeHtml } from "./markdown.mjs";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOME = resolve(process.env.GRIMOIRE_HOME || join(HERE, "..", ".grimoire"));
const CHANNELS = join(HOME, "channels");
const THEMES = join(HOME, "themes");
const SETTINGS = join(HOME, "settings.json");
const PORT = Number(process.env.PORT) || 4180;
const HOST = "127.0.0.1"; // local only: artifacts can point at private files

const MIME = {
  ".html": "text/html; charset=utf-8", ".htm": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8", ".mjs": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8", ".txt": "text/plain; charset=utf-8", ".csv": "text/plain; charset=utf-8",
  ".yml": "text/plain; charset=utf-8", ".yaml": "text/plain; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".gif": "image/gif",
  ".webp": "image/webp", ".ico": "image/x-icon", ".pdf": "application/pdf", ".woff2": "font/woff2", ".mp4": "video/mp4",
};
const IMAGE = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico"]);
// Two-way artifacts may only write plain data and documents, never code or pages.
const WRITABLE = new Set([".json", ".jsonl", ".md", ".txt", ".csv", ".yml", ".yaml"]);
// Never listed in a repo view and never served: build noise and likely secrets.
const SKIP_DIRS = new Set([".git", "node_modules", ".next", "dist", "build", ".turbo", ".cache", "__pycache__", ".venv"]);
const SECRET = /(^|[\\/])(\.env(\..*)?|.*\.(pem|key|p12|pfx)|id_rsa.*|\.npmrc)$/i;
const isSecret = p => SECRET.test(p) && !/\.example$/i.test(p);
// Files with these double extensions render through a built-in viewer (grimoire/lib/viewers/).
const VIEWERS = { ".kanban.json": "kanban", ".dashboard.json": "dashboard", ".session.jsonl": "session" };
const viewerFor = name => Object.entries(VIEWERS).find(([ext]) => name.toLowerCase().endsWith(ext))?.[1];

/* ======================= Reading the .grimoire tree ======================= */

const readJson = async p => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return null; } };
const sorted = async dir => {
  try { return (await readdir(dir, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true })); }
  catch { return []; }
};
/** "10-weekly-plan.md" → "Weekly plan" */
const pretty = name => {
  const s = name.replace(/\.(kanban|dashboard)\.json$/i, "").replace(/\.session\.jsonl$/i, "").replace(/\.(link|html?|md|json)$/i, "")
    .replace(/^\d+[-_ .]+/, "").replace(/[-_]+/g, " ").trim();
  return s ? s[0].toUpperCase() + s.slice(1) : name;
};
const PALETTE = ["#3b82f6", "#8b5cf6", "#f97316", "#14b8a6", "#ef4444", "#eab308", "#22c55e", "#ec4899"];
const autoColor = id => PALETTE[[...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % PALETTE.length];
// Entries starting with "_" or "." are data or config, never tabs.
const hidden = name => name.startsWith("_") || name.startsWith(".") || name === "channel.json";

async function head(file, bytes = 65536) {
  try { const b = await readFile(file); return b.subarray(0, bytes).toString("utf8"); } catch { return ""; }
}
async function titleOf(file) {
  const ext = extname(file).toLowerCase(), text = await head(file);
  if (ext === ".html" || ext === ".htm") return text.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1].trim();
  if (ext === ".md") return text.match(/^---[\s\S]*?\ntitle:\s*["']?(.+?)["']?\s*\n[\s\S]*?---/)?.[1] || text.match(/^#\s+(.+)$/m)?.[1].trim();
}

/** Resolve what a .link file points at: a URL or an absolute path. */
async function linkTarget(linkFile) {
  const line = (await head(linkFile, 4096)).split(/\r?\n/).map(s => s.trim()).find(s => s && !s.startsWith("#"));
  if (!line) return null;
  if (/^https?:\/\//i.test(line)) return { url: line };
  return { path: resolve(dirname(linkFile), line) };
}

/**
 * One artifact's description. `kind` decides rendering:
 * html | md | dir (folder with index.html) | repo (any other folder) | kanban | dashboard | file | url | missing
 */
async function describe(channelDir, entry) {
  const entryPath = join(channelDir, entry.name);
  let target = entryPath, isLink = false, url = null;
  if (entry.isFile() && entry.name.endsWith(".link")) {
    isLink = true;
    const t = await linkTarget(entryPath);
    if (!t) return { kind: "missing", target: null, isLink };
    if (t.url) url = t.url; else target = t.path;
  }
  if (url) return { kind: "url", target: url, isLink, name: pretty(entry.name) };
  let st;
  try { st = statSync(target); } catch { return { kind: "missing", target, isLink, name: pretty(entry.name) }; }
  if (st.isDirectory()) {
    const index = join(target, "index.html");
    if (existsSync(index)) return { kind: "dir", target, isLink, name: isLink ? pretty(entry.name) : (await titleOf(index)) || pretty(entry.name) };
    if (isSessionsFolder(target)) return { kind: "sessions", target, isLink, name: pretty(entry.name) };
    return { kind: "repo", target, isLink, name: pretty(entry.name) };
  }
  const viewer = viewerFor(target);
  if (viewer) return { kind: viewer, target, isLink, name: pretty(entry.name) };
  const ext = extname(target).toLowerCase();
  const kind = ext === ".html" || ext === ".htm" ? "html" : ext === ".md" ? "md" : "file";
  return { kind, target, isLink, name: isLink ? pretty(entry.name) : (await titleOf(target)) || pretty(entry.name) };
}

/** A folder of day logs: named "sessions", or holding *.session.jsonl files. */
function isSessionsFolder(dir) {
  if (/sessions$/i.test(basename(dir))) return true;
  try { return readdirSync(dir).some(n => n.endsWith(".session.jsonl")); } catch { return false; }
}

/* ---------- Themes ---------- */

/** Theme metadata from the header comment: @name, @description, @modes, plus swatch colors. */
async function themeInfo(file) {
  const id = basename(file, ".css");
  const css = await head(file, 32768);
  const tag = t => css.match(new RegExp(`@${t}\\s+([^\\n*]+)`))?.[1].trim();
  const root = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1] || "";
  const token = t => root.match(new RegExp(`--${t}\\s*:\\s*([^;]+);`))?.[1].trim();
  return {
    id,
    name: tag("name") || pretty(id),
    description: tag("description") || "",
    modes: (tag("modes") || "light dark").split(/[\s,]+/).filter(Boolean),
    background: existsSync(join(THEMES, `${id}.bg.js`)),
    swatch: { background: token("background"), foreground: token("foreground"), primary: token("primary"), card: token("card"), wallpaper: token("wallpaper") },
  };
}
async function listThemes() {
  const out = [];
  for (const e of await sorted(THEMES)) if (e.isFile() && e.name.endsWith(".css")) out.push(await themeInfo(join(THEMES, e.name)));
  return out;
}
const settings = async () => ({ theme: "default", ...((await readJson(SETTINGS)) || {}) });
let themeVersion = Date.now();

async function scan() {
  const channels = [];
  for (const d of await sorted(CHANNELS)) {
    if (!d.isDirectory() || d.name.startsWith(".") || d.name.startsWith("_")) continue;
    const dir = join(CHANNELS, d.name);
    const meta = (await readJson(join(dir, "channel.json"))) || {};
    const artifacts = [];
    for (const e of await sorted(dir)) {
      if (hidden(e.name)) continue;
      const a = await describe(dir, e);
      const layout = meta.layout?.[e.name] || {};
      artifacts.push({
        id: e.name,
        name: a.name || pretty(e.name),
        kind: a.kind,
        link: a.isLink,
        path: a.target,
        src: a.kind === "url" ? a.target : `/a/${encodeURIComponent(d.name)}/${encodeURIComponent(e.name)}/`,
        w: layout.w, h: layout.h,
      });
    }
    channels.push({ id: d.name, name: meta.name || pretty(d.name), pinned: !!meta.pinned, color: meta.color || autoColor(d.name), description: meta.description || "", artifacts });
  }
  return {
    home: HOME,
    channels,
    focus: (await readJson(join(HOME, "focus.json"))) || {},
    themes: await listThemes(),
    settings: await settings(),
    themeVersion,
  };
}

/* ======================= Live updates ======================= */

const clients = new Set();
const broadcast = msg => { const data = `data: ${JSON.stringify(msg)}\n\n`; for (const res of clients) res.write(data); };

let state = { channels: [], focus: {}, themes: [], settings: {} };
let lastStateJson = "";
async function refresh() {
  state = await scan();
  const { focus, themeVersion: _, ...rest } = state;
  const json = JSON.stringify(rest);
  if (json !== lastStateJson) { lastStateJson = json; broadcast({ type: "state", state }); }
  syncLinkWatchers();
}

// Debounce bursts (editors write via temp files and renames).
const timers = new Map();
const debounce = (key, ms, fn) => { clearTimeout(timers.get(key)); timers.set(key, setTimeout(() => { timers.delete(key); fn(); }, ms)); };

// Writes made through the two-way API, so change events can say "saved from Grimoire" instead of "edited on disk".
const recentWrites = new Map(); // absolute path → timestamp
const wroteByUi = abs => Date.now() - (recentWrites.get(resolve(abs)) || 0) < 2000;

const reloadBy = new Map();
const reload = (channel, artifact, file, abs) => {
  const key = `${channel}/${artifact}`;
  if (abs && wroteByUi(abs)) reloadBy.set(key, "ui"); else if (!reloadBy.has(key)) reloadBy.set(key, "disk");
  debounce(`reload:${key}`, 120, () => {
    broadcast({ type: "reload", channel, artifact, file, by: reloadBy.get(key) });
    reloadBy.delete(key);
  });
};

function themeChanged() {
  debounce("theme", 80, async () => {
    themeVersion = Date.now();
    await refresh();
    broadcast({ type: "theme", settings: state.settings, themes: state.themes, themeVersion });
  });
}

function onTvEvent(_event, filename) {
  if (!filename) return debounce("refresh", 100, refresh);
  const parts = filename.split(/[\\/]/);
  if (parts[0] === "focus.json") {
    return debounce("focus", 60, async () => {
      const focus = (await readJson(join(HOME, "focus.json"))) || {};
      state.focus = focus;
      broadcast({ type: "focus", focus });
    });
  }
  if (parts[0] === "settings.json" || parts[0] === "themes") return themeChanged();
  if (parts[0] !== "channels") return;
  debounce("refresh", 100, refresh);
  if (parts.length >= 3 && parts[2] !== "channel.json") {
    const abs = join(HOME, filename);
    // A "_data" file changes every artifact in its channel that might read it.
    if (parts[2].startsWith("_")) {
      const c = state.channels.find(x => x.id === parts[1]);
      for (const a of c?.artifacts || []) reload(parts[1], a.id, parts.slice(2).join("/"), abs);
    } else reload(parts[1], parts[2], parts.slice(3).join("/"), abs);
  }
}

// Linked folders and files live outside .grimoire/, so each gets its own watcher.
const linkWatchers = new Map(); // target path → { watcher, owners: [{channel, artifact}] }
function syncLinkWatchers() {
  const wanted = new Map();
  for (const c of state.channels) for (const a of c.artifacts) {
    if (!a.link || !a.path || a.kind === "url" || a.kind === "missing") continue;
    if (!wanted.has(a.path)) wanted.set(a.path, []);
    wanted.get(a.path).push({ channel: c.id, artifact: a.id });
  }
  for (const [path, w] of linkWatchers) if (!wanted.has(path)) { w.watcher.close(); linkWatchers.delete(path); }
  for (const [path, owners] of wanted) {
    const existing = linkWatchers.get(path);
    if (existing) { existing.owners = owners; continue; }
    try {
      const isDir = statSync(path).isDirectory();
      const entry = { owners, watcher: null };
      entry.watcher = watch(path, { recursive: isDir }, (_e, f) => {
        if (f && f.split(/[\\/]/).some(p => SKIP_DIRS.has(p))) return;
        const abs = isDir && f ? join(path, f) : path;
        for (const o of entry.owners) reload(o.channel, o.artifact, f || basename(path), abs);
      });
      entry.watcher.on("error", () => {});
      linkWatchers.set(path, entry);
    } catch { /* target vanished; the next refresh shows it as missing */ }
  }
}

/* ======================= Rendering documents ======================= */

// Every document Grimoire serves gets the design tokens, the active theme and the bridge.
const bridgeTags = () =>
  `<link rel="stylesheet" href="/grimoire/tokens.css"><link id="grim-theme" rel="stylesheet" href="/grimoire/theme.css?v=${themeVersion}"><script src="/grimoire/bridge.js"></script>`;
const injectBridge = html =>
  /<head[^>]*>/i.test(html) ? html.replace(/<head[^>]*>/i, m => m + bridgeTags()) : bridgeTags() + html;

const page = (title, body, { base, extraHead = "" } = {}) => `<!doctype html><html><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">${bridgeTags()}
${base ? `<base href="${escapeHtml(base)}">` : ""}<title>${escapeHtml(title)}</title>
<link rel="stylesheet" href="/grimoire/grimoire.css">${extraHead}</head><body>${body}</body></html>`;

const mdPage = (title, source, base) => {
  const { html } = renderMarkdown(source);
  return page(title, `<article class="prose" data-grim-markdown>${html}</article>`, { base });
};

/** A repository / folder view: file tree on the left, README or the chosen file on the right. */
async function repoPage(root, rel, prefix, name) {
  const files = [];
  const walk = async (dir, depth) => {
    if (files.length > 4000 || depth > 12) return;
    for (const e of await sorted(dir)) {
      const p = join(dir, e.name);
      const r = relative(root, p).split(sep).join("/");
      if (e.isDirectory()) {
        if (SKIP_DIRS.has(e.name)) continue;
        files.push({ r, dir: true, depth });
        await walk(p, depth + 1);
      } else if (!isSecret(e.name)) files.push({ r, dir: false, depth });
    }
  };
  await walk(root, 0);
  files.sort((a, b) => {
    // Folders before files at each level, keeping parents above children.
    const pa = a.r.split("/"), pb = b.r.split("/");
    for (let i = 0; i < Math.min(pa.length, pb.length); i++) {
      if (pa[i] === pb[i]) continue;
      const aDir = i < pa.length - 1 || a.dir, bDir = i < pb.length - 1 || b.dir;
      if (aDir !== bDir) return aDir ? -1 : 1;
      return pa[i].localeCompare(pb[i], undefined, { numeric: true });
    }
    return pa.length - pb.length;
  });

  let current = rel;
  if (!current) current = files.find(f => !f.dir && f.depth === 0 && /^readme(\.md|\.txt)?$/i.test(basename(f.r)))?.r;
  const open = new Set();
  if (current) { const segs = current.split("/"); for (let i = 1; i < segs.length; i++) open.add(segs.slice(0, i).join("/")); }

  const tree = files.map(f => {
    const segs = f.r.split("/");
    const shown = f.depth === 0 || segs.slice(0, -1).every((_, i) => open.has(segs.slice(0, i + 1).join("/")));
    const cls = `${f.dir ? "d" : "f"}${f.r === current ? " on" : ""}${open.has(f.r) ? " open" : ""}`;
    const href = f.dir ? "#" : `${prefix}~view/${segs.map(encodeURIComponent).join("/")}`;
    return `<a class="${cls}" href="${href}" data-r="${escapeHtml(f.r)}" style="--d:${f.depth}"${shown ? "" : " hidden"}>${escapeHtml(basename(f.r))}</a>`;
  }).join("");

  let content, base;
  if (!current) content = `<div class="empty-note">No README here. Pick a file on the left.</div>`;
  else {
    base = `${prefix}${current.split("/").slice(0, -1).map(encodeURIComponent).join("/")}${current.includes("/") ? "/" : ""}`;
    content = await fileBody(join(root, current), current);
  }
  const crumbs = current ? current.split("/").map(escapeHtml).join(" <span>/</span> ") : "";
  return page(name, `
<div class="repo">
  <nav class="repo-tree" aria-label="Files"><div class="repo-name">${escapeHtml(name)}</div>${tree}</nav>
  <main class="repo-main"><div class="crumbs">${crumbs}</div>${content}</main>
</div>
<script>
document.querySelectorAll(".repo-tree a.d").forEach(a => a.onclick = e => {
  e.preventDefault();
  const r = a.dataset.r, open = a.classList.toggle("open");
  document.querySelectorAll(".repo-tree a").forEach(x => {
    if (x.dataset.r.startsWith(r + "/")) {
      const rest = x.dataset.r.slice(r.length + 1);
      if (!open) { x.hidden = true; x.classList.remove("open"); }
      else if (!rest.includes("/")) x.hidden = false;
    }
  });
});
// Scroll only the tree: scrollIntoView would also scroll the Grimoire app around this frame.
const on = document.querySelector(".repo-tree a.on"), tree = document.querySelector(".repo-tree");
if (on) tree.scrollTop = on.offsetTop - tree.clientHeight / 2;
</script>`, { base });
}

/** The readable body for one file: rendered markdown, an image, or numbered source. */
async function fileBody(abs, label) {
  const ext = extname(abs).toLowerCase();
  let st;
  try { st = await stat(abs); } catch { return `<div class="empty-note">File not found.</div>`; }
  if (IMAGE.has(ext)) return `<img class="file-img" src="${escapeHtml(basename(abs))}" alt="${escapeHtml(label)}">`;
  if (st.size > 1_000_000) return `<div class="empty-note">This file is ${(st.size / 1e6).toFixed(1)} MB — too large to preview.</div>`;
  const buf = await readFile(abs);
  if (buf.includes(0)) return `<div class="empty-note">Binary file — no preview.</div>`;
  const text = buf.toString("utf8");
  if (ext === ".md") return `<article class="prose">${renderMarkdown(text).html}</article>`;
  const lines = text.replace(/\n$/, "").split(/\r?\n/);
  return `<pre class="code"><code>${lines.map((l, i) => `<span class="ln">${i + 1}</span>${escapeHtml(l) || " "}`).join("\n")}</code></pre>`;
}

/* ======================= HTTP ======================= */

const send = (res, code, body, type = "text/plain; charset=utf-8", extra = {}) => {
  res.writeHead(code, { "content-type": type, "cache-control": "no-store", ...extra });
  res.end(body);
};
const safeJoin = (base, sub) => {
  const p = resolve(base, sub);
  const r = relative(base, p);
  return r.startsWith("..") || resolve(base, r) !== p || /^[a-zA-Z]:/.test(r) ? null : p;
};

async function readBody(req, limit = 2_000_000) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) { size += chunk.length; if (size > limit) throw Object.assign(new Error("too large"), { code: 413 }); chunks.push(chunk); }
  return Buffer.concat(chunks).toString("utf8");
}
const readJsonBody = async req => JSON.parse((await readBody(req, 100_000)) || "{}");
const validName = s => typeof s === "string" && /^[^\\/:*?"<>|]+$/.test(s) && s !== "." && s !== "..";
/** Mutations must come from Grimoire's own pages: a custom header forces a CORS preflight, and the origin must be ours. */
const trustedWrite = req => {
  const origin = req.headers.origin;
  return req.headers["x-grim"] === "1" && (!origin || origin === `http://localhost:${PORT}` || origin === `http://127.0.0.1:${PORT}`);
};

async function serveFile(res, file, { raw = false } = {}) {
  if (isSecret(file)) return send(res, 403, "Hidden by Grimoire: looks like a secret file.");
  const ext = extname(file).toLowerCase();
  if (!raw && (ext === ".html" || ext === ".htm")) return send(res, 200, injectBridge(await readFile(file, "utf8")), MIME[".html"]);
  if (!raw && ext === ".md") return send(res, 200, mdPage(basename(file), await readFile(file, "utf8")), MIME[".html"]);
  send(res, 200, await readFile(file), MIME[ext] || "application/octet-stream");
}

async function serveViewer(res, viewer, title, mode = viewer) {
  const html = await readFile(join(HERE, "lib", "viewers", `${viewer}.html`), "utf8");
  const head = `<title>${escapeHtml(title)}</title><meta name="grimoire-mode" content="${escapeHtml(mode)}">`;
  send(res, 200, injectBridge(html.replace("<title></title>", head)), MIME[".html"]);
}

async function serveArtifact(req, res, channelId, artifactId, sub, url) {
  if (!validName(channelId) || !validName(artifactId)) return send(res, 400, "Bad name");
  const channelDir = join(CHANNELS, channelId);
  let entry;
  try { entry = (await readdir(channelDir, { withFileTypes: true })).find(e => e.name === artifactId); } catch {}
  if (!entry) return send(res, 404, page("Missing", `<div class="empty-note">This artifact no longer exists.</div>`), MIME[".html"]);
  const a = await describe(channelDir, entry);
  const prefix = `/a/${encodeURIComponent(channelId)}/${encodeURIComponent(artifactId)}/`;

  if (a.kind === "missing") return send(res, 404, page("Missing", `<div class="empty-note"><b>Link target not found</b><br><code>${escapeHtml(a.target || "(empty .link file)")}</code></div>`), MIME[".html"]);
  if (a.kind === "url") return send(res, 302, "", undefined, { location: a.target });

  const isFolder = a.kind === "dir" || a.kind === "repo" || a.kind === "sessions";
  const base = isFolder ? a.target : dirname(a.target);
  const raw = url.searchParams.has("raw");

  // Two-way: write a data file inside this artifact (its own file when sub is empty).
  if (req.method === "PUT") {
    if (!trustedWrite(req)) return send(res, 403, "Writes must come from Grimoire.");
    const file = sub ? safeJoin(base, sub) : (isFolder ? null : a.target);
    if (!file) return send(res, 403, "Outside this artifact.");
    if (!WRITABLE.has(extname(file).toLowerCase())) return send(res, 403, `Grimoire only writes ${[...WRITABLE].join(" ")} files.`);
    if (isSecret(file)) return send(res, 403, "Refusing to write a secret-looking file.");
    const text = await readBody(req);
    if (extname(file).toLowerCase() === ".json") { try { JSON.parse(text); } catch { return send(res, 400, "Invalid JSON"); } }
    await mkdir(dirname(file), { recursive: true });
    recentWrites.set(resolve(file), Date.now());
    await writeFile(file, text);
    return send(res, 204, "");
  }

  if (!sub) {
    if (url.searchParams.has("list") && isFolder) {
      const entries = (await sorted(a.target)).filter(e => !SKIP_DIRS.has(e.name) && !isSecret(e.name) && !e.name.startsWith("."));
      return send(res, 200, JSON.stringify(entries.map(e => ({ name: e.name, dir: e.isDirectory() }))), MIME[".json"]);
    }
    if (raw && !isFolder) return serveFile(res, a.target, { raw: true });
    if (a.kind === "repo") return send(res, 200, await repoPage(a.target, null, prefix, a.name), MIME[".html"]);
    if (a.kind === "dir") return serveFile(res, join(a.target, "index.html"));
    if (a.kind === "kanban" || a.kind === "dashboard") return serveViewer(res, a.kind, a.name);
    if (a.kind === "sessions" || a.kind === "session") return serveViewer(res, "sessions", a.name, a.kind);
    if (a.kind === "file") return send(res, 200, page(a.name, `<main class="repo-main solo">${await fileBody(a.target, a.name)}</main>`, { base: prefix }), MIME[".html"]);
    return serveFile(res, a.target);
  }
  if (isFolder && sub.startsWith("~view/")) {
    const rel = sub.slice(6);
    if (!safeJoin(a.target, rel) || isSecret(rel)) return send(res, 403, "Forbidden");
    return send(res, 200, await repoPage(a.target, rel, prefix, a.name), MIME[".html"]);
  }
  const file = safeJoin(base, sub);
  if (!file) return send(res, 403, "Forbidden");
  try {
    const st = await stat(file);
    if (st.isDirectory()) {
      const index = join(file, "index.html");
      if (existsSync(index)) return serveFile(res, index);
      return send(res, 404, "Not found");
    }
    return serveFile(res, file, { raw });
  } catch { send(res, 404, "Not found"); }
}

async function serveTheme(res, name, kind) {
  const id = validName(name || "") ? name : (await settings()).theme;
  const file = join(THEMES, `${id}${kind === "bg" ? ".bg.js" : ".css"}`);
  try { send(res, 200, await readFile(file), kind === "bg" ? MIME[".js"] : MIME[".css"]); }
  catch { send(res, kind === "bg" ? 404 : 200, kind === "bg" ? "" : `/* theme "${id}" not found: tokens.css defaults apply */`, kind === "bg" ? MIME[".js"] : MIME[".css"]); }
}

const server = createServer(async (req, res) => {
  try {
    const url = new URL(req.url, "http://localhost");
    const path = decodeURIComponent(url.pathname);

    if (path === "/") return send(res, 200, await readFile(join(HERE, "ui", "index.html")), MIME[".html"]);
    if (path === "/grimoire/theme.css") return serveTheme(res, url.searchParams.get("name"), "css");
    if (path === "/grimoire/theme-bg.js") return serveTheme(res, url.searchParams.get("name"), "bg");
    if (path.startsWith("/ui/") || path.startsWith("/grimoire/")) {
      const ui = path.startsWith("/ui/");
      const file = safeJoin(ui ? join(HERE, "ui") : join(HERE, "lib"), path.slice(ui ? "/ui/".length : "/grimoire/".length));
      if (!file || !existsSync(file)) return send(res, 404, "Not found");
      return send(res, 200, await readFile(file), MIME[extname(file).toLowerCase()] || "application/octet-stream");
    }
    if (path === "/api/state") return send(res, 200, JSON.stringify(state), MIME[".json"]);
    if (path === "/api/events") {
      res.writeHead(200, { "content-type": "text/event-stream", "cache-control": "no-store", connection: "keep-alive" });
      res.write(`data: ${JSON.stringify({ type: "state", state })}\n\n`);
      clients.add(res);
      const ping = setInterval(() => res.write(": ping\n\n"), 25000);
      req.on("close", () => { clearInterval(ping); clients.delete(res); });
      return;
    }
    if (req.method === "POST" && path.startsWith("/api/") && !trustedWrite(req)) return send(res, 403, "Writes must come from Grimoire.");
    if (req.method === "POST" && path === "/api/focus") {
      const { channel, artifact } = await readJsonBody(req);
      if (!validName(channel)) return send(res, 400, "Bad channel");
      const focus = { channel, ...(artifact && validName(artifact) ? { artifact } : {}), by: "ui", at: new Date().toISOString() };
      await writeFile(join(HOME, "focus.json"), JSON.stringify(focus, null, 2) + "\n");
      return send(res, 204, "");
    }
    if (req.method === "POST" && path === "/api/settings") {
      const patch = await readJsonBody(req);
      if (patch.theme !== undefined && !state.themes.some(t => t.id === patch.theme)) return send(res, 400, "Unknown theme");
      await writeFile(SETTINGS, JSON.stringify({ ...(await settings()), ...patch }, null, 2) + "\n");
      return send(res, 204, "");
    }
    if (req.method === "POST" && path === "/api/layout") {
      const { channel, artifact, w, h } = await readJsonBody(req);
      if (!validName(channel) || !validName(artifact)) return send(res, 400, "Bad name");
      const file = join(CHANNELS, channel, "channel.json");
      const meta = (await readJson(file)) || {};
      meta.layout = { ...meta.layout, [artifact]: { w: Math.round(w), h: Math.round(h) } };
      await writeFile(file, JSON.stringify(meta, null, 2) + "\n");
      return send(res, 204, "");
    }
    if (req.method === "POST" && path === "/api/channel") {
      const { name } = await readJsonBody(req);
      const clean = String(name || "").trim().slice(0, 60);
      if (!clean) return send(res, 400, "Name required");
      const nums = state.channels.map(c => parseInt(c.id) || 0);
      const id = `${(Math.floor(Math.max(0, ...nums) / 10) + 1) * 10}-${clean.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "channel"}`;
      await mkdir(join(CHANNELS, id), { recursive: true });
      await writeFile(join(CHANNELS, id, "channel.json"), JSON.stringify({ name: clean }, null, 2) + "\n");
      return send(res, 200, JSON.stringify({ id }), MIME[".json"]);
    }
    const m = path.match(/^\/a\/([^/]+)\/([^/]+)\/?(.*)$/);
    if (m) return serveArtifact(req, res, m[1], m[2], m[3], url);
    send(res, 404, "Not found");
  } catch (err) {
    if (err.code !== 413) console.error(err);
    if (!res.headersSent) send(res, err.code === 413 ? 413 : 500, err.code === 413 ? "Too large" : "Server error");
  }
});

await mkdir(CHANNELS, { recursive: true });
await mkdir(THEMES, { recursive: true });
await refresh();
watch(HOME, { recursive: true }, onTvEvent).on("error", e => console.error("watch error", e));
server.listen(PORT, HOST, () => console.log(`Grimoire: watching ${HOME}\nGrimoire: open http://localhost:${PORT}`));
