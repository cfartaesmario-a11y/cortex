// Cerebro con destellos: chispas de luz que viajan siguiendo las fibras brillantes de la imagen.
// Cada chispa avanza de píxel en píxel eligiendo el vecino más luminoso en la dirección en que ya iba,
// así recorre los "cables" del cerebro en lugar de moverse al azar.

const SRC = "assets/brain.webp";
const GRID = 240;
let mapPromise = null;

function loadMap() {
  if (mapPromise) return mapPromise;
  mapPromise = new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = GRID;
      const x = c.getContext("2d", { willReadFrequently: true });
      x.drawImage(img, 0, 0, GRID, GRID);
      const d = x.getImageData(0, 0, GRID, GRID).data;
      const L = new Float32Array(GRID * GRID);
      const seeds = [];
      for (let i = 0; i < GRID * GRID; i++) {
        const v = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
        L[i] = v;
        if (v > 0.62) seeds.push(i);
      }
      res({ L, seeds });
    };
    img.onerror = rej;
    img.src = SRC;
  });
  return mapPromise;
}

const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export class BrainFX {
  constructor({ sparks = 26, size = 320, className = "", dim = 1, burstEvery = 2600, speed = 2 } = {}) {
    this.opts = { sparks, dim, burstEvery, speed };
    this.el = document.createElement("div");
    this.el.className = `brain ${className}`;
    this.el.style.setProperty("--brain-size", typeof size === "number" ? `${size}px` : size);
    this.img = new Image();
    this.img.src = SRC;
    this.img.alt = "";
    this.img.decoding = "async";
    this.img.setAttribute("aria-hidden", "true");
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.el.append(this.img, this.canvas);
    this.list = [];
    this.running = false;
    this.off = false;
    this.fc = 0;
    this.lastBurst = 0;
    this.frame = this.frame.bind(this);
    loadMap().then((m) => { this.map = m; this.start(); }).catch(() => {});
  }
  resize() {
    const r = this.el.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr));
    if (this.canvas.width !== w) { this.canvas.width = this.canvas.height = w; }
    this.scale = w / GRID;
    this.dpr = dpr;
  }
  spawn(at) {
    const { L, seeds } = this.map;
    const i = at ?? seeds[(Math.random() * seeds.length) | 0];
    const d = DIRS[(Math.random() * 8) | 0];
    this.list.push({ x: i % GRID, y: (i / GRID) | 0, dx: d[0], dy: d[1], life: 60 + Math.random() * 120, seen: new Set([i]), L });
  }
  burst() {
    const { seeds } = this.map;
    const i = seeds[(Math.random() * seeds.length) | 0];
    for (let k = 0; k < 7; k++) this.spawn(i);
  }
  step(s) {
    const { L } = this.map;
    let best = null, bestScore = -1;
    for (const [dx, dy] of DIRS) {
      const nx = s.x + dx, ny = s.y + dy;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      const idx = ny * GRID + nx;
      if (s.seen.has(idx)) continue;
      const inertia = (dx * s.dx + dy * s.dy) / (Math.hypot(dx, dy) * Math.hypot(s.dx, s.dy) || 1);
      const score = L[idx] * (1.2 + inertia) + Math.random() * 0.35;
      if (score > bestScore) { bestScore = score; best = [nx, ny, dx, dy, idx]; }
    }
    if (!best || L[best[4]] < 0.18) { s.life = 0; return; }
    [s.x, s.y, s.dx, s.dy] = best;
    s.seen.add(best[4]);
    if (s.seen.size > 40) s.seen.delete(s.seen.values().next().value);
    s.life--;
  }
  start() {
    if (this.running || !this.map || reduced()) return;
    this.running = true;
    this.resize();
    requestAnimationFrame(this.frame);
  }
  stop() { this.running = false; }
  destroy() { this.stop(); this.el.remove(); }
  frame(t) {
    if (!this.running) return;
    if (!this.el.isConnected) {
      // Aún no está en la página: se reintenta un momento (si nunca llega, se para solo)
      if ((this.wait = (this.wait || 0) + 1) > 120) { this.running = false; return; }
      requestAnimationFrame(this.frame); return;
    }
    this.wait = 0;
    if (document.hidden) { this.running = false; return; }
    if (this.fc++ % 30 === 0) { const r = this.el.getBoundingClientRect(); this.off = !r.width || r.bottom < 0 || r.top > innerHeight; }
    if (this.off) { setTimeout(() => requestAnimationFrame(this.frame), 500); this.fc = 0; return; }
    this.resize();
    const ctx = this.canvas.getContext("2d");
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = "rgba(0,0,0,0.15)";
    ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.globalCompositeOperation = "lighter";
    while (this.list.length < this.opts.sparks) this.spawn();
    if (t - this.lastBurst > this.opts.burstEvery) { this.lastBurst = t; this.burst(); }
    const sc = this.scale;
    for (const s of this.list) {
      for (let k = 0; k < this.opts.speed; k++) {
        const px = s.x * sc, py = s.y * sc;
        this.step(s);
        if (s.life <= 0) break;
        const x = s.x * sc, y = s.y * sc;
        ctx.strokeStyle = `rgba(255,255,255,${0.8 * this.opts.dim})`;
        ctx.lineWidth = Math.max(1, this.canvas.width / 360);
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      }
      if (s.life > 0) {
        const x = s.x * sc, y = s.y * sc, r = Math.max(4, this.canvas.width / 64);
        const g = ctx.createRadialGradient(x, y, 0, x, y, r);
        g.addColorStop(0, `rgba(255,255,255,${0.95 * this.opts.dim})`);
        g.addColorStop(0.35, `rgba(220,235,255,${0.4 * this.opts.dim})`);
        g.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = g;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);
      }
    }
    this.list = this.list.filter((s) => s.life > 0);
    requestAnimationFrame(this.frame);
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) document.querySelectorAll(".brain").forEach((b) => b.__fx?.start());
});
export function brain(opts) { const fx = new BrainFX(opts); fx.el.__fx = fx; return fx.el; }
