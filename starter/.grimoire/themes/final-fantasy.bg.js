// Drifting crystal light: slow rising motes with a soft glow.
const c = document.getElementById("c"), ctx = c.getContext("2d");
let w, h, motes = [];
const hues = [200, 220, 260, 280, 190];

function resize() {
  w = c.width = innerWidth; h = c.height = innerHeight;
  motes = Array.from({ length: Math.round((w * h) / 14000) }, () => spawn(true));
}
function spawn(anywhere) {
  return { x: Math.random() * w, y: anywhere ? Math.random() * h : h + 10, r: 0.6 + Math.random() * 2.2, v: 0.12 + Math.random() * 0.35, hue: hues[(Math.random() * hues.length) | 0], t: Math.random() * 6.28 };
}
addEventListener("resize", resize);
resize();

const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
function frame() {
  ctx.clearRect(0, 0, w, h);
  for (const m of motes) {
    m.y -= m.v; m.t += 0.02; m.x += Math.sin(m.t) * 0.25;
    if (m.y < -10) Object.assign(m, spawn(false));
    const a = 0.35 + Math.sin(m.t * 2) * 0.25;
    const g = ctx.createRadialGradient(m.x, m.y, 0, m.x, m.y, m.r * 6);
    g.addColorStop(0, `hsla(${m.hue}, 100%, 85%, ${a})`);
    g.addColorStop(1, `hsla(${m.hue}, 100%, 60%, 0)`);
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(m.x, m.y, m.r * 6, 0, 6.29); ctx.fill();
  }
  if (!still) requestAnimationFrame(frame);
}
frame();
