#!/usr/bin/env node
// grim CLI: session logs for channels. Works without the server running.
//
//   node grimoire/cli.mjs log "text" [--kind note] [--channel 20-grimoire] [--files a,b] [--refs grim-018] [--by claude]
//   node grimoire/cli.mjs today [--channel 20-grimoire]      print today's entries
//   node grimoire/cli.mjs where [--channel 20-grimoire]      print the sessions folder and today's file
//   node grimoire/cli.mjs hook <event>                 Claude Code hooks (JSON on stdin):
//                                                session-start | prompt | post-tool | stop | session-end
//
// A session log is one append-only JSON Lines file per day, <sessions>/<YYYY-MM-DD>.session.jsonl.
// Each line: { t, by, kind, text, files?, refs?, session? }.
// The channel is chosen by --channel, then GRIM_CHANNEL, then the path being worked on
// (the deepest folder a channel links to), then focus.json.

import { appendFile, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync, statSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const HOME = resolve(process.env.GRIMOIRE_HOME || join(HERE, "..", ".grimoire"));
const CHANNELS = join(HOME, "channels");
const STATE = join(HOME, ".state");
const WORKSPACE = dirname(HOME);

export const KINDS = ["start", "note", "change", "decision", "finding", "question", "blocker", "done", "summary", "end"];
const COALESCE_MS = 15 * 60 * 1000; // repeated edits within 15 minutes merge into one "change" entry
const IGNORE = [/[\\/]\.grimoire[\\/](focus|settings)\.json$/, /[\\/]\.grimoire[\\/]\.state[\\/]/, /\.session\.jsonl$/, /[\\/]channel\.json$/];

/* ---------------- helpers ---------------- */

const readJson = async p => { try { return JSON.parse(await readFile(p, "utf8")); } catch { return null; } };
const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const isInside = (root, p) => { const r = relative(root, p); return r === "" || (!r.startsWith("..") && !/^[a-zA-Z]:/.test(r)); };
const norm = p => resolve(p).replace(/[\\/]+$/, "");

async function linkTarget(file) {
  try {
    const line = (await readFile(file, "utf8")).split(/\r?\n/).map(s => s.trim()).find(s => s && !s.startsWith("#"));
    if (!line || /^https?:/i.test(line)) return null;
    return resolve(dirname(file), line);
  } catch { return null; }
}

/** Every channel with the folders it covers and where its session logs live. */
async function channels() {
  const out = [];
  let dirs = [];
  try { dirs = (await readdir(CHANNELS, { withFileTypes: true })).filter(d => d.isDirectory() && !/^[._]/.test(d.name)); } catch {}
  for (const d of dirs) {
    const dir = join(CHANNELS, d.name);
    const roots = [dir];
    let sessions = null;
    for (const e of await readdir(dir, { withFileTypes: true })) {
      const p = join(dir, e.name);
      const target = e.isFile() && e.name.endsWith(".link") ? await linkTarget(p) : e.isDirectory() ? p : null;
      if (!target || !existsSync(target)) continue;
      const isDir = statSync(target).isDirectory();
      if (isDir) roots.push(target);
      if (isDir && /sessions$/i.test(basename(target)) && !sessions) sessions = target;
    }
    const meta = (await readJson(join(dir, "channel.json"))) || {};
    out.push({ id: d.name, name: meta.name || d.name, dir, roots: roots.map(norm), sessions });
  }
  return out;
}

async function channelFor({ channel, path } = {}) {
  const all = await channels();
  const pick = channel || process.env.GRIM_CHANNEL;
  if (pick) return all.find(c => c.id === pick || c.name.toLowerCase() === String(pick).toLowerCase()) || null;
  if (path) {
    const p = norm(path);
    let best = null, depth = -1;
    for (const c of all) for (const r of c.roots) if (isInside(r, p) && r.length > depth) { best = c; depth = r.length; }
    if (best) return best;
    return null;
  }
  const focus = await readJson(join(HOME, "focus.json"));
  return all.find(c => c.id === focus?.channel) || null;
}

/** The channel's sessions folder; created inside the channel if it has none. */
async function sessionsDir(c) {
  if (c.sessions) return c.sessions;
  const dir = join(c.dir, "15-sessions");
  await mkdir(dir, { recursive: true });
  return dir;
}
const todayFile = async c => join(await sessionsDir(c), `${today()}.session.jsonl`);

async function readEntries(file) {
  try {
    return (await readFile(file, "utf8")).split(/\r?\n/).filter(Boolean).map(l => { try { return JSON.parse(l); } catch { return null; } }).filter(Boolean);
  } catch { return []; }
}

async function append(c, entry) {
  const file = await todayFile(c);
  const line = JSON.stringify({ t: new Date().toISOString(), by: "claude", ...entry }) + "\n";
  await appendFile(file, line);
  return file;
}

/** Merge a file change into this session's latest "change" entry when it's recent, else append one. */
async function recordChange(c, path, session) {
  const file = await todayFile(c);
  const entries = await readEntries(file);
  const last = entries.at(-1);
  const rel = relative(WORKSPACE, path).split(sep).join("/");
  if (last && last.kind === "change" && last.session === session && Date.now() - Date.parse(last.last || last.t) < COALESCE_MS) {
    last.files = [...new Set([...(last.files || []), rel])].slice(0, 50);
    last.last = new Date().toISOString();
    entries[entries.length - 1] = last;
    await writeFile(file, entries.map(e => JSON.stringify(e)).join("\n") + "\n");
  } else {
    await appendFile(file, JSON.stringify({ t: new Date().toISOString(), by: "claude", kind: "change", text: "Edited files", files: [rel], session }) + "\n");
  }
}

/* ---------------- per-Claude-session state (for hooks) ---------------- */

const stateFile = id => join(STATE, `${String(id || "unknown").replace(/[^\w-]/g, "")}.json`);
const loadState = async id => (await readJson(stateFile(id))) || { turnStart: Date.now(), touched: [], started: [] };
async function saveState(id, s) { await mkdir(STATE, { recursive: true }); await writeFile(stateFile(id), JSON.stringify(s)); }

async function stdinJson() {
  if (process.stdin.isTTY) return {};
  let data = "";
  for await (const chunk of process.stdin) data += chunk;
  try { return JSON.parse(data || "{}"); } catch { return {}; }
}

/* ---------------- hooks ---------------- */

const HOOKS = {
  /** Session start: remind the agent of the rules and show today's logs, so context survives restarts. */
  async "session-start"(input) {
    const all = await channels();
    const lines = [];
    for (const c of all) {
      if (!c.sessions && !existsSync(join(c.dir, "15-sessions"))) continue;
      const entries = (await readEntries(join(c.sessions || join(c.dir, "15-sessions"), `${today()}.session.jsonl`))).filter(e => e.kind !== "change");
      if (entries.length) lines.push(`- ${c.name} (${c.id}): ${entries.slice(-4).map(e => `[${e.kind}] ${e.text}`).join(" · ")}`);
    }
    const here = await channelFor({ path: input.cwd || process.cwd() });
    if (here && (input.source === "startup" || input.source === "resume")) {
      await append(here, { kind: "start", text: `Claude Code session ${input.source === "resume" ? "resumed" : "started"}`, session: input.session_id });
    }
    const context = [
      "Grimoire session logs are active (see the Grimoire skill, section \"Sessions\").",
      "File edits inside a channel's project are logged automatically. You log the meaning: decisions, findings, questions, blockers, and what got done.",
      'Log with: node grimoire/cli.mjs log "<plain-language sentence>" --kind <note|decision|finding|question|blocker|done|summary> [--channel <id>] [--refs <card ids>]',
      lines.length ? `Today so far:\n${lines.join("\n")}` : "No session entries yet today.",
    ].join("\n");
    process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context } }));
  },

  /** New user turn: start tracking what this turn touches. */
  async prompt(input) {
    const s = await loadState(input.session_id);
    s.turnStart = Date.now();
    s.touched = [];
    s.nudged = false;
    await saveState(input.session_id, s);
  },

  /** A file was written: log it against the channel whose project contains it. */
  async "post-tool"(input) {
    const path = input.tool_input?.file_path || input.tool_input?.notebook_path || input.tool_response?.filePath;
    if (!path || IGNORE.some(r => r.test(path))) return;
    const c = await channelFor({ path });
    if (!c) return;
    await recordChange(c, resolve(path), input.session_id);
    const s = await loadState(input.session_id);
    if (!s.touched.includes(c.id)) s.touched.push(c.id);
    await saveState(input.session_id, s);
  },

  /** End of a turn: if files changed in a channel but nobody said what happened, ask once. */
  async stop(input) {
    if (input.stop_hook_active) return;
    const s = await loadState(input.session_id);
    if (s.nudged || !s.touched.length) return;
    const all = await channels();
    const silent = [];
    for (const id of s.touched) {
      const c = all.find(x => x.id === id);
      if (!c) continue;
      const entries = await readEntries(await todayFile(c));
      const explained = entries.some(e => e.kind !== "change" && e.kind !== "start" && Date.parse(e.t) >= s.turnStart);
      if (!explained) silent.push(c);
    }
    if (!silent.length) return;
    s.nudged = true;
    await saveState(input.session_id, s);
    const names = silent.map(c => `${c.name} (--channel ${c.id})`).join(", ");
    process.stdout.write(JSON.stringify({
      decision: "block",
      reason: `Grimoire: you changed files in ${names} this turn but the session log doesn't say what happened. Append one plain-language entry per channel, e.g.\n  node grimoire/cli.mjs log "Added X so that Y" --kind done --channel ${silent[0].id}\nUse --kind decision/finding/question/blocker when that fits better. If the project's board or roadmap changed state, update them too. Then finish your reply.`,
    }));
  },

  /** Session end: close out the channels this session worked in. */
  async "session-end"(input) {
    const s = await loadState(input.session_id);
    const all = await channels();
    for (const id of new Set(s.touched.concat(s.everTouched || []))) {
      const c = all.find(x => x.id === id);
      if (c) await append(c, { kind: "end", text: "Claude Code session ended", session: input.session_id });
    }
  },
};

/* ---------------- commands ---------------- */

function parseArgs(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) { const k = a.slice(2); out[k] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : true; }
    else out._.push(a);
  }
  return out;
}

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const args = parseArgs(rest);

  if (cmd === "hook") {
    const name = args._[0];
    if (!HOOKS[name]) { console.error(`unknown hook: ${name}`); process.exit(1); }
    const input = await stdinJson();
    // Remember every channel a session touched, for session-end.
    await HOOKS[name](input);
    if (name === "post-tool" && input.session_id) {
      const s = await loadState(input.session_id);
      s.everTouched = [...new Set([...(s.everTouched || []), ...s.touched])];
      await saveState(input.session_id, s);
    }
    return;
  }

  const c = await channelFor({ channel: args.channel, path: args.channel ? null : process.cwd() }) || await channelFor({});
  if (!c && cmd !== "help") { console.error("Grimoire: no channel found. Pass --channel <id> (see .grimoire/channels/)."); process.exit(1); }

  if (cmd === "log") {
    const text = args._.join(" ").trim();
    if (!text) { console.error('usage: grim log "what happened" [--kind note] [--channel id]'); process.exit(1); }
    const kind = KINDS.includes(args.kind) ? args.kind : "note";
    const entry = { kind, text, by: typeof args.by === "string" ? args.by : "claude" };
    if (typeof args.files === "string") entry.files = args.files.split(",").map(s => s.trim()).filter(Boolean);
    if (typeof args.refs === "string") entry.refs = args.refs.split(",").map(s => s.trim()).filter(Boolean);
    const file = await append(c, entry);
    console.log(`logged [${kind}] to ${c.name} → ${relative(WORKSPACE, file)}`);
  } else if (cmd === "today") {
    const entries = await readEntries(await todayFile(c));
    if (!entries.length) console.log(`${c.name}: nothing logged today.`);
    for (const e of entries) console.log(`${new Date(e.t).toTimeString().slice(0, 5)}  ${e.kind.padEnd(8)} ${e.text}${e.files ? `  (${e.files.length} files)` : ""}`);
  } else if (cmd === "where") {
    console.log(`channel:  ${c.id} (${c.name})\nsessions: ${await sessionsDir(c)}\ntoday:    ${await todayFile(c)}`);
  } else {
    console.log(`grim CLI — session logs
  grim log "text" [--kind ${KINDS.join("|")}] [--channel id] [--files a,b] [--refs id1,id2] [--by name]
  grim today [--channel id]
  grim where [--channel id]
  grim hook session-start|prompt|post-tool|stop|session-end   (for Claude Code hooks)`);
  }
}

main().catch(e => { console.error(`Grimoire: ${e.message}`); process.exit(process.argv[2] === "hook" ? 0 : 1); });
