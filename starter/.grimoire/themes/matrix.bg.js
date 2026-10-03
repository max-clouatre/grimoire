// Matrix digital rain, drawn behind the stage.
const c = document.getElementById("c"), ctx = c.getContext("2d");
const glyphs = "アァカサタナハマヤャラワガザダバパイィキシチニヒミリヰギジヂビピウゥクスツヌフムユュルグズブプエェケセテネヘメレヱゲゼデベペオォコソトノホモヨョロヲゴゾドボポヴッン0123456789".split("");
const size = 16;
let cols = [], w = 0, h = 0;

function resize() {
  w = c.width = innerWidth; h = c.height = innerHeight;
  cols = Array.from({ length: Math.ceil(w / size) }, () => Math.random() * -h / size);
}
addEventListener("resize", resize);
resize();

const still = matchMedia("(prefers-reduced-motion: reduce)").matches;
let last = 0;
function frame(t) {
  if (t - last > 55) {
    last = t;
    ctx.fillStyle = "rgba(0, 0, 0, 0.08)";
    ctx.fillRect(0, 0, w, h);
    ctx.font = `${size}px monospace`;
    cols.forEach((y, i) => {
      const ch = glyphs[(Math.random() * glyphs.length) | 0];
      ctx.fillStyle = Math.random() > 0.975 ? "#d6ffe0" : "#00ff41";
      ctx.globalAlpha = 0.55;
      ctx.fillText(ch, i * size, y * size);
      cols[i] = y * size > h && Math.random() > 0.975 ? 0 : y + 1;
    });
    ctx.globalAlpha = 1;
  }
  if (!still) requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
