// Apps de CORTEX OS. Cada una devuelve su contenido para la ventana.
import * as C from "./crypto.js";
import * as S from "./store.js";
import { ID_TEMPLATES, tpl } from "./templates.js";
import { st, settings, saveSettings, saveItem, deleteItem, byKind } from "./state.js";
import { h, ico, $, $$, toast, copy, modal, closeModal, confirmBox, promptBox, fmtDate, fmtDay, fmtSize, downloadJSON, hexShort } from "./ui.js";
import { openApp, refreshApp, refreshAll, closeAll } from "./os.js";

let lockFn = () => {};
export function setLock(fn) { lockFn = fn; }
export const MAX_FAILS = 5;
const QUOTA = 1024 * 1024 * 1024; // 1 GiB del plan gratuito

// ───────────────────────── piezas comunes ─────────────────────────
const head = (title, sub, ...actions) => h("div", { class: "app-head" },
  h("div", {}, h("h2", {}, title), sub && h("p", { class: "muted" }, sub)), h("div", { class: "row" }, ...actions));
const btn = (label, icon, onclick, cls = "primary") => h("button", { class: cls, onclick }, icon && ico(icon), h("span", {}, label));
const empty = (text, action) => h("div", { class: "empty" }, h("div", { class: "empty-glyph" }, "∅"), h("p", {}, text), action);
function searchBox(ctx, onInput, placeholder = "Buscar") {
  const i = h("input", { type: "search", placeholder, value: ctx.state.q || "", "aria-label": placeholder, spellcheck: "false" });
  i.addEventListener("input", () => { ctx.state.q = i.value; onInput(); });
  return h("label", { class: "search" }, ico("search"), i);
}
const matches = (ctx, it, ...keys) => { const q = (ctx.state.q || "").toLowerCase(); return !q || keys.some((k) => String(it[k] || "").toLowerCase().includes(q)); };

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
  return { els, read: () => Object.fromEntries(Object.entries(inputs).map(([k, i]) => [k, i.value.trim()])) };
}

function editor(title, defs, item, kind, extra = {}) {
  const f = formFields(defs, item || {});
  const save = h("button", { class: "primary", type: "submit" }, ico("lock"), h("span", {}, "Guardar cifrado"));
  const form = h("form", { class: "form", onsubmit: async (e) => {
    e.preventDefault(); save.disabled = true;
    try { await saveItem({ ...(item || {}), ...extra, ...f.read(), kind }); closeModal(); toast("Guardado y cifrado"); }
    catch (err) { toast(err.message, "err"); save.disabled = false; }
  } }, h("div", { class: "fgrid" }, ...f.els),
    h("div", { class: "row end" },
      item?.id && h("button", { type: "button", class: "danger ghost", onclick: async () => { if (await confirmBox("Se eliminará para siempre.")) { await deleteItem(item); toast("Eliminado"); } } }, ico("trash"), h("span", {}, "Eliminar")),
      save));
  modal(title, form, { wide: defs.length > 4 });
}

// Menú contextual pequeño
function popMenu(x, y, entries) {
  $(".ctxmenu")?.remove();
  const m = h("div", { class: "ctxmenu", role: "menu" }, ...entries.filter(Boolean).map(([label, icon, fn, cls]) =>
    h("button", { role: "menuitem", class: cls || "", onclick: () => { m.remove(); fn(); } }, ico(icon), h("span", {}, label))));
  document.body.append(m);
  const r = m.getBoundingClientRect();
  m.style.left = `${Math.min(x, innerWidth - r.width - 8)}px`;
  m.style.top = `${Math.min(y, innerHeight - r.height - 8)}px`;
  setTimeout(() => {
    const off = (e) => { if (!m.contains(e.target)) { m.remove(); removeEventListener("pointerdown", off, true); } };
    addEventListener("pointerdown", off, true);
  }, 0);
  m.querySelector("button")?.focus();
}

// ───────────────────────── CONTRASEÑAS ─────────────────────────
const LOGIN_DEFS = [["title", "Nombre (p. ej. Instagram)"], ["username", "Usuario o correo"], ["password", "Contraseña", "secret"], ["url", "Web"], ["notes", "Notas", "area"]];
export const newLogin = (pre = {}) => editor("Nueva contraseña", LOGIN_DEFS, Object.keys(pre).length ? pre : null, "login");
export const editLogin = (l) => editor(`Editar · ${l.title || "contraseña"}`, LOGIN_DEFS, l, "login");
function appLogins(ctx) {
  const list = h("div", { class: "list" });
  const draw = () => {
    const items = byKind("login").filter((l) => matches(ctx, l, "title", "username", "url"));
    list.replaceChildren(...(items.length ? items.map(loginRow) : [empty(ctx.state.q ? "Nada coincide con la búsqueda." : "Aún no hay contraseñas guardadas.", !ctx.state.q && btn("Añadir la primera", "plus", () => newLogin()))]));
  };
  draw();
  return h("div", { class: "app" }, head("Contraseñas", `${byKind("login").length} guardadas · toca copiar para llevarte el dato`, btn("Nueva", "plus", () => newLogin())), searchBox(ctx, draw, "Buscar por nombre, usuario o web"), list);
}
function loginRow(l) {
  const s = C.strength(l.password);
  return h("article", { class: "item" },
    h("div", { class: "avatar" }, (l.title || "?")[0].toUpperCase()),
    h("div", { class: "item-main" },
      h("div", { class: "item-title" }, h("strong", {}, l.title || "Sin nombre"), h("span", { class: `badge s${s.score}` }, s.label)),
      h("div", { class: "fields-inline" },
        field("Usuario", l.username), field("Contraseña", l.password, { secret: true, mono: true }),
        l.url && field("Web", l.url, { href: /^https?:/i.test(l.url) ? l.url : `https://${l.url}` }))),
    h("button", { class: "icon-btn", "aria-label": "Editar", onclick: () => editLogin(l) }, ico("edit")));
}

// ───────────────────────── TARJETAS ─────────────────────────
const CARD_DEFS = [["label", "Nombre de la tarjeta (p. ej. Banco principal)"], ["holder", "Titular"], ["number", "Número"], ["expiry", "Caducidad (MM/AA)"], ["cvv", "CVV (opcional, no recomendado)", "secret"], ["notes", "Notas", "area"]];
const groupNum = (n = "") => n.replace(/\D/g, "").replace(/(.{4})/g, "$1 ").trim();
const newCard = () => editor("Nueva tarjeta", CARD_DEFS, null, "card");
function appCards() {
  const cards = byKind("card");
  return h("div", { class: "app" },
    head("Tarjetas", "Toca cualquier dato de la tarjeta para copiarlo.", btn("Nueva tarjeta", "plus", newCard)),
    h("div", { class: "cards" },
      ...(cards.length ? cards.map(cardView) : [cardView({ label: "Plantilla", holder: "TU NOMBRE", number: "0000000000000000", expiry: "MM/AA", demo: true })]),
      h("button", { class: "add-tile card-add", onclick: newCard }, ico("plus"), h("span", {}, "Añadir tarjeta"))));
}
function cardView(c) {
  let reveal = false;
  const digits = (c.number || "").replace(/\D/g, "");
  const num = h("button", { class: "cc-num", onclick: () => !c.demo && copy(digits, "Número") });
  const paint = () => { num.textContent = reveal || c.demo ? groupNum(digits) : `•••• •••• •••• ${digits.slice(-4)}`; };
  paint();
  const tap = (label, val, cls) => h("button", { class: cls, onclick: () => !c.demo && copy(val, label) }, val || "—");
  const cc = h("div", { class: "cc" },
    h("div", { class: "cc-shine", "aria-hidden": "true" }),
    h("div", { class: "cc-top" }, tap("Nombre", c.label, "cc-label"), h("span", { class: "cc-wave" }, ico("wave"))),
    h("div", { class: "chip", "aria-hidden": "true" }, h("i"), h("i"), h("i"), h("i")),
    num,
    h("div", { class: "cc-bottom" },
      h("div", {}, h("small", {}, "Titular"), tap("Titular", c.holder, "cc-holder")),
      h("div", {}, h("small", {}, "Caduca"), tap("Caducidad", c.expiry, "cc-exp")),
      c.cvv && h("div", {}, h("small", {}, "CVV"), h("button", { class: "cc-exp", onclick: () => copy(c.cvv, "CVV") }, "•••"))));
  // inclinación 3D con el ratón
  cc.addEventListener("pointermove", (e) => {
    if (e.pointerType !== "mouse") return;
    const r = cc.getBoundingClientRect(), x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
    cc.style.transform = `rotateY(${x * 10}deg) rotateX(${-y * 10}deg)`;
    cc.style.setProperty("--mx", `${(x + 0.5) * 100}%`); cc.style.setProperty("--my", `${(y + 0.5) * 100}%`);
  });
  cc.addEventListener("pointerleave", () => { cc.style.transform = ""; });
  return h("div", { class: "cc-wrap" }, h("div", { class: "cc-stage" }, cc),
    !c.demo && h("div", { class: "row" },
      h("button", { class: "ghost sm", onclick: () => { reveal = !reveal; paint(); } }, ico("eye"), h("span", {}, "Ver número")),
      h("button", { class: "ghost sm", onclick: () => editor("Editar tarjeta", CARD_DEFS, c, "card") }, ico("edit"), h("span", {}, "Editar"))),
    c.demo && h("p", { class: "muted small center" }, "Así se verá tu tarjeta. Pulsa «Nueva tarjeta» para rellenarla."));
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
  const draw = () => {
    tabs.replaceChildren(...["Todos", "España", "Rumanía", "General"].map((g) => h("button", { role: "tab", class: g === group ? "on" : "", "aria-selected": g === group, onclick: () => { group = g; draw(); } }, g)));
    const list = ID_TEMPLATES.filter((t) => (group === "Todos" || t.group === group) && (!q || `${t.name} ${t.region}`.toLowerCase().includes(q)));
    grid.replaceChildren(...list.map((t) => h("button", { class: `tpl ${t.id.includes("pas") ? "is-pass" : ""}`, onclick: () => { closeModal(); idEditor({ template: t.id }); } },
      h("div", { class: "tpl-mini", "aria-hidden": "true" }, h("i", { class: "m-photo" }), h("i", { class: "m-l1" }), h("i", { class: "m-l2" }), h("i", { class: "m-l3" })),
      h("span", { class: "tpl-name" }, t.name), h("small", {}, `${t.region} · ${t.fields.length} campos`))));
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
  const exp = d.validez || d.valabilitate;
  const expSoon = exp && new Date(exp) - Date.now() < 90 * 864e5;
  return h("article", { class: `idc ${passport ? "passport" : ""}` },
    h("header", {},
      h("div", {}, h("small", {}, `${t.region.toUpperCase()} // FICHA CORTEX`), h("strong", {}, d.titulo || t.name)),
      h("div", { class: "row" }, expSoon && h("span", { class: "badge warn" }, "Caduca pronto"),
        h("button", { class: "icon-btn sm", "aria-label": "Editar", onclick: () => idEditor(d) }, ico("edit")))),
    h("div", { class: "idc-body" },
      h("div", { class: "photo" }, d.photo ? h("img", { src: d.photo, alt: "Foto" }) : h("span", {}, ico("contact"))),
      h("div", { class: "idc-fields" },
        main && h("button", { class: "idc-main", onclick: () => copy(main, t.fields.find((f) => f[0] === t.main)[1]) }, main),
        ...vals.map(([k, label, type]) => h("button", { class: "idc-f", onclick: () => copy(d[k], label) }, h("small", {}, label), h("span", {}, type === "date" ? fmtDay(d[k]) : d[k]))))),
    h("footer", { class: "idc-foot" }, h("span", {}, "Ficha de consulta personal · no es un documento oficial"), h("span", { class: "mono" }, `#${(d.id || "").slice(0, 6)}`)));
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
      d.id && h("button", { type: "button", class: "danger ghost", onclick: async () => { if (await confirmBox("Se eliminará esta ficha.")) { await deleteItem(d); closeModal(); } } }, ico("trash"), h("span", {}, "Eliminar")),
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
const fileType = (t = "") => t.startsWith("image/") ? ["img", "IMG"] : t.startsWith("video/") ? ["vid", "VID"] : t === "application/pdf" ? ["pdf", "PDF"] : t.startsWith("audio/") ? ["aud", "AUD"] : ["file", "DOC"];
const children = (parent) => [...st.items.values()].filter((i) => (i.kind === "folder" || i.kind === "file") && (i.parent || null) === parent);
function pathOf(folderId) {
  const out = []; let cur = folderId ? st.items.get(folderId) : null; let guard = 0;
  while (cur && guard++ < 50) { out.unshift(cur); cur = cur.parent ? st.items.get(cur.parent) : null; }
  return out;
}
function folderSize(id) { return children(id).reduce((a, c) => a + (c.kind === "file" ? c.size || 0 : folderSize(c.id)), 0); }
function isInside(id, ancestor) { let cur = st.items.get(id); let g = 0; while (cur && g++ < 50) { if (cur.parent === ancestor) return true; cur = cur.parent ? st.items.get(cur.parent) : null; } return false; }

function appDrive(ctx) {
  const s = ctx.state;
  s.folder ??= null; s.view ??= "grid";
  if (s.folder && !st.items.has(s.folder)) s.folder = null;
  const used = byKind("file").reduce((a, f) => a + (f.size || 0), 0);
  const goto = (id) => { s.folder = id; s.q = ""; ctx.refresh(); };

  const input = h("input", { type: "file", multiple: true, class: "sr", id: `up-${ctx.id}` });
  input.onchange = () => { uploadFiles([...input.files], s.folder); input.value = ""; };

  const crumbs = h("nav", { class: "crumbs", "aria-label": "Ruta" },
    crumbBtn("Mi unidad", null, goto),
    ...pathOf(s.folder).flatMap((f) => [ico("chev", "sep"), crumbBtn(f.name, f.id, goto)]));

  const content = h("div", { class: `drive-${s.view}` });
  const draw = () => {
    const q = (s.q || "").toLowerCase();
    let list = q ? [...st.items.values()].filter((i) => (i.kind === "folder" || i.kind === "file") && i.name.toLowerCase().includes(q)) : children(s.folder);
    list = list.sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name, "es") : a.kind === "folder" ? -1 : 1));
    content.replaceChildren(...(list.length ? list.map((it) => driveTile(it, ctx, goto))
      : [empty(q ? "Nada coincide con la búsqueda." : "Esta carpeta está vacía. Arrastra archivos aquí o crea una carpeta.", !q && h("div", { class: "row center" }, btn("Subir archivos", "up", () => input.click()), btn("Nueva carpeta", "folder", () => newFolder(s.folder), "ghost")))]));
  };
  draw();

  const root = h("div", { class: "app drive" },
    h("div", { class: "drive-top" },
      crumbs,
      h("div", { class: "row" },
        btn("Carpeta", "folder", () => newFolder(s.folder), "ghost sm"),
        btn("Subir", "up", () => input.click(), "primary sm"),
        h("div", { class: "seg mini" },
          h("button", { class: s.view === "grid" ? "on" : "", "aria-label": "Cuadrícula", onclick: () => { s.view = "grid"; ctx.refresh(); } }, ico("grid")),
          h("button", { class: s.view === "list" ? "on" : "", "aria-label": "Lista", onclick: () => { s.view = "list"; ctx.refresh(); } }, ico("list"))))),
    h("div", { class: "drive-bar" }, searchBox(ctx, draw, "Buscar en todo el drive"),
      h("div", { class: "quota", title: `${fmtSize(used)} de 1 GB` }, h("div", { class: "meter" }, h("i", { style: `width:${Math.max(1, (used / QUOTA) * 100)}%` })), h("small", { class: "muted" }, `${fmtSize(used)} / 1 GB`))),
    input, content,
    h("div", { class: "drop-veil", "aria-hidden": "true" }, ico("up"), h("span", {}, "Suelta para subir y cifrar")));

  // Arrastrar archivos desde el ordenador
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
function crumbBtn(label, id, goto) {
  const b = h("button", { class: "crumb", onclick: () => goto(id) }, label);
  dropTarget(b, id);
  return b;
}
function dropTarget(el, folderId) {
  el.addEventListener("dragover", (e) => { if ([...e.dataTransfer.types].includes("text/cortex-item")) { e.preventDefault(); el.classList.add("target"); } });
  el.addEventListener("dragleave", () => el.classList.remove("target"));
  el.addEventListener("drop", async (e) => {
    const id = e.dataTransfer.getData("text/cortex-item");
    el.classList.remove("target");
    if (!id) return;
    e.preventDefault(); e.stopPropagation();
    await moveItem(st.items.get(id), folderId);
  });
}
async function moveItem(it, dest) {
  if (!it || (it.parent || null) === dest) return;
  if (it.id === dest || (it.kind === "folder" && dest && isInside(dest, it.id))) return toast("No puedes mover una carpeta dentro de sí misma", "err");
  await saveItem({ ...it, parent: dest });
  toast(`Movido a ${dest ? st.items.get(dest).name : "Mi unidad"}`);
}
function driveTile(it, ctx, goto) {
  const folder = it.kind === "folder";
  const [icon, tag] = folder ? ["folder", ""] : fileType(it.type);
  const count = folder ? children(it.id).length : 0;
  const open = () => (folder ? goto(it.id) : openFile(it));
  const menu = (x, y) => popMenu(x, y, [
    [folder ? "Abrir" : "Ver", folder ? "folder" : "eye", open],
    !folder && ["Descargar", "dl", () => openFile(it, true)],
    ["Renombrar", "rename", async () => { const n = await promptBox("Renombrar", "Nuevo nombre", it.name); if (n) { await saveItem({ ...it, name: n }); toast("Renombrado"); } }],
    ["Mover a…", "move", () => moveDialog(it)],
    ["Eliminar", "trash", async () => {
      const msg = folder ? `Se eliminará «${it.name}» y todo lo que contiene (${count} elemento${count === 1 ? "" : "s"}).` : `Se eliminará «${it.name}».`;
      if (await confirmBox(msg)) { await deleteItem(it); toast("Eliminado"); }
    }, "danger-item"],
  ]);
  const more = h("button", { class: "icon-btn sm tile-more", "aria-label": "Más opciones", onclick: (e) => { e.stopPropagation(); const r = e.currentTarget.getBoundingClientRect(); menu(r.left, r.bottom + 4); } }, ico("more"));
  const el = h("div", { class: `tile ${folder ? "is-folder" : ""}`, draggable: "true", tabindex: "0", role: "button", "aria-label": it.name },
    h("div", { class: "tile-ico" }, ico(icon), tag && h("b", {}, tag)),
    h("div", { class: "tile-txt" }, h("strong", {}, it.name),
      h("small", { class: "muted" }, folder ? `${count} elemento${count === 1 ? "" : "s"} · ${fmtSize(folderSize(it.id))}` : `${fmtSize(it.size)} · ${fmtDate(it.updated)}`)),
    more);
  el.addEventListener("click", (e) => { if (!e.target.closest(".tile-more")) open(); });
  el.addEventListener("keydown", (e) => { if (e.key === "Enter") open(); });
  el.addEventListener("contextmenu", (e) => { e.preventDefault(); menu(e.clientX, e.clientY); });
  el.addEventListener("dragstart", (e) => { e.dataTransfer.setData("text/cortex-item", it.id); e.dataTransfer.effectAllowed = "move"; el.classList.add("dragged"); });
  el.addEventListener("dragend", () => el.classList.remove("dragged"));
  if (folder) dropTarget(el, it.id);
  return el;
}
async function newFolder(parent) {
  const name = await promptBox("Nueva carpeta", "Nombre de la carpeta", "", "Crear");
  if (!name) return;
  await saveItem({ kind: "folder", name, parent: parent || null });
  toast(`Carpeta «${name}» creada`);
}
function moveDialog(it) {
  const tree = h("div", { class: "tree" });
  const row = (id, name, depth) => {
    const disabled = id === it.id || (it.kind === "folder" && id && (id === it.id || isInside(id, it.id))) || (it.parent || null) === id;
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
      await saveItem({ kind: "file", name: file.name, type: file.type, size: file.size, fileId, chunks: chunks.length, parent: parent || null });
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
    modal(f.name, h("div", {}, view, h("div", { class: "row end" }, h("a", { class: "primary btnlike", href: url, download: f.name }, ico("dl"), h("span", {}, "Descargar")))), { wide: true });
  } catch (e) { toast(e.message, "err"); }
}

// ───────────────────────── NOTAS ─────────────────────────
const NOTE_DEFS = [["title", "Título"], ["body", "Texto", "area"]];
const newNote = () => editor("Nueva nota", NOTE_DEFS, null, "note");
export const editNote = (n) => editor("Editar nota", NOTE_DEFS, n, "note");
function appNotes(ctx) {
  const list = h("div", { class: "notes" });
  const draw = () => {
    const ns = byKind("note").filter((n) => matches(ctx, n, "title", "body"));
    list.replaceChildren(...(ns.length ? ns.map((n) => h("button", { class: "note", onclick: () => editNote(n) },
      h("strong", {}, n.title || "Sin título"), h("p", {}, (n.body || "").slice(0, 220)), h("small", { class: "muted mono" }, fmtDate(n.updated))))
      : [empty(ctx.state.q ? "Nada coincide." : "Guarda aquí códigos de recuperación o cualquier texto privado.", !ctx.state.q && btn("Nueva nota", "plus", newNote))]));
  };
  draw();
  return h("div", { class: "app" }, head("Notas seguras", null, btn("Nueva nota", "plus", newNote)), searchBox(ctx, draw), list);
}

// ───────────────────────── CONTACTOS ─────────────────────────
const CONTACT_DEFS = [["name", "Nombre"], ["role", "Tipo (médico, emergencia, banco, seguro…)"], ["phone", "Teléfono", "tel"], ["email", "Correo", "email"], ["notes", "Notas", "area"]];
const newContact = () => editor("Nuevo contacto", CONTACT_DEFS, null, "contact");
export const editContact = (c) => editor("Editar contacto", CONTACT_DEFS, c, "contact");
function appContacts() {
  const cs = byKind("contact");
  return h("div", { class: "app" },
    head("Contactos clave", "Personas y servicios importantes.", btn("Añadir", "plus", newContact)),
    cs.length ? h("div", { class: "list" }, ...cs.map((c) => h("article", { class: "item" },
      h("div", { class: "avatar" }, (c.name || "?")[0].toUpperCase()),
      h("div", { class: "item-main" },
        h("div", { class: "item-title" }, h("strong", {}, c.name), c.role && h("span", { class: "badge" }, c.role)),
        h("div", { class: "fields-inline" }, field("Teléfono", c.phone, { href: c.phone && `tel:${c.phone.replace(/\s/g, "")}` }), field("Correo", c.email)),
        c.notes && h("p", { class: "muted small" }, c.notes)),
      h("button", { class: "icon-btn", "aria-label": "Editar", onclick: () => editContact(c) }, ico("edit")))))
      : empty("Añade tu médico, un contacto de emergencia o el teléfono del banco.", btn("Añadir", "plus", newContact)));
}

// ───────────────────────── GENERADOR ─────────────────────────
function appGen(ctx) {
  const s = ctx.state;
  s.opts ??= { length: 20, lower: true, upper: true, digits: true, symbols: true };
  s.mode ??= "chars";
  const out = h("button", { class: "gen-out mono", title: "Copiar", onclick: () => copy(out.dataset.v, "Contraseña") });
  const meter = h("div", { class: "meter" }, h("i")); const info = h("small", { class: "muted mono" });
  const lenLbl = h("b", { class: "mono" }, s.opts.length);
  const run = () => {
    const v = s.mode === "chars" ? C.generatePassword(s.opts) : C.generatePassphrase(Math.max(4, Math.round(s.opts.length / 4)));
    out.dataset.v = v; out.textContent = v;
    const k = C.strength(v); meter.dataset.score = k.score; info.textContent = `${k.label} · ${k.bits} bits de entropía`;
  };
  const range = h("input", { type: "range", min: 8, max: 64, value: s.opts.length, "aria-label": "Longitud" });
  range.oninput = () => { s.opts.length = +range.value; lenLbl.textContent = range.value; run(); };
  const tog = (k, label) => { const c = h("input", { type: "checkbox", checked: s.opts[k] }); c.onchange = () => { s.opts[k] = c.checked; run(); }; return h("label", { class: "check" }, c, h("span", {}, label)); };
  const seg = h("div", { class: "seg", role: "tablist" },
    ...[["chars", "Caracteres"], ["words", "Frase de palabras"]].map(([m, l]) => h("button", { class: m === s.mode ? "on" : "", role: "tab", onclick: () => { s.mode = m; ctx.refresh(); } }, l)));
  run();
  return h("div", { class: "app narrow" }, head("Generador de claves", "Toca la contraseña para copiarla."),
    h("div", { class: "panel" }, seg, out, meter, info,
      h("div", { class: "gen-len" }, h("span", {}, "Longitud"), lenLbl), range,
      h("div", { class: "toggles" }, tog("lower", "Minúsculas"), tog("upper", "Mayúsculas"), tog("digits", "Números"), tog("symbols", "Símbolos")),
      h("div", { class: "row" }, btn("Generar otra", "gen", run), btn("Guardar como contraseña", "key", () => newLogin({ password: out.dataset.v }), "ghost"))));
}

// ───────────────────────── REGISTRO ─────────────────────────
function appLog(ctx) {
  const list = h("div", { class: "log" }, h("p", { class: "muted pad" }, "Leyendo registro…"));
  const devices = h("div", { class: "devices" });
  const NAMES = { entrada: "ENTRADA", fallo: "FALLO", bloqueo: "BLOQUEO", creada: "CREADA" };
  S.getLog(100).then((rows) => {
    const all = [...rows, ...st.fails.map((f) => ({ ...f, type: "fallo" }))].sort((a, b) => b.at - a.at);
    list.replaceChildren(...(all.length ? all.map((r) =>
      h("div", { class: `log-row ${r.type}` }, h("time", {}, fmtDate(r.at)), h("strong", {}, NAMES[r.type] || r.type.toUpperCase()), h("span", { class: "muted" }, r.device)))
      : [h("p", { class: "muted pad" }, "Sin registros.")]));
    const seen = {};
    rows.filter((r) => r.type === "entrada").forEach((r) => { seen[r.device] = Math.max(seen[r.device] || 0, r.at); });
    devices.replaceChildren(...Object.entries(seen).sort((a, b) => b[1] - a[1]).map(([d, t]) => h("div", { class: "dev" }, ico("cpu"), h("div", {}, h("strong", {}, d), h("small", { class: "muted" }, `Última entrada: ${fmtDate(t)}`)))));
  }).catch((e) => list.replaceChildren(h("p", { class: "err-text pad" }, e.message)));
  return h("div", { class: "app" }, head("Registro de accesos", "Cada entrada, fallo y bloqueo de tu bóveda."),
    h("h3", { class: "sub" }, "Dispositivos que han entrado"), devices,
    h("h3", { class: "sub" }, "Actividad"), list);
}

// ───────────────────────── AJUSTES ─────────────────────────
function appSettings() {
  const sel = (id, opts, cur, fn) => { const s = h("select", { id }, ...opts.map(([v, l]) => h("option", { value: v, selected: cur === v }, l))); s.onchange = () => fn(+s.value); return s; };
  const toggle = (label, key, note) => {
    const c = h("input", { type: "checkbox", checked: settings[key], role: "switch" });
    c.onchange = () => { settings[key] = c.checked; saveSettings(); toast("Ajuste guardado"); };
    return h("label", { class: "set switch" }, h("span", {}, label, note && h("small", { class: "muted block" }, note)), c);
  };
  return h("div", { class: "app narrow" }, head("Ajustes"),
    h("div", { class: "panel" }, h("h3", {}, ico("shield"), "Seguridad"),
      h("div", { class: "set" }, h("label", { for: "lockm" }, "Bloquear tras inactividad"),
        sel("lockm", [1, 2, 5, 10, 15, 30].map((m) => [m, `${m} min`]), settings.lockMinutes, (v) => { settings.lockMinutes = v; saveSettings(); toast("Ajuste guardado"); })),
      h("div", { class: "set" }, h("label", { for: "clips" }, "Borrar portapapeles tras"),
        sel("clips", [15, 30, 60].map((s) => [s, `${s} s`]), settings.clipSeconds, (v) => { settings.clipSeconds = v; saveSettings(); toast("Ajuste guardado"); })),
      h("p", { class: "muted small" }, `Tras ${MAX_FAILS} intentos fallidos la bóveda se bloquea 5 min y el tiempo se duplica con cada fallo extra.`)),
    keyFilePanel(),
    h("div", { class: "panel" }, h("h3", {}, ico("cpu"), "Sistema"),
      toggle("Efectos de luz en el cerebro", "fx", "Se aplica la próxima vez que entres."),
      toggle("Animación de arranque", "boot")),
    h("div", { class: "panel" }, h("h3", {}, ico("dl"), "Copia de seguridad"),
      h("p", { class: "muted small" }, "Descarga todo tal como está en Firebase: cifrado. Solo se abre con tu contraseña y tu archivo llave."),
      btn("Descargar copia cifrada", "dl", async () => {
        const items = await S.listItems();
        downloadJSON({ type: "cortex-backup", v: 2, at: new Date().toISOString(), keyId: st.keyId, items }, `cortex-copia-${new Date().toISOString().slice(0, 10)}.json`);
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
  const print = (text, cls = "") => { out.append(h("div", { class: `tl ${cls}` }, text)); out.scrollTop = out.scrollHeight; root.scrollTop = root.scrollHeight; };
  const APPS = { claves: "claves", contraseñas: "claves", tarjetas: "tarjetas", identidad: "identidad", drive: "drive", notas: "notas", contactos: "contactos", generador: "generador", registro: "registro", ajustes: "ajustes" };
  const CMDS = {
    help: () => [
      "comandos disponibles:",
      "  ls                lista lo que hay en la bóveda",
      "  open <app>        abre una app (claves, tarjetas, identidad, drive…)",
      "  find <texto>      busca en contraseñas, documentos, notas y archivos",
      "  gen [n]           genera una contraseña de n caracteres",
      "  phrase            genera una frase de palabras",
      "  stats             estado de la bóveda",
      "  whoami | date | neofetch | clear | lock",
    ].forEach((l) => print(l)),
    ls: () => [["login", "contraseñas"], ["card", "tarjetas"], ["id", "documentos"], ["folder", "carpetas"], ["file", "archivos"], ["note", "notas"], ["contact", "contactos"]]
      .forEach(([k, n]) => print(`drwx------  ${String(byKind(k).length).padStart(4)}  ${n}/`)),
    open: (a) => { const id = APPS[(a || "").toLowerCase()]; if (!id) return print(`open: app desconocida «${a || ""}»`, "err"); openApp(id); print(`abriendo ${id}…`, "dim"); },
    find: (...q) => { const term = q.join(" ").toLowerCase(); if (!term) return print("uso: find <texto>", "err"); const r = searchItems(term); if (!r.length) return print("sin resultados", "dim"); r.slice(0, 15).forEach((x) => print(`  [${x.sub}] ${x.label}`)); },
    gen: (n) => { const v = C.generatePassword({ length: Math.min(128, Math.max(8, +n || 24)) }); print(v, "hi"); copy(v, "Contraseña"); },
    phrase: () => { const v = C.generatePassphrase(5); print(v, "hi"); copy(v, "Frase"); },
    stats: () => {
      const used = byKind("file").reduce((a, f) => a + (f.size || 0), 0);
      print(`elementos cifrados: ${st.items.size}`); print(`drive: ${fmtSize(used)} / 1 GB`);
      print(`último acceso previo: ${st.prevAccess ? fmtDate(st.prevAccess.at) : "—"}`);
      print(`cifrado: AES-256-GCM · PBKDF2-SHA256 600k · HKDF`);
    },
    whoami: () => print(`mario@cortex · llave ${hexShort(st.keyId)}`),
    date: () => print(new Date().toString()),
    neofetch: () => {
      print([
        "        .--~~~~--.         mario@cortex",
        "     .~  .-~~-.   ~.       ------------",
        "    /  ./  /\\  \\.   \\      OS: CORTEX OS 2.0",
        "   |  /  ./  \\.  \\   |     Host: marela-8d4e5 · eu-west1",
        "   |  \\  \\    /  /   |     Cifrado: AES-256-GCM",
        "    \\  `~.\\__/.~'   /      Derivación: PBKDF2 600k + HKDF",
        "     `~._    _.~'          Elementos: " + st.items.size,
        "         `||'              Sesión: solo en memoria",
      ].join("\n"), "pre");
    },
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
      if (a !== undefined) { const m = Object.keys(APPS).find((k) => k.startsWith(a.toLowerCase())); if (m) input.value = `${c} ${m}`; }
      else { const m = Object.keys(CMDS).find((k) => k.startsWith(c.toLowerCase())); if (m) input.value = m + " "; }
    }
  });
  const root = h("div", { class: "terminal", onclick: () => { if (!getSelection().toString()) input.focus(); } },
    out, h("div", { class: "term-line" }, h("span", { class: "prompt" }, "mario@cortex:~$"), input));
  s.root = root; s.input = input;
  print("CORTEX OS 2.0 · terminal cifrada", "hi");
  print("escribe «help» para ver los comandos", "dim");
  setTimeout(() => input.focus(), 50);
  return root;
}

// ───────────────────────── buscador global ─────────────────────────
export function searchItems(q) {
  const out = [];
  for (const it of st.items.values()) {
    const hay = (...k) => k.some((x) => String(it[x] || "").toLowerCase().includes(q));
    if (it.kind === "login" && hay("title", "username", "url")) out.push({ label: it.title || it.username, sub: "Contraseña", icon: "key", run: () => { openApp("claves"); editLogin(it); } });
    else if (it.kind === "card" && hay("label", "holder")) out.push({ label: it.label || "Tarjeta", sub: "Tarjeta", icon: "card", run: () => openApp("tarjetas") });
    else if (it.kind === "id") { const t = tpl(it.template); if (`${t.name} ${t.region} ${Object.values(it).join(" ")}`.toLowerCase().includes(q)) out.push({ label: `${t.name} · ${t.region}`, sub: "Documento", icon: "id", run: () => { openApp("identidad"); idEditor(it); } }); }
    else if (it.kind === "note" && hay("title", "body")) out.push({ label: it.title || "Nota", sub: "Nota", icon: "note", run: () => { openApp("notas"); editNote(it); } });
    else if (it.kind === "contact" && hay("name", "role", "phone", "email")) out.push({ label: it.name, sub: "Contacto", icon: "contact", run: () => { openApp("contactos"); editContact(it); } });
    else if (it.kind === "file" && hay("name")) out.push({ label: it.name, sub: "Archivo", icon: fileType(it.type)[0], run: () => openFile(it) });
    else if (it.kind === "folder" && hay("name")) out.push({ label: it.name, sub: "Carpeta", icon: "folder", run: () => { const w = openApp("drive"); if (w) { w.state.folder = it.id; w.state.q = ""; refreshApp("drive"); } } });
  }
  return out;
}

// ───────────────────────── panel del escritorio ─────────────────────────
export function securityAlerts() {
  const logins = byKind("login");
  const weak = logins.filter((l) => C.strength(l.password).score <= 2);
  const counts = {}; logins.forEach((l) => l.password && (counts[l.password] = (counts[l.password] || 0) + 1));
  const reused = logins.filter((l) => counts[l.password] > 1);
  const soon = byKind("id").filter((d) => { const v = d.validez || d.valabilitate; return v && new Date(v) - Date.now() < 90 * 864e5; });
  return [
    st.failsSince && { warn: true, text: `${st.failsSince} intento${st.failsSince > 1 ? "s" : ""} fallido${st.failsSince > 1 ? "s" : ""} desde tu última entrada`, app: "registro" },
    weak.length && { text: `${weak.length} contraseña${weak.length > 1 ? "s" : ""} débil${weak.length > 1 ? "es" : ""}`, app: "claves" },
    reused.length && { text: `${reused.length} contraseñas repetidas`, app: "claves" },
    ...soon.map((d) => ({ text: `${tpl(d.template).name} caduca el ${fmtDay(d.validez || d.valabilitate)}`, app: "identidad" })),
  ].filter(Boolean);
}
export function widget() {
  const alerts = securityAlerts();
  const stat = (k, label, app) => h("button", { class: "w-stat", onclick: () => openApp(app) }, h("b", {}, byKind(k).length), h("span", {}, label));
  const hour = new Date().getHours();
  const greet = hour < 6 ? "Buenas noches" : hour < 14 ? "Buenos días" : hour < 21 ? "Buenas tardes" : "Buenas noches";
  return h("div", { class: "w-inner" },
    h("div", { class: "w-head" }, h("span", { class: "w-tag" }, "SISTEMA"), h("span", { class: "led" })),
    h("h2", { class: "w-greet" }, `${greet}, Mario.`),
    h("p", { class: "muted small" }, st.prevAccess ? `Última entrada: ${fmtDate(st.prevAccess.at)} · ${st.prevAccess.device}` : "Primera entrada en este sistema."),
    h("div", { class: "w-stats" }, stat("login", "claves", "claves"), stat("card", "tarjetas", "tarjetas"), stat("id", "documentos", "identidad"), stat("file", "archivos", "drive"), stat("note", "notas", "notas"), stat("contact", "contactos", "contactos")),
    h("div", { class: "w-alerts" }, h("span", { class: "w-tag" }, "REVISIÓN DE SEGURIDAD"),
      alerts.length ? h("ul", {}, ...alerts.map((a) => h("li", { class: a.warn ? "warn" : "" }, h("button", { onclick: () => openApp(a.app) }, a.text, ico("chev")))))
        : h("p", { class: "ok-line" }, ico("shield"), "Todo en orden")));
}

// ───────────────────────── catálogo ─────────────────────────
export const APPS = [
  { id: "claves", title: "Contraseñas", icon: "key", render: appLogins, dock: true, w: 760, h: 620 },
  { id: "tarjetas", title: "Tarjetas", icon: "card", render: appCards, dock: true, w: 880, h: 560 },
  { id: "identidad", title: "Identidad", icon: "id", render: appIds, dock: true, w: 960, h: 640 },
  { id: "drive", title: "Drive", icon: "drive", render: appDrive, dock: true, w: 980, h: 640 },
  { id: "notas", title: "Notas", icon: "note", render: appNotes, dock: true, w: 760, h: 560 },
  { id: "contactos", title: "Contactos", icon: "contact", render: appContacts, w: 720, h: 560 },
  { id: "generador", title: "Generador", icon: "gen", render: appGen, w: 560, h: 600 },
  { id: "terminal", title: "Terminal", icon: "term", render: appTerminal, dock: true, w: 720, h: 460 },
  { id: "registro", title: "Registro", icon: "log", render: appLog, w: 700, h: 580 },
  { id: "ajustes", title: "Ajustes", icon: "cog", render: appSettings, w: 620, h: 640 },
];
export { refreshAll, closeAll };
