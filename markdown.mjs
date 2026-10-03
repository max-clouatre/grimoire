// A small, dependency-free Markdown renderer covering what agents and READMEs
// actually write: front matter, headings, paragraphs, emphasis, code (inline and
// fenced), links, images, block quotes, nested and task lists, tables, rules.

export const escapeHtml = s =>
  String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

const safeUrl = u => (/^\s*(javascript|vbscript|data):/i.test(u) && !/^\s*data:image\//i.test(u) ? "#" : u);
const slug = s => s.toLowerCase().replace(/<[^>]+>/g, "").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-");

function inline(src) {
  const codes = [];
  let s = src.replace(/`([^`]+)`/g, (_, c) => `\u0000${codes.push(c) - 1}\u0000`);
  s = escapeHtml(s)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)/g, (_, alt, src) => `<img alt="${alt}" src="${safeUrl(src)}">`)
    .replace(/\[([^\]]+)\]\(([^)\s]+)(?:\s+&quot;[^)]*&quot;)?\)/g, (_, text, href) => `<a href="${safeUrl(href)}">${text}</a>`)
    .replace(/(^|[\s(])(https?:\/\/[^\s<)]+)/g, '$1<a href="$2">$2</a>')
    .replace(/\*\*([^*]+)\*\*|__([^_]+)__/g, (_, a, b) => `<strong>${a ?? b}</strong>`)
    .replace(/(^|[^*\w])\*(?!\s)([^*\n]+?)\*(?!\w)/g, "$1<em>$2</em>")
    .replace(/(^|[^_\w])_(?!\s)([^_\n]+?)_(?!\w)/g, "$1<em>$2</em>")
    .replace(/~~([^~]+)~~/g, "<del>$1</del>");
  return s.replace(/\u0000(\d+)\u0000/g, (_, i) => `<code>${escapeHtml(codes[i])}</code>`);
}

const LI = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;
const indentOf = l => l.search(/\S/);
const dedent = lines => {
  const n = Math.min(...lines.filter(l => l.trim()).map(indentOf));
  return lines.map(l => l.slice(Math.min(n, indentOf(l) < 0 ? l.length : n)));
};
const splitRow = l => l.trim().replace(/^\||\|$/g, "").split(/(?<!\\)\|/).map(c => c.trim());

function blocks(lines) {
  const out = [];
  let i = 0;
  const isBlockStart = l =>
    /^(#{1,6})\s/.test(l) || /^\s*```/.test(l) || /^>/.test(l) || LI.test(l) || /^\s*([-*_])(\s*\1){2,}\s*$/.test(l);

  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }

    const fence = line.match(/^\s*```(\S*)/);
    if (fence) {
      const code = [];
      i++;
      while (i < lines.length && !/^\s*```/.test(lines[i])) code.push(lines[i++]);
      i++;
      out.push(`<pre><code${fence[1] ? ` class="lang-${escapeHtml(fence[1])}"` : ""}>${escapeHtml(code.join("\n"))}</code></pre>`);
      continue;
    }
    const h = line.match(/^(#{1,6})\s+(.*?)\s*#*\s*$/);
    if (h) { const t = inline(h[2]); out.push(`<h${h[1].length} id="${slug(t)}">${t}</h${h[1].length}>`); i++; continue; }
    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) { out.push("<hr>"); i++; continue; }
    if (/^>/.test(line)) {
      const q = [];
      while (i < lines.length && /^>/.test(lines[i])) q.push(lines[i++].replace(/^>\s?/, ""));
      out.push(`<blockquote>${blocks(q)}</blockquote>`);
      continue;
    }
    if (LI.test(line)) {
      const [html, next] = list(lines, i);
      out.push(html); i = next; continue;
    }
    if (line.includes("|") && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(lines[i + 1])) {
      const head = splitRow(line);
      const align = splitRow(lines[i + 1]).map(c => (c.startsWith(":") && c.endsWith(":") ? "center" : c.endsWith(":") ? "right" : ""));
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) rows.push(splitRow(lines[i++]));
      const cell = (tag, c, j) => `<${tag}${align[j] ? ` style="text-align:${align[j]}"` : ""}>${inline(c)}</${tag}>`;
      out.push(`<div class="table-wrap"><table><thead><tr>${head.map((c, j) => cell("th", c, j)).join("")}</tr></thead><tbody>${
        rows.map(r => `<tr>${head.map((_, j) => cell("td", r[j] ?? "", j)).join("")}</tr>`).join("")}</tbody></table></div>`);
      continue;
    }
    const para = [];
    while (i < lines.length && lines[i].trim() && !(para.length && isBlockStart(lines[i]))) para.push(lines[i++].trim());
    out.push(`<p>${inline(para.join(" ")).replace(/ {2,}$/gm, "<br>")}</p>`);
  }
  return out.join("\n");
}

function list(lines, i) {
  const first = lines[i].match(LI);
  const indent = first[1].length, ordered = /\d/.test(first[2]);
  const items = [];
  while (i < lines.length) {
    const l = lines[i], m = l.match(LI);
    if (m && m[1].length === indent && /\d/.test(m[2]) === ordered) { items.push([m[3]]); i++; continue; }
    if (!l.trim()) {
      const n = lines[i + 1];
      if (n !== undefined && n.trim() && indentOf(n) > indent) { items.at(-1).push(""); i++; continue; }
      if (n !== undefined && LI.test(n) && n.match(LI)[1].length === indent) { i++; continue; }
      break;
    }
    if (indentOf(l) > indent) { items.at(-1).push(l); i++; continue; }
    break;
  }
  const start = ordered && parseInt(first[2]) !== 1 ? ` start="${parseInt(first[2])}"` : "";
  const lis = items.map(([text, ...rest]) => {
    const task = text.match(/^\[( |x|X)\]\s+(.*)$/);
    const label = task ? `<input type="checkbox" data-task="${taskCount++}"${task[1] !== " " ? " checked" : ""}> ${inline(task[2])}` : inline(text);
    const sub = rest.some(r => r.trim()) ? blocks(dedent(rest)) : "";
    return `<li${task ? ' class="task"' : ""}>${label}${sub}</li>`;
  }).join("");
  return [`<${ordered ? "ol" : "ul"}${start}>${lis}</${ordered ? "ol" : "ul"}>`, i];
}

// Task checkboxes are numbered in document order so a click can toggle the matching source line.
let taskCount = 0;

export function renderMarkdown(source) {
  taskCount = 0;
  let src = String(source).replace(/\r\n?/g, "\n");
  const meta = {};
  const fm = src.match(/^---\n([\s\S]*?)\n---\n?/);
  if (fm) {
    for (const l of fm[1].split("\n")) {
      const k = l.indexOf(":");
      if (k > 0) meta[l.slice(0, k).trim()] = l.slice(k + 1).trim().replace(/^["']|["']$/g, "");
    }
    src = src.slice(fm[0].length);
  }
  return { html: blocks(src.split("\n")), meta };
}
