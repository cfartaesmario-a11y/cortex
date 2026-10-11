// CORTEX OS · arranque, pantalla de acceso, creación de bóveda y sesión.
import * as C from "./crypto.js";
import * as S from "./store.js";
import { st, settings, wipeSession, onChange } from "./state.js";
import { h, ico, $, toast, closeModal, downloadJSON, scramble, hexShort } from "./ui.js";
import { brain } from "./brain.js";
import { mountDesktop, unmountDesktop, refreshAll } from "./os.js";
import { APPS, widget, searchItems, setLock, MAX_FAILS } from "./apps.js";

const root = () => $("#app");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
let idleTimer = null, hiddenAt = 0;

// ───────────────────────── arranque ─────────────────────────
async function boot() {
  if (!S.configured) {
    root().replaceChildren(h("main", { class: "gate" }, h("section", { class: "gate-card" }, h("h1", { class: "logo-txt" }, "CORTEX"),
      h("p", { class: "muted" }, "Falta la configuración de Firebase en js/config.js."))));
    return;
  }
  if (settings.boot && !sessionStorage.getItem("cortex.booted")) {
    try { sessionStorage.setItem("cortex.booted", "1"); } catch {}
    await bootSequence();
  }
  renderLock();
}

async function bootSequence() {
  if (document.hidden) return; // en segundo plano no tiene sentido animar el arranque
  const lines = [
    ["CORTEX OS 2.0 · núcleo neural", "hi"],
    ["[  OK  ] Comprobando integridad del sistema", ""],
    ["[  OK  ] Cargando motor criptográfico AES-256-GCM", ""],
    ["[  OK  ] Derivación de claves PBKDF2-SHA256 · 600.000 iteraciones", ""],
    ["[  OK  ] Enlace con nodo marela-8d4e5 · europe-west1", ""],
    ["[  OK  ] Sesión en memoria volátil · sin persistencia local", ""],
    ["[  OK  ] Sinapsis listas", ""],
    ["> esperando llave de acceso_", "hi"],
  ];
  const out = h("div", { class: "boot-out" });
  const scr = h("main", { class: "boot", "aria-label": "Arrancando CORTEX" }, h("div", { class: "boot-logo" }, h("img", { src: "assets/icon-192.png", alt: "" })), out, h("small", { class: "boot-skip" }, "toca para saltar"));
  root().replaceChildren(scr);
  let skip = false;
  const sk = () => { skip = true; };
  scr.addEventListener("pointerdown", sk); addEventListener("keydown", sk, { once: true });
  for (const [t, cls] of lines) {
    if (skip || document.hidden) { skip = true; break; }
    const l = h("div", { class: `bl ${cls}` }); out.append(l); scramble(l, t, 160);
    await wait(150 + Math.random() * 90);
  }
  if (!skip) await wait(350);
  scr.classList.add("out");
  await wait(skip ? 50 : 380);
}

// ───────────────────────── pantalla de acceso ─────────────────────────
function lockShell(panel, { big = true } = {}) {
  const clock = h("div", { class: "ls-clock" });
  const date = h("div", { class: "ls-date" });
  const tick = () => {
    const d = new Date();
    clock.textContent = d.toLocaleTimeString("es-ES", { hour: "2-digit", minute: "2-digit" });
    date.textContent = d.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" });
  };
  tick(); const iv = setInterval(() => { if (!clock.isConnected) clearInterval(iv); else tick(); }, 10000);
  const b = settings.fx ? brain({ size: big ? "min(64vh, 44vw)" : "min(50vh, 40vw)", sparks: 34, className: "ls-brain", speed: 2 }) : h("img", { class: "ls-brain static", src: "assets/brain.webp", alt: "" });
  const scr = h("main", { class: "lockscreen" },
    h("div", { class: "wall-grid", "aria-hidden": "true" }), h("div", { class: "wall-scan", "aria-hidden": "true" }),
    h("section", { class: "ls-hero" }, b, h("div", { class: "ls-time" }, clock, date)),
    panel);
  root().replaceChildren(scr);
  return scr;
}

function renderLock(reason) {
  let keyFile = null, lockedData = null, attempts = null;
  const status = h("div", { class: "ls-status mono", "aria-live": "polite" });
  const say = (t, cls = "") => { const l = h("div", { class: cls }, ""); status.append(l); scramble(l, `> ${t}`, 220); while (status.children.length > 5) status.firstChild.remove(); };
  const fileIn = h("input", { type: "file", class: "sr", id: "kf" });
  const dropTxt = h("span", { class: "drop-txt" }, "Elige o arrastra tu archivo llave");
  const dropSub = h("small", { class: "muted" }, "Desde tu USB CODEX o donde lo guardes");
  const drop = h("label", { class: "drop", for: "kf" }, h("span", { class: "drop-ico" }, ico("usb")), h("span", { class: "drop-col" }, dropTxt, dropSub));
  const fpw = h("input", { type: "password", autocomplete: "off", id: "fpw" });
  const fpwWrap = h("div", { class: "f hidden" }, h("label", { for: "fpw" }, "Contraseña del archivo llave"), fpw);
  const pw = h("input", { type: "password", autocomplete: "current-password", id: "pw" });
  const msg = h("p", { class: "err-text", role: "alert" }, reason || "");
  const btn = h("button", { class: "primary big", type: "submit" }, ico("lock"), h("span", {}, "Acceder"));

  const lockedFor = () => Math.max(0, (attempts?.lockUntil || 0) - Date.now());
  let lockTimer;
  const showLock = () => {
    clearTimeout(lockTimer);
    const ms = lockedFor();
    if (ms > 0) { btn.disabled = true; msg.textContent = `Demasiados intentos. Espera ${Math.ceil(ms / 60000)} min.`; lockTimer = setTimeout(showLock, Math.min(ms, 30000)); }
    else if (btn.disabled && !btn.classList.contains("busy")) { btn.disabled = false; msg.textContent = ""; }
  };
  const setKey = async (kf) => {
    keyFile = kf; lockedData = null;
    drop.classList.add("ok"); dropTxt.textContent = `Llave ${hexShort(kf.id)} lista`; dropSub.textContent = "Verificada";
    attempts = await S.getAttempts(kf.id).catch(() => ({ failed: 0, lockUntil: 0, fails: [] }));
    showLock();
  };
  const takeFile = async (f) => {
    if (!f) return;
    msg.textContent = "";
    try {
      const parsed = C.parseKeyFile(await f.text());
      if (parsed.locked) {
        lockedData = parsed.data; keyFile = null;
        drop.classList.add("ok"); dropTxt.textContent = `${f.name} · protegido`; dropSub.textContent = "Escribe la contraseña del archivo";
        fpwWrap.classList.remove("hidden"); say("llave protegida detectada"); fpw.focus();
      } else {
        fpwWrap.classList.add("hidden"); say(`llave ${hexShort(parsed.id)} cargada`);
        await setKey(parsed); pw.focus();
      }
    } catch (e) { keyFile = lockedData = null; drop.classList.remove("ok"); dropTxt.textContent = "Elige o arrastra tu archivo llave"; dropSub.textContent = "Desde tu USB CODEX o donde lo guardes"; msg.textContent = e.message; }
  };
  fileIn.onchange = () => takeFile(fileIn.files[0]);
  drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.classList.add("over"); });
  drop.addEventListener("dragleave", () => drop.classList.remove("over"));
  drop.addEventListener("drop", (e) => { e.preventDefault(); drop.classList.remove("over"); takeFile(e.dataTransfer.files[0]); });

  const busy = (on) => { btn.disabled = on; btn.classList.toggle("busy", on); btn.lastChild.textContent = on ? "Verificando…" : "Acceder"; };
  const fail = async (text) => {
    const failed = (attempts.failed || 0) + 1;
    attempts = { ...attempts, failed, fails: [...(attempts.fails || []), { at: Date.now(), device: S.device() }] };
    if (failed >= MAX_FAILS) attempts.lockUntil = Date.now() + Math.min(5 * 2 ** (failed - MAX_FAILS), 1440) * 60000;
    await S.setAttempts(keyFile.id, attempts).catch(() => {});
    busy(false); pw.select();
    say("acceso denegado", "err");
    msg.textContent = text || (failed >= MAX_FAILS ? "" : `Contraseña o llave incorrectas. Quedan ${MAX_FAILS - failed} intentos antes del bloqueo.`);
    scr.classList.remove("shake"); void scr.offsetWidth; scr.classList.add("shake");
    showLock();
  };
  const authError = (e) => ({
    "auth/too-many-requests": "Firebase ha frenado los intentos. Espera unos minutos.",
    "auth/network-request-failed": "Sin conexión. Revisa internet.",
  }[e?.code] || e?.message || "Error desconocido");

  const attempt = async (e) => {
    e?.preventDefault();
    msg.textContent = "";
    if (!keyFile && !lockedData) return (msg.textContent = "Falta el archivo llave.");
    if (lockedData) {
      if (!fpw.value) return (msg.textContent = "Falta la contraseña del archivo llave."), fpw.focus();
      busy(true); say("abriendo archivo llave…");
      try { const kf = await C.unlockKeyFile(lockedData, fpw.value); fpw.value = ""; fpwWrap.classList.add("hidden"); await setKey(kf); say(`llave ${hexShort(kf.id)} desbloqueada`); }
      catch (err) { busy(false); msg.textContent = err.message; say("contraseña del archivo incorrecta", "err"); return; }
      busy(false);
      if (lockedFor() > 0) return showLock();
      if (!pw.value) return pw.focus();
    }
    if (lockedFor() > 0) return showLock();
    if (!pw.value) return (msg.textContent = "Falta la contraseña maestra."), pw.focus();
    busy(true);
    say("derivando clave · PBKDF2 600.000");
    let derived;
    try { derived = await C.deriveVault(pw.value, keyFile); } catch (err) { return fail(err.message); }
    say("autenticando con marela…");
    try { await S.openAccount(keyFile.id, derived.authPw); }
    catch (err) {
      if (["auth/invalid-credential", "auth/wrong-password", "auth/user-not-found", "auth/invalid-login-credentials"].includes(err.code)) return fail();
      busy(false); msg.textContent = authError(err); return;
    }
    try {
      const meta = await S.getMeta();
      if (!meta) throw new Error("No se encontró la bóveda.");
      await C.decryptJSON(derived.key, meta.check);
      say("firma verificada", "ok");
      st.key = derived.key; st.keyId = keyFile.id; st.keyFile = keyFile; pw.value = "";
      const log = await S.getLog(10).catch(() => []);
      st.prevAccess = log.find((l) => l.type === "entrada") || null;
      st.fails = attempts.fails || [];
      st.failsSince = st.fails.filter((f) => !st.prevAccess || f.at > st.prevAccess.at).length;
      await S.setAttempts(keyFile.id, { failed: 0, lockUntil: 0, fails: st.fails }).catch(() => {});
      await S.logEvent("entrada");
      await openVault((n) => say(`descifrando ${n} elementos…`));
      say("acceso concedido", "ok");
      await enter(scr);
    } catch (err) { await S.logout(); fail(err.message); }
  };

  const panel = h("form", { class: "ls-panel", onsubmit: attempt },
    h("div", { class: "ls-head" }, h("span", { class: "w-tag" }, "ACCESO RESTRINGIDO"), h("span", { class: "led" })),
    h("h1", { class: "logo-txt" }, "CORTEX"),
    fileIn, drop, fpwWrap,
    h("div", { class: "f" }, h("label", { for: "pw" }, "Contraseña maestra"), pw),
    msg, btn, status,
    h("button", { type: "button", class: "link", onclick: renderSetup }, "Crear una bóveda nueva"));
  const scr = lockShell(panel);
  say(reason ? reason.toLowerCase() : "sistema listo · inserta tu llave");
}

async function enter(scr) {
  scr.classList.add("granted");
  await wait(matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 900);
  startDesktop();
}

// ───────────────────────── crear bóveda ─────────────────────────
function renderSetup() {
  const keyFile = C.createKeyFile();
  const parsedKey = C.parseKeyFile(JSON.stringify(keyFile));
  let downloaded = false;
  const pw = h("input", { type: "password", autocomplete: "new-password", placeholder: "Mínimo 12 caracteres", id: "pw1" });
  const pw2 = h("input", { type: "password", autocomplete: "new-password", id: "pw2" });
  const meter = h("div", { class: "meter" }, h("i"));
  const meterText = h("small", { class: "muted mono" }, "");
  const protect = h("input", { type: "checkbox", checked: true, id: "protect" });
  const fpw = h("input", { type: "password", autocomplete: "new-password", id: "fpw1" });
  const fpw2 = h("input", { type: "password", autocomplete: "new-password", id: "fpw2" });
  const fname = h("input", { type: "text", value: "pas", id: "fname", spellcheck: "false" });
  const fileFields = h("div", { class: "fgrid" },
    h("div", { class: "f" }, h("label", { for: "fpw1" }, "Contraseña del archivo"), fpw),
    h("div", { class: "f" }, h("label", { for: "fpw2" }, "Repítela"), fpw2),
    h("div", { class: "f full" }, h("label", { for: "fname" }, "Nombre del archivo"), fname));
  const saved = h("input", { type: "checkbox", id: "saved" });
  const msg = h("p", { class: "err-text", role: "alert" });
  const go = h("button", { class: "primary big", type: "button", disabled: true }, ico("lock"), h("span", {}, "Crear bóveda"));
  const dlBtn = h("button", { class: "ghost", type: "button" }, ico("dl"), h("span", {}, "Descargar archivo llave"));
  const check = () => {
    const s = C.strength(pw.value);
    meter.dataset.score = pw.value ? s.score : 0; meterText.textContent = pw.value ? `${s.label} · ${s.bits} bits` : "";
    fileFields.classList.toggle("hidden", !protect.checked);
    go.disabled = !(pw.value.length >= 12 && s.score >= 3 && pw.value === pw2.value && saved.checked && downloaded);
  };
  [pw, pw2, saved, protect].forEach((e) => e.addEventListener("input", check));
  [fpw, fpw2, protect].forEach((e) => e.addEventListener("input", () => { if (downloaded) { downloaded = false; dlBtn.classList.remove("done"); dlBtn.lastChild.textContent = "Descargar archivo llave"; check(); } }));
  dlBtn.onclick = async () => {
    msg.textContent = "";
    if (protect.checked) {
      if (fpw.value.length < 8) return (msg.textContent = "La contraseña del archivo necesita al menos 8 caracteres.");
      if (fpw.value !== fpw2.value) return (msg.textContent = "Las contraseñas del archivo no coinciden.");
      downloadJSON(await C.lockKeyFile(parsedKey, fpw.value), fname.value.trim() || "pas");
    } else downloadJSON(keyFile, `${fname.value.trim() || "cortex-llave"}.json`);
    downloaded = true; dlBtn.classList.add("done"); dlBtn.lastChild.textContent = "Llave descargada"; check();
  };
  go.onclick = async () => {
    go.disabled = true; go.lastChild.textContent = "Cifrando…"; msg.textContent = "";
    try {
      const { key, authPw } = await C.deriveVault(pw.value, parsedKey);
      await S.createAccount(parsedKey.id, authPw);
      const chk = await C.encryptJSON(key, { cortex: "ok", keyId: parsedKey.id });
      await S.createMeta({ check: chk, keyId: parsedKey.id, v: 2 });
      st.keyId = parsedKey.id; st.key = key; st.keyFile = parsedKey; st.prevAccess = null; st.failsSince = 0; st.fails = [];
      await S.logEvent("creada");
      pw.value = pw2.value = fpw.value = fpw2.value = "";
      await openVault();
      await enter(scr);
    } catch (e) {
      msg.textContent = e?.code === "auth/email-already-in-use" ? "Ya existe una bóveda con esta llave." : e.message;
      go.disabled = false; go.lastChild.textContent = "Crear bóveda";
    }
  };
  const panel = h("section", { class: "ls-panel wide" },
    h("div", { class: "ls-head" }, h("span", { class: "w-tag" }, "NUEVA BÓVEDA"), h("span", { class: "led" })),
    h("h1", { class: "logo-txt" }, "CORTEX"),
    h("ol", { class: "steps" },
      h("li", {}, h("strong", {}, "Contraseña maestra"),
        h("div", { class: "f" }, h("label", { for: "pw1" }, "Contraseña"), pw, meter, meterText),
        h("div", { class: "f" }, h("label", { for: "pw2" }, "Repítela"), pw2)),
      h("li", {}, h("strong", {}, "Archivo llave"),
        h("p", { class: "muted small" }, "Se combina con tu contraseña. Para llevarlo en el USB, protégelo con su propia contraseña: si alguien lo copia, no le servirá."),
        h("label", { class: "check" }, protect, h("span", {}, "Proteger el archivo con contraseña (recomendado)")),
        fileFields, dlBtn),
      h("li", {}, h("strong", {}, "Confirmación"),
        h("label", { class: "check" }, saved, h("span", {}, "Entiendo que sin la contraseña y el archivo llave nadie puede recuperar mis datos, tampoco yo.")))),
    msg, go,
    h("button", { type: "button", class: "link", onclick: () => renderLock() }, "Ya tengo una bóveda"));
  const scr = lockShell(panel, { big: false });
  scr.classList.add("setup");
}

// ───────────────────────── sesión ─────────────────────────
async function openVault(progress) {
  const docs = await S.listItems();
  progress?.(docs.length);
  st.items.clear();
  await Promise.all(docs.map(async (d) => {
    try { const it = await C.decryptJSON(st.key, d.box); it.id = d.id; st.items.set(d.id, it); } catch {}
  }));
}

function startDesktop() {
  mountDesktop({ apps: APPS, widget, onLock: () => lock("Bóveda bloqueada"), search: searchItems });
  armIdle();
}
onChange(() => refreshAll());

function lock(reason) {
  if (!st.key) return;
  clearTimeout(idleTimer); closeModal();
  document.querySelector(".ctxmenu")?.remove();
  const os = $("#os");
  const finish = () => {
    wipeSession(); unmountDesktop();
    S.logout();
    renderLock(reason);
  };
  S.logEvent("bloqueo").catch(() => {});
  if (os && !matchMedia("(prefers-reduced-motion: reduce)").matches) { os.classList.add("locking"); setTimeout(finish, 420); }
  else finish();
}
setLock(lock);

function armIdle() {
  clearTimeout(idleTimer);
  if (!st.key || !settings.lockMinutes) return;
  idleTimer = setTimeout(() => lock("Bloqueada por inactividad"), settings.lockMinutes * 60000);
}
["pointerdown", "keydown", "wheel", "touchstart"].forEach((ev) => addEventListener(ev, armIdle, { passive: true }));
document.addEventListener("visibilitychange", () => {
  if (document.hidden) hiddenAt = Date.now();
  else if (st.key && hiddenAt && Date.now() - hiddenAt > 60000) lock("Bloqueada al volver a la pestaña");
});

boot();
