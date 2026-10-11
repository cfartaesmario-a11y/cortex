import * as C from "./crypto.js";
import * as S from "./store.js";
import { ID_TEMPLATES, tpl } from "./templates.js";

// ───────────────────────── estado ─────────────────────────
const st = {
  keyId: null, key: null, fails: [], items: new Map(), view: "inicio",
  idleTimer: null, hiddenAt: 0, prevAccess: null, query: "",
};
const MAX_FAILS = 5;
const SETTINGS_KEY = "cortex.settings";
const settings = Object.assign({ lockMinutes: 5, clipSeconds: 30 }, safeJSON(localStorage.getItem(SETTINGS_KEY)));
function safeJSON(s) { try { return JSON.parse(s) || {}; } catch { return {}; } }
function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} }

// ───────────────────────── utilidades DOM ─────────────────────────
const $ = (s, r = document) => r.querySelector(s);
function h(tag, attrs = {}, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
    else if (k === "html") el.innerHTML = v; // solo para iconos SVG internos
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : String(kid));
  return el;
}
const ico = (name) => h("span", { class: "ico", "aria-hidden": "true", html: ICONS[name] || "" });
const uid = () => [...C.randomBytes(8)].map((b) => b.toString(16).padStart(2, "0")).join("");
const fmtDate = (t) => t ? new Date(t).toLocaleString("es-ES", { dateStyle: "medium", timeStyle: "short" }) : "—";
const fmtDay = (s) => { if (!s) return ""; const d = new Date(s); return isNaN(d) ? s : d.toLocaleDateString("es-ES"); };
const fmtSize = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(0)} KB` : `${(n / 1048576).toFixed(1)} MB`;
const byKind = (k) => [...st.items.values()].filter((i) => i.kind === k).sort((a, b) => (b.updated || 0) - (a.updated || 0));

const ICONS = {
  home: '<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
  key: '<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="M11 12l9-9M17 6l3 3M15 8l2 2"/></svg>',
  card: '<svg viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20M6 15h4"/></svg>',
  id: '<svg viewBox="0 0 24 24"><rect x="3" y="4" width="18" height="16" rx="2"/><circle cx="9" cy="11" r="2.5"/><path d="M5.5 17c.8-2 2-3 3.5-3s2.7 1 3.5 3M14 9h4M14 13h4"/></svg>',
  drive: '<svg viewBox="0 0 24 24"><path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  note: '<svg viewBox="0 0 24 24"><path d="M5 3h10l4 4v14H5z"/><path d="M15 3v4h4M8 12h8M8 16h6"/></svg>',
  contact: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/></svg>',
  gen: '<svg viewBox="0 0 24 24"><path d="M4 4h16v16H4z"/><circle cx="9" cy="9" r="1.2"/><circle cx="15" cy="15" r="1.2"/><circle cx="15" cy="9" r="1.2"/><circle cx="9" cy="15" r="1.2"/></svg>',
  log: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  cog: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  copy: '<svg viewBox="0 0 24 24"><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/></svg>',
  eye: '<svg viewBox="0 0 24 24"><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
  edit: '<svg viewBox="0 0 24 24"><path d="M4 20h4L20 8l-4-4L4 16z"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  file: '<svg viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6z"/><path d="M14 3v4h4"/></svg>',
  dl: '<svg viewBox="0 0 24 24"><path d="M12 4v11M7 10l5 5 5-5M5 20h14"/></svg>',
  up: '<svg viewBox="0 0 24 24"><path d="M12 20V9M7 14l5-5 5 5M5 4h14"/></svg>',
  x: '<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  wave: '<svg viewBox="0 0 24 24"><path d="M8 7c2 3 2 7 0 10M12 5c3 4 3 10 0 14M16 3c4 5 4 13 0 18"/></svg>',
  search: '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></svg>',
  phone: '<svg viewBox="0 0 24 24"><path d="M5 3h4l2 5-3 2a12 12 0 0 0 6 6l2-3 5 2v4a2 2 0 0 1-2 2A18 18 0 0 1 3 5a2 2 0 0 1 2-2z"/></svg>',
};

// ───────────────────────── avisos y portapapeles ─────────────────────────
function toast(msg, kind = "") {
  const t = h("div", { class: `toast ${kind}`, role: "status" }, msg);
  $("#toasts").append(t);
  setTimeout(() => t.classList.add("out"), 2600);
  setTimeout(() => t.remove(), 3100);
}
let clipTimer;
async function copy(text, label = "Dato") {
  if (!text) return toast("Este campo está vacío");
  try {
    await navigator.clipboard.writeText(text);
    toast(`${label} copiado · se borra en ${settings.clipSeconds} s`);
    clearTimeout(clipTimer);
    clipTimer = setTimeout(() => navigator.clipboard.writeText("").catch(() => {}), settings.clipSeconds * 1000);
  } catch { toast("No se pudo copiar", "err"); }
}

// ───────────────────────── modal ─────────────────────────
function modal(title, body, { wide = false } = {}) {
  closeModal();
  const box = h("div", { class: `modal ${wide ? "wide" : ""}`, role: "dialog", "aria-modal": "true", "aria-label": title },
    h("header", {}, h("h2", {}, title), h("button", { class: "icon-btn", "aria-label": "Cerrar", onclick: closeModal }, ico("x"))),
    h("div", { class: "modal-body" }, body));
  const scrim = h("div", { class: "scrim", onclick: (e) => { if (e.target === scrim) closeModal(); } }, box);
  document.body.append(scrim);
  setTimeout(() => box.querySelector("input,textarea,select,button.primary")?.focus(), 30);
  return box;
}
function closeModal() { document.querySelectorAll(".scrim").forEach((s) => { s.querySelectorAll("[data-url]").forEach((e) => URL.revokeObjectURL(e.dataset.url)); s.remove(); }); }
document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeModal(); });

function confirmBox(text, okLabel = "Eliminar") {
  return new Promise((res) => {
    const m = modal("Confirmar", h("div", {},
      h("p", { class: "muted" }, text),
      h("div", { class: "row end" },
        h("button", { class: "ghost", onclick: () => { closeModal(); res(false); } }, "Cancelar"),
        h("button", { class: "danger", onclick: () => { closeModal(); res(true); } }, okLabel))));
    m.querySelector(".danger").focus();
  });
}

// ───────────────────────── guardado cifrado ─────────────────────────
async function saveItem(item) {
  item.id ||= uid();
  item.updated = Date.now();
  const box = await C.encryptJSON(st.key, item);
  await S.putItem(item.id, box);
  st.items.set(item.id, item);
}
async function deleteItem(item) {
  if (item.kind === "file") await S.removeChunks(item.fileId, item.chunks);
  await S.removeItem(item.id);
  st.items.delete(item.id);
}

// ───────────────────────── bloqueo por inactividad ─────────────────────────
function armIdle() {
  clearTimeout(st.idleTimer);
  if (!st.key || !settings.lockMinutes) return;
  st.idleTimer = setTimeout(() => lock("Bloqueada por inactividad"), settings.lockMinutes * 60000);
}
["pointerdown", "keydown", "scroll", "touchstart"].forEach((ev) => addEventListener(ev, armIdle, { passive: true }));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) st.hiddenAt = Date.now();
  else if (st.key && st.hiddenAt && Date.now() - st.hiddenAt > 60000) lock("Bloqueada al volver a la pestaña");
});
function lock(reason) {
  if (!st.key) return;
  st.key = null; st.items.clear(); clearTimeout(st.idleTimer); closeModal();
  const done = () => { S.logout(); renderUnlock(reason); };
  S.logEvent("bloqueo").then(done, done);
}

// ───────────────────────── arranque ─────────────────────────
const root = () => $("#app");
function screen(...kids) { root().replaceChildren(h("main", { class: "gate" }, h("div", { class: "grid-bg", "aria-hidden": "true" }), ...kids)); }
function brand(sub) {
  return h("div", { class: "brand" },
    h("div", { class: "core", "aria-hidden": "true" }, h("i"), h("i"), h("i")),
    h("h1", {}, "CORTEX"), sub && h("p", { class: "muted" }, sub));
}
const authError = (e) => ({
  "auth/too-many-requests": "Firebase ha bloqueado temporalmente los intentos. Espera unos minutos.",
  "auth/network-request-failed": "Sin conexión. Revisa internet.",
  "auth/email-already-in-use": "Ya existe una bóveda con este archivo llave.",
}[e?.code] || e?.message || "Error desconocido");

if (!S.configured) {
  screen(h("section", { class: "gate-card" }, brand("Falta conectar Firebase"),
    h("p", { class: "muted" }, "Rellena js/config.js con la configuración web del proyecto marela.")));
} else {
  renderUnlock();
}

// ───────────────────────── crear bóveda ─────────────────────────
function renderSetup() {
  const keyFile = C.createKeyFile();
  let downloaded = false;
  const pw = h("input", { type: "password", autocomplete: "new-password", placeholder: "Mínimo 12 caracteres", id: "pw1" });
  const pw2 = h("input", { type: "password", autocomplete: "new-password", id: "pw2" });
  const meter = h("div", { class: "meter" }, h("i"));
  const meterText = h("small", { class: "muted" }, "");
  const saved = h("input", { type: "checkbox", id: "saved" });
  const msg = h("p", { class: "err-text", role: "alert" });
  const btn = h("button", { class: "primary big", disabled: true }, "Crear bóveda");
  const check = () => {
    const s = C.strength(pw.value);
    meter.dataset.score = s.score; meterText.textContent = `${s.label} · ${s.bits} bits`;
    btn.disabled = !(pw.value.length >= 12 && s.score >= 3 && pw.value === pw2.value && saved.checked && downloaded);
  };
  [pw, pw2, saved].forEach((e) => e.addEventListener("input", check));
  const dlBtn = h("button", { class: "ghost", onclick: () => {
    downloadJSON(keyFile, `cortex-llave-${keyFile.id.slice(0, 6)}.json`); downloaded = true; dlBtn.classList.add("done"); dlBtn.lastChild.textContent = "Llave descargada"; check();
  } }, ico("dl"), h("span", {}, "Descargar archivo llave"));

  btn.onclick = async () => {
    btn.disabled = true; btn.textContent = "Cifrando…"; msg.textContent = "";
    try {
      const kf = C.parseKeyFile(JSON.stringify(keyFile));
      const { key, authPw } = await C.deriveVault(pw.value, kf);
      await S.createAccount(kf.id, authPw);
      const chk = await C.encryptJSON(key, { cortex: "ok", keyId: kf.id });
      await S.createMeta({ check: chk, keyId: kf.id, v: 2 });
      st.keyId = kf.id; st.key = key; st.prevAccess = null; st.failsSince = 0;
      await S.logEvent("creada");
      pw.value = pw2.value = "";
      await openVault();
    } catch (e) { msg.textContent = authError(e); btn.disabled = false; btn.textContent = "Crear bóveda"; }
  };

  screen(h("section", { class: "gate-card wide" },
    brand("Crea tu bóveda"),
    h("ol", { class: "steps" },
      h("li", {}, h("strong", {}, "Contraseña maestra"),
        h("label", { for: "pw1" }, "Contraseña"), pw, meter, meterText,
        h("label", { for: "pw2" }, "Repítela"), pw2),
      h("li", {}, h("strong", {}, "Archivo llave"),
        h("p", { class: "muted" }, "Se combina con tu contraseña. Guárdalo en dos sitios (por ejemplo, un USB y el móvil). No lo subas a ninguna nube."),
        dlBtn),
      h("li", {}, h("strong", {}, "Confirmación"),
        h("label", { class: "check" }, saved, h("span", {}, "Entiendo que sin la contraseña y el archivo llave nadie puede recuperar mis datos, tampoco yo.")))),
    msg, btn,
    h("button", { class: "link", onclick: () => renderUnlock() }, "Ya tengo una bóveda")));
}

function downloadJSON(obj, name) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(obj, null, 2)], { type: "application/json" }));
  const a = h("a", { href: url, download: name }); document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ───────────────────────── desbloquear ─────────────────────────
function renderUnlock(reason) {
  let keyFile = null, attempts = null;
  const pw = h("input", { type: "password", autocomplete: "current-password", id: "pw" });
  const fileIn = h("input", { type: "file", accept: ".json,application/json", class: "sr", id: "kf" });
  const drop = h("label", { class: "drop", for: "kf" }, ico("key"), h("span", {}, "Elige o arrastra tu archivo llave .json"));
  const msg = h("p", { class: "err-text", role: "alert" }, reason || "");
  const btn = h("button", { class: "primary big" }, "Desbloquear");

  const lockedFor = () => Math.max(0, (attempts?.lockUntil || 0) - Date.now());
  let lockTimer;
  const showLock = () => {
    clearTimeout(lockTimer);
    const ms = lockedFor();
    if (ms > 0) {
      btn.disabled = true;
      msg.textContent = `Demasiados intentos. Espera ${Math.ceil(ms / 60000)} min.`;
      lockTimer = setTimeout(showLock, Math.min(ms, 30000));
    } else if (btn.disabled && btn.textContent === "Desbloquear") { btn.disabled = false; msg.textContent = ""; }
  };
  const takeFile = async (f) => {
    if (!f) return;
    try {
      keyFile = C.parseKeyFile(await f.text());
      drop.classList.add("ok"); drop.lastChild.textContent = `Llave ${keyFile.id.slice(0, 6)}… lista`;
      msg.textContent = "";
      attempts = await S.getAttempts(keyFile.id).catch(() => ({ failed: 0, lockUntil: 0, fails: [] }));
      showLock(); pw.focus();
    } catch (e) { keyFile = null; drop.classList.remove("ok"); drop.lastChild.textContent = "Elige o arrastra tu archivo llave .json"; msg.textContent = e.message; }
  };
  fileIn.onchange = () => takeFile(fileIn.files[0]);
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); takeFile(e.dataTransfer.files[0]); });

  const fail = async (text) => {
    const failed = (attempts.failed || 0) + 1;
    attempts = { ...attempts, failed, fails: [...(attempts.fails || []), { at: Date.now(), device: S.device() }] };
    if (failed >= MAX_FAILS) attempts.lockUntil = Date.now() + Math.min(5 * 2 ** (failed - MAX_FAILS), 1440) * 60000;
    await S.setAttempts(keyFile.id, attempts).catch(() => {});
    btn.textContent = "Desbloquear"; btn.disabled = false; pw.select();
    msg.textContent = text || (failed >= MAX_FAILS ? "" : `Contraseña o llave incorrectas. Quedan ${MAX_FAILS - failed} intentos antes del bloqueo.`);
    showLock();
  };

  const attempt = async (e) => {
    e?.preventDefault();
    if (!keyFile) return (msg.textContent = "Falta el archivo llave.");
    if (lockedFor() > 0) return showLock();
    if (!pw.value) return (msg.textContent = "Falta la contraseña.");
    btn.disabled = true; btn.textContent = "Verificando…";
    let derived;
    try { derived = await C.deriveVault(pw.value, keyFile); } catch (err) { return fail(err.message); }
    try { await S.openAccount(keyFile.id, derived.authPw); }
    catch (err) {
      if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"].includes(err.code)) return fail();
      btn.textContent = "Desbloquear"; btn.disabled = false; msg.textContent = authError(err); return;
    }
    try {
      const meta = await S.getMeta();
      if (!meta) throw new Error("No se encontró la bóveda.");
      await C.decryptJSON(derived.key, meta.check);
      st.key = derived.key; st.keyId = keyFile.id; pw.value = "";
      const log = await S.getLog(10).catch(() => []);
      st.prevAccess = log.find((l) => l.type === "entrada") || null;
      st.failsSince = (attempts.fails || []).filter((f) => !st.prevAccess || f.at > st.prevAccess.at).length;
      st.fails = attempts.fails || [];
      await S.setAttempts(keyFile.id, { failed: 0, lockUntil: 0, fails: attempts.fails || [] }).catch(() => {});
      await S.logEvent("entrada");
      await openVault();
    } catch (err) { await S.logout(); fail(err.message); }
  };
  btn.onclick = attempt;

  screen(h("form", { class: "gate-card", onsubmit: attempt },
    brand("Tu memoria cifrada"),
    fileIn, drop,
    h("label", { for: "pw" }, "Contraseña maestra"), pw,
    msg, btn,
    h("button", { type: "button", class: "link", onclick: renderSetup }, "Crear una bóveda nueva")));
}

// ───────────────────────── abrir bóveda ─────────────────────────
async function openVault() {
  screen(h("section", { class: "gate-card" }, brand("Descifrando…")));
  const docs = await S.listItems();
  st.items.clear();
  await Promise.all(docs.map(async (d) => {
    try { const it = await C.decryptJSON(st.key, d.box); it.id = d.id; st.items.set(d.id, it); } catch {}
  }));
  st.view = "inicio"; armIdle();
  renderShell();
}

const NAV = [
  ["inicio", "Inicio", "home"], ["claves", "Contraseñas", "key"], ["tarjetas", "Tarjetas", "card"],
  ["identidad", "Identidad", "id"], ["drive", "Drive", "drive"], ["notas", "Notas", "note"],
  ["contactos", "Contactos", "contact"], ["generador", "Generador", "gen"], ["registro", "Registro", "log"], ["ajustes", "Ajustes", "cog"],
];
const MOBILE_NAV = ["inicio", "claves", "tarjetas", "identidad", "drive"];

function renderShell() {
  const side = h("nav", { class: "side", "aria-label": "Secciones" },
    h("div", { class: "side-brand" }, h("div", { class: "core sm", "aria-hidden": "true" }, h("i"), h("i"), h("i")), h("span", {}, "CORTEX")),
    ...NAV.map(([id, label, icon]) => h("button", { class: `nav ${st.view === id ? "on" : ""}`, onclick: () => go(id), "aria-current": st.view === id ? "page" : null }, ico(icon), h("span", {}, label))),
    h("button", { class: "nav lockbtn", onclick: () => lock("Bóveda bloqueada") }, ico("lock"), h("span", {}, "Bloquear")));
  const bottom = h("nav", { class: "bottom", "aria-label": "Secciones" },
    ...MOBILE_NAV.map((id) => { const [, label, icon] = NAV.find((n) => n[0] === id); return h("button", { class: st.view === id ? "on" : "", onclick: () => go(id) }, ico(icon), h("span", {}, label)); }),
    h("button", { class: !MOBILE_NAV.includes(st.view) ? "on" : "", onclick: moreMenu }, ico("cog"), h("span", {}, "Más")));
  const top = h("header", { class: "top" },
    h("div", { class: "status" }, h("i", { class: "pulse", "aria-hidden": "true" }), h("span", {}, "Cifrado activo · AES-256")),
    h("button", { class: "icon-btn", "aria-label": "Bloquear", onclick: () => lock("Bóveda bloqueada") }, ico("lock")));
  const content = h("div", { class: "content", id: "content" });
  root().replaceChildren(h("div", { class: "shell" }, side, h("div", { class: "main" }, top, content), bottom));
  renderView();
}
function moreMenu() {
  modal("Más secciones", h("div", { class: "more-grid" },
    ...NAV.filter(([id]) => !MOBILE_NAV.includes(id)).map(([id, label, icon]) =>
      h("button", { class: "tile", onclick: () => { closeModal(); go(id); } }, ico(icon), h("span", {}, label))),
    h("button", { class: "tile", onclick: () => { closeModal(); lock("Bóveda bloqueada"); } }, ico("lock"), h("span", {}, "Bloquear"))));
}
function go(view) { st.view = view; st.query = ""; renderShell(); $("#content")?.scrollTo?.(0, 0); }
function renderView() {
  const c = $("#content");
  const views = { inicio: vHome, claves: vLogins, tarjetas: vCards, identidad: vIds, drive: vDrive, notas: vNotes, contactos: vContacts, generador: vGen, registro: vLog, ajustes: vSettings };
  c.replaceChildren(views[st.view]());
}
const head = (title, sub, ...actions) => h("div", { class: "head" }, h("div", {}, h("h2", {}, title), sub && h("p", { class: "muted" }, sub)), h("div", { class: "row" }, ...actions));
const addBtn = (label, fn) => h("button", { class: "primary", onclick: fn }, ico("plus"), h("span", {}, label));
const empty = (text, action) => h("div", { class: "empty" }, h("p", {}, text), action);
function searchBox(onInput) {
  const i = h("input", { type: "search", placeholder: "Buscar", value: st.query, "aria-label": "Buscar" });
  i.addEventListener("input", () => { st.query = i.value; onInput(); });
  return h("div", { class: "search" }, ico("search"), i);
}
const matches = (it, ...keys) => !st.query || keys.some((k) => String(it[k] || "").toLowerCase().includes(st.query.toLowerCase()));

// ───────────────────────── campos reutilizables ─────────────────────────
function field(label, value, { secret = false, mono = false, href } = {}) {
  if (!value) return null;
  const val = h("span", { class: `val ${mono ? "mono" : ""} ${secret ? "masked" : ""}` }, secret ? "••••••••••" : value);
  let shown = false;
  return h("div", { class: "field" },
    h("small", {}, label),
    h("div", { class: "field-row" },
      href ? h("a", { class: "val", href, target: "_blank", rel: "noopener noreferrer" }, value) : val,
      secret && h("button", { class: "icon-btn sm", "aria-label": "Mostrar", onclick: () => { shown = !shown; val.textContent = shown ? value : "••••••••••"; val.classList.toggle("masked", !shown); } }, ico("eye")),
      h("button", { class: "icon-btn sm", "aria-label": `Copiar ${label}`, onclick: () => copy(value, label) }, ico("copy"))));
}
function formFields(defs, data) {
  // defs: [name, label, type?]
  const inputs = {};
  const els = defs.map(([name, label, type]) => {
    const id = `f_${name}`;
    let input;
    if (type === "area") input = h("textarea", { id, rows: 4 });
    else if (type === "select") input = h("select", { id }, ...arguments[2][name].map((o) => h("option", { value: o }, o)));
    else input = h("input", { id, type: type === "secret" ? "password" : type || "text", autocomplete: "off", spellcheck: "false" });
    input.value = data[name] || "";
    inputs[name] = input;
    const wrap = h("div", { class: `f ${type === "area" ? "full" : ""}` }, h("label", { for: id }, label), input);
    if (type === "secret") {
      const gen = h("button", { type: "button", class: "icon-btn sm", "aria-label": "Generar", onclick: () => { input.value = C.generatePassword({ length: 20 }); input.type = "text"; input.dispatchEvent(new Event("input")); } }, ico("gen"));
      const eye = h("button", { type: "button", class: "icon-btn sm", "aria-label": "Mostrar", onclick: () => { input.type = input.type === "password" ? "text" : "password"; } }, ico("eye"));
      wrap.append(h("div", { class: "inline-tools" }, eye, gen));
    }
    return wrap;
  });
  return { els, read: () => Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value.trim()])), inputs };
}
function editor(title, defs, item, kind, after, extraOpts) {
  const f = formFields(defs, item || {}, extraOpts);
  const save = h("button", { class: "primary", type: "submit" }, "Guardar");
  const form = h("form", { class: "form", onsubmit: async (e) => {
    e.preventDefault(); save.disabled = true;
    try { await saveItem({ ...(item || {}), ...f.read(), kind }); closeModal(); toast("Guardado y cifrado"); renderView(); after?.(); }
    catch (err) { toast(err.message, "err"); save.disabled = false; }
  } }, h("div", { class: "fgrid" }, ...f.els),
    h("div", { class: "row end" },
      item?.id && h("button", { type: "button", class: "danger ghost", onclick: async () => { if (await confirmBox("Se eliminará para siempre.")) { await deleteItem(item); closeModal(); renderView(); toast("Eliminado"); } } }, "Eliminar"),
      save));
  modal(title, form);
  return f;
}

// ───────────────────────── INICIO ─────────────────────────
function vHome() {
  const logins = byKind("login");
  const weak = logins.filter((l) => C.strength(l.password).score <= 2);
  const counts = {}; logins.forEach((l) => l.password && (counts[l.password] = (counts[l.password] || 0) + 1));
  const reused = logins.filter((l) => counts[l.password] > 1);
  const soon = byKind("id").filter((d) => { const v = d.validez || d.valabilitate; if (!v) return false; const t = new Date(v) - Date.now(); return t < 90 * 864e5; });
  const stat = (n, label, view) => h("button", { class: "stat", onclick: () => go(view) }, h("b", {}, n), h("span", {}, label));
  const alerts = [
    weak.length && h("li", {}, `${weak.length} contraseña${weak.length > 1 ? "s" : ""} débil${weak.length > 1 ? "es" : ""}`, h("button", { class: "link", onclick: () => go("claves") }, "Revisar")),
    reused.length && h("li", {}, `${reused.length} contraseñas repetidas`, h("button", { class: "link", onclick: () => go("claves") }, "Revisar")),
    ...soon.map((d) => h("li", {}, `${tpl(d.template).name} caduca el ${fmtDay(d.validez || d.valabilitate)}`, h("button", { class: "link", onclick: () => go("identidad") }, "Ver"))),
    st.failsSince && h("li", { class: "warn" }, `${st.failsSince} intento${st.failsSince > 1 ? "s" : ""} fallido${st.failsSince > 1 ? "s" : ""} desde tu última entrada`, h("button", { class: "link", onclick: () => go("registro") }, "Ver registro")),
  ].filter(Boolean);
  return h("section", { class: "view" },
    h("div", { class: "hero" },
      h("div", { class: "hero-txt" },
        h("p", { class: "muted" }, "Hola, Mario"),
        h("h2", {}, "Tu memoria está a salvo."),
        h("p", { class: "muted" }, st.prevAccess ? `Última entrada: ${fmtDate(st.prevAccess.at)} · ${st.prevAccess.device}` : "Esta es tu primera entrada.")),
      h("div", { class: "neuro", "aria-hidden": "true" }, ...Array.from({ length: 24 }, (_, i) => h("i", { style: `--i:${i}` })))),
    h("div", { class: "stats" },
      stat(logins.length, "Contraseñas", "claves"), stat(byKind("card").length, "Tarjetas", "tarjetas"),
      stat(byKind("id").length, "Documentos", "identidad"), stat(byKind("file").length, "Archivos", "drive"),
      stat(byKind("note").length, "Notas", "notas"), stat(byKind("contact").length, "Contactos", "contactos")),
    h("div", { class: "panel" }, h("h3", {}, "Revisión de seguridad"),
      alerts.length ? h("ul", { class: "alerts" }, ...alerts) : h("p", { class: "muted" }, "Todo en orden. No hay contraseñas débiles, repetidas ni documentos a punto de caducar.")));
}

// ───────────────────────── CONTRASEÑAS ─────────────────────────
const LOGIN_DEFS = [["title", "Nombre (p. ej. Instagram)"], ["username", "Usuario o correo"], ["password", "Contraseña", "secret"], ["url", "Web"], ["notes", "Notas", "area"]];
function vLogins() {
  const list = h("div", { class: "list" });
  const draw = () => {
    const items = byKind("login").filter((l) => matches(l, "title", "username", "url"));
    list.replaceChildren(...(items.length ? items.map(loginRow) : [empty(st.query ? "Nada coincide con la búsqueda." : "Añade tu primera contraseña.", !st.query && addBtn("Añadir", newLogin))]));
  };
  draw();
  return h("section", { class: "view" }, head("Contraseñas", "Toca el icono de copiar para llevarte el dato.", addBtn("Añadir", newLogin)), searchBox(draw), list);
}
function newLogin() { editor("Nueva contraseña", LOGIN_DEFS, null, "login"); }
function loginRow(l) {
  const s = C.strength(l.password);
  return h("article", { class: "item" },
    h("div", { class: "avatar" }, (l.title || "?")[0].toUpperCase()),
    h("div", { class: "item-main" },
      h("div", { class: "item-title" }, h("strong", {}, l.title || "Sin nombre"), h("span", { class: `badge s${s.score}` }, s.label)),
      field("Usuario", l.username), field("Contraseña", l.password, { secret: true, mono: true }),
      l.url && field("Web", l.url, { href: /^https?:/i.test(l.url) ? l.url : `https://${l.url}` })),
    h("button", { class: "icon-btn", "aria-label": "Editar", onclick: () => editor("Editar contraseña", LOGIN_DEFS, l, "login") }, ico("edit")));
}

// ───────────────────────── TARJETAS ─────────────────────────
const CARD_DEFS = [["label", "Nombre de la tarjeta (p. ej. Banco principal)"], ["holder", "Titular"], ["number", "Número"], ["expiry", "Caducidad (MM/AA)"], ["cvv", "CVV (opcional, no recomendado)", "secret"], ["notes", "Notas", "area"]];
const groupNum = (n = "") => n.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();
function vCards() {
  const cards = byKind("card");
  return h("section", { class: "view" },
    head("Tarjetas", "Toca cualquier dato de la tarjeta para copiarlo.", addBtn("Nueva tarjeta", () => editor("Nueva tarjeta", CARD_DEFS, null, "card"))),
    cards.length ? h("div", { class: "cards" }, ...cards.map(cardView)) :
      h("div", { class: "cards" }, cardView({ label: "Plantilla", holder: "TU NOMBRE", number: "0000000000000000", expiry: "MM/AA", demo: true })));
}
function cardView(c) {
  let reveal = false;
  const digits = (c.number || "").replace(/\D/g, "");
  const num = h("button", { class: "cc-num", onclick: () => !c.demo && copy(digits, "Número") });
  const paint = () => { num.textContent = reveal || c.demo ? groupNum(digits) : `•••• •••• •••• ${digits.slice(-4)}`; };
  paint();
  const tap = (label, val, cls) => h("button", { class: cls, onclick: () => !c.demo && copy(val, label) }, val || "—");
  return h("div", { class: "cc-wrap" },
    h("div", { class: "cc", tabindex: "-1" },
      h("div", { class: "cc-top" }, tap("Nombre", c.label, "cc-label"), h("span", { class: "cc-wave", html: ICONS.wave })),
      h("div", { class: "chip", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i")),
      num,
      h("div", { class: "cc-bottom" },
        h("div", {}, h("small", {}, "Titular"), tap("Titular", c.holder, "cc-holder")),
        h("div", {}, h("small", {}, "Caduca"), tap("Caducidad", c.expiry, "cc-exp")),
        c.cvv && h("div", {}, h("small", {}, "CVV"), h("button", { class: "cc-exp", onclick: () => copy(c.cvv, "CVV") }, "•••")))),
    !c.demo && h("div", { class: "row" },
      h("button", { class: "ghost sm", onclick: () => { reveal = !reveal; paint(); } }, ico("eye"), h("span", {}, "Ver número")),
      h("button", { class: "ghost sm", onclick: () => editor("Editar tarjeta", CARD_DEFS, c, "card") }, ico("edit"), h("span", {}, "Editar"))),
    c.demo && h("p", { class: "muted center" }, "Así se verá. Pulsa «Nueva tarjeta» para rellenar la tuya."));
}

// ───────────────────────── IDENTIDAD ─────────────────────────
function vIds() {
  const mine = byKind("id");
  const groups = ["España", "Rumanía", "General"];
  return h("section", { class: "view" },
    head("Identidad", "Fichas con tus datos. Elige un modelo y rellena los huecos."),
    mine.length ? h("div", { class: "ids" }, ...mine.map(idCard)) : empty("Todavía no tienes fichas. Elige un modelo abajo."),
    h("h3", { class: "sub" }, "Modelos disponibles"),
    ...groups.map((g) => h("div", { class: "tpl-group" }, h("h4", {}, g),
      h("div", { class: "tpl-grid" }, ...ID_TEMPLATES.filter((t) => t.group === g).map((t) =>
        h("button", { class: "tpl", onclick: () => idEditor({ template: t.id }) }, ico(t.id.includes("pas") ? "note" : "id"), h("span", {}, t.name), h("small", {}, t.region)))))));
}
function idCard(d) {
  const t = tpl(d.template);
  const passport = t.id.includes("pas");
  const vals = t.fields.filter(([k, , type]) => d[k] && type !== "area");
  const main = d[t.main];
  return h("article", { class: `idc ${passport ? "passport" : ""}` },
    h("header", {}, h("div", {}, h("small", {}, `${t.region} · ficha CORTEX`), h("strong", {}, d.titulo || t.name)),
      h("button", { class: "icon-btn sm", "aria-label": "Editar", onclick: () => idEditor(d) }, ico("edit"))),
    h("div", { class: "idc-body" },
      h("div", { class: "photo" }, d.photo ? h("img", { src: d.photo, alt: "Foto" }) : h("span", {}, "Foto")),
      h("div", { class: "idc-fields" },
        main && h("button", { class: "idc-main", onclick: () => copy(main, t.fields.find((f) => f[0] === t.main)[1]) }, main),
        ...vals.filter(([k]) => k !== t.main).map(([k, label, type]) =>
          h("button", { class: "idc-f", onclick: () => copy(d[k], label) }, h("small", {}, label), h("span", {}, type === "date" ? fmtDay(d[k]) : d[k]))))),
    h("footer", { class: "idc-foot" }, "Ficha de consulta personal · no es un documento oficial"));
}
function idEditor(d) {
  const t = tpl(d.template);
  const defs = [...t.fields];
  let photo = d.photo || "";
  const preview = h("div", { class: "photo big" }, photo ? h("img", { src: photo, alt: "Foto" }) : h("span", {}, "Sin foto"));
  const pIn = h("input", { type: "file", accept: "image/*", class: "sr", id: "photoin" });
  pIn.onchange = async () => { const f = pIn.files[0]; if (!f) return; photo = await shrinkImage(f, 360); preview.replaceChildren(h("img", { src: photo, alt: "Foto" })); };
  const fx = formFields(defs, d);
  const save = h("button", { class: "primary", type: "submit" }, "Guardar");
  const form = h("form", { class: "form", onsubmit: async (e) => {
    e.preventDefault(); save.disabled = true;
    try { await saveItem({ ...d, ...fx.read(), photo, template: t.id, kind: "id" }); closeModal(); toast("Ficha guardada y cifrada"); renderView(); }
    catch (err) { toast(err.message, "err"); save.disabled = false; }
  } },
    h("div", { class: "photo-row" }, preview, h("div", {}, h("label", { class: "ghost sm btnlike", for: "photoin" }, ico("up"), h("span", {}, "Añadir foto")), pIn,
      photo && h("button", { type: "button", class: "link", onclick: () => { photo = ""; preview.replaceChildren(h("span", {}, "Sin foto")); } }, "Quitar foto"))),
    h("div", { class: "fgrid" }, ...fx.els),
    h("div", { class: "row end" },
      d.id && h("button", { type: "button", class: "danger ghost", onclick: async () => { if (await confirmBox("Se eliminará esta ficha.")) { await deleteItem(d); closeModal(); renderView(); } } }, "Eliminar"),
      save));
  modal(`${t.name} · ${t.region}`, form, { wide: true });
}
function shrinkImage(file, max) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const cv = h("canvas", { width: Math.round(img.width * s), height: Math.round(img.height * s) });
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url); res(cv.toDataURL("image/jpeg", 0.82));
    };
    img.onerror = () => rej(new Error("No se pudo leer la imagen"));
    img.src = url;
  });
}

// ───────────────────────── DRIVE ─────────────────────────
function vDrive() {
  const files = byKind("file");
  const total = files.reduce((a, f) => a + (f.size || 0), 0);
  const input = h("input", { type: "file", multiple: true, class: "sr", id: "up" });
  input.onchange = () => uploadFiles([...input.files]);
  const zone = h("label", { class: "drop big", for: "up" }, ico("up"), h("span", {}, "Suelta aquí archivos o toca para elegirlos"), h("small", { class: "muted" }, `Hasta ${fmtSize(S.MAX_FILE)} por archivo · se cifran antes de subir`));
  zone.addEventListener("dragover", (e) => { e.preventDefault(); zone.classList.add("over"); });
  zone.addEventListener("dragleave", () => zone.classList.remove("over"));
  zone.addEventListener("drop", (e) => { e.preventDefault(); zone.classList.remove("over"); uploadFiles([...e.dataTransfer.files]); });
  const list = h("div", { class: "files" });
  const draw = () => list.replaceChildren(...files.filter((f) => matches(f, "name")).map(fileRow));
  draw();
  return h("section", { class: "view" }, head("Drive", `${files.length} archivos · ${fmtSize(total)} cifrados`), zone, input, files.length > 3 && searchBox(draw), list);
}
const fileKind = (t = "") => t.startsWith("image/") ? "IMG" : t.startsWith("video/") ? "VID" : t === "application/pdf" ? "PDF" : t.startsWith("audio/") ? "AUD" : "DOC";
function fileRow(f) {
  return h("article", { class: "frow" },
    h("div", { class: "ftype" }, fileKind(f.type)),
    h("button", { class: "fname", onclick: () => openFile(f) }, h("strong", {}, f.name), h("small", { class: "muted" }, `${fmtSize(f.size)} · ${fmtDate(f.updated)}`)),
    h("button", { class: "icon-btn sm", "aria-label": "Descargar", onclick: () => openFile(f, true) }, ico("dl")),
    h("button", { class: "icon-btn sm", "aria-label": "Eliminar", onclick: async () => { if (await confirmBox(`Se eliminará «${f.name}».`)) { await deleteItem(f); renderView(); toast("Archivo eliminado"); } } }, ico("trash")));
}
async function uploadFiles(files) {
  for (const file of files) {
    if (file.size > S.MAX_FILE) { toast(`${file.name} supera ${fmtSize(S.MAX_FILE)}`, "err"); continue; }
    const bar = h("div", { class: "meter progress" }, h("i"));
    const t = h("div", { class: "toast sticky" }, h("span", {}, `Cifrando ${file.name}`), bar);
    $("#toasts").append(t);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const fileId = uid(); const chunks = [];
      for (let i = 0; i < buf.length || i === 0; i += S.CHUNK) {
        chunks.push(await C.encryptBytes(st.key, buf.subarray(i, i + S.CHUNK)));
        bar.firstChild.style.width = `${Math.min(100, ((i + S.CHUNK) / Math.max(buf.length, 1)) * 60)}%`;
        if (buf.length === 0) break;
      }
      t.firstChild.textContent = `Subiendo ${file.name}`;
      await S.putChunks(fileId, chunks);
      bar.firstChild.style.width = "100%";
      await saveItem({ kind: "file", name: file.name, type: file.type, size: file.size, fileId, chunks: chunks.length });
      toast(`${file.name} guardado`);
    } catch (e) { toast(`Error con ${file.name}: ${e.message}`, "err"); }
    t.remove();
  }
  if (st.view === "drive") renderView();
}
async function openFile(f, download = false) {
  toast(`Descifrando ${f.name}…`);
  try {
    const parts = [];
    for (let i = 0; i < f.chunks; i++) { const c = await S.getChunk(f.fileId, i); parts.push(await C.decryptBytes(st.key, c.iv, c.ct)); }
    const blob = new Blob(parts, { type: f.type || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    if (download) { const a = h("a", { href: url, download: f.name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); return; }
    let view;
    if (f.type.startsWith("image/")) view = h("img", { src: url, alt: f.name, class: "pv", "data-url": url });
    else if (f.type.startsWith("video/")) view = h("video", { src: url, controls: true, class: "pv", "data-url": url });
    else if (f.type.startsWith("audio/")) view = h("audio", { src: url, controls: true, "data-url": url });
    else if (f.type === "application/pdf") view = h("iframe", { src: url, class: "pv pdf", title: f.name, "data-url": url });
    else view = h("p", { class: "muted", "data-url": url }, "Este tipo de archivo no se puede previsualizar.");
    modal(f.name, h("div", {}, view, h("div", { class: "row end" }, h("a", { class: "primary btnlike", href: url, download: f.name }, ico("dl"), h("span", {}, "Descargar")))), { wide: true });
  } catch (e) { toast(e.message, "err"); }
}

// ───────────────────────── NOTAS ─────────────────────────
const NOTE_DEFS = [["title", "Título"], ["body", "Texto", "area"]];
function vNotes() {
  const list = h("div", { class: "notes" });
  const draw = () => {
    const ns = byKind("note").filter((n) => matches(n, "title", "body"));
    list.replaceChildren(...(ns.length ? ns.map((n) => h("button", { class: "note", onclick: () => editor("Editar nota", NOTE_DEFS, n, "note") },
      h("strong", {}, n.title || "Sin título"), h("p", {}, (n.body || "").slice(0, 180)), h("small", { class: "muted" }, fmtDate(n.updated))))
      : [empty(st.query ? "Nada coincide." : "Guarda aquí códigos de recuperación o cualquier texto privado.", !st.query && addBtn("Nueva nota", () => editor("Nueva nota", NOTE_DEFS, null, "note")))]));
  };
  draw();
  return h("section", { class: "view" }, head("Notas seguras", null, addBtn("Nueva nota", () => editor("Nueva nota", NOTE_DEFS, null, "note"))), searchBox(draw), list);
}

// ───────────────────────── CONTACTOS ─────────────────────────
const CONTACT_DEFS = [["name", "Nombre"], ["role", "Tipo (médico, emergencia, banco, seguro…)"], ["phone", "Teléfono", "tel"], ["email", "Correo", "email"], ["notes", "Notas", "area"]];
function vContacts() {
  const cs = byKind("contact");
  return h("section", { class: "view" },
    head("Contactos clave", "Personas y servicios importantes.", addBtn("Añadir", () => editor("Nuevo contacto", CONTACT_DEFS, null, "contact"))),
    cs.length ? h("div", { class: "list" }, ...cs.map((c) => h("article", { class: "item" },
      h("div", { class: "avatar" }, (c.name || "?")[0].toUpperCase()),
      h("div", { class: "item-main" },
        h("div", { class: "item-title" }, h("strong", {}, c.name), c.role && h("span", { class: "badge" }, c.role)),
        field("Teléfono", c.phone, { href: c.phone && `tel:${c.phone.replace(/\s/g, "")}` }), field("Correo", c.email), c.notes && h("p", { class: "muted small" }, c.notes)),
      h("button", { class: "icon-btn", "aria-label": "Editar", onclick: () => editor("Editar contacto", CONTACT_DEFS, c, "contact") }, ico("edit")))))
      : empty("Añade tu médico, un contacto de emergencia o el teléfono del banco.", addBtn("Añadir", () => editor("Nuevo contacto", CONTACT_DEFS, null, "contact"))));
}

// ───────────────────────── GENERADOR ─────────────────────────
function vGen() {
  const opts = { length: 20, lower: true, upper: true, digits: true, symbols: true };
  let mode = "chars";
  const out = h("button", { class: "gen-out mono", onclick: () => copy(out.textContent, "Contraseña") });
  const meter = h("div", { class: "meter" }, h("i")); const info = h("small", { class: "muted" });
  const lenLbl = h("b", {}, opts.length);
  const run = () => {
    out.textContent = mode === "chars" ? C.generatePassword(opts) : C.generatePassphrase(Math.max(4, Math.round(opts.length / 4)));
    const s = C.strength(out.textContent); meter.dataset.score = s.score; info.textContent = `${s.label} · ${s.bits} bits`;
  };
  const range = h("input", { type: "range", min: 8, max: 64, value: opts.length, "aria-label": "Longitud" });
  range.oninput = () => { opts.length = +range.value; lenLbl.textContent = range.value; run(); };
  const tog = (k, label) => { const c = h("input", { type: "checkbox", checked: opts[k] }); c.onchange = () => { opts[k] = c.checked; run(); }; return h("label", { class: "check" }, c, h("span", {}, label)); };
  const seg = h("div", { class: "seg", role: "tablist" },
    ...[["chars", "Caracteres"], ["words", "Frase de palabras"]].map(([m, l]) => h("button", { class: m === mode ? "on" : "", role: "tab", onclick: (e) => { mode = m; seg.querySelectorAll("button").forEach((b) => b.classList.remove("on")); e.currentTarget.classList.add("on"); run(); } }, l)));
  run();
  return h("section", { class: "view narrow" }, head("Generador de claves", "Toca la contraseña para copiarla."),
    h("div", { class: "panel" }, seg, out, meter, info,
      h("div", { class: "gen-len" }, h("span", {}, "Longitud "), lenLbl), range,
      h("div", { class: "toggles" }, tog("lower", "Minúsculas"), tog("upper", "Mayúsculas"), tog("digits", "Números"), tog("symbols", "Símbolos")),
      h("div", { class: "row" }, h("button", { class: "primary", onclick: run }, "Generar otra"),
        h("button", { class: "ghost", onclick: () => editor("Nueva contraseña", LOGIN_DEFS, { password: out.textContent }, "login") }, "Guardar como contraseña"))));
}

// ───────────────────────── REGISTRO ─────────────────────────
function vLog() {
  const list = h("div", { class: "log" }, h("p", { class: "muted" }, "Cargando…"));
  const NAMES = { entrada: "Entrada correcta", fallo: "Intento fallido", bloqueo: "Bloqueo", creada: "Bóveda creada" };
  S.getLog(80).then((rows) => [...rows, ...st.fails.map((f) => ({ ...f, type: "fallo" }))].sort((a, b) => b.at - a.at)).then((rows) => list.replaceChildren(...(rows.length ? rows.map((r) =>
    h("div", { class: `log-row ${r.type}` }, h("i", { "aria-hidden": "true" }), h("strong", {}, NAMES[r.type] || r.type), h("span", { class: "muted" }, r.device), h("time", {}, fmtDate(r.at))))
    : [h("p", { class: "muted" }, "Sin registros.")]))).catch((e) => list.replaceChildren(h("p", { class: "err-text" }, e.message)));
  return h("section", { class: "view" }, head("Registro de entradas", "Cada entrada, fallo y bloqueo de tu bóveda."), list);
}

// ───────────────────────── AJUSTES ─────────────────────────
function vSettings() {
  const sel = h("select", { id: "lockm" }, ...[1, 2, 5, 10, 15, 30].map((m) => h("option", { value: m, selected: settings.lockMinutes === m }, `${m} min`)));
  sel.onchange = () => { settings.lockMinutes = +sel.value; saveSettings(); armIdle(); toast("Ajuste guardado"); };
  const clip = h("select", { id: "clips" }, ...[15, 30, 60].map((s) => h("option", { value: s, selected: settings.clipSeconds === s }, `${s} s`)));
  clip.onchange = () => { settings.clipSeconds = +clip.value; saveSettings(); toast("Ajuste guardado"); };
  return h("section", { class: "view narrow" }, head("Ajustes"),
    h("div", { class: "panel" },
      h("div", { class: "set" }, h("label", { for: "lockm" }, "Bloquear tras inactividad"), sel),
      h("div", { class: "set" }, h("label", { for: "clips" }, "Borrar portapapeles tras"), clip),
      h("p", { class: "muted small" }, `Tras ${MAX_FAILS} intentos fallidos la bóveda se bloquea 5 min, y el tiempo se duplica con cada fallo extra.`)),
    h("div", { class: "panel" },
      h("h3", {}, "Copia de seguridad"),
      h("p", { class: "muted small" }, "Descarga todo tal como está en Firebase: cifrado. Solo se puede abrir con tu contraseña y tu archivo llave."),
      h("button", { class: "ghost", onclick: async () => {
        const items = await S.listItems();
        downloadJSON({ type: "cortex-backup", v: 1, at: new Date().toISOString(), keyId: st.keyId, items }, `cortex-copia-${new Date().toISOString().slice(0, 10)}.json`);
      } }, ico("dl"), h("span", {}, "Descargar copia cifrada"))),
    h("div", { class: "panel" },
      h("h3", {}, "Sesión"), h("p", { class: "muted small" }, `Archivo llave: ${st.keyId.slice(0, 6)}…`),
      h("div", { class: "row" }, h("button", { class: "ghost", onclick: () => lock("Bóveda bloqueada") }, "Bloquear ahora"),
        h("button", { class: "danger ghost", onclick: () => lock("Sesión cerrada") }, "Cerrar sesión"))));
}
