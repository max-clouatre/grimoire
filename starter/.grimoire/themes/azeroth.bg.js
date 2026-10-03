// Embers rising from a forge somewhere below the stage.
const c = document.getElementById("c"), ctx = c.getContext("2d");
let w, h, embers = [];

function resize() {
  w = c.width = innerWidth; h = c.height = innerHeight;
  embers = Array.from({ length: Math.round(w / 9) }, () => spawn(true));
}
function spawn(anywhere) {
  return { x: Math.random() * w, y: anywhere ? Math.random() * h : h + 5, v: 0.4 + Math.random() * 1.1, r: 0.8 + Math.random() * 1.8, life: 0.4 + Math.random() * 0.6, drift: (Math.random() - 0.5) * 0.6, t: Math.random() * 6 };
}
addEventListener("resize", resize);
resize();

const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
function frame() {
  ctx.clearRect(0, 0, w, h);
  ctx.globalCompositeOperation = "lighter";
  for (const e of embers) {
    e.y -= e.v; e.t += 0.05; e.x += e.drift + Math.sin(e.t) * 0.4;
    const fade = Math.max(0, Math.min(1, e.y / h)) * e.life;
    if (e.y < -10 || fade <= 0.01) { Object.assign(e, spawn(false)); continue; }
    const g = ctx.createRadialGradient(e.x, e.y, 0, e.x, e.y, e.r * 5);
    g.addColorStop(0, `rgba(255, 210, 120, ${fade})`);
    g.addColorStop(0.4, `rgba(255, 110, 20, ${fade * 0.6})`);
    g.addColorStop(1, "rgba(255, 60, 0, 0)");
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 5, 0, 6.29); ctx.fill();
  }
  ctx.globalCompositeOperation = "source-over";
  if (!still) requestAnimationFrame(frame);
}
frame();
