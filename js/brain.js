// Destellos neuronales: puntos de luz que viajan despacio por las fibras de una imagen (cerebro o esfera).
// Cada chispa avanza de píxel en píxel eligiendo el vecino que más se parece a una fibra en la dirección
// en que ya iba, y se dibuja interpolada para que el movimiento sea suave.

const GRID = 260;
const maps = new Map();

function loadMap(src) {
  if (maps.has(src)) return maps.get(src);
  const p = new Promise((res, rej) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement("canvas");
      c.width = c.height = GRID;
      const x = c.getContext("2d", { willReadFrequently: true });
      x.drawImage(img, 0, 0, GRID, GRID);
      const d = x.getImageData(0, 0, GRID, GRID).data;
      const L = new Float32Array(GRID * GRID);
      for (let i = 0; i < L.length; i++) L[i] = (d[i * 4] * 0.3 + d[i * 4 + 1] * 0.59 + d[i * 4 + 2] * 0.11) / 255;
      // Mapa de "fibras": brillo menos su entorno (quita halos y zonas lisas)
      const B = new Float32Array(L.length), R = 3;
      for (let y = 0; y < GRID; y++) for (let xx = 0; xx < GRID; xx++) {
        let s = 0, n = 0;
        for (let dy = -R; dy <= R; dy += 2) for (let dx = -R; dx <= R; dx += 2) {
          const X = xx + dx, Y = y + dy;
          if (X >= 0 && Y >= 0 && X < GRID && Y < GRID) { s += L[Y * GRID + X]; n++; }
        }
        B[y * GRID + xx] = s / n;
      }
      const F = new Float32Array(L.length);
      const seeds = [];
      for (let i = 0; i < L.length; i++) {
        const f = Math.max(0, L[i] - B[i] * 0.85) * 2.2 + L[i] * 0.35;
        F[i] = Math.min(1, f);
        if (F[i] > 0.42 && L[i] > 0.35) seeds.push(i);
      }
      res({ F, seeds });
    };
    img.onerror = rej;
    img.src = src;
  });
  maps.set(src, p);
  return p;
}

const DIRS = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

export class NeuralFX {
  // speed: pasos de la cuadrícula por segundo (más bajo = más lento)
  constructor({ src = "assets/brain.webp", sparks = 18, size = 320, className = "", dim = 1, burstEvery = 6000, speed = 14, trail = 0.05 } = {}) {
    this.opts = { sparks, dim, burstEvery, speed, trail };
    this.src = src;
    this.el = document.createElement("div");
    this.el.className = `neural ${className}`;
    this.el.style.setProperty("--fx-size", typeof size === "number" ? `${size}px` : size);
    this.img = new Image();
    this.img.src = src; this.img.alt = ""; this.img.decoding = "async";
    this.img.setAttribute("aria-hidden", "true");
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.el.append(this.img, this.canvas);
    this.list = [];
    this.running = false;
    this.off = false; this.fc = 0; this.wait = 0;
    this.lastBurst = 0; this.last = 0;
    this.frame = this.frame.bind(this);
    this.el.__fx = this;
    loadMap(src).then((m) => { this.map = m; this.start(); }).catch(() => {});
  }
  setSpeed(v) { this.opts.speed = v; }
  resize() {
    const r = this.el.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 2);
    const w = Math.max(1, Math.round(r.width * dpr));
    if (this.canvas.width !== w) { this.canvas.width = this.canvas.height = w; }
    this.scale = w / GRID;
  }
  spawn(at) {
    const { seeds } = this.map;
    if (!seeds.length) return;
    const i = at ?? seeds[(Math.random() * seeds.length) | 0];
    const d = DIRS[(Math.random() * 8) | 0];
    const s = { x: i % GRID, y: (i / GRID) | 0, dx: d[0], dy: d[1], t: Math.random(), life: 50 + Math.random() * 110, seen: new Set([i]), age: 0, fade: 0 };
    s.nx = s.x; s.ny = s.y;
    this.pick(s);
    this.list.push(s);
  }
  burst() {
    const { seeds } = this.map;
    const i = seeds[(Math.random() * seeds.length) | 0];
    for (let k = 0; k < 5; k++) this.spawn(i);
  }
  // Elige la siguiente casilla siguiendo la fibra
  pick(s) {
    const { F } = this.map;
    let best = null, bestScore = -1;
    for (const [dx, dy] of DIRS) {
      const nx = s.x + dx, ny = s.y + dy;
      if (nx < 0 || ny < 0 || nx >= GRID || ny >= GRID) continue;
      const idx = ny * GRID + nx;
      if (s.seen.has(idx)) continue;
      const inertia = (dx * s.dx + dy * s.dy) / (Math.hypot(dx, dy) * Math.hypot(s.dx, s.dy) || 1);
      const score = F[idx] * (1.25 + inertia) + Math.random() * 0.25;
      if (score > bestScore) { bestScore = score; best = [nx, ny, dx, dy, idx]; }
    }
    if (!best || F[best[4]] < 0.16) { s.life = 0; return; }
    [s.nx, s.ny, s.dx, s.dy] = best;
    s.seen.add(best[4]);
    if (s.seen.size > 48) s.seen.delete(s.seen.values().next().value);
  }
  start() {
    if (this.running || !this.map || reduced()) return;
    this.running = true; this.last = 0;
    requestAnimationFrame(this.frame);
  }
  stop() { this.running = false; }
  frame(t) {
    if (!this.running) return;
    if (!this.el.isConnected) {
      if (++this.wait > 120) { this.running = false; return; }
      requestAnimationFrame(this.frame); return;
    }
    this.wait = 0;
    if (document.hidden) { this.running = false; return; }
    if (this.fc++ % 30 === 0) { const r = this.el.getBoundingClientRect(); this.off = !r.width || r.bottom < 0 || r.top > innerHeight; }
    if (this.off) { this.fc = 0; setTimeout(() => requestAnimationFrame(this.frame), 600); return; }
    const dt = Math.min(0.05, this.last ? (t - this.last) / 1000 : 0.016);
    this.last = t;
    this.resize();
    const ctx = this.canvas.getContext("2d");
    const W = this.canvas.width, sc = this.scale;
    ctx.globalCompositeOperation = "destination-out";
    ctx.fillStyle = `rgba(0,0,0,${this.opts.trail})`;
    ctx.fillRect(0, 0, W, W);
    ctx.globalCompositeOperation = "lighter";
    while (this.list.length < this.opts.sparks) this.spawn();
    if (t - this.lastBurst > this.opts.burstEvery) { this.lastBurst = t; this.burst(); }
    const lw = Math.max(1, W / 420), r = Math.max(3, W / 110);
    for (const s of this.list) {
      const px = (s.x + (s.nx - s.x) * s.t) * sc, py = (s.y + (s.ny - s.y) * s.t) * sc;
      s.t += this.opts.speed * dt;
      while (s.t >= 1 && s.life > 0) { s.t -= 1; s.x = s.nx; s.y = s.ny; s.life--; this.pick(s); }
      s.age += dt;
      // aparece y desaparece con suavidad
      const a = Math.min(1, s.age * 1.5) * (s.life <= 0 ? 0 : Math.min(1, s.life / 12)) * this.opts.dim;
      if (a <= 0) continue;
      const x = (s.x + (s.nx - s.x) * s.t) * sc, y = (s.y + (s.ny - s.y) * s.t) * sc;
      ctx.strokeStyle = `rgba(255,255,255,${0.55 * a})`;
      ctx.lineWidth = lw;
      ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(x, y); ctx.stroke();
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.65 * a})`);
      g.addColorStop(0.3, `rgba(225,232,255,${0.22 * a})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    this.list = this.list.filter((s) => s.life > 0);
    requestAnimationFrame(this.frame);
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) document.querySelectorAll(".neural").forEach((b) => b.__fx?.start());
});

export const SPEEDS = { lenta: 7, media: 14, rapida: 26 };
export function neural(opts) { return new NeuralFX(opts).el; }
// compatibilidad con el nombre antiguo
export function brain(opts) { return neural({ src: "assets/brain.webp", ...opts }); }
