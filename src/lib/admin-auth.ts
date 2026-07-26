export const ADMIN_COOKIE = "sd_admin";

/** Password for /admin — ADMIN_PASSWORD, else password embedded in MONGODB_URI. */
export function getAdminPassword(): string {
  const explicit = process.env.ADMIN_PASSWORD?.trim();
  if (explicit) return explicit;

  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) return "";

  try {
    const parsed = new URL(uri.replace(/^mongodb(\+srv)?:\/\//, "http://"));
    return decodeURIComponent(parsed.password || "");
  } catch {
    const m = uri.match(/^mongodb(?:\+srv)?:\/\/[^:]+:([^@]+)@/);
    return m ? decodeURIComponent(m[1]) : "";
  }
}

function toHex(buf: ArrayBuffer): string {
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

/** Edge + Node compatible session token. */
export async function sessionTokenFor(password: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(password),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode("storedesk-admin-v1"));
  return toHex(sig);
}

export function passwordsMatch(provided: string, expected: string): boolean {
  if (!expected || !provided) return false;
  if (provided.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < provided.length; i++) {
    diff |= provided.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return diff === 0;
}

export async function isValidAdminCookie(cookieValue: string | undefined): Promise<boolean> {
  const password = getAdminPassword();
  if (!password || !cookieValue) return false;
  const expected = await sessionTokenFor(password);
  return passwordsMatch(cookieValue, expected);
}
