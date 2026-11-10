// Uses the Web Crypto API (globalThis.crypto.subtle) instead of Node's crypto
// module so this code is compatible with the Next.js Edge Runtime (middleware).

async function hmac(secret, data) {
  const enc = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await globalThis.crypto.subtle.sign("HMAC", key, enc.encode(data));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

// Derive a session token from the secret. The token IS the cookie value —
// no session store needed since all sessions are equivalent (shared password).
export async function generateToken() {
  if (!process.env.SESSION_SECRET) throw new Error("SESSION_SECRET env var is not set");
  return hmac(process.env.SESSION_SECRET, "session");
}

export async function isValidToken(token) {
  if (!token) return false;
  return token === await generateToken();
}

// Compares in time that depends only on the length, so a caller can't find
// the token a character at a time by timing failed requests. (Web Crypto has
// no timingSafeEqual, and Node's crypto isn't available on the Edge Runtime.)
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Checks an `Authorization: Bearer <token>` header against API_TOKEN, for
// agents and scripts that can't do the cookie login. Unlike the other env
// vars this one is optional: when it's unset, bearer auth is simply off.
// Tokens shorter than 32 characters are refused outright so a weak value
// can't be configured by accident.
export const MIN_API_TOKEN_LENGTH = 32;

export function isValidApiToken(authHeader) {
  const expected = process.env.API_TOKEN;
  if (!expected || expected.length < MIN_API_TOKEN_LENGTH) return false;
  const match = /^Bearer\s+(\S+)\s*$/i.exec(authHeader ?? "");
  if (!match) return false;
  return safeEqual(match[1], expected);
}

export function checkPassword(password) {
  if (!process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD env var is not set");
  if (!password) return false;
  return password === process.env.ADMIN_PASSWORD;
}
