// Apps de CORTEX OS. Cada una devuelve su contenido para la ventana.
import * as C from "./crypto.js";
import * as S from "./store.js";
import { ID_TEMPLATES, tpl } from "./templates.js";
import { st, settings, saveSettings, saveItem, deleteItem, byKind, trashItem, restoreItem, trashed, emptyTrash, toggleFav, TRASH_DAYS } from "./state.js";
import { h, ico, $, toast, copy, modal, closeModal, confirmBox, promptBox, fmtDate, fmtDay, fmtSize, downloadJSON, hexShort, popMenu, bindMenu, relTime } from "./ui.js";
import { openApp, refreshApp, refreshAll, closeAll, setWallpaper, isMobile, openPalette, resetIcons } from "./os.js";
import { sphere } from "./sphere.js";

let lockFn = () => {};
export function setLock(fn) { lockFn = fn; }
export const MAX_FAILS = 5;
const QUOTA = 1024 * 1024 * 1024; // 1 GiB del plan gratuito

// ───────────────────────── piezas comunes ─────────────────────────
const head = (title, sub, ...actions) => h("div", { class: "app-head" },
  h("div", {}, h("h2", {}, title), sub && h("p", { class: "muted" }, sub)), h("div", { class: "row" }, ...actions));
const btn = (label, icon, onclick, cls = "primary") => h("button", { class: cls, onclick }, icon && ico(icon), h("span", {}, label));
const empty = (text, action) => h("div", { class: "empty" }, h("div", { class: "empty-glyph" }, "[ ∅ ]"), h("p", {}, text), action);
function searchBox(ctx, onInput, placeholder = "Buscar") {
  const i = h("input", { type: "search", placeholder, value: ctx.state.q || "", "aria-label": placeholder, spellcheck: "false" });
  i.addEventListener("input", () => { ctx.state.q = i.value; onInput(); });
  return h("label", { class: "search" }, ico("search"), i);
}
const matches = (ctx, it, ...keys) => { const q = (ctx.state.q || "").toLowerCase(); return !q || keys.some((k) => String(it[k] || "").toLowerCase().includes(q)); };
function chips(ctx, options, onPick) {
  ctx.state.filter ??= options[0][0];
  return h("div", { class: "chips", role: "tablist" }, ...options.map(([id, label, n]) =>
    h("button", { role: "tab", class: ctx.state.filter === id ? "on" : "", "aria-selected": ctx.state.filter === id, onclick: () => { ctx.state.filter = id; onPick(); } },
      label, n != null && h("b", {}, n))));
}
const nameOf = (it) => it.title || it.name || it.label || (it.kind === "id" ? tpl(it.template).name : "") || it.issuer || "Elemento";

function field(label, value, { secret = false, mono = false, href } = {}) {
  if (!value) return null;
  const val = h("span", { class: `val ${mono ? "mono" : ""} ${secret ? "masked" : ""}` }, secret ? "••••••••••••" : value);
  let shown = false;
  return h("div", { class: "field" },
    h("small", {}, label),
    h("div", { class: "field-row" },
      href ? h("a", { class: "val", href, target: "_blank", rel: "noopener noreferrer" }, value) : val,
      secret && h("button", { class: "icon-btn sm", "aria-label": "Mostrar", onclick: () => { shown = !shown; val.textContent = shown ? value : "••••••••••••"; val.classList.toggle("masked", !shown); } }, ico("eye")),
      h("button", { class: "icon-btn sm", "aria-label": `Copiar ${label}`, onclick: () => copy(value, label) }, ico("copy"))));
}

function formFields(defs, data) {
  const inputs = {};
  const els = defs.map(([name, label, type]) => {
    const id = `f_${name}`;
    let input;
    if (type === "area") input = h("textarea", { id, rows: 5, spellcheck: "false" });
    else input = h("input", { id, type: type === "secret" ? "password" : type || "text", autocomplete: "off", spellcheck: "false" });
    input.value = data[name] || "";
    inputs[name] = input;
    const wrap = h("div", { class: `f ${type === "area" ? "full" : ""}` }, h("label", { for: id }, label), input);
    if (type === "secret") {
      const meter = h("div", { class: "meter" }, h("i"));
      const upd = () => { meter.dataset.score = input.value ? C.strength(input.value).score : 0; };
      input.addEventListener("input", upd); upd();
      wrap.append(h("div", { class: "inline-tools" },
        h("button", { type: "button", class: "icon-btn sm", "aria-label": "Mostrar", onclick: () => { input.type = input.type === "password" ? "text" : "password"; } }, ico("eye")),
        h("button", { type: "button", class: "icon-btn sm", "aria-label": "Generar contraseña", onclick: () => { input.value = C.generatePassword({ length: 20 }); input.type = "text"; upd(); } }, ico("gen"))), meter);
    }
    return wrap;
  });
  return { els, inputs, read: () => Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value.trim()])) };
}

function editor(title, defs, item, kind, extra = {}) {
  const f = formFields(defs, item || {});
  const save = h("button", { class: "primary", type: "submit" }, ico("lock"), h("span", {}, "Guardar cifrado"));
  const form = h("form", { class: "form", onsubmit: async (e) => {
    e.preventDefault(); save.disabled = true;
    try {
      const data = f.read();
      const prev = item?.password;
      const out = { ...(item || {}), ...extra, ...data, kind };
      if (kind === "login" && data.password !== prev) out.pwChanged = Date.now();
      await saveItem(out); closeModal(); toast("Guardado y cifrado");
    } catch (err) { toast(err.message, "err"); save.disabled = false; }
  } }, h("div", { class: "fgrid" }, ...f.els),
    h("div", { class: "row end" },
      item?.id && h("button", { type: "button", class: "danger ghost", onclick: () => { closeModal(); trash(item); } }, ico("trash"), h("span", {}, "A la papelera")),
      save));
  modal(title, form, { wide: defs.length > 4 });
  return f;
}

// Papelera con "Deshacer"
export async function trash(it) {
  await trashItem(it);
  toast(`«${nameOf(it)}» movido a la papelera`, "", ["Deshacer", () => { const cur = st.items.get(it.id); if (cur) restoreItem(cur); }]);
}
const favEntry = (it) => [it.fav ? "Quitar de favoritos" : "Añadir a favoritos", it.fav ? "starf" : "star", () => toggleFav(it)];
const trashEntry = (it) => ["Mover a la papelera", "trash", () => trash(it), "danger-item", "Supr"];
// Teclado: Supr manda a la papelera, Intro abre
function keys(el, it, open) {
  el.tabIndex = 0;
  el.addEventListener("keydown", (e) => {
    if (e.target !== el) return;
    if (e.key === "Delete") { e.preventDefault(); trash(it); }
    else if (e.key === "Enter") { e.preventDefault(); open?.(); }
  });
}

// ───────────────────────── CONTRASEÑAS ─────────────────────────
const LOGIN_DEFS = [["title", "Nombre (p. ej. Instagram)"], ["username", "Usuario o correo"], ["password", "Contraseña", "secret"], ["url", "Web"], ["notes", "Notas", "area"]];
export const newLogin = (pre = {}) => editor("Nueva contraseña", LOGIN_DEFS, Object.keys(pre).length ? pre : null, "login");
export const editLogin = (l) => editor(`Editar · ${l.title || "contraseña"}`, LOGIN_DEFS, l, "login");
function reuseMap() { const m = {}; byKind("login").forEach((l) => l.password && (m[l.password] = (m[l.password] || 0) + 1)); return m; }
function appLogins(ctx) {
  const list = h("div", { class: "list" });
  const chipHost = h("div");
  const draw = () => {
    const all = byKind("login"), reuse = reuseMap();
    const weak = (l) => C.strength(l.password).score <= 2;
    const filters = { all: () => true, fav: (l) => l.fav, weak, reused: (l) => reuse[l.password] > 1 };
    chipHost.replaceChildren(chips(ctx, [["all", "Todas", all.length], ["fav", "Favoritas", all.filter((l) => l.fav).length], ["weak", "Débiles", all.filter(weak).length], ["reused", "Repetidas", all.filter(filters.reused).length]], draw));
    const items = all.filter(filters[ctx.state.filter] || filters.all).filter((l) => matches(ctx, l, "title", "username", "url"));
    list.replaceChildren(...(items.length ? items.map((l) => loginRow(l, reuse)) : [empty(ctx.state.q || ctx.state.filter !== "all" ? "Nada que mostrar con este filtro." : "Aún no hay contraseñas guardadas.", !ctx.state.q && ctx.state.filter === "all" && btn("Añadir la primera", "plus", () => newLogin()))]));
  };
  draw();
  return h("div", { class: "app" }, head("Contraseñas", "Clic derecho en una fila para más opciones", btn("Nueva", "plus", () => newLogin())), searchBox(ctx, draw, "Buscar por nombre, usuario o web"), chipHost, list);
}
function loginRow(l, reuse) {
  const s = C.strength(l.password);
  const old = l.pwChanged && Date.now() - l.pwChanged > 365 * 864e5;
  const url = l.url && (/^https?:/i.test(l.url) ? l.url : `https://${l.url}`);
  const el = h("article", { class: `item ${l.fav ? "is-fav" : ""}` },
    h("div", { class: "avatar" }, (l.title || "?")[0].toUpperCase()),
    h("div", { class: "item-main" },
      h("div", { class: "item-title" },
        h("strong", {}, l.title || "Sin nombre"),
        l.fav && h("span", { class: "fav-star", title: "Favorita" }, ico("starf")),
        h("span", { class: `badge s${s.score}` }, s.label),
        reuse[l.password] > 1 && h("span", { class: "badge warn" }, "Repetida"),
        old && h("span", { class: "badge" }, "+1 año sin cambiar")),
      h("div", { class: "fields-inline" },
        field("Usuario", l.username), field("Contraseña", l.password, { secret: true, mono: true }),
        url && field("Web", l.url, { href: url })),
      h("small", { class: "item-meta" }, `Actualizada ${relTime(l.updated)}`)),
    h("div", { class: "item-acts" },
      h("button", { class: "icon-btn", "aria-label": l.fav ? "Quitar de favoritos" : "Añadir a favoritos", onclick: () => toggleFav(l) }, ico(l.fav ? "starf" : "star")),
      h("button", { class: "icon-btn", "aria-label": "Editar", onclick: () => editLogin(l) }, ico("edit"))));
  bindMenu(el, () => [
    ["Copiar usuario", "user", () => copy(l.username, "Usuario")],
    ["Copiar contraseña", "key", () => copy(l.password, "Contraseña")],
    url && ["Abrir web", "link", () => window.open(url, "_blank", "noopener,noreferrer")],
    ["Editar", "edit", () => editLogin(l)],
    "-", favEntry(l), trashEntry(l)], l.title);
  keys(el, l, () => editLogin(l));
  return el;
}

// ───────────────────────── TARJETAS ─────────────────────────
const CARD_DEFS = [["label", "Nombre de la tarjeta (p. ej. Banco principal)"], ["holder", "Titular"], ["number", "Número"], ["expiry", "Caducidad (MM/AA)"], ["cvv", "CVV (opcional, no recomendado)", "secret"], ["notes", "Notas", "area"]];
const groupNum = (n = "") => n.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();
const newCard = () => editor("Nueva tarjeta", CARD_DEFS, null, "card");
function appCards() {
  const cards = byKind("card");
  return h("div", { class: "app" },
    head("Tarjetas", "Toca un dato para copiarlo · clic derecho para más opciones", btn("Nueva tarjeta", "plus", newCard)),
    h("div", { class: "cards" },
      ...(cards.length ? cards.map(cardView) : [cardView({ label: "Plantilla", holder: "TU NOMBRE", number: "0000000000000000", expiry: "MM/AA", demo: true })]),
      h("button", { class: "add-tile card-add", onclick: newCard }, h("span", { class: "add-plus" }, ico("plus")), h("span", {}, "Añadir tarjeta"))));
}
function cardView(c) {
  let reveal = false;
  const digits = (c.number || "").replace(/\D/g, "");
  const num = h("button", { class: "cc-num", onclick: () => !c.demo && copy(digits, "Número") });
  const paint = () => { num.textContent = reveal || c.demo ? groupNum(digits) : `•••• •••• •••• ${digits.slice(-4)}`; };
  paint();
  const tap = (label, val, cls) => h("button", { class: cls, onclick: () => !c.demo && copy(val, label) }, val || "—");
  const exp = /^(\d{2})\/(\d{2})$/.exec(c.expiry || "");
  const expired = exp && new Date(2000 + +exp[2], +exp[1], 0) < new Date();
  const cc = h("div", { class: "cc" },
    h("div", { class: "cc-shine", "aria-hidden": "true" }),
    h("div", { class: "cc-top" }, tap("Nombre", c.label, "cc-label"), h("span", { class: "cc-wave" }, ico("wave"))),
    h("div", { class: "chip", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i")),
    num,
    h("div", { class: "cc-bottom" },
      h("div", {}, h("small", {}, "Titular"), tap("Titular", c.holder, "cc-holder")),
      h("div", {}, h("small", {}, "Caduca"), tap("Caducidad", c.expiry, "cc-exp")),
      c.cvv && h("div", {}, h("small", {}, "CVV"), h("button", { class: "cc-exp", onclick: () => copy(c.cvv, "CVV") }, "•••"))));
  cc.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const r = cc.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    cc.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
    cc.style.setProperty("--mx", `${(x + 0.5) * 100}%`); cc.style.setProperty("--my", `${(y + 0.5) * 100}%`);
  });
  cc.addEventListener("pointerleave", () => { cc.style.transform = ""; });
  const wrap = h("div", { class: "cc-wrap" }, h("div", { class: "cc-stage" }, cc),
    !c.demo && h("div", { class: "row" },
      h("button", { class: "ghost sm", onclick: () => { reveal = !reveal; paint(); } }, ico("eye"), h("span", {}, "Ver número")),
      h("button", { class: "ghost sm", onclick: () => editor("Editar tarjeta", CARD_DEFS, c, "card") }, ico("edit"), h("span", {}, "Editar")),
      expired && h("span", { class: "badge warn" }, "Caducada"), c.fav && h("span", { class: "fav-star" }, ico("starf"))),
    c.demo && h("p", { class: "muted small center" }, "Así se verá tu tarjeta. Pulsa «Nueva tarjeta» para rellenarla."));
  if (!c.demo) bindMenu(cc, () => [
    ["Copiar número", "copy", () => copy(digits, "Número")], ["Copiar titular", "user", () => copy(c.holder, "Titular")], ["Copiar caducidad", "log", () => copy(c.expiry, "Caducidad")],
    ["Editar", "edit", () => editor("Editar tarjeta", CARD_DEFS, c, "card")], "-", favEntry(c), trashEntry(c)], c.label);
  return wrap;
}

// ───────────────────────── IDENTIDAD ─────────────────────────
function appIds() {
  const mine = byKind("id");
  return h("div", { class: "app" },
    head("Identidad", mine.length ? `${mine.length} documento${mine.length > 1 ? "s" : ""} · toca un dato para copiarlo` : "Tus documentos y datos personales, cifrados.", btn("Nuevo documento", "plus", pickTemplate)),
    h("div", { class: "ids" },
      ...mine.map(idCard),
      h("button", { class: "add-tile id-add", onclick: pickTemplate, "aria-label": "Añadir documento" }, h("span", { class: "add-plus" }, ico("plus")), h("span", {}, "Añadir documento"))));
}
export function pickTemplate() {
  let group = "Todos", q = "";
  const grid = h("div", { class: "tpl-grid" });
  const tabs = h("div", { class: "seg", role: "tablist" });
  const have = new Set(byKind("id").map((d) => d.template));
  const draw = () => {
    tabs.replaceChildren(...["Todos", "España", "Rumanía", "General"].map((g) => h("button", { role: "tab", class: g === group ? "on" : "", "aria-selected": g === group, onclick: () => { group = g; draw(); } }, g)));
    const list = ID_TEMPLATES.filter((t) => (group === "Todos" || t.group === group) && (!q || `${t.name} ${t.region}`.toLowerCase().includes(q)));
    grid.replaceChildren(...list.map((t) => h("button", { class: `tpl ${t.id.includes("pas") ? "is-pass" : ""}`, onclick: () => { closeModal(); idEditor({ template: t.id }); } },
      h("div", { class: "tpl-mini", "aria-hidden": "true" }, h("i", { class: "m-photo" }), h("i", { class: "m-l1" }), h("i", { class: "m-l2" }), h("i", { class: "m-l3" })),
      h("span", { class: "tpl-name" }, t.name), h("small", {}, `${t.region} · ${t.fields.length} campos`),
      have.has(t.id) && h("span", { class: "badge tpl-have" }, "Ya tienes uno"))));
    if (!list.length) grid.append(h("p", { class: "muted" }, "No hay modelos con ese nombre."));
  };
  const s = h("input", { type: "search", placeholder: "Buscar modelo (DNI, pasaporte, CNP…)", "aria-label": "Buscar modelo" });
  s.addEventListener("input", () => { q = s.value.trim().toLowerCase(); draw(); });
  draw();
  modal("Elige un modelo", h("div", { class: "picker" }, h("label", { class: "search" }, ico("search"), s), tabs, grid), { wide: true });
}
function idCard(d) {
  const t = tpl(d.template);
  const passport = t.id.includes("pas");
  const vals = t.fields.filter(([k, , type]) => d[k] && type !== "area" && k !== t.main);
  const main = d[t.main];
  const mainLabel = t.fields.find((f) => f[0] === t.main)[1];
  const exp = d.validez || d.valabilitate;
  const left = exp ? new Date(exp) - Date.now() : null;
  const el = h("article", { class: `idc ${passport ? "passport" : ""}` },
    h("header", {},
      h("div", {}, h("small", {}, `${t.region.toUpperCase()} // FICHA CORTEX`), h("strong", {}, d.titulo || t.name)),
      h("div", { class: "row" },
        left != null && left < 0 && h("span", { class: "badge warn" }, "Caducado"),
        left != null && left >= 0 && left < 90 * 864e5 && h("span", { class: "badge warn" }, "Caduca pronto"),
        d.fav && h("span", { class: "fav-star" }, ico("starf")),
        h("button", { class: "icon-btn sm", "aria-label": "Editar", onclick: () => idEditor(d) }, ico("edit")))),
    h("div", { class: "idc-body" },
      h("div", { class: "photo" }, d.photo ? h("img", { src: d.photo, alt: "Foto" }) : h("span", {}, ico("contact"))),
      h("div", { class: "idc-fields" },
        main && h("button", { class: "idc-main", onclick: () => copy(main, mainLabel) }, main),
        ...vals.map(([k, label, type]) => h("button", { class: "idc-f", onclick: () => copy(d[k], label) }, h("small", {}, label), h("span", {}, type === "date" ? fmtDay(d[k]) : d[k]))))),
    h("footer", { class: "idc-foot" }, h("span", {}, "Ficha de consulta personal · no es un documento oficial"), h("span", { class: "mono" }, `#${(d.id || "").slice(0, 6)}`)));
  bindMenu(el, () => [
    main && [`Copiar ${mainLabel}`, "copy", () => copy(main, mainLabel)],
    ["Copiar todos los datos", "note", () => copy([`${t.name} (${t.region})`, ...t.fields.filter(([k]) => d[k]).map(([k, l, ty]) => `${l}: ${ty === "date" ? fmtDay(d[k]) : d[k]}`)].join("\n"), "Datos")],
    ["Editar", "edit", () => idEditor(d)], "-", favEntry(d), trashEntry(d)], d.titulo || t.name);
  keys(el, d, () => idEditor(d));
  return el;
}
export function idEditor(d) {
  const t = tpl(d.template);
  let photo = d.photo || "";
  const preview = h("div", { class: "photo big" }, photo ? h("img", { src: photo, alt: "Foto" }) : h("span", {}, ico("contact")));
  const pIn = h("input", { type: "file", accept: "image/*", class: "sr", id: "photoin" });
  pIn.onchange = async () => { const f = pIn.files[0]; if (!f) return; photo = await shrinkImage(f, 360); preview.replaceChildren(h("img", { src: photo, alt: "Foto" })); };
  const fx = formFields(t.fields, d);
  const save = h("button", { class: "primary", type: "submit" }, ico("lock"), h("span", {}, "Guardar cifrado"));
  const form = h("form", { class: "form", onsubmit: async (e) => {
    e.preventDefault(); save.disabled = true;
    try { await saveItem({ ...d, ...fx.read(), photo, template: t.id, kind: "id" }); closeModal(); toast("Ficha guardada y cifrada"); }
    catch (err) { toast(err.message, "err"); save.disabled = false; }
  } },
    h("div", { class: "photo-row" }, preview, h("div", {},
      h("label", { class: "ghost sm btnlike", for: "photoin" }, ico("up"), h("span", {}, photo ? "Cambiar foto" : "Añadir foto")), pIn,
      h("p", { class: "muted small" }, "Opcional. Se guarda cifrada y en blanco y negro."))),
    h("div", { class: "fgrid" }, ...fx.els),
    h("div", { class: "row end" },
      d.id && h("button", { type: "button", class: "danger ghost", onclick: () => { closeModal(); trash(d); } }, ico("trash"), h("span", {}, "A la papelera")),
      save));
  modal(`${t.name} · ${t.region}`, form, { wide: true });
}
function shrinkImage(file, max, q = 0.82) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const s = Math.min(1, max / Math.max(img.width, img.height));
      const cv = h("canvas", { width: Math.max(1, Math.round(img.width * s)), height: Math.max(1, Math.round(img.height * s)) });
      cv.getContext("2d").drawImage(img, 0, 0, cv.width, cv.height);
      URL.revokeObjectURL(url); res(cv.toDataURL("image/jpeg", q));
    };
    img.onerror = () => { URL.revokeObjectURL(url); rej(new Error("No se pudo leer la imagen")); };
    img.src = url;
  });
}

// ───────────────────────── DRIVE ─────────────────────────
const fileType = (t = "", n = "") => t.startsWith("image/") ? ["img", "IMG"] : t.startsWith("video/") ? ["vid", "VID"] : t === "application/pdf" ? ["pdf", "PDF"] : t.startsWith("audio/") ? ["aud", "AUD"] : ["file", (n.split(".").pop() || "DOC").slice(0, 4).toUpperCase()];
const live = (i) => (i.kind === "folder" || i.kind === "file") && !i.trashed;
const children = (parent) => [...st.items.values()].filter((i) => live(i) && (i.parent || null) === parent);
function pathOf(folderId) {
  const out = []; let cur = folderId ? st.items.get(folderId) : null; let guard = 0;
  while (cur && guard++ < 50) { out.unshift(cur); cur = cur.parent ? st.items.get(cur.parent) : null; }
  return out;
}
function folderSize(id) { return children(id).reduce((a, c) => a + (c.kind === "file" ? c.size || 0 : folderSize(c.id)), 0); }
function isInside(id, ancestor) { let cur = st.items.get(id); let g = 0; while (cur && g++ < 50) { if (cur.parent === ancestor) return true; cur = cur.parent ? st.items.get(cur.parent) : null; } return false; }
const SORTS = { name: ["Nombre", (a, b) => a.name.localeCompare(b.name, "es")], date: ["Más recientes", (a, b) => (b.updated || 0) - (a.updated || 0)], size: ["Tamaño", (a, b) => (b.kind === "file" ? b.size : folderSize(b.id)) - (a.kind === "file" ? a.size : folderSize(a.id))] };

function appDrive(ctx) {
  const s = ctx.state;
  s.folder ??= null; s.view ??= "grid"; s.sort ??= "name";
  if (s.folder && (!st.items.has(s.folder) || st.items.get(s.folder).trashed)) s.folder = null;
  const used = [...st.items.values()].filter((i) => i.kind === "file").reduce((a, f) => a + (f.size || 0), 0);
  const goto = (id) => { s.folder = id; s.q = ""; ctx.refresh(); };

  const input = h("input", { type: "file", multiple: true, class: "sr", id: `up-${ctx.id}` });
  input.onchange = () => { uploadFiles([...input.files], s.folder); input.value = ""; };
  ctx.upload = () => input.click();

  const crumbs = h("nav", { class: "crumbs", "aria-label": "Ruta" },
    crumbBtn("Mi unidad", null, goto),
    ...pathOf(s.folder).flatMap((f) => [ico("chev", "sep"), crumbBtn(f.name, f.id, goto)]));

  const content = h("div", { class: `drive-${s.view}` });
  const draw = () => {
    const q = (s.q || "").toLowerCase();
    let list = q ? [...st.items.values()].filter((i) => live(i) && i.name.toLowerCase().includes(q)) : children(s.folder);
    const cmp = SORTS[s.sort][1];
    list = list.sort((a, b) => (a.kind === b.kind ? cmp(a, b) : a.kind === "folder" ? -1 : 1));
    content.replaceChildren(...(list.length ? list.map((it) => driveTile(it, ctx, goto))
      : [empty(q ? "Nada coincide con la búsqueda." : "Esta carpeta está vacía. Arrastra archivos aquí o crea una carpeta.", !q && h("div", { class: "row center" }, btn("Subir archivos", "up", () => input.click()), btn("Nueva carpeta", "folder", () => newFolder(s.folder), "ghost")))]));
  };
  draw();
  const sortBtn = h("button", { class: "ghost sm", onclick: (e) => { const r = e.currentTarget.getBoundingClientRect(); popMenu(r.left, r.bottom + 4, Object.entries(SORTS).map(([k, [l]]) => [l + (s.sort === k ? "  ✓" : ""), "sort", () => { s.sort = k; ctx.refresh(); }]), "Ordenar por"); } }, ico("sort"), h("span", {}, SORTS[s.sort][0]));

  const root = h("div", { class: "app drive" },
    h("div", { class: "drive-top" },
      crumbs,
      h("div", { class: "row" },
        btn("Carpeta", "folder", () => newFolder(s.folder), "ghost sm"),
        btn("Subir", "up", () => input.click(), "primary sm"))),
    h("div", { class: "drive-bar" }, searchBox(ctx, draw, "Buscar en todo el drive"), sortBtn,
      h("div", { class: "seg mini" },
        h("button", { class: s.view === "grid" ? "on" : "", "aria-label": "Cuadrícula", onclick: () => { s.view = "grid"; ctx.refresh(); } }, ico("grid")),
        h("button", { class: s.view === "list" ? "on" : "", "aria-label": "Lista", onclick: () => { s.view = "list"; ctx.refresh(); } }, ico("list"))),
      h("div", { class: "quota", title: `${fmtSize(used)} de 1 GB` }, h("div", { class: "meter" }, h("i", { style: `width:${Math.max(1, (used / QUOTA) * 100)}%` })), h("small", { class: "muted" }, `${fmtSize(used)} / 1 GB`))),
    h("p", { class: "hint muted small" }, isMobile() ? "Mantén pulsado un elemento para moverlo a otra carpeta · ⋯ para más opciones" : "Mantén pulsado y arrastra para mover · clic derecho para más opciones"),
    input, content,
    h("div", { class: "drop-veil", "aria-hidden": "true" }, ico("up"), h("span", {}, "Suelta para subir y cifrar")));

  bindMenu(root, () => [["Nueva carpeta", "folder", () => newFolder(s.folder)], ["Subir archivos", "up", () => input.click()], "-", ["Vista " + (s.view === "grid" ? "de lista" : "en cuadrícula"), s.view === "grid" ? "list" : "grid", () => { s.view = s.view === "grid" ? "list" : "grid"; ctx.refresh(); }]], "Drive");
  // Archivos arrastrados desde el ordenador
  let depth = 0;
  root.addEventListener("dragenter", (e) => { if ([...e.dataTransfer.types].includes("Files")) { depth++; root.classList.add("dropping"); } });
  root.addEventListener("dragleave", () => { if (--depth <= 0) { depth = 0; root.classList.remove("dropping"); } });
  root.addEventListener("dragover", (e) => { if ([...e.dataTransfer.types].includes("Files")) e.preventDefault(); });
  root.addEventListener("drop", (e) => {
    if (!e.dataTransfer.files.length) return;
    e.preventDefault(); depth = 0; root.classList.remove("dropping");
    uploadFiles([...e.dataTransfer.files], s.folder);
  });
  return root;
}
function crumbBtn(label, id, goto) { return h("button", { class: "crumb", "data-drop": id || "root", onclick: () => goto(id) }, label); }
async function moveItem(it, dest) {
  if (!it || (it.parent || null) === dest) return;
  if (it.id === dest || (it.kind === "folder" && dest && isInside(dest, it.id))) return toast("No puedes mover una carpeta dentro de sí misma", "err");
  const from = it.parent || null;
  await saveItem({ ...it, parent: dest });
  toast(`«${it.name}» movido a ${dest ? st.items.get(dest).name : "Mi unidad"}`, "", ["Deshacer", () => { const cur = st.items.get(it.id); if (cur) saveItem({ ...cur, parent: from }); }]);
}

// Mantener pulsado para coger un elemento y soltarlo en una carpeta (ratón y táctil)
function holdToMove(el, it, onTap) {
  let timer = null, sx = 0, sy = 0, dragging = false, ghost = null, target = null, pid = null, suppress = false;
  const blockScroll = (e) => { if (dragging) e.preventDefault(); };
  const begin = (e) => {
    dragging = true; timer = null;
    navigator.vibrate?.(15);
    el.classList.add("dragged");
    document.body.classList.add("is-dragging");
    const [icon] = it.kind === "folder" ? ["folder"] : fileType(it.type, it.name);
    ghost = h("div", { class: "drag-ghost" }, ico(icon), h("span", {}, it.name));
    document.body.append(ghost);
    move(e);
    addEventListener("touchmove", blockScroll, { passive: false });
  };
  const move = (e) => {
    if (!dragging) return;
    ghost.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 10}px)`;
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-drop]");
    const ok = under && under !== el && under.dataset.drop !== it.id;
    if (target !== under) { target?.classList.remove("target"); target = ok ? under : null; target?.classList.add("target"); }
  };
  const end = async () => {
    clearTimeout(timer); timer = null;
    if (!dragging) return;
    dragging = false; suppress = true;
    removeEventListener("touchmove", blockScroll);
    el.classList.remove("dragged"); document.body.classList.remove("is-dragging");
    ghost?.remove(); ghost = null;
    const t = target; target?.classList.remove("target"); target = null;
    if (!t) return;
    const d = t.dataset.drop;
    if (d === "__trash") return trash(it);
    await moveItem(it, d === "root" ? null : d);
  };
  el.addEventListener("pointerdown", (e) => {
    if (e.button !== 0 || e.target.closest(".tile-more")) return;
    sx = e.clientX; sy = e.clientY; pid = e.pointerId; suppress = false;
    timer = setTimeout(() => { try { el.setPointerCapture(pid); } catch {} begin({ clientX: sx, clientY: sy }); }, 380);
  });
  el.addEventListener("pointermove", (e) => {
    if (dragging) return move(e);
    if (!timer) return;
    const dist = Math.hypot(e.clientX - sx, e.clientY - sy);
    if (e.pointerType === "mouse" && dist > 7) { clearTimeout(timer); timer = null; try { el.setPointerCapture(e.pointerId); } catch {} begin(e); }
    else if (e.pointerType !== "mouse" && dist > 10) { clearTimeout(timer); timer = null; } // es un desplazamiento
  });
  el.addEventListener("pointerup", end);
  el.addEventListener("pointercancel", () => { if (dragging) { target = null; end(); } else { clearTimeout(timer); timer = null; } });
  el.addEventListener("click", (e) => { if (suppress) { suppress = false; e.stopImmediatePropagation(); e.preventDefault(); return; } if (!e.target.closest(".tile-more")) onTap(); });
  el.addEventListener("dragstart", (e) => e.preventDefault());
}

function driveTile(it, ctx, goto) {
  const folder = it.kind === "folder";
  const [icon, tag] = folder ? ["folder", ""] : fileType(it.type, it.name);
  const count = folder ? children(it.id).length : 0;
  const open = () => (folder ? goto(it.id) : openFile(it));
  const entries = () => [
    [folder ? "Abrir" : "Ver", folder ? "folder" : "eye", open],
    !folder && ["Descargar", "dl", () => openFile(it, true)],
    ["Renombrar", "rename", async () => { const n = await promptBox("Renombrar", "Nuevo nombre", it.name); if (n) { await saveItem({ ...it, name: n }); toast("Renombrado"); } }],
    ["Mover a…", "move", () => moveDialog(it)],
    "-", favEntry(it),
    ["Mover a la papelera", "trash", () => trash(it), "danger-item", "Supr"],
  ];
  const more = h("button", { class: "icon-btn sm tile-more", "aria-label": "Más opciones", onclick: (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); popMenu(r.left, r.bottom + 4, entries(), it.name); } }, ico("more"));
  const el = h("div", { class: `tile ${folder ? "is-folder" : ""} ${it.fav ? "is-fav" : ""}`, role: "button", "aria-label": it.name, "data-drop": folder ? it.id : null },
    h("div", { class: "tile-ico" }, it.thumb ? h("img", { src: it.thumb, alt: "", draggable: "false" }) : ico(icon), tag && h("b", {}, tag), it.fav && h("span", { class: "tile-star" }, ico("starf"))),
    h("div", { class: "tile-txt" }, h("strong", {}, it.name),
      h("small", { class: "muted" }, folder ? `${count} elemento${count === 1 ? "" : "s"} · ${fmtSize(folderSize(it.id))}` : `${fmtSize(it.size)} · ${relTime(it.updated)}`)),
    more);
  el.addEventListener("contextmenu", (e) => { e.preventDefault(); e.stopPropagation(); popMenu(e.clientX, e.clientY, entries(), it.name); });
  holdToMove(el, it, open);
  keys(el, it, open);
  return el;
}
export async function newFolder(parent) {
  const name = await promptBox("Nueva carpeta", "Nombre de la carpeta", "", "Crear");
  if (!name) return;
  await saveItem({ kind: "folder", name, parent: parent || null });
  toast(`Carpeta «${name}» creada`);
}
function moveDialog(it) {
  const tree = h("div", { class: "tree" });
  const row = (id, name, depth) => {
    const disabled = id === it.id || (it.kind === "folder" && id && isInside(id, it.id)) || (it.parent || null) === id;
    return h("button", { class: "tree-row", disabled, style: `--d:${depth}`, onclick: async () => { closeModal(); await moveItem(it, id); } }, ico(id ? "folder" : "drive"), h("span", {}, name));
  };
  const walk = (parent, depth) => children(parent).filter((c) => c.kind === "folder" && c.id !== it.id).sort((a, b) => a.name.localeCompare(b.name, "es"))
    .flatMap((f) => [row(f.id, f.name, depth), ...walk(f.id, depth + 1)]);
  tree.append(row(null, "Mi unidad", 0), ...walk(null, 1));
  modal(`Mover «${it.name}»`, tree);
}
export async function uploadFiles(files, parent = null) {
  for (const file of files) {
    if (file.size > S.MAX_FILE) { toast(`${file.name} supera ${fmtSize(S.MAX_FILE)}`, "err"); continue; }
    const bar = h("div", { class: "meter" }, h("i"));
    const label = h("span", {}, `Cifrando ${file.name}`);
    const t = h("div", { class: "toast sticky" }, h("span", { class: "toast-tag" }, "UP"), h("div", { class: "grow" }, label, bar));
    $("#toasts").append(t);
    try {
      const buf = new Uint8Array(await file.arrayBuffer());
      const fileId = C.randomBytes(8).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
      const chunks = [];
      let i = 0;
      do {
        chunks.push(await C.encryptBytes(st.key, buf.subarray(i, i + S.CHUNK)));
        i += S.CHUNK;
        bar.firstChild.style.width = `${Math.min(100, (i / Math.max(buf.length, 1)) * 50)}%`;
      } while (i < buf.length);
      label.textContent = `Subiendo ${file.name}`;
      await S.putChunks(fileId, chunks);
      bar.firstChild.style.width = "100%";
      let thumb;
      if (file.type.startsWith("image/") && file.size < 15 * 1024 * 1024) thumb = await shrinkImage(file, 260, 0.7).catch(() => undefined);
      await saveItem({ kind: "file", name: file.name, type: file.type, size: file.size, fileId, chunks: chunks.length, parent: parent || null, thumb });
      toast(`${file.name} cifrado y guardado`);
    } catch (e) { toast(`Error con ${file.name}: ${e.message}`, "err"); }
    t.remove();
  }
}
export async function openFile(f, download = false) {
  toast(`Descifrando ${f.name}…`);
  try {
    const parts = [];
    for (let i = 0; i < f.chunks; i++) { const c = await S.getChunk(f.fileId, i); parts.push(await C.decryptBytes(st.key, c.iv, c.ct)); }
    const blob = new Blob(parts, { type: f.type || "application/octet-stream" });
    const url = URL.createObjectURL(blob);
    if (download) { const a = h("a", { href: url, download: f.name }); document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 4000); return; }
    const t = f.type || "";
    let view;
    if (t.startsWith("image/")) view = h("img", { src: url, alt: f.name, class: "pv", "data-url": url });
    else if (t.startsWith("video/")) view = h("video", { src: url, controls: true, class: "pv", "data-url": url });
    else if (t.startsWith("audio/")) view = h("audio", { src: url, controls: true, "data-url": url });
    else if (t === "application/pdf") view = h("iframe", { src: url, class: "pv pdf", title: f.name, "data-url": url });
    else if (t.startsWith("text/") || /\.(txt|md|csv|json)$/i.test(f.name)) view = h("pre", { class: "pv-text", "data-url": url }, (await blob.text()).slice(0, 200000));
    else view = h("p", { class: "muted", "data-url": url }, "Este tipo de archivo no se puede previsualizar. Descárgalo para abrirlo.");
    modal(f.name, h("div", {}, view, h("div", { class: "row end" },
      h("span", { class: "muted small grow" }, `${fmtSize(f.size)} · subido ${relTime(f.updated)}`),
      h("a", { class: "primary btnlike", href: url, download: f.name }, ico("dl"), h("span", {}, "Descargar")))), { wide: true });
  } catch (e) { toast(e.message, "err"); }
}

// ───────────────────────── AUTENTICADOR 2FA ─────────────────────────
const OTP_DEFS = [["issuer", "Servicio (p. ej. Instagram)"], ["account", "Cuenta o correo"], ["secret", "Clave secreta o enlace otpauth://", "secret"]];
export function otpEditor(item) {
  const f = editor(item ? "Editar código 2FA" : "Nuevo código 2FA", OTP_DEFS, item, "totp");
  const sec = f.inputs.secret;
  sec.closest(".f").querySelector(".inline-tools button:last-child")?.remove();
  sec.closest(".f").querySelector(".meter")?.remove();
  sec.addEventListener("input", () => {
    const v = sec.value.trim();
    if (v.startsWith("otpauth://")) {
      try { const p = C.parseOtpAuth(v); sec.value = p.secret; if (!f.inputs.issuer.value) f.inputs.issuer.value = p.issuer; if (!f.inputs.account.value) f.inputs.account.value = p.account; toast("Enlace leído"); }
      catch (e) { toast(e.message, "err"); }
    }
  });
  const form = sec.closest("form");
  form.querySelector(".fgrid").after(h("p", { class: "muted small" }, "En la web del servicio, al activar la verificación en dos pasos, elige «introducir la clave manualmente» y pégala aquí. CORTEX generará los códigos de 6 cifras."));
  form.addEventListener("submit", async (e) => {
    try { await C.totp(sec.value); } catch (err) { e.stopImmediatePropagation(); e.preventDefault(); toast(err.message, "err"); }
  }, true);
}
function ring(p) {
  const r = 15, c = 2 * Math.PI * r;
  return h("span", { class: "ring", html: `<svg viewBox="0 0 36 36"><circle cx="18" cy="18" r="${r}" class="ring-bg"/><circle cx="18" cy="18" r="${r}" class="ring-fg" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - p)}"/></svg>` });
}
// Pinta códigos vivos dentro de un contenedor; se para solo cuando el contenedor desaparece
function liveCodes(host, items, render) {
  let last = "";
  const tick = async () => {
    if (!host.isConnected && last) return clearInterval(iv);
    const now = Date.now();
    const rows = await Promise.all(items.map(async (it) => {
      let code = "------";
      try { code = await C.totp(it.secret, { digits: it.digits || 6, period: it.period || 30, algo: it.algo || "SHA-1" }); } catch {}
      const per = (it.period || 30) * 1000;
      return { it, code, left: per - (now % per), per };
    }));
    last = "x";
    host.replaceChildren(...rows.map(render));
  };
  const iv = setInterval(tick, 1000);
  tick();
}
const fmtCode = (c) => c.length === 6 ? `${c.slice(0, 3)} ${c.slice(3)}` : c;
function appOtp() {
  const items = byKind("totp");
  const list = h("div", { class: "otp-list" });
  if (items.length) liveCodes(list, items, ({ it, code, left, per }) => {
    const el = h("article", { class: `otp ${left < 6000 ? "ending" : ""}` },
      h("div", { class: "otp-who" }, h("strong", {}, it.issuer || "Servicio"), h("small", { class: "muted" }, it.account || "")),
      h("button", { class: "otp-code mono", "aria-label": `Copiar código de ${it.issuer}`, onclick: () => copy(code, "Código") }, fmtCode(code)),
      h("div", { class: "otp-time" }, ring(left / per), h("small", { class: "mono" }, `${Math.ceil(left / 1000)}s`)));
    bindMenu(el, () => [["Copiar código", "copy", () => copy(code, "Código")], ["Editar", "edit", () => otpEditor(it)], "-", favEntry(it), trashEntry(it)], it.issuer);
    return el;
  });
  return h("div", { class: "app" },
    head("Autenticador 2FA", "Códigos de verificación en dos pasos, cifrados. Toca el código para copiarlo.", btn("Añadir", "plus", () => otpEditor())),
    items.length ? list : empty("Guarda aquí las claves de verificación en dos pasos de tus cuentas y genera los códigos sin depender del móvil.", btn("Añadir el primero", "plus", () => otpEditor())));
}

// ───────────────────────── NOTAS ─────────────────────────
const NOTE_DEFS = [["title", "Título"], ["body", "Texto", "area"]];
const newNote = () => editor("Nueva nota", NOTE_DEFS, null, "note");
export const editNote = (n) => editor("Editar nota", NOTE_DEFS, n, "note");
function appNotes(ctx) {
  const list = h("div", { class: "notes" });
  const draw = () => {
    const ns = byKind("note").filter((n) => matches(ctx, n, "title", "body"));
    list.replaceChildren(...(ns.length ? ns.map((n) => {
      const el = h("button", { class: `note ${n.fav ? "is-fav" : ""}`, onclick: () => editNote(n) },
        h("div", { class: "note-top" }, h("strong", {}, n.title || "Sin título"), n.fav && h("span", { class: "fav-star" }, ico("starf"))),
        h("p", {}, (n.body || "").slice(0, 220)), h("small", { class: "muted mono" }, relTime(n.updated)));
      bindMenu(el, () => [["Abrir", "edit", () => editNote(n)], ["Copiar texto", "copy", () => copy(n.body, "Nota")], "-", [n.fav ? "Desfijar" : "Fijar arriba", n.fav ? "starf" : "star", () => toggleFav(n)], trashEntry(n)], n.title);
      el.addEventListener("keydown", (e) => { if (e.key === "Delete") trash(n); });
      return el;
    })
      : [empty(ctx.state.q ? "Nada coincide." : "Guarda aquí códigos de recuperación o cualquier texto privado.", !ctx.state.q && btn("Nueva nota", "plus", newNote))]));
  };
  draw();
  return h("div", { class: "app" }, head("Notas seguras", "Clic derecho para fijar o mover a la papelera", btn("Nueva nota", "plus", newNote)), searchBox(ctx, draw), list);
}

// ───────────────────────── CONTACTOS ─────────────────────────
const CONTACT_DEFS = [["name", "Nombre"], ["role", "Tipo (médico, emergencia, banco, seguro…)"], ["phone", "Teléfono", "tel"], ["email", "Correo", "email"], ["notes", "Notas", "area"]];
const newContact = () => editor("Nuevo contacto", CONTACT_DEFS, null, "contact");
export const editContact = (c) => editor("Editar contacto", CONTACT_DEFS, c, "contact");
function appContacts() {
  const cs = byKind("contact");
  return h("div", { class: "app" },
    head("Contactos clave", "Personas y servicios importantes.", btn("Añadir", "plus", newContact)),
    cs.length ? h("div", { class: "list" }, ...cs.map((c) => {
      const tel = c.phone && `tel:${c.phone.replace(/\s/g, "")}`;
      const el = h("article", { class: "item" },
        h("div", { class: "avatar" }, (c.name || "?")[0].toUpperCase()),
        h("div", { class: "item-main" },
          h("div", { class: "item-title" }, h("strong", {}, c.name), c.role && h("span", { class: "badge" }, c.role), c.fav && h("span", { class: "fav-star" }, ico("starf"))),
          h("div", { class: "fields-inline" }, field("Teléfono", c.phone, { href: tel }), field("Correo", c.email)),
          c.notes && h("p", { class: "muted small" }, c.notes)),
        h("div", { class: "item-acts" }, tel && h("a", { class: "icon-btn", href: tel, "aria-label": "Llamar" }, ico("phone")),
          h("button", { class: "icon-btn", "aria-label": "Editar", onclick: () => editContact(c) }, ico("edit"))));
      bindMenu(el, () => [tel && ["Llamar", "phone", () => { location.href = tel; }], c.phone && ["Copiar teléfono", "copy", () => copy(c.phone, "Teléfono")], c.email && ["Copiar correo", "copy", () => copy(c.email, "Correo")], ["Editar", "edit", () => editContact(c)], "-", favEntry(c), trashEntry(c)], c.name);
      keys(el, c, () => editContact(c));
      return el;
    }))
      : empty("Añade tu médico, un contacto de emergencia o el teléfono del banco.", btn("Añadir", "plus", newContact)));
}

// ───────────────────────── PAPELERA ─────────────────────────
const KIND_ICON = { login: "key", card: "card", id: "id", note: "note", contact: "contact", file: "file", folder: "folder", totp: "otp" };
const KIND_NAME = { login: "Contraseña", card: "Tarjeta", id: "Documento", note: "Nota", contact: "Contacto", file: "Archivo", folder: "Carpeta", totp: "Código 2FA" };
function appTrash() {
  const list = trashed();
  const purge = async (it) => { if (await confirmBox(`«${nameOf(it)}» se eliminará para siempre. No se puede deshacer.`, "Eliminar para siempre")) { await deleteItem(it); toast("Eliminado para siempre"); } };
  return h("div", { class: "app" },
    head("Papelera", `Lo que borras se guarda aquí ${TRASH_DAYS} días antes de desaparecer.`,
      list.length > 0 && btn("Vaciar papelera", "trash", async () => { if (await confirmBox(`Se eliminarán para siempre ${list.length} elemento${list.length > 1 ? "s" : ""}.`, "Vaciar")) { const n = await emptyTrash(); toast(`${n} elemento${n > 1 ? "s" : ""} eliminados`); } }, "danger ghost")),
    list.length ? h("div", { class: "list" }, ...list.map((it) => {
      const daysLeft = Math.max(0, TRASH_DAYS - Math.floor((Date.now() - it.trashed) / 864e5));
      const el = h("article", { class: "item trash-row" },
        h("div", { class: "avatar" }, ico(KIND_ICON[it.kind] || "file")),
        h("div", { class: "item-main" },
          h("div", { class: "item-title" }, h("strong", {}, nameOf(it)), h("span", { class: "badge" }, KIND_NAME[it.kind] || it.kind)),
          h("small", { class: "item-meta" }, `Eliminado ${relTime(it.trashed)} · se borra en ${daysLeft} día${daysLeft === 1 ? "" : "s"}`)),
        h("div", { class: "item-acts" },
          h("button", { class: "ghost sm", onclick: async () => { await restoreItem(it); toast("Restaurado"); } }, ico("restore"), h("span", {}, "Restaurar")),
          h("button", { class: "icon-btn", "aria-label": "Eliminar para siempre", onclick: () => purge(it) }, ico("x"))));
      bindMenu(el, () => [["Restaurar", "restore", async () => { await restoreItem(it); toast("Restaurado"); }], ["Eliminar para siempre", "x", () => purge(it), "danger-item"]], nameOf(it));
      return el;
    })) : empty("La papelera está vacía."));
}

// ───────────────────────── GENERADOR ─────────────────────────
function appGen(ctx) {
  const s = ctx.state;
  s.opts ??= { length: 20, lower: true, upper: true, digits: true, symbols: true };
  s.mode ??= "chars";
  s.history ??= [];
  const out = h("button", { class: "gen-out mono", title: "Copiar", onclick: () => { copy(out.dataset.v, "Contraseña"); } });
  const meter = h("div", { class: "meter" }, h("i")); const info = h("small", { class: "muted mono" });
  const lenLbl = h("b", { class: "mono" }, s.opts.length);
  const hist = h("div", { class: "gen-hist" });
  const drawHist = () => hist.replaceChildren(...s.history.slice(-5).reverse().map((v) => h("button", { class: "mono", onclick: () => copy(v, "Contraseña") }, v)));
  const run = (keep = true) => {
    if (keep && out.dataset.v) { s.history.push(out.dataset.v); drawHist(); }
    const v = s.mode === "chars" ? C.generatePassword(s.opts) : C.generatePassphrase(Math.max(4, Math.round(s.opts.length / 4)));
    out.dataset.v = v; out.textContent = v;
    const k = C.strength(v); meter.dataset.score = k.score;
    const years = 2 ** Math.max(0, k.bits - 1) / 1e10 / 31557600;
    info.textContent = `${k.label} · ${k.bits} bits · ${years > 1e6 ? "millones de años" : years > 1 ? `${Math.round(years)} años` : "minutos"} para romperla a 10.000 M intentos/s`;
  };
  const range = h("input", { type: "range", min: 8, max: 64, value: s.opts.length, "aria-label": "Longitud" });
  range.oninput = () => { s.opts.length = +range.value; lenLbl.textContent = range.value; run(false); };
  const tog = (k, label) => { const c = h("input", { type: "checkbox", checked: s.opts[k] }); c.onchange = () => { s.opts[k] = c.checked; run(false); }; return h("label", { class: "check" }, c, h("span", {}, label)); };
  const seg = h("div", { class: "seg", role: "tablist" },
    ...[["chars", "Caracteres"], ["words", "Frase de palabras"]].map(([m, l]) => h("button", { class: m === s.mode ? "on" : "", role: "tab", onclick: () => { s.mode = m; ctx.refresh(); } }, l)));
  run(false); drawHist();
  return h("div", { class: "app narrow" }, head("Generador de claves", "Toca la contraseña para copiarla."),
    h("div", { class: "panel" }, seg, out, meter, info,
      h("div", { class: "gen-len" }, h("span", {}, "Longitud"), lenLbl), range,
      h("div", { class: "toggles" }, tog("lower", "Minúsculas"), tog("upper", "Mayúsculas"), tog("digits", "Números"), tog("symbols", "Símbolos")),
      h("div", { class: "row" }, btn("Generar otra", "gen", () => run()), btn("Guardar como contraseña", "key", () => newLogin({ password: out.dataset.v }), "ghost"))),
    h("h3", { class: "sub" }, "Generadas en esta sesión"), hist,
    h("p", { class: "muted small" }, "Este historial solo vive en memoria y se borra al bloquear."));
}

// ───────────────────────── REGISTRO ─────────────────────────
function appLog() {
  const list = h("div", { class: "log" }, h("p", { class: "muted pad" }, "Leyendo registro…"));
  const devices = h("div", { class: "devices" });
  const NAMES = { entrada: "ACCESS", fallo: "DENIED", bloqueo: "LOCKED", creada: "CREATED" };
  S.getLog(100).then((rows) => {
    const all = [...rows, ...st.fails.map((f) => ({ ...f, type: "fallo" }))].sort((a, b) => b.at - a.at);
    list.replaceChildren(...(all.length ? all.map((r) =>
      h("div", { class: `log-row ${r.type}` }, h("time", {}, fmtDate(r.at)), h("strong", {}, NAMES[r.type] || r.type.toUpperCase()), h("span", { class: "muted" }, r.device)))
      : [h("p", { class: "muted pad" }, "Sin registros.")]));
    const seen = {};
    rows.filter((r) => r.type === "entrada").forEach((r) => { seen[r.device] = Math.max(seen[r.device] || 0, r.at); });
    devices.replaceChildren(...Object.entries(seen).sort((a, b) => b[1] - a[1]).map(([d, t]) => h("div", { class: "dev" }, ico("cpu"), h("div", {}, h("strong", {}, d), h("small", { class: "muted" }, `Última entrada ${relTime(t)}`)))));
  }).catch((e) => list.replaceChildren(h("p", { class: "err-text pad" }, e.message)));
  return h("div", { class: "app" }, head("Registro de accesos", "Cada entrada, fallo y bloqueo de tu bóveda."),
    h("h3", { class: "sub" }, "Dispositivos que han entrado"), devices,
    h("h3", { class: "sub" }, "Actividad"), list);
}

// ───────────────────────── AJUSTES ─────────────────────────
function appSettings(ctx) {
  const sel = (id, opts, cur, fn) => { const s = h("select", { id }, ...opts.map(([v, l]) => h("option", { value: v, selected: cur === v }, l))); s.onchange = () => fn(s.value); return s; };
  const toggle = (label, key, note, after) => {
    const c = h("input", { type: "checkbox", checked: settings[key], role: "switch" });
    c.onchange = () => { settings[key] = c.checked; saveSettings(); after?.(); toast("Ajuste guardado"); };
    return h("label", { class: "set switch" }, h("span", {}, label, note && h("small", { class: "muted block" }, note)), c);
  };
  const thumb = { esfera: () => sphere({ size: 92, still: true, interactive: false, pulses: 0 }), cerebro: () => h("img", { src: "assets/brain.webp", alt: "" }), rejilla: () => h("i") };
  const wallSeg = h("div", { class: "wall-pick" }, ...[["esfera", "Esfera neuronal"], ["cerebro", "Cerebro"], ["rejilla", "Rejilla"]].map(([k, l]) =>
    h("button", { class: settings.wallpaper === k ? "on" : "", onclick: () => { settings.wallpaper = k; saveSettings(); setWallpaper(); ctx.refresh(); } },
      h("span", { class: "wp-thumb" }, thumb[k]()), h("span", {}, l))));
  return h("div", { class: "app narrow" }, head("Ajustes"),
    h("div", { class: "panel" }, h("h3", {}, ico("shield"), "Seguridad"),
      h("div", { class: "set" }, h("label", { for: "lockm" }, "Bloquear tras inactividad"),
        sel("lockm", [1, 2, 5, 10, 15, 30].map((m) => [m, `${m} min`]), settings.lockMinutes, (v) => { settings.lockMinutes = +v; saveSettings(); toast("Ajuste guardado"); })),
      h("div", { class: "set" }, h("label", { for: "clips" }, "Borrar portapapeles tras"),
        sel("clips", [15, 30, 60].map((s) => [s, `${s} s`]), settings.clipSeconds, (v) => { settings.clipSeconds = +v; saveSettings(); toast("Ajuste guardado"); })),
      h("p", { class: "muted small" }, `Tras ${MAX_FAILS} intentos fallidos la bóveda se bloquea 5 min y el tiempo se duplica con cada fallo extra. Atajo para bloquear al instante: Ctrl+Shift+L.`)),
    h("div", { class: "panel" }, h("h3", {}, ico("sphere"), "Apariencia"),
      h("label", {}, "Fondo de pantalla"), wallSeg,
      h("div", { class: "set" }, h("label", { for: "fxs" }, "Velocidad de los destellos"),
        sel("fxs", [["lenta", "Lenta"], ["media", "Media"], ["rapida", "Rápida"]], settings.fxSpeed, (v) => { settings.fxSpeed = v; saveSettings(); setWallpaper(); toast("Ajuste guardado"); })),
      toggle("Destellos de luz", "fx", null, setWallpaper),
      toggle("Animación de arranque", "boot")),
    keyFilePanel(),
    h("div", { class: "panel" }, h("h3", {}, ico("dl"), "Copia de seguridad"),
      h("p", { class: "muted small" }, "Descarga todo tal como está en Firebase: cifrado. Solo se abre con tu contraseña y tu archivo llave."),
      btn("Descargar copia cifrada", "dl", async () => {
        const items = await S.listItems();
        downloadJSON({ type: "cortex-backup", v: 3, at: new Date().toISOString(), keyId: st.keyId, items }, `cortex-copia-${new Date().toISOString().slice(0, 10)}.json`);
      }, "ghost")),
    h("div", { class: "panel" }, h("h3", {}, ico("power"), "Sesión"),
      h("p", { class: "muted small mono" }, `Llave ${hexShort(st.keyId)}`),
      h("div", { class: "row" }, btn("Bloquear ahora", "lock", () => lockFn("Bóveda bloqueada"), "ghost"))));
}
function keyFilePanel() {
  const pw = h("input", { type: "password", id: "kfp1", autocomplete: "new-password" });
  const pw2 = h("input", { type: "password", id: "kfp2", autocomplete: "new-password" });
  const nameIn = h("input", { type: "text", id: "kfname", value: "pas", spellcheck: "false" });
  const meter = h("div", { class: "meter" }, h("i"));
  pw.addEventListener("input", () => { meter.dataset.score = pw.value ? C.strength(pw.value).score : 0; });
  const msg = h("p", { class: "err-text", role: "alert" });
  const go = h("button", { class: "primary", type: "submit" }, ico("usb"), h("span", {}, "Crear archivo protegido"));
  return h("div", { class: "panel" }, h("h3", {}, ico("usb"), "Archivo llave para el USB"),
    h("p", { class: "muted small" }, "Crea una versión de tu archivo llave que pide su propia contraseña para abrirse. Si alguien copia el archivo del USB, no le sirve de nada."),
    h("form", { class: "form", onsubmit: async (e) => {
      e.preventDefault(); msg.textContent = "";
      if (!st.keyFile) return (msg.textContent = "Vuelve a entrar en CORTEX para usar esta opción.");
      if (pw.value.length < 8) return (msg.textContent = "Usa al menos 8 caracteres.");
      if (pw.value !== pw2.value) return (msg.textContent = "Las contraseñas no coinciden.");
      go.disabled = true;
      try {
        const locked = await C.lockKeyFile(st.keyFile, pw.value);
        downloadJSON(locked, nameIn.value.trim() || "pas");
        pw.value = pw2.value = "";
        toast("Archivo protegido descargado");
        modal("Último paso", h("div", {},
          h("ol", { class: "howto" },
            h("li", {}, "Abre el USB ", h("b", {}, "CODEX"), "."),
            h("li", {}, "Borra el archivo llave antiguo (sin contraseña) del USB."),
            h("li", {}, "Copia ahí el archivo que acabas de descargar."),
            h("li", {}, "Borra también la copia de Descargas y de la papelera.")),
          h("p", { class: "muted small" }, "A partir de ahora, al elegir el archivo, CORTEX te pedirá primero su contraseña. Guarda una segunda copia protegida en otro sitio por si pierdes el USB."),
          h("div", { class: "row end" }, h("button", { class: "primary", onclick: closeModal }, "Entendido"))));
      } catch (err) { msg.textContent = err.message; }
      go.disabled = false;
    } },
      h("div", { class: "fgrid" },
        h("div", { class: "f" }, h("label", { for: "kfp1" }, "Contraseña del archivo"), pw, meter),
        h("div", { class: "f" }, h("label", { for: "kfp2" }, "Repítela"), pw2),
        h("div", { class: "f full" }, h("label", { for: "kfname" }, "Nombre del archivo"), nameIn)),
      msg, h("div", { class: "row end" }, go)));
}

// ───────────────────────── TERMINAL ─────────────────────────
function appTerminal(ctx) {
  const s = ctx.state;
  if (s.root) { setTimeout(() => s.input?.focus(), 0); return s.root; }
  s.hist = []; s.hi = 0;
  const out = h("div", { class: "term-out", "aria-live": "polite" });
  const input = h("input", { class: "term-in", autocomplete: "off", spellcheck: "false", "aria-label": "Comando" });
  const print = (text, cls = "") => { out.append(h("div", { class: `tl ${cls}` }, text)); root.scrollTop = root.scrollHeight; };
  const APPMAP = { claves: "claves", contraseñas: "claves", tarjetas: "tarjetas", identidad: "identidad", drive: "drive", "2fa": "autenticador", autenticador: "autenticador", notas: "notas", contactos: "contactos", generador: "generador", registro: "registro", papelera: "papelera", ajustes: "ajustes" };
  const CMDS = {
    help: () => [
      "comandos disponibles:",
      "  ls                lista lo que hay en la bóveda",
      "  open <app>        abre una app (claves, tarjetas, identidad, drive, 2fa…)",
      "  find <texto>      busca en toda la bóveda",
      "  otp               muestra tus códigos 2FA actuales",
      "  gen [n]           genera una contraseña de n caracteres y la copia",
      "  phrase            genera una frase de palabras y la copia",
      "  audit             revisión de seguridad",
      "  wall <esfera|cerebro|rejilla>   cambia el fondo",
      "  stats | whoami | date | neofetch | clear | lock",
    ].forEach((l) => print(l)),
    ls: () => [["login", "contraseñas"], ["card", "tarjetas"], ["id", "documentos"], ["totp", "códigos-2fa"], ["folder", "carpetas"], ["file", "archivos"], ["note", "notas"], ["contact", "contactos"]]
      .forEach(([k, n]) => print(`drwx------  ${String(byKind(k).length).padStart(4)}  ${n}/`)),
    open: (a) => { const id = APPMAP[(a || "").toLowerCase()]; if (!id) return print(`open: app desconocida «${a || ""}»`, "err"); openApp(id); print(`abriendo ${id}…`, "dim"); },
    find: (...q) => { const term = q.join(" ").toLowerCase(); if (!term) return print("uso: find <texto>", "err"); const r = searchItems(term); if (!r.length) return print("sin resultados", "dim"); r.slice(0, 15).forEach((x) => print(`  [${x.sub}] ${x.label}`)); },
    otp: async () => { const list = byKind("totp"); if (!list.length) return print("no hay códigos 2FA guardados", "dim"); for (const it of list) { try { print(`  ${fmtCode(await C.totp(it.secret, { digits: it.digits || 6, period: it.period || 30, algo: it.algo || "SHA-1" }))}   ${it.issuer} ${it.account ? "· " + it.account : ""}`, "hi"); } catch { print(`  ------   ${it.issuer} (clave no válida)`, "err"); } } },
    gen: (n) => { const v = C.generatePassword({ length: Math.min(128, Math.max(8, +n || 24)) }); print(v, "hi"); copy(v, "Contraseña"); },
    phrase: () => { const v = C.generatePassphrase(5); print(v, "hi"); copy(v, "Frase"); },
    audit: () => { const a = securityAlerts(); if (!a.length) return print("[ OK ] todo en orden", "hi"); a.forEach((x) => print(`[ !! ] ${x.text}`, x.warn ? "err" : "")); },
    wall: (k) => { if (!["esfera", "cerebro", "rejilla"].includes(k)) return print("uso: wall <esfera|cerebro|rejilla>", "err"); settings.wallpaper = k; saveSettings(); setWallpaper(); print(`fondo: ${k}`, "dim"); },
    stats: () => {
      const used = byKind("file").reduce((a, f) => a + (f.size || 0), 0);
      print(`elementos cifrados: ${st.items.size}`); print(`drive: ${fmtSize(used)} / 1 GB`); print(`papelera: ${trashed().length}`);
      print(`último acceso previo: ${st.prevAccess ? fmtDate(st.prevAccess.at) : "—"}`);
      print(`cifrado: AES-256-GCM · PBKDF2-SHA256 600k · HKDF`);
    },
    whoami: () => print(`mario@cortex · llave ${hexShort(st.keyId)}`),
    date: () => print(new Date().toString()),
    neofetch: () => print([
      "        .--~~~~--.         mario@cortex",
      "     .~  .-~~-.   ~.       ------------",
      "    /  ./  /\\  \\.   \\      OS: CORTEX OS 3.0",
      "   |  /  ./  \\.  \\   |     Host: marela-8d4e5 · eu-west1",
      "   |  \\  \\    /  /   |     Cifrado: AES-256-GCM",
      "    \\  `~.\\__/.~'   /      Derivación: PBKDF2 600k + HKDF",
      "     `~._    _.~'          Elementos: " + st.items.size,
      "         `||'              Sesión: solo en memoria",
    ].join("\n"), "pre"),
    clear: () => out.replaceChildren(),
    lock: () => lockFn("Bloqueada desde la terminal"),
  };
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter") {
      const line = input.value.trim(); input.value = "";
      print(h("span", {}, h("span", { class: "prompt" }, "mario@cortex:~$ "), line));
      if (!line) return;
      s.hist.push(line); s.hi = s.hist.length;
      const [cmd, ...args] = line.split(/\s+/);
      const fn = CMDS[cmd.toLowerCase()];
      fn ? fn(...args) : print(`${cmd}: comando no encontrado. Escribe «help».`, "err");
    } else if (e.key === "ArrowUp") { e.preventDefault(); s.hi = Math.max(0, s.hi - 1); input.value = s.hist[s.hi] || ""; }
    else if (e.key === "ArrowDown") { e.preventDefault(); s.hi = Math.min(s.hist.length, s.hi + 1); input.value = s.hist[s.hi] || ""; }
    else if (e.key === "Tab") {
      e.preventDefault();
      const [c, a] = input.value.split(/\s+/);
      if (a !== undefined) { const m = Object.keys(APPMAP).find((k) => k.startsWith(a.toLowerCase())); if (m) input.value = `${c} ${m}`; }
      else { const m = Object.keys(CMDS).find((k) => k.startsWith(c.toLowerCase())); if (m) input.value = m + " "; }
    }
  });
  const root = h("div", { class: "terminal", onclick: () => { if (!getSelection().toString()) input.focus(); } },
    out, h("div", { class: "term-line" }, h("span", { class: "prompt" }, "mario@cortex:~$"), input));
  s.root = root; s.input = input;
  print("CORTEX OS 3.0 · terminal cifrada", "hi");
  print("escribe «help» para ver los comandos", "dim");
  setTimeout(() => input.focus(), 50);
  return root;
}

// ───────────────────────── buscador global ─────────────────────────
export function searchItems(q) {
  const out = [];
  for (const it of st.items.values()) {
    if (it.trashed) continue;
    const hay = (...k) => k.some((x) => String(it[x] || "").toLowerCase().includes(q));
    if (it.kind === "login" && hay("title", "username", "url")) out.push({ label: it.title || it.username, sub: "Contraseña", icon: "key", run: () => { openApp("claves"); editLogin(it); } });
    else if (it.kind === "card" && hay("label", "holder")) out.push({ label: it.label || "Tarjeta", sub: "Tarjeta", icon: "card", run: () => openApp("tarjetas") });
    else if (it.kind === "id") { const t = tpl(it.template); if (`${t.name} ${t.region} ${Object.values(it).filter((v) => typeof v === "string" && v.length < 200).join(" ")}`.toLowerCase().includes(q)) out.push({ label: `${t.name} · ${t.region}`, sub: "Documento", icon: "id", run: () => { openApp("identidad"); idEditor(it); } }); }
    else if (it.kind === "note" && hay("title", "body")) out.push({ label: it.title || "Nota", sub: "Nota", icon: "note", run: () => { openApp("notas"); editNote(it); } });
    else if (it.kind === "contact" && hay("name", "role", "phone", "email")) out.push({ label: it.name, sub: "Contacto", icon: "contact", run: () => { openApp("contactos"); editContact(it); } });
    else if (it.kind === "totp" && hay("issuer", "account")) out.push({ label: `${it.issuer} ${it.account ? "· " + it.account : ""}`, sub: "Código 2FA", icon: "otp", run: () => openApp("autenticador") });
    else if (it.kind === "file" && hay("name")) out.push({ label: it.name, sub: "Archivo", icon: fileType(it.type, it.name)[0], run: () => openFile(it) });
    else if (it.kind === "folder" && hay("name")) out.push({ label: it.name, sub: "Carpeta", icon: "folder", run: () => { const w = openApp("drive"); if (w) { w.state.folder = it.id; w.state.q = ""; refreshApp("drive"); } } });
  }
  return out;
}

// ───────────────────────── paneles del escritorio ─────────────────────────
export function securityAlerts() {
  const logins = byKind("login");
  const weak = logins.filter((l) => C.strength(l.password).score <= 2);
  const reuse = reuseMap();
  const reused = logins.filter((l) => reuse[l.password] > 1);
  const soon = byKind("id").filter((d) => { const v = d.validez || d.valabilitate; return v && new Date(v) - Date.now() < 90 * 864e5; });
  const goLogins = (f) => () => { const w = openApp("claves"); if (w) { w.state.filter = f; refreshApp("claves"); } };
  return [
    st.failsSince && { warn: true, text: `${st.failsSince} intento${st.failsSince > 1 ? "s" : ""} fallido${st.failsSince > 1 ? "s" : ""} desde tu última entrada`, run: () => openApp("registro") },
    weak.length && { text: `${weak.length} contraseña${weak.length > 1 ? "s" : ""} débil${weak.length > 1 ? "es" : ""}`, run: goLogins("weak") },
    reused.length && { text: `${reused.length} contraseñas repetidas`, run: goLogins("reused") },
    ...soon.map((d) => ({ text: `${tpl(d.template).name} ${new Date(d.validez || d.valabilitate) < new Date() ? "caducado" : "caduca"} el ${fmtDay(d.validez || d.valabilitate)}`, run: () => openApp("identidad") })),
  ].filter(Boolean);
}

let logCache = { at: 0, rows: [] };
function activityPanel() {
  const host = h("div", { class: "act-list" }, h("p", { class: "muted small" }, "…"));
  const paint = (rows) => host.replaceChildren(...(rows.length ? rows.slice(0, 4).map((r) =>
    h("div", { class: `act ${r.type}` }, h("i"), h("span", {}, { entrada: "Acceso", fallo: "Fallo", bloqueo: "Bloqueo", creada: "Creada" }[r.type] || r.type), h("small", { class: "muted" }, relTime(r.at))))
    : [h("p", { class: "muted small" }, "Sin actividad.")]));
  if (Date.now() - logCache.at < 60000) paint(logCache.rows);
  else S.getLog(6).then((rows) => { logCache = { at: Date.now(), rows }; paint(rows); }).catch(() => paint([]));
  return host;
}
const panel = (tag, ...kids) => h("section", { class: "hud" }, h("header", { class: "hud-head" }, h("span", {}, tag), h("i", { class: "led" })), ...kids);

export function widget() {
  const alerts = securityAlerts();
  const used = [...st.items.values()].filter((i) => i.kind === "file").reduce((a, f) => a + (f.size || 0), 0);
  const hour = new Date().getHours();
  const greet = hour < 6 ? "Buenas noches" : hour < 14 ? "Buenos días" : hour < 21 ? "Buenas tardes" : "Buenas noches";
  const stat = (k, label, app) => h("button", { class: "w-stat", onclick: () => openApp(app) }, h("b", {}, byKind(k).length), h("span", {}, label));
  const otps = byKind("totp").sort((a, b) => (b.fav ? 1 : 0) - (a.fav ? 1 : 0)).slice(0, 3);
  const otpHost = h("div", { class: "w-otps" });
  if (otps.length) liveCodes(otpHost, otps, ({ it, code, left, per }) => h("button", { class: `w-otp ${left < 6000 ? "ending" : ""}`, onclick: () => copy(code, `Código ${it.issuer}`) },
    h("span", { class: "w-otp-name" }, it.issuer), h("b", { class: "mono" }, fmtCode(code)), ring(left / per)));

  return h("div", { class: "w-inner" },
    panel("SISTEMA",
      h("h2", { class: "w-greet" }, `${greet}, Mario.`),
      h("p", { class: "muted small" }, st.prevAccess ? `Último acceso ${relTime(st.prevAccess.at)} · ${st.prevAccess.device}` : "Primera entrada en este sistema."),
      h("div", { class: "w-stats" }, stat("login", "claves", "claves"), stat("card", "tarjetas", "tarjetas"), stat("id", "docs", "identidad"), stat("totp", "2FA", "autenticador"), stat("file", "archivos", "drive"), stat("note", "notas", "notas")),
      h("div", { class: "w-quota" }, h("small", { class: "muted" }, "DRIVE"), h("div", { class: "meter" }, h("i", { style: `width:${Math.max(1, (used / QUOTA) * 100)}%` })), h("small", { class: "mono" }, `${fmtSize(used)} / 1 GB`))),
    otps.length > 0 && panel("CÓDIGOS 2FA", otpHost),
    panel("AUDITORÍA",
      alerts.length ? h("ul", { class: "w-alerts" }, ...alerts.map((a) => h("li", { class: a.warn ? "warn" : "" }, h("button", { onclick: a.run }, h("span", {}, a.text), ico("chev")))))
        : h("p", { class: "ok-line" }, ico("shield"), "Todo en orden")),
    h("div", { class: "hide-mobile" }, panel("ACTIVIDAD", activityPanel())));
}

// Menú del fondo del escritorio
export function desktopMenu() {
  return [
    ["Nueva contraseña", "key", () => { openApp("claves"); newLogin(); }],
    ["Nueva nota", "note", () => { openApp("notas"); newNote(); }],
    ["Nuevo documento", "id", () => { openApp("identidad"); pickTemplate(); }],
    ["Nuevo código 2FA", "otp", () => { openApp("autenticador"); otpEditor(); }],
    ["Subir archivos", "up", () => { const w = openApp("drive"); setTimeout(() => w?.upload?.(), 50); }],
    "-",
    ["Ordenar iconos", "grid", () => resetIcons()],
    ["Cambiar fondo", "sphere", () => { const order = ["esfera", "cerebro", "rejilla"]; settings.wallpaper = order[(order.indexOf(settings.wallpaper) + 1) % 3]; saveSettings(); setWallpaper(); toast(`Fondo: ${settings.wallpaper}`); }],
    ["Buscar", "search", () => openPalette(), null, "Ctrl K"],
    ["Bloquear", "lock", () => lockFn("Bóveda bloqueada"), "danger-item", "Ctrl ⇧ L"],
  ];
}

// ───────────────────────── catálogo ─────────────────────────
export const APPS = [
  { id: "claves", title: "Contraseñas", icon: "key", render: appLogins, dock: true, w: 800, h: 640 },
  { id: "tarjetas", title: "Tarjetas", icon: "card", render: appCards, dock: true, w: 880, h: 560 },
  { id: "identidad", title: "Identidad", icon: "id", render: appIds, dock: true, w: 960, h: 640 },
  { id: "drive", title: "Drive", icon: "drive", render: appDrive, dock: true, w: 980, h: 660 },
  { id: "autenticador", title: "Autenticador", icon: "otp", render: appOtp, dock: true, w: 640, h: 560 },
  { id: "notas", title: "Notas", icon: "note", render: appNotes, dock: true, w: 760, h: 560 },
  { id: "contactos", title: "Contactos", icon: "contact", render: appContacts, w: 720, h: 560 },
  { id: "generador", title: "Generador", icon: "gen", render: appGen, w: 580, h: 640 },
  { id: "terminal", title: "Terminal", icon: "term", render: appTerminal, dock: true, w: 720, h: 460 },
  { id: "registro", title: "Registro", icon: "log", render: appLog, w: 700, h: 580 },
  { id: "papelera", title: "Papelera", icon: "trash", render: appTrash, w: 700, h: 540 },
  { id: "ajustes", title: "Ajustes", icon: "cog", render: appSettings, w: 640, h: 680 },
];
export { refreshAll, closeAll };
