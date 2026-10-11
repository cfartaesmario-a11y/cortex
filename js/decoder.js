// Secuencia de entrada: decodificador que genera códigos mientras descifra la bóveda de verdad,
// y termina con ACCESS GRANTED antes de mostrar el escritorio.
import { h } from "./ui.js";

const HEX = "0123456789abcdef";
const GLYPH = "0123456789ABCDEF<>/\\|#%&*+=";
const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const rnd = (set, n) => Array.from({ length: n }, () => set[(Math.random() * set.length) | 0]).join("");

async function sha256hex(text) {
  const b = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
  return [...b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

// Lluvia de códigos de fondo (monocromo, lenta)
function rain(canvas) {
  const ctx = canvas.getContext("2d");
  let cols = [], fs = 14, raf, last = 0;
  const fit = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = innerWidth * dpr; canvas.height = innerHeight * dpr;
    fs = 13 * dpr;
    cols = Array.from({ length: Math.ceil(canvas.width / (fs * 1.4)) }, () => Math.random() * -60);
  };
  fit();
  const step = (t) => {
    raf = requestAnimationFrame(step);
    if (t - last < 55) return;
    last = t;
    ctx.fillStyle = "rgba(0,0,0,0.12)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.font = `${fs}px "JetBrains Mono", monospace`;
    cols.forEach((y, i) => {
      const x = i * fs * 1.4;
      ctx.fillStyle = Math.random() < 0.04 ? "rgba(255,255,255,0.9)" : "rgba(160,160,170,0.32)";
      ctx.fillText(GLYPH[(Math.random() * GLYPH.length) | 0], x, y * fs);
      cols[i] = y * fs > canvas.height && Math.random() > 0.97 ? 0 : y + 1;
    });
  };
  raf = requestAnimationFrame(step);
  addEventListener("resize", fit);
  return () => { cancelAnimationFrame(raf); removeEventListener("resize", fit); };
}

function resolveText(el, text, ms) {
  if (reduced()) { el.textContent = text; return wait(0); }
  return new Promise((res) => {
    const t0 = performance.now();
    const tick = (t) => {
      const p = Math.min(1, (t - t0) / ms);
      const n = Math.floor(text.length * p);
      el.textContent = text.slice(0, n) + [...text.slice(n)].map((c) => (c === " " ? " " : GLYPH[(Math.random() * GLYPH.length) | 0])).join("");
      p < 1 ? requestAnimationFrame(tick) : res();
    };
    requestAnimationFrame(tick);
  });
}

// decrypt(onProgress) descifra la bóveda y llama onProgress(hechos, total)
export async function runDecoder({ keyId, name = "Mario", decrypt }) {
  const canvas = h("canvas", { class: "dec-rain", "aria-hidden": "true" });
  const rows = h("div", { class: "dec-rows" });
  const stream = h("div", { class: "dec-stream", "aria-hidden": "true" });
  const barFill = h("i");
  const pct = h("span", { class: "dec-pct" }, "0%");
  const status = h("span", {}, "DECRYPTING VAULT");
  const bar = h("div", { class: "dec-bar" }, h("div", { class: "dec-track" }, barFill), pct);
  const granted = h("div", { class: "dec-granted", "aria-live": "assertive" });
  const sub = h("div", { class: "dec-sub" });
  const panel = h("section", { class: "dec-panel" },
    h("header", { class: "dec-head" }, h("span", {}, "CORTEX // SECURE ENTRY"), h("span", { class: "dec-blink" }, "● LIVE")),
    rows, h("div", { class: "dec-status" }, status), bar, stream);
  const scr = h("div", { class: "decoder", role: "status", "aria-label": "Descifrando la bóveda" },
    canvas, h("div", { class: "dec-vignette" }), panel, h("div", { class: "dec-final" }, granted, sub));
  document.body.append(scr);
  const stopRain = reduced() ? () => {} : rain(canvas);

  const fp = await sha256hex(`cortex:${keyId}`);
  const line = async (k, v, ms = 220) => {
    const val = h("b", {});
    rows.append(h("div", { class: "dec-row" }, h("span", {}, k), h("i", { class: "dots" }), val));
    await resolveText(val, v, ms);
  };

  // Códigos generándose mientras se trabaja
  let streaming = true;
  (async () => {
    while (streaming) {
      stream.append(h("div", {}, `${rnd(HEX, 8)}  ${rnd(HEX, 4)} ${rnd(HEX, 4)} ${rnd(HEX, 4)} ${rnd(HEX, 4)}  ${rnd(GLYPH, 10)}`));
      while (stream.children.length > 6) stream.firstChild.remove();
      await wait(70);
    }
  })();

  const t0 = performance.now();
  await line("KEY ID", keyId.slice(0, 8).toUpperCase().replace(/(.{4})/, "$1·"));
  await line("FINGERPRINT", fp.slice(0, 32).replace(/(.{4})/g, "$1 ").trim(), 360);
  await line("CIPHER", "AES-256-GCM");
  await line("KDF", "PBKDF2-SHA256 · 600000 IT · HKDF");
  await line("NODE", "marela-8d4e5 / europe-west1");

  // Descifrado real con barra de progreso
  let shown = 0;
  await decrypt((done, total) => {
    const p = total ? Math.round((done / total) * 100) : 100;
    if (p > shown) { shown = p; barFill.style.width = `${p}%`; pct.textContent = `${p}%`; }
    status.textContent = `DECRYPTING VAULT · ${done}/${total} OBJECTS`;
  });
  barFill.style.width = "100%"; pct.textContent = "100%";
  status.textContent = "INTEGRITY CHECK · OK";
  const min = reduced() ? 0 : 1900;
  const elapsed = performance.now() - t0;
  if (elapsed < min) await wait(min - elapsed);
  streaming = false;

  scr.classList.add("ok");
  await resolveText(granted, "ACCESS GRANTED", 520);
  await wait(reduced() ? 0 : 250);
  await resolveText(sub, `WELCOME BACK, ${name.toUpperCase()} · ENTERING CORTEX`, 600);
  await wait(reduced() ? 0 : 650);
  return {
    // Se llama cuando el escritorio ya está montado detrás
    finish: async () => {
      scr.classList.add("out");
      await wait(reduced() ? 0 : 700);
      stopRain(); scr.remove();
    },
  };
}
