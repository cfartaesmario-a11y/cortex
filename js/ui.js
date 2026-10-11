// Utilidades de interfaz compartidas.
import { settings } from "./state.js";

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];

export function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "string") el.setAttribute("style", v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v; // solo para iconos SVG internos
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}

export const ICONS = {
  key: '<path d="M14.5 9.5a4.5 4.5 0 1 1-9 0 4.5 4.5 0 0 1 9 0z"/><path d="M13.2 12.6L21 20.4M17.5 16.9l2-2M15.5 14.9l2-2"/>',
  card: '<rect x="2.5" y="5" width="19" height="14" rx="2.5"/><path d="M2.5 9.5h19M6 15h4"/>',
  id: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="10.5" r="2.4"/><path d="M5.6 16.6c.7-1.8 1.9-2.8 3.4-2.8s2.7 1 3.4 2.8M14 9h4.5M14 12.5h4.5"/>',
  drive: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.8l2 2h7.2A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/>',
  folder: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.8l2 2h7.2A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><path d="M3 10h18"/>',
  note: '<path d="M6 3h9l4 4v14H6z"/><path d="M15 3v4h4M9 12h7M9 16h5"/>',
  contact: '<circle cx="12" cy="8" r="3.8"/><path d="M4.5 20.5c1.4-3.7 4.3-5.6 7.5-5.6s6.1 1.9 7.5 5.6"/>',
  gen: '<rect x="4" y="4" width="16" height="16" rx="3"/><circle cx="9" cy="9" r="1.1"/><circle cx="15" cy="15" r="1.1"/><circle cx="15" cy="9" r="1.1"/><circle cx="9" cy="15" r="1.1"/><circle cx="12" cy="12" r="1.1"/>',
  log: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.2 2"/>',
  cog: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  term: '<rect x="2.5" y="4" width="19" height="16" rx="2.5"/><path d="M6.5 9l3 3-3 3M12 15h5"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  copy: '<rect x="8.5" y="8.5" width="11.5" height="11.5" rx="2"/><path d="M15.5 8.5V5.5a1.5 1.5 0 0 0-1.5-1.5H5.5A1.5 1.5 0 0 0 4 5.5V14a1.5 1.5 0 0 0 1.5 1.5h3"/>',
  eye: '<path d="M2 12s3.8-7 10-7 10 7 10 7-3.8 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  edit: '<path d="M4 20h4L19.5 8.5a2.1 2.1 0 0 0-3-3L5 17v3z"/>',
  trash: '<path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13"/>',
  file: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/>',
  dl: '<path d="M12 4v11M7 10.5l5 5 5-5M5 20h14"/>',
  up: '<path d="M12 20V9M7 13.5l5-5 5 5M5 4h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  min: '<path d="M6 12h12"/>',
  max: '<rect x="6" y="6" width="12" height="12" rx="1"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  chev: '<path d="M9 5l7 7-7 7"/>',
  wave: '<path d="M8 7c2 3 2 7 0 10M12 5c3 4 3 10 0 14M16 3c4 5 4 13 0 18"/>',
  search: '<circle cx="11" cy="11" r="6.5"/><path d="M20 20l-4.2-4.2"/>',
  phone: '<path d="M5 3h4l2 5-2.8 1.8a11 11 0 0 0 6 6L15 13l5 2v4a2 2 0 0 1-2 2A17 17 0 0 1 3 5a2 2 0 0 1 2-2z"/>',
  more: '<circle cx="5.5" cy="12" r="1.3"/><circle cx="12" cy="12" r="1.3"/><circle cx="18.5" cy="12" r="1.3"/>',
  move: '<path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h3.8l2 2h7.2A2.5 2.5 0 0 1 21 9.5v8a2.5 2.5 0 0 1-2.5 2.5h-13A2.5 2.5 0 0 1 3 17.5z"/><path d="M10 13.5h6M13.5 11l2.5 2.5-2.5 2.5"/>',
  rename: '<path d="M4 7h10M4 12h6M4 17h4"/><path d="M13 19h3l6-6-3-3-6 6z"/>',
  grid: '<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>',
  list: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  shield: '<path d="M12 3l8 3v6c0 4.5-3.4 8.3-8 9-4.6-.7-8-4.5-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/>',
  usb: '<path d="M9 2h6v6H9z"/><path d="M7 8h10v9a5 5 0 0 1-10 0z"/><path d="M11 4.5h.01M13 4.5h.01"/>',
  power: '<path d="M12 3v8"/><path d="M6.3 6.8a8 8 0 1 0 11.4 0"/>',
  home: '<path d="M4 11l8-6.5 8 6.5v8.5a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1z"/>',
  img: '<rect x="3" y="4" width="18" height="16" rx="2.5"/><circle cx="9" cy="9.5" r="1.8"/><path d="M21 16l-5-5-9 9"/>',
  vid: '<rect x="3" y="5" width="13" height="14" rx="2.5"/><path d="M16 10l5-3v10l-5-3z"/>',
  pdf: '<path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4M9 13h6M9 16.5h4"/>',
  aud: '<path d="M9 18V6l11-2v12"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  cpu: '<rect x="6" y="6" width="12" height="12" rx="2"/><path d="M9.5 9.5h5v5h-5zM9 2.5V6M15 2.5V6M9 18v3.5M15 18v3.5M2.5 9H6M2.5 15H6M18 9h3.5M18 15h3.5"/>',
};
export const ico = (name, cls = "") => h("span", { class: `ico ${cls}`, "aria-hidden": "true", html: `<svg viewBox="0 0 24 24">${ICONS[name] || ""}</svg>` });

export const fmtDate = (t) => (t ? new Date(t).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : "—");
export const fmtDay = (s) => { if (!s) return ""; const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString("es-ES"); };
export const fmtSize = (n = 0) => (n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`);
export const hexShort = (id = "") => id.slice(0, 4).toUpperCase() + "·" + id.slice(4, 8).toUpperCase();

// ---- avisos ----
export function toast(msg, kind = "") {
  const host = $("#toasts");
  if (!host) return;
  const t = h("div", { class: `toast ${kind}`, role: "status" }, h("span", { class: "toast-tag" }, kind === "err" ? "ERR" : "OK"), h("span", {}, msg));
  host.append(t);
  setTimeout(() => t.classList.add("out"), 2600);
  setTimeout(() => t.remove(), 3100);
}

let clipTimer;
export async function copy(text, label = "Dato") {
  if (!text) return toast("Este campo está vacío", "err");
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} copiado · se borra en ${settings.clipSeconds} s`);
    clearTimeout(clipTimer);
    clipTimer = setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), settings.clipSeconds * 1000);
  } catch { toast("No se pudo copiar", "err"); }
}

// ---- ventanas modales ----
export function modal(title, body, { wide = false, onClose } = {}) {
  closeModal();
  const box = h("div", { class: `modal ${wide ? "wide" : ""}`, role: "dialog", "aria-modal": "true", "aria-label": title },
    h("header", {}, h("span", { class: "modal-title" }, h("i", { class: "led" }), title),
      h("button", { class: "icon-btn", "aria-label": "Cerrar", onclick: () => closeModal() }, ico("x"))),
    h("div", { class: "modal-body" }, body));
  const scrim = h("div", { class: "scrim", onpointerdown: (e) => { if (e.target === scrim) closeModal(); } }, box);
  scrim._onClose = onClose;
  document.body.append(scrim);
  setTimeout(() => box.querySelector("[autofocus], input, textarea, select, button.primary")?.focus(), 40);
  return box;
}
export function closeModal() {
  $$(".scrim").forEach((s) => {
    $$("[data-url]", s).forEach((e) => URL.revokeObjectURL(e.dataset.url));
    s._onClose?.();
    s.remove();
  });
}
export const modalOpen = () => !!$(".scrim");

export function confirmBox(text, okLabel = "Eliminar") {
  return new Promise((res) => {
    let done = false;
    const finish = (v) => { if (done) return; done = true; closeModal(); res(v); };
    const m = modal("Confirmar", h("div", {},
      h("p", { class: "muted" }, text),
      h("div", { class: "row end" },
        h("button", { class: "ghost", onclick: () => finish(false) }, "Cancelar"),
        h("button", { class: "danger", onclick: () => finish(true) }, okLabel))), { onClose: () => { if (!done) { done = true; res(false); } } });
    m.querySelector(".danger").focus();
  });
}

export function promptBox(title, label, value = "", okLabel = "Guardar") {
  return new Promise((res) => {
    let done = false;
    const input = h("input", { type: "text", value, autocomplete: "off", spellcheck: "false", id: "prompt-in" });
    const finish = (v) => { if (done) return; done = true; closeModal(); res(v); };
    modal(title, h("form", { class: "form", onsubmit: (e) => { e.preventDefault(); finish(input.value.trim() || null); } },
      h("label", { for: "prompt-in" }, label), input,
      h("div", { class: "row end" }, h("button", { type: "button", class: "ghost", onclick: () => finish(null) }, "Cancelar"), h("button", { class: "primary" }, okLabel))),
    { onClose: () => { if (!done) { done = true; res(null); } } });
    setTimeout(() => { input.focus(); input.select(); }, 50);
  });
}

export function downloadJSON(obj, name) {
  // Sin extensión (p. ej. "pas") se descarga tal cual, sin que el navegador añada ".json"
  const type = /\.[a-z0-9]{1,5}$/i.test(name) ? "application/json" : "application/octet-stream";
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type }));
  const a = h("a", { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// Texto que se "descifra" letra a letra (efecto de pantalla)
const GLYPHS = "01ABCDEF#$%&*+<>/\\|";
export function scramble(el, text, ms = 500) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) { el.textContent = text; return; }
  const start = performance.now();
  const tick = (t) => {
    const p = Math.min(1, (t - start) / ms);
    const n = Math.floor(text.length * p);
    el.textContent = text.slice(0, n) + [...text.slice(n)].map((c) => (c === " " ? " " : GLYPHS[(Math.random() * GLYPHS.length) | 0])).join("");
    if (p < 1) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
