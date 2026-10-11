// Esfera neuronal generada por código: nodos en la superficie y en el interior, filamentos curvos
// entre ellos y pulsos de luz que viajan de neurona en neurona. Gira despacio y sigue un poco al ratón.

const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
const norm = (v) => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };

function build(seed = 7) {
  const R = rng(seed);
  const nodes = [];
  const N = 520;
  // superficie: espiral de Fibonacci con algo de ruido
  for (let i = 0; i < N; i++) {
    const y = 1 - (i / (N - 1)) * 2, r = Math.sqrt(1 - y * y), th = i * 2.399963 + R() * 0.5;
    nodes.push({ p: norm([Math.cos(th) * r + (R() - 0.5) * 0.08, y + (R() - 0.5) * 0.08, Math.sin(th) * r + (R() - 0.5) * 0.08]), surf: true, w: R() });
  }
  // interior: da profundidad
  for (let i = 0; i < 90; i++) {
    const d = norm([R() - 0.5, R() - 0.5, R() - 0.5]), k = 0.35 + R() * 0.5;
    nodes.push({ p: [d[0] * k, d[1] * k, d[2] * k], surf: false, w: R() * 0.6 });
  }
  const dist = (a, b) => Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]);
  const edges = [], seen = new Set(), adj = nodes.map(() => []);
  const add = (i, j, kind) => {
    const key = i < j ? `${i}-${j}` : `${j}-${i}`;
    if (i === j || seen.has(key)) return;
    seen.add(key);
    const a = nodes[i].p, b = nodes[j].p;
    // curva: punto medio empujado hacia fuera (superficie) o con giro (interior)
    const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
    const lm = Math.hypot(...m) || 1;
    const bulge = kind === "surf" ? 1 / lm : 1 + (R() - 0.5) * 0.4;
    const c = [m[0] * bulge, m[1] * bulge, m[2] * bulge];
    const pts = [];
    for (let s = 0; s <= 8; s++) {
      const t = s / 8, u = 1 - t;
      pts.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1], u * u * a[2] + 2 * u * t * c[2] + t * t * b[2]]);
    }
    const e = { i, j, pts, w: kind === "fiber" ? 1 : 0.35 + R() * 0.45, kind };
    adj[i].push(edges.length); adj[j].push(edges.length);
    edges.push(e);
  };
  // vecinos cercanos
  nodes.forEach((n, i) => {
    const near = nodes.map((m, j) => [j, dist(n, m)]).filter(([j]) => j !== i).sort((a, b) => a[1] - b[1]);
    const k = n.surf ? 3 : 2;
    for (let q = 0; q < k; q++) add(i, near[q][0], n.surf && nodes[near[q][0]].surf ? "surf" : "in");
  });
  // fibras largas, finas y en haces (como filamentos neuronales)
  const fibers = [];
  const cross = (u, v) => [u[1] * v[2] - u[2] * v[1], u[2] * v[0] - u[0] * v[2], u[0] * v[1] - u[1] * v[0]];
  const tangent = (p, d) => { const k = d[0] * p[0] + d[1] * p[1] + d[2] * p[2]; return norm([d[0] - k * p[0], d[1] - k * p[1], d[2] - k * p[2]]); };
  for (let f = 0; f < 170; f++) {
    let p, d, r;
    if (fibers.length && R() < 0.45) { // nace pegada a otra fibra: forma haces
      const src = fibers[(R() * fibers.length) | 0], k = (R() * (src.pts.length - 2)) | 0;
      p = norm(src.pts[k].map((v) => v + (R() - 0.5) * 0.05));
      d = norm(src.pts[k + 1].map((v, i) => v - src.pts[k][i] + (R() - 0.5) * 0.02));
      r = Math.hypot(...src.pts[k]);
    } else { p = norm([R() - 0.5, R() - 0.5, R() - 0.5]); d = norm([R() - 0.5, R() - 0.5, R() - 0.5]); r = 0.9 + R() * 0.1; }
    d = tangent(p, d);
    const len = 24 + ((R() * 52) | 0), pts = [];
    let turn = (R() - 0.5) * 0.12;
    for (let k = 0; k < len; k++) {
      pts.push([p[0] * r, p[1] * r, p[2] * r]);
      turn += (R() - 0.5) * 0.05; turn *= 0.92;
      const n = p, side = cross(n, d);
      d = tangent(n, norm([d[0] + side[0] * turn, d[1] + side[1] * turn, d[2] + side[2] * turn]));
      p = norm([p[0] + d[0] * 0.034, p[1] + d[1] * 0.034, p[2] + d[2] * 0.034]);
      r = Math.min(1.01, Math.max(0.78, r + (R() - 0.5) * 0.012));
    }
    fibers.push({ pts, w: 0.45 + R() * 0.55 });
  }
  return { nodes, edges, adj, fibers };
}

export class NeuralSphere {
  constructor({ size = 600, speed = 0.35, pulses = 22, className = "", interactive = true, still = false } = {}) {
    this.opts = { speed, pulses, interactive, still };
    this.el = document.createElement("div");
    this.el.className = `nsphere ${className}`;
    this.el.style.setProperty("--fx-size", typeof size === "number" ? `${size}px` : size);
    this.canvas = document.createElement("canvas");
    this.canvas.setAttribute("aria-hidden", "true");
    this.el.append(this.canvas);
    this.el.__fx = this;
    this.g = build();
    this.rot = 0.6; this.tilt = 0.38;
    this.mx = 0; this.my = 0; this.tx = 0; this.ty = 0;
    this.pulses = [];
    this.last = 0; this.acc = 0; this.running = false; this.wait = 0; this.fc = 0; this.off = false;
    this.frame = this.frame.bind(this);
    if (interactive) {
      this.onMove = (e) => { this.tx = (e.clientX / innerWidth - 0.5) * 0.5; this.ty = (e.clientY / innerHeight - 0.5) * 0.35; };
      addEventListener("pointermove", this.onMove, { passive: true });
    }
    requestAnimationFrame(() => { this.resize(); this.draw(0); if (!still) this.start(); });
  }
  setSpeed(v) { this.opts.speed = v; }
  resize() {
    const r = this.el.getBoundingClientRect();
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    const w = Math.max(1, Math.round(r.width * dpr));
    if (this.canvas.width !== w) this.canvas.width = this.canvas.height = w;
    this.W = w;
  }
  start() { if (this.running || reduced()) return; this.running = true; this.last = 0; requestAnimationFrame(this.frame); }
  stop() { this.running = false; }
  destroy() { this.stop(); if (this.onMove) removeEventListener("pointermove", this.onMove); }
  spawnPulse() {
    const f = (Math.random() * this.g.fibers.length) | 0;
    this.pulses.push({ f, t: 0, rev: Math.random() < 0.5, age: 0 });
  }
  frame(t) {
    if (!this.running) return;
    if (!this.el.isConnected) { if (++this.wait > 120) { this.destroy(); return; } requestAnimationFrame(this.frame); return; }
    this.wait = 0;
    if (document.hidden) { this.running = false; return; }
    if (this.fc++ % 30 === 0) { const r = this.el.getBoundingClientRect(); this.off = !r.width || r.bottom < 0 || r.top > innerHeight; }
    if (this.off) { this.fc = 0; setTimeout(() => requestAnimationFrame(this.frame), 600); return; }
    const dt = Math.min(0.1, this.last ? (t - this.last) / 1000 : 0.016);
    this.last = t;
    this.acc += dt;
    requestAnimationFrame(this.frame);
    if (this.acc < 1 / 32) return; // ~30 fps: suave y ahorra batería
    const step = this.acc; this.acc = 0;
    this.rot += step * 0.045;
    this.mx += (this.tx - this.mx) * Math.min(1, step * 1.5);
    this.my += (this.ty - this.my) * Math.min(1, step * 1.5);
    // pulsos
    while (this.pulses.length < this.opts.pulses) this.spawnPulse();
    for (const p of this.pulses) {
      const n = this.g.fibers[p.f].pts.length;
      p.t += (step * this.opts.speed * 26) / n; // misma velocidad en fibras largas y cortas
      p.age += step;
      if (p.t >= 1) p.dead = true;
    }
    this.pulses = this.pulses.filter((p) => !p.dead);
    this.resize();
    this.draw(step);
  }
  draw() {
    const ctx = this.canvas.getContext("2d");
    const W = this.W || this.canvas.width, C = W / 2, R = W * 0.4;
    ctx.clearRect(0, 0, W, W);
    const ya = this.rot + this.mx, xa = this.tilt + this.my;
    const cy = Math.cos(ya), sy = Math.sin(ya), cx = Math.cos(xa), sx = Math.sin(xa);
    const cam = 3.4;
    const proj = (p) => {
      const x1 = p[0] * cy + p[2] * sy, z1 = -p[0] * sy + p[2] * cy;
      const y2 = p[1] * cx - z1 * sx, z2 = p[1] * sx + z1 * cx;
      const k = cam / (cam - z2);
      return [C + x1 * R * k, C + y2 * R * k, z2];
    };
    // halo (luz de borde, como la foto)
    const halo = ctx.createRadialGradient(C, C, R * 0.82, C, C, R * 1.32);
    halo.addColorStop(0, "rgba(255,255,255,0)");
    halo.addColorStop(0.28, "rgba(255,255,255,0.075)");
    halo.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = halo; ctx.fillRect(0, 0, W, W);
    const glow = ctx.createRadialGradient(C, C * 1.12, R * 0.2, C, C, R * 1.05);
    glow.addColorStop(0, "rgba(255,255,255,0.025)"); glow.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(C, C, R * 1.05, 0, Math.PI * 2); ctx.fill();

    // brillo según profundidad y borde (luz de contorno)
    const light = (z, w) => { const d = (z + 1) / 2, rim = 1 - Math.min(1, Math.abs(z) * 1.6); return Math.min(1, (0.05 + 0.75 * d ** 1.5 + 0.55 * rim ** 3) * w); };
    const B = 8, buckets = Array.from({ length: B }, () => []);
    for (const e of this.g.edges) {
      const pts = e.pts.map(proj);
      let z = 0; for (const q of pts) z += q[2]; z /= pts.length;
      buckets[Math.min(B - 1, (light(z, e.w * 0.6) * B) | 0)].push(pts);
    }
    const fiberProj = this.g.fibers.map((f) => {
      const pts = f.pts.map(proj);
      for (let k = 0; k < pts.length - 1; k += 6) {
        const seg = pts.slice(k, k + 7);
        let z = 0; for (const q of seg) z += q[2]; z /= seg.length;
        buckets[Math.min(B - 1, (light(z, f.w) * B) | 0)].push(seg);
      }
      return pts;
    });
    ctx.lineCap = "round"; ctx.lineJoin = "round";
    buckets.forEach((list, bi) => {
      if (!list.length) return;
      const a = (bi + 0.5) / B;
      ctx.strokeStyle = `rgba(236,239,246,${0.62 * a})`;
      ctx.lineWidth = Math.max(0.55, W / 1700) * (0.5 + a * 1.3);
      ctx.beginPath();
      for (const pts of list) { ctx.moveTo(pts[0][0], pts[0][1]); for (let k = 1; k < pts.length; k++) ctx.lineTo(pts[k][0], pts[k][1]); }
      ctx.stroke();
    });
    // nodos (sinapsis)
    for (const n of this.g.nodes) {
      const [x, y, z] = proj(n.p);
      const a = light(z, 0.35 + n.w * 0.65);
      const r = Math.max(0.5, W / 1100) * (0.7 + a) * (n.w > 0.93 ? 1.8 : 1);
      ctx.fillStyle = `rgba(255,255,255,${a * 0.75})`;
      ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
    }
    // pulsos de información recorriendo las fibras
    ctx.globalCompositeOperation = "lighter";
    for (const p of this.pulses) {
      const pts = fiberProj[p.f];
      const pos = (tt) => {
        const f = (p.rev ? 1 - tt : tt) * (pts.length - 1), k = Math.max(0, Math.min(pts.length - 2, Math.floor(f))), u = f - k;
        return [pts[k][0] + (pts[k + 1][0] - pts[k][0]) * u, pts[k][1] + (pts[k + 1][1] - pts[k][1]) * u, pts[k][2] + (pts[k + 1][2] - pts[k][2]) * u];
      };
      if (!Number.isFinite(p.t)) { p.t = 1; continue; }
      const [x, y, z] = pos(Math.min(1, p.t));
      if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
      const fade = Math.min(1, p.age * 2) * Math.min(1, (1 - p.t) * 8);
      const a = light(z, 1) * fade;
      if (a <= 0.01) continue;
      ctx.strokeStyle = `rgba(255,255,255,${0.4 * a})`;
      ctx.lineWidth = Math.max(1, W / 650);
      ctx.beginPath();
      const span = 7 / pts.length;
      for (let s = 0; s <= 8; s++) { const q = pos(Math.max(0, p.t - (s / 8) * span)); s ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); }
      ctx.stroke();
      const r = Math.max(3, W / 85) * (0.5 + a * 0.6);
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, `rgba(255,255,255,${0.95 * a})`); g.addColorStop(0.3, `rgba(220,230,255,${0.3 * a})`); g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
    }
    ctx.globalCompositeOperation = "source-over";
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) document.querySelectorAll(".nsphere").forEach((b) => !b.__fx?.opts.still && b.__fx?.start());
});
export function sphere(opts) { return new NeuralSphere(opts).el; }
