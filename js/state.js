// Estado de la sesión y guardado cifrado.
import * as C from "./crypto.js";
import * as S from "./store.js";

export const st = {
  key: null,          // clave AES de la bóveda (solo en memoria)
  keyId: null,
  keyFile: null,      // llave descifrada en memoria, para crear copias protegidas
  items: new Map(),
  prevAccess: null,
  failsSince: 0,
  fails: [],
  ui: {},             // estado de cada app (carpeta abierta, búsqueda…)
};

const SETTINGS_KEY = "cortex.settings";
function safeJSON(s) { try { return JSON.parse(s) || {}; } catch { return {}; } }
let stored = {};
try { stored = safeJSON(localStorage.getItem(SETTINGS_KEY)); } catch {}
export const settings = Object.assign({ lockMinutes: 5, clipSeconds: 30, fx: true, boot: true }, stored);
export function saveSettings() { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch {} }

export const uid = () => [...C.randomBytes(8)].map((b) => b.toString(16).padStart(2, "0")).join("");
export const byKind = (k) => [...st.items.values()].filter((i) => i.kind === k).sort((a, b) => (b.updated || 0) - (a.updated || 0));

const listeners = new Set();
export function onChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function changed() { listeners.forEach((fn) => { try { fn(); } catch (e) { console.error(e); } }); }

export async function saveItem(item, { silent = false } = {}) {
  item.id ||= uid();
  item.updated = Date.now();
  const box = await C.encryptJSON(st.key, item);
  await S.putItem(item.id, box);
  st.items.set(item.id, item);
  if (!silent) changed();
  return item;
}

export async function deleteItem(item, { silent = false } = {}) {
  if (item.kind === "file") await S.removeChunks(item.fileId, item.chunks);
  if (item.kind === "folder") {
    for (const child of [...st.items.values()].filter((i) => i.parent === item.id)) await deleteItem(child, { silent: true });
  }
  await S.removeItem(item.id);
  st.items.delete(item.id);
  if (!silent) changed();
}

export function wipeSession() {
  st.key = null; st.keyId = null; st.keyFile = null;
  st.items.clear(); st.fails = []; st.ui = {};
}
