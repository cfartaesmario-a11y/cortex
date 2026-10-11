// CORTEX · cifrado de conocimiento cero
// Clave = HKDF( PBKDF2(contraseña, sal, 600k) || secreto del archivo llave )
// Todo se cifra con AES-256-GCM en el navegador antes de salir hacia Firebase.

const enc = new TextEncoder();
const dec = new TextDecoder();
const PBKDF2_ITER = 600000;

export const b64 = {
  from(buf) {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let s = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    }
    return btoa(s);
  },
  to(str) {
    const bin = atob(str);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  },
};

export function randomBytes(n) {
  return crypto.getRandomValues(new Uint8Array(n));
}

// Archivo llave .json que el usuario guarda fuera de la nube
export function createKeyFile() {
  return {
    type: "cortex-keyfile",
    version: 1,
    id: [...randomBytes(12)].map((b) => b.toString(16).padStart(2, "0")).join(""),
    secret: b64.from(randomBytes(32)),
    created: new Date().toISOString(),
    warning: "Guarda este archivo en un lugar seguro y haz una copia. Sin él y sin tu contraseña no se puede abrir CORTEX.",
  };
}

function checkPlain(data) {
  if (data?.type !== "cortex-keyfile" || !data.secret || !/^[0-9a-f]{24}$/.test(data.id || "")) {
    throw new Error("Este archivo no es una llave de CORTEX.");
  }
  const secret = b64.to(data.secret);
  if (secret.length !== 32) throw new Error("El archivo llave está dañado.");
  return { ...data, secretBytes: secret };
}

// Devuelve la llave lista, o { locked: true, data } si el archivo está protegido con contraseña.
export function parseKeyFile(text) {
  let data;
  try { data = JSON.parse(text); } catch { throw new Error("Este archivo no es una llave de CORTEX."); }
  if (data?.type === "cortex-keyfile-locked") {
    if (!data.salt || !data.iv || !data.ct) throw new Error("El archivo llave protegido está dañado.");
    return { locked: true, data };
  }
  return checkPlain(data);
}

// ---- Archivo llave protegido (para llevarlo en un USB) ----
// El contenido de la llave (id + secreto) se cifra con una contraseña propia del archivo.
// Quien copie el archivo del USB no puede usarlo sin esa contraseña.
async function fileKey(password, salt) {
  const k = await crypto.subtle.importKey("raw", enc.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveKey"]);
  return crypto.subtle.deriveKey({ name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITER },
    k, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
}

export async function lockKeyFile(keyFile, password) {
  const salt = randomBytes(16), iv = randomBytes(12);
  const inner = { type: "cortex-keyfile", version: 1, id: keyFile.id, secret: b64.from(keyFile.secretBytes), created: keyFile.created };
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, await fileKey(password, salt), enc.encode(JSON.stringify(inner)));
  return {
    type: "cortex-keyfile-locked", version: 1,
    salt: b64.from(salt), iv: b64.from(iv), ct: b64.from(ct),
    note: "Archivo llave de CORTEX protegido con contraseña. Sin su contraseña no sirve para nada.",
  };
}

export async function unlockKeyFile(data, password) {
  let pt;
  try {
    pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64.to(data.iv) }, await fileKey(password, b64.to(data.salt)), b64.to(data.ct));
  } catch { throw new Error("Contraseña del archivo llave incorrecta."); }
  return checkPlain(JSON.parse(dec.decode(pt)));
}

// Deriva dos cosas independientes a partir de contraseña + archivo llave:
//  · key:    clave AES-256 que cifra los datos (nunca sale del navegador)
//  · authPw: contraseña de la cuenta de Firebase (no sirve para descifrar nada)
export async function deriveVault(password, keyFile) {
  const salt = enc.encode(`cortex|${keyFile.id}`);
  const pwKey = await crypto.subtle.importKey("raw", enc.encode(password.normalize("NFKC")), "PBKDF2", false, ["deriveBits"]);
  const pwBits = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: PBKDF2_ITER }, pwKey, 256));
  const ikm = new Uint8Array(64);
  ikm.set(pwBits, 0);
  ikm.set(keyFile.secretBytes, 32);
  pwBits.fill(0);
  const hk = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveKey", "deriveBits"]);
  ikm.fill(0);
  const key = await crypto.subtle.deriveKey(
    { name: "HKDF", hash: "SHA-256", salt, info: enc.encode("cortex-vault-v1") },
    hk, { name: "AES-GCM", length: 256 }, false, ["encrypt", "decrypt"]);
  const authBits = await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info: enc.encode("cortex-auth-v1") }, hk, 256);
  return { key, authPw: b64.from(authBits) };
}

export async function encryptJSON(key, obj) {
  const iv = randomBytes(12);
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(JSON.stringify(obj)));
  return { iv: b64.from(iv), ct: b64.from(ct) };
}

export async function decryptJSON(key, box) {
  const pt = await crypto.subtle.decrypt({ name: "AES-GCM", iv: b64.to(box.iv) }, key, b64.to(box.ct));
  return JSON.parse(dec.decode(pt));
}

export async function encryptBytes(key, bytes) {
  const iv = randomBytes(12);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, bytes));
  return { iv, ct };
}

export async function decryptBytes(key, iv, ct) {
  return new Uint8Array(await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct));
}

// ---- Contraseñas ----
const SETS = {
  lower: "abcdefghijkmnopqrstuvwxyz",
  upper: "ABCDEFGHJKLMNPQRSTUVWXYZ",
  digits: "23456789",
  symbols: "!@#$%&*+-=?_.:;~^",
};

function randInt(max) {
  const lim = Math.floor(0x100000000 / max) * max;
  const a = new Uint32Array(1);
  do { crypto.getRandomValues(a); } while (a[0] >= lim);
  return a[0] % max;
}

export function generatePassword({ length = 20, lower = true, upper = true, digits = true, symbols = true } = {}) {
  const pools = [lower && SETS.lower, upper && SETS.upper, digits && SETS.digits, symbols && SETS.symbols].filter(Boolean);
  if (!pools.length) pools.push(SETS.lower);
  const all = pools.join("");
  const out = pools.map((p) => p[randInt(p.length)]);
  while (out.length < length) out.push(all[randInt(all.length)]);
  for (let i = out.length - 1; i > 0; i--) { const j = randInt(i + 1); [out[i], out[j]] = [out[j], out[i]]; }
  return out.join("");
}

const WORDS = ("ancla arena bosque cable cometa delta dragon eco faro fibra glaciar halcon iman isla jade kilo lago laser luna magma mapa nave neon nube onda orbita pixel polar prisma quark radar rayo roca sable satelite sigma sol tigre titan trueno turbo ultra valle vector vela volcan zafiro zenit cobre cristal dinamo eter").split(" ");
export function generatePassphrase(words = 5) {
  const out = [];
  for (let i = 0; i < words; i++) out.push(WORDS[randInt(WORDS.length)]);
  return out.join("-") + "-" + (randInt(90) + 10);
}

// Estimación de fuerza en bits (0-4)
export function strength(pw = "") {
  if (!pw) return { score: 0, bits: 0, label: "Vacía" };
  let pool = 0;
  if (/[a-z]/.test(pw)) pool += 26;
  if (/[A-Z]/.test(pw)) pool += 26;
  if (/\d/.test(pw)) pool += 10;
  if (/[^A-Za-z0-9]/.test(pw)) pool += 30;
  let bits = pw.length * Math.log2(Math.max(pool, 1));
  if (/(.)\1{2,}/.test(pw)) bits -= 10;
  if (/^(123|abc|qwerty|password|contraseña|admin)/i.test(pw)) bits -= 25;
  bits = Math.max(0, Math.round(bits));
  const score = bits < 40 ? 1 : bits < 60 ? 2 : bits < 80 ? 3 : 4;
  return { score, bits, label: ["Vacía", "Débil", "Mejorable", "Fuerte", "Muy fuerte"][score] };
}
