// CORTEX OS: escritorio, ventanas, dock y buscador. En móvil se convierte en pantalla de inicio con apps a pantalla completa.
import { h, ico, $, $$, modalOpen, closeModal } from "./ui.js";
import { brain } from "./brain.js";
import { settings } from "./state.js";

const mobileQ = matchMedia("(max-width: 760px)");
export const isMobile = () => mobileQ.matches;

let APPS = [];
let cfg = {};
const wins = new Map(); // id -> { el, body, ctx, state }
let zTop = 10;
let clockTimer = null;
const appById = (id) => APPS.find((a) => a.id === id);

// ───────────────────────── montaje ─────────────────────────
export function mountDesktop({ apps, widget, onLock, search }) {
  APPS = apps; cfg = { widget, onLock, search };
  wins.clear();
  const icons = h("div", { class: "desk-icons", role: "list" },
    ...apps.filter((a) => a.desktop !== false).map((a) => {
      const b = h("button", { class: "desk-icon", role: "listitem", "data-app": a.id, title: a.title },
        h("span", { class: "desk-glyph" }, ico(a.icon)), h("span", { class: "desk-label" }, a.title));
      b.addEventListener("click", (e) => {
        if (isMobile() || e.detail === 0 || e.pointerType === "touch") return openApp(a.id);
        $$(".desk-icon.sel").forEach((x) => x.classList.remove("sel")); b.classList.add("sel");
      });
      b.addEventListener("dblclick", () => openApp(a.id));
      b.addEventListener("keydown", (e) => { if (e.key === "Enter") openApp(a.id); });
      return b;
    }));
  const dock = h("nav", { class: "dock", "aria-label": "Dock" },
    h("button", { class: "dock-btn home-btn", title: "Escritorio", onclick: showDesktop }, ico("home")),
    h("i", { class: "dock-sep" }),
    ...apps.filter((a) => a.dock).map((a) => h("button", { class: "dock-btn", "data-app": a.id, title: a.title, onclick: () => toggleApp(a.id) }, ico(a.icon), h("i", { class: "run" }))),
    h("i", { class: "dock-sep" }),
    h("button", { class: "dock-btn", title: "Buscar (Ctrl+K)", onclick: openPalette }, ico("search")),
    h("button", { class: "dock-btn danger-hover", title: "Bloquear", onclick: () => cfg.onLock?.() }, ico("lock")));

  const clock = h("span", { class: "tb-clock" });
  const top = h("header", { class: "topbar" },
    h("div", { class: "tb-left" },
      h("button", { class: "tb-brand", onclick: openPalette, title: "Buscar en CORTEX" }, h("img", { src: "assets/icon-32.png", alt: "" }), h("b", {}, "CORTEX"), h("span", { class: "tb-os" }, "OS")),
      h("span", { class: "tb-active", id: "tb-active" }, "Escritorio")),
    h("div", { class: "tb-right" },
      h("span", { class: "tb-chip" }, h("i", { class: "led" }), "AES-256-GCM"),
      h("span", { class: "tb-chip hide-sm" }, h("i", { class: "led" }), "marela · eu-west1"),
      clock,
      h("button", { class: "icon-btn", title: "Bloquear", "aria-label": "Bloquear", onclick: () => cfg.onLock?.() }, ico("lock"))));

  const wall = h("div", { class: "wallpaper", "aria-hidden": "true" },
    h("div", { class: "wall-grid" }),
    settings.fx ? brain({ size: "min(78vh, 62vw)", sparks: 22, className: "wall-brain", dim: 0.9, speed: 2 }) : h("img", { class: "wall-brain static", src: "assets/brain.webp", alt: "" }),
    h("div", { class: "wall-scan" }), h("div", { class: "wall-vignette" }));

  const widgetHost = h("aside", { class: "widget", id: "widget" });
  const layer = h("div", { class: "win-layer", id: "win-layer" });
  const os = h("div", { class: "os enter", id: "os" }, top, h("main", { class: "desk", id: "desk" }, wall, widgetHost, icons, layer), dock);
  $("#app").replaceChildren(os);
  setTimeout(() => os.classList.remove("enter"), 1200);
  renderWidget();

  const tick = () => { clock.textContent = new Date().toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" }); };
  tick(); clearInterval(clockTimer); clockTimer = setInterval(tick, 10000);
}

export function unmountDesktop() {
  clearInterval(clockTimer);
  wins.clear();
  closePalette();
}

export function renderWidget() {
  const host = $("#widget");
  if (host && cfg.widget) host.replaceChildren(cfg.widget());
}

// ───────────────────────── ventanas ─────────────────────────
export function openApp(id, args) {
  const app = appById(id);
  if (!app) return;
  if (wins.has(id)) {
    const w = wins.get(id);
    if (args !== undefined) { w.ctx.args = args; refreshApp(id); }
    w.el.classList.remove("min");
    focusWin(id);
    return w.ctx;
  }
  const body = h("div", { class: "win-body" });
  const title = h("span", { class: "win-title" }, app.title);
  const ctx = { id, args, body, state: {}, refresh: () => refreshApp(id), close: () => closeApp(id), setTitle: (t) => { title.textContent = t; } };
  const bar = h("header", { class: "win-bar" },
    h("button", { class: "win-back icon-btn", "aria-label": "Volver", onclick: () => closeApp(id) }, ico("back")),
    h("span", { class: "win-ico" }, ico(app.icon)), title,
    h("span", { class: "win-path" }, `~/cortex/${app.id}`),
    h("div", { class: "win-ctl" },
      h("button", { class: "wc", "aria-label": "Minimizar", onclick: () => minimize(id) }, ico("min")),
      h("button", { class: "wc", "aria-label": "Maximizar", onclick: () => toggleMax(id) }, ico("max")),
      h("button", { class: "wc close", "aria-label": "Cerrar", onclick: () => closeApp(id) }, ico("x"))));
  const grip = h("i", { class: "win-grip", "aria-hidden": "true" });
  const el = h("section", { class: "win opening", "data-app": id, role: "dialog", "aria-label": app.title }, bar, body, grip);
  ctx.el = el;
  // Posición inicial en cascada
  const desk = $("#desk").getBoundingClientRect();
  const n = wins.size;
  const w = Math.min(app.w || 860, desk.width - 40), hh = Math.min(app.h || 600, desk.height - 30);
  el.style.width = `${w}px`; el.style.height = `${hh}px`;
  el.style.left = `${Math.max(12, Math.min(desk.width - w - 12, (desk.width - w) / 2 + (n - 1) * 28))}px`;
  el.style.top = `${Math.max(10, Math.min(desk.height - hh - 10, (desk.height - hh) / 2.4 + (n - 1) * 26))}px`;
  el.addEventListener("pointerdown", () => focusWin(id), true);
  bar.addEventListener("dblclick", (e) => { if (!e.target.closest("button")) toggleMax(id); });
  drag(el, bar); resize(el, grip);
  $("#win-layer").append(el);
  wins.set(id, { el, body, ctx });
  renderInto(id);
  focusWin(id);
  setTimeout(() => el.classList.remove("opening"), 260);
  updateDock();
  return ctx;
}
function renderInto(id) {
  const w = wins.get(id); if (!w) return;
  const app = appById(id);
  const scroll = w.body.scrollTop;
  try { w.body.replaceChildren(app.render(w.ctx)); }
  catch (e) { console.error(e); w.body.replaceChildren(h("p", { class: "err-text pad" }, e.message)); }
  w.body.scrollTop = scroll;
}
export function refreshApp(id) { renderInto(id); }
export function refreshAll() { for (const id of wins.keys()) renderInto(id); renderWidget(); }
export function toggleApp(id) {
  const w = wins.get(id);
  if (!w) return openApp(id);
  if (w.el.classList.contains("min")) { w.el.classList.remove("min"); focusWin(id); }
  else if (w.el.classList.contains("active")) minimize(id);
  else focusWin(id);
}
export function closeApp(id) {
  const w = wins.get(id); if (!w) return;
  w.el.classList.add("closing");
  wins.delete(id);
  setTimeout(() => w.el.remove(), 180);
  const next = [...wins.values()].filter((x) => !x.el.classList.contains("min")).sort((a, b) => b.el.style.zIndex - a.el.style.zIndex)[0];
  if (next) focusWin(next.ctx.id); else setActiveTitle("Escritorio");
  updateDock();
}
function minimize(id) {
  const w = wins.get(id); if (!w) return;
  w.el.classList.add("min"); w.el.classList.remove("active");
  setActiveTitle("Escritorio"); updateDock();
}
function toggleMax(id) { wins.get(id)?.el.classList.toggle("max"); }
function focusWin(id) {
  const w = wins.get(id); if (!w) return;
  $$(".win.active").forEach((x) => x.classList.remove("active"));
  w.el.classList.add("active");
  w.el.style.zIndex = ++zTop;
  setActiveTitle(appById(id).title);
  updateDock();
}
function showDesktop() { for (const id of wins.keys()) minimize(id); }
export function closeAll() { for (const id of [...wins.keys()]) closeApp(id); }
function setActiveTitle(t) { const e = $("#tb-active"); if (e) e.textContent = t; }
function updateDock() {
  $$(".dock-btn[data-app]").forEach((b) => {
    const w = wins.get(b.dataset.app);
    b.classList.toggle("open", !!w);
    b.classList.toggle("on", !!w && w.el.classList.contains("active"));
  });
}

function drag(el, handle) {
  handle.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest("button") || isMobile() || el.classList.contains("max")) return;
    const r = el.getBoundingClientRect(), d = $("#desk").getBoundingClientRect();
    const ox = e.clientX - r.left, oy = e.clientY - r.top;
    handle.setPointerCapture(e.pointerId);
    el.classList.add("dragging");
    const move = (ev) => {
      el.style.left = `${Math.max(-r.width + 80, Math.min(d.width - 80, ev.clientX - d.left - ox))}px`;
      el.style.top = `${Math.max(0, Math.min(d.height - 40, ev.clientY - d.top - oy))}px`;
    };
    const up = () => { el.classList.remove("dragging"); handle.removeEventListener("pointermove", move); handle.removeEventListener("pointerup", up); };
    handle.addEventListener("pointermove", move); handle.addEventListener("pointerup", up);
  });
}
function resize(el, grip) {
  grip.addEventListener("pointerdown", (e) => {
    if (isMobile() || el.classList.contains("max")) return;
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY, sw = el.offsetWidth, sh = el.offsetHeight;
    grip.setPointerCapture(e.pointerId);
    const move = (ev) => { el.style.width = `${Math.max(360, sw + ev.clientX - sx)}px`; el.style.height = `${Math.max(260, sh + ev.clientY - sy)}px`; };
    const up = () => { grip.removeEventListener("pointermove", move); grip.removeEventListener("pointerup", up); };
    grip.addEventListener("pointermove", move); grip.addEventListener("pointerup", up);
  });
}

// ───────────────────────── buscador (Ctrl+K) ─────────────────────────
export function openPalette() {
  if ($(".palette-scrim")) return;
  const input = h("input", { type: "search", placeholder: "Buscar apps, contraseñas, documentos, archivos…", "aria-label": "Buscar", autocomplete: "off", spellcheck: "false" });
  const list = h("div", { class: "pal-list", role: "listbox" });
  let results = [], sel = 0;
  const draw = () => {
    const q = input.value.trim().toLowerCase();
    const appsRes = APPS.filter((a) => !q || a.title.toLowerCase().includes(q)).map((a) => ({ label: a.title, sub: "App", icon: a.icon, run: () => openApp(a.id) }));
    results = [...appsRes, ...(q ? cfg.search?.(q) || [] : [])].slice(0, 30);
    sel = Math.min(sel, Math.max(0, results.length - 1));
    list.replaceChildren(...(results.length ? results.map((r, i) =>
      h("button", { class: `pal-item ${i === sel ? "on" : ""}`, role: "option", onclick: () => { closePalette(); r.run(); }, onpointermove: () => { if (sel !== i) { sel = i; draw(); } } },
        ico(r.icon), h("span", { class: "pal-label" }, r.label), h("small", {}, r.sub)))
      : [h("p", { class: "muted pad" }, "Sin resultados.")]));
  };
  input.addEventListener("input", () => { sel = 0; draw(); });
  input.addEventListener("keydown", (e) => {
    if (e.key === "ArrowDown") { e.preventDefault(); sel = Math.min(results.length - 1, sel + 1); draw(); list.children[sel]?.scrollIntoView({ block: "nearest" }); }
    else if (e.key === "ArrowUp") { e.preventDefault(); sel = Math.max(0, sel - 1); draw(); list.children[sel]?.scrollIntoView({ block: "nearest" }); }
    else if (e.key === "Enter") { e.preventDefault(); const r = results[sel]; if (r) { closePalette(); r.run(); } }
    else if (e.key === "Escape") closePalette();
  });
  const box = h("div", { class: "palette", role: "dialog", "aria-label": "Buscar" }, h("div", { class: "pal-head" }, ico("search"), input, h("kbd", {}, "esc")), list);
  const scrim = h("div", { class: "palette-scrim", onpointerdown: (e) => { if (e.target === scrim) closePalette(); } }, box);
  document.body.append(scrim);
  draw();
  setTimeout(() => input.focus(), 20);
}
export function closePalette() { $(".palette-scrim")?.remove(); }

document.addEventListener("keydown", (e) => {
  if (!$("#os")) return;
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") { e.preventDefault(); $(".palette-scrim") ? closePalette() : openPalette(); }
  else if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "l") { e.preventDefault(); cfg.onLock?.(); }
  else if (e.key === "Escape") {
    if ($(".palette-scrim")) closePalette();
    else if (modalOpen()) closeModal();
  }
});
