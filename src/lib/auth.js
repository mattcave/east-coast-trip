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

export function checkPassword(password) {
  if (!process.env.ADMIN_PASSWORD) throw new Error("ADMIN_PASSWORD env var is not set");
  if (!password) return false;
  return password === process.env.ADMIN_PASSWORD;
}
