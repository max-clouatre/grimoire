// Injected into every HTML document Grimoire serves (after tokens.css and the theme).
//
// It keeps the artifact in step with the app (light/dark mode, live theme swaps,
// scroll position across reloads) and gives the page a small API, window.grim,
// for two-way artifacts:
//
//   await grim.read("data.json")            text of a file inside this artifact ("" = the artifact's own file)
//   await grim.readJSON("data.json")
//   await grim.write("data.json", text)     .json .md .txt .csv .yml only
//   await grim.writeJSON("data.json", obj)
//   await grim.list()                       entries of a folder artifact
//   grim.peer("20-board.link")              the same API for another artifact on this channel
//   grim.focus("30-roadmap.link")           bring another artifact on this channel into view
//   grim.onChange(fn)                       handle file changes yourself instead of reloading;
//                                         fn({ artifact, file, by, self }) — by is "ui" or "disk"
(() => {
  const root = document.documentElement;
  const setMode = m => { if (m) root.dataset.mode = m; };
  try { if (parent !== window) setMode(parent.document.documentElement.dataset.mode); } catch {}

  const match = location.pathname.match(/^\/a\/([^/]+)\/([^/]+)\//);
  const channel = match ? decodeURIComponent(match[1]) : null;
  const artifact = match ? decodeURIComponent(match[2]) : null;
  const urlFor = (art, path = "") =>
    `/a/${encodeURIComponent(channel)}/${encodeURIComponent(art)}/` + path.split("/").filter(Boolean).map(encodeURIComponent).join("/");

  const toParent = msg => { try { if (parent !== window) parent.postMessage(msg, location.origin); } catch {} };

  function api(art) {
    return {
      async read(path = "") {
        const r = await fetch(urlFor(art, path) + "?raw", { cache: "no-store" });
        if (!r.ok) throw new Error(`grim.read ${path || art}: ${r.status}`);
        return r.text();
      },
      async readJSON(path = "") { return JSON.parse(await this.read(path)); },
      async write(path, text) {
        if (text === undefined) { text = path; path = ""; }
        const r = await fetch(urlFor(art, path), { method: "PUT", headers: { "x-grim": "1", "content-type": "text/plain" }, body: text });
        if (!r.ok) throw new Error(`grim.write ${path || art}: ${r.status} ${await r.text()}`);
      },
      async writeJSON(path, data) {
        if (data === undefined) { data = path; path = ""; }
        return this.write(path, JSON.stringify(data, null, 2) + "\n");
      },
      async list() {
        const r = await fetch(urlFor(art) + "?list", { cache: "no-store" });
        if (!r.ok) throw new Error(`grim.list ${art}: ${r.status}`);
        return r.json();
      },
    };
  }

  const listeners = [];
  window.grim = Object.assign(api(artifact), {
    channel, artifact,
    peer: id => api(id),
    focus: id => toParent({ type: "grim-focus", artifact: id }),
    onChange(fn) { listeners.push(fn); toParent({ type: "grim-live", live: true }); },
  });
  // Every new document starts as "reload me on change" until it calls grim.onChange.
  toParent({ type: "grim-live", live: false });

  addEventListener("message", e => {
    const d = e.data || {};
    if (d.type === "grim-theme") {
      setMode(d.mode);
      const link = document.getElementById("grim-theme");
      if (link && d.v) link.href = `/grimoire/theme.css?v=${d.v}`;
    }
    if (d.type === "grim-change") listeners.forEach(fn => fn({ artifact: d.artifact, file: d.file, by: d.by, self: d.artifact === artifact }));
  });

  // Keep the scroll position when a file edit reloads the page.
  const key = "grim-scroll:" + location.pathname;
  addEventListener("pagehide", () => { try { sessionStorage.setItem(key, String(scrollY)); } catch {} });
  addEventListener("load", () => {
    try { const y = Number(sessionStorage.getItem(key)); if (y) scrollTo(0, y); } catch {}
  });

  // Markdown artifacts are two-way: task checkboxes write back to the file, and
  // edits to the file morph the page in place instead of reloading it.
  addEventListener("DOMContentLoaded", () => {
    document.querySelectorAll(".prose:not([data-grim-markdown]) input[data-task]").forEach(i => (i.disabled = true));
    const article = document.querySelector("[data-grim-markdown]");
    if (!article) return;
    const self = location.pathname;
    article.addEventListener("change", async e => {
      const box = e.target.closest("input[data-task]");
      if (!box) return;
      const n = Number(box.dataset.task);
      const src = await (await fetch(self + "?raw", { cache: "no-store" })).text();
      let seen = -1, fenced = false;
      const out = src.split("\n").map(line => {
        if (/^\s*```/.test(line)) fenced = !fenced;
        if (fenced) return line;
        return line.replace(/^(\s*(?:[-*+]|\d+[.)])\s+\[)( |x|X)(\])/, (m, a, _c, b) => (++seen === n ? a + (box.checked ? "x" : " ") + b : m));
      }).join("\n");
      const r = await fetch(self, { method: "PUT", headers: { "x-grim": "1" }, body: out });
      if (!r.ok) { box.checked = !box.checked; console.warn("Grimoire: could not save", await r.text()); }
    });
    window.grim.onChange(async ({ self: mine }) => {
      if (!mine) return;
      const html = await (await fetch(location.href, { cache: "no-store" })).text();
      const next = new DOMParser().parseFromString(html, "text/html").querySelector("[data-grim-markdown]");
      if (next) article.innerHTML = next.innerHTML;
    });
  });
})();
