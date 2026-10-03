// Outrun sunset: a striped sun over a perspective grid that scrolls toward you.
const c = document.getElementById("c"), ctx = c.getContext("2d");
let w, h;
addEventListener("resize", () => { w = c.width = innerWidth; h = c.height = innerHeight; });
w = c.width = innerWidth; h = c.height = innerHeight;

const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
let offset = 0;
function frame() {
  ctx.clearRect(0, 0, w, h);
  const horizon = h * 0.62;

  // Sun with horizontal cut-outs.
  const r = Math.min(w, h) * 0.2, cx = w / 2, cy = horizon - r * 0.35;
  const sun = ctx.createLinearGradient(0, cy - r, 0, cy + r);
  sun.addColorStop(0, "#ffd319"); sun.addColorStop(0.5, "#ff2975"); sun.addColorStop(1, "#8c1eff");
  ctx.save();
  ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.29); ctx.clip();
  ctx.fillStyle = sun; ctx.fillRect(cx - r, cy - r, r * 2, r * 2);
  ctx.globalCompositeOperation = "destination-out";
  for (let i = 0; i < 7; i++) {
    const y = cy + r * 0.1 + i * r * 0.14, gap = 2 + i * 1.6;
    ctx.fillRect(cx - r, y, r * 2, gap);
  }
  ctx.restore();
  ctx.shadowBlur = 0;

  // Floor.
  ctx.fillStyle = "rgba(13, 2, 33, 0.85)";
  ctx.fillRect(0, horizon, w, h - horizon);
  ctx.strokeStyle = "rgba(255, 62, 191, 0.55)";
  ctx.lineWidth = 1.2;
  ctx.shadowColor = "#ff3ebf"; ctx.shadowBlur = 8;
  for (let i = -24; i <= 24; i++) {
    ctx.beginPath(); ctx.moveTo(cx + i * 6, horizon); ctx.lineTo(cx + i * w * 0.09, h); ctx.stroke();
  }
  for (let i = 0; i < 16; i++) {
    const p = ((i + offset) / 16) ** 2.2;
    const y = horizon + p * (h - horizon);
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke();
  }
  ctx.shadowBlur = 0;
  offset = (offset + 0.012) % 1;
  if (!still) requestAnimationFrame(frame);
}
frame();
