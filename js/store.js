// Capa de datos: Firebase Auth (cuenta derivada de contraseña + archivo llave) + Firestore.
// Sin Google: la cuenta solo existe para que las reglas de Firestore sepan de quién es cada bóveda.
// En Firestore solo se guardan bloques cifrados.
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.0.2/firebase-app.js";
import {
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut,
  setPersistence, inMemoryPersistence,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-auth.js";
import {
  initializeFirestore, doc, getDoc, setDoc, updateDoc, deleteDoc, collection, getDocs,
  query, orderBy, limit, writeBatch, serverTimestamp, Bytes,
} from "https://www.gstatic.com/firebasejs/11.0.2/firebase-firestore.js";
import { firebaseConfig } from "./config.js";

export const configured = !Object.values(firebaseConfig).includes("PENDIENTE");

let app, auth, db;
if (configured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  // La sesión vive solo en memoria: al recargar o cerrar la pestaña hay que volver a desbloquear.
  setPersistence(auth, inMemoryPersistence).catch(() => {});
  db = initializeFirestore(app, { ignoreUndefinedProperties: true });
}

export const CHUNK = 700 * 1024; // trozo de archivo antes de cifrar (<1 MiB por documento)
export const MAX_FILE = 25 * 1024 * 1024;

const u = () => auth.currentUser?.uid;
const ref = (...p) => doc(db, "vaults", u(), ...p);
const col = (name) => collection(db, "vaults", u(), name);
const emailFor = (keyId) => `v-${keyId}@cortex-vault.app`;

export async function openAccount(keyId, authPw) { return signInWithEmailAndPassword(auth, emailFor(keyId), authPw); }
export async function createAccount(keyId, authPw) { return createUserWithEmailAndPassword(auth, emailFor(keyId), authPw); }
export function logout() { return signOut(auth).catch(() => {}); }

export function device() {
  const ua = navigator.userAgent;
  const os = /Android/i.test(ua) ? "Android" : /iPhone|iPad/i.test(ua) ? "iOS" : /Mac/i.test(ua) ? "macOS" : /Win/i.test(ua) ? "Windows" : /Linux/i.test(ua) ? "Linux" : "Otro";
  const br = /Edg\//.test(ua) ? "Edge" : /Chrome\//.test(ua) ? "Chrome" : /Firefox\//.test(ua) ? "Firefox" : /Safari\//.test(ua) ? "Safari" : "Navegador";
  return `${br} · ${os}`;
}

// ---- Intentos (antes de entrar; documento por archivo llave) ----
export async function getAttempts(keyId) {
  const s = await getDoc(doc(db, "attempts", keyId));
  return s.exists() ? s.data() : { failed: 0, lockUntil: 0, fails: [] };
}
export async function setAttempts(keyId, data) {
  await setDoc(doc(db, "attempts", keyId), {
    failed: data.failed | 0, lockUntil: Math.floor(data.lockUntil || 0), fails: (data.fails || []).slice(-30),
  });
}

// ---- Metadatos de la bóveda ----
export async function getMeta() {
  const s = await getDoc(ref("meta", "vault"));
  return s.exists() ? s.data() : null;
}
export async function createMeta(data) { await setDoc(ref("meta", "vault"), { ...data, created: serverTimestamp() }); }

// ---- Registro de entradas ----
export async function logEvent(type) {
  const id = `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  await setDoc(ref("log", id), { type, at: Date.now(), device: device() });
}
export async function getLog(n = 60) {
  const s = await getDocs(query(col("log"), orderBy("at", "desc"), limit(n)));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}

// ---- Elementos cifrados ----
export async function listItems() {
  const s = await getDocs(col("items"));
  return s.docs.map((d) => ({ id: d.id, ...d.data() }));
}
export async function putItem(id, box) { await setDoc(ref("items", id), { box, updated: Date.now() }); }
export async function removeItem(id) { await deleteDoc(ref("items", id)); }

// ---- Archivos (troceados y cifrados en Firestore, sin Storage) ----
export async function putChunks(fileId, chunks) {
  for (let i = 0; i < chunks.length; i += 8) {
    const b = writeBatch(db);
    chunks.slice(i, i + 8).forEach((c, k) => {
      b.set(ref("chunks", `${fileId}_${i + k}`), { iv: Bytes.fromUint8Array(c.iv), ct: Bytes.fromUint8Array(c.ct) });
    });
    await b.commit();
  }
}
export async function getChunk(fileId, n) {
  const s = await getDoc(ref("chunks", `${fileId}_${n}`));
  if (!s.exists()) throw new Error("Falta un trozo del archivo.");
  const d = s.data();
  return { iv: d.iv.toUint8Array(), ct: d.ct.toUint8Array() };
}
export async function removeChunks(fileId, count) {
  for (let i = 0; i < count; i += 400) {
    const b = writeBatch(db);
    for (let k = i; k < Math.min(count, i + 400); k++) b.delete(ref("chunks", `${fileId}_${k}`));
    await b.commit();
  }
}
