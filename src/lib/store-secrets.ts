import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";
import { ControlPlaneError } from "@/lib/control-plane-security";

/**
 * Encryption for store secrets held in Atlas.
 *
 * Exactly one secret uses this today: the Verifone Commander password, so an
 * operator can set the register credential from the control plane and have it
 * reach the store automatically instead of reading it down the phone.
 *
 * The rules that make that safe:
 *   - encrypted at rest, so a database dump or a support engineer with read
 *     access to Atlas does not hand over every store's register password;
 *   - `select: false` on the field, so it is never loaded by accident;
 *   - delivered only to the authenticated Worker over TLS, and never inside
 *     `configJson`, which every signed-in client of the store receives;
 *   - never returned to a browser or a phone in any response.
 *
 * A client can *set* it. No client can *read* it back.
 */

const VERSION = "v1";

function key(salt: Buffer): Buffer {
  const secret = process.env.STORE_SECRET_KEY?.trim();
  if (!secret || secret.length < 32) {
    throw new ControlPlaneError(
      503,
      "STORE_SECRET_UNAVAILABLE",
      "STORE_SECRET_KEY is not configured; store credentials cannot be stored",
      true
    );
  }
  return scryptSync(secret, salt, 32);
}

export function isStoreSecretConfigured(): boolean {
  const secret = process.env.STORE_SECRET_KEY?.trim();
  return Boolean(secret && secret.length >= 32);
}

/** Encrypt a store secret. Returns a self-describing `v1.salt.iv.tag.ct` string. */
export function sealStoreSecret(plaintext: string): string {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(salt), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  return [
    VERSION,
    salt.toString("base64url"),
    iv.toString("base64url"),
    cipher.getAuthTag().toString("base64url"),
    ciphertext.toString("base64url")
  ].join(".");
}

/**
 * Decrypt a store secret.
 *
 * Returns null rather than throwing when the value is absent or unreadable —
 * a rotated `STORE_SECRET_KEY` should degrade to "no password configured",
 * which the operator can fix by re-entering it, not to a 500 on config sync
 * that takes the whole store offline.
 */
export function openStoreSecret(sealed: string | null | undefined): string | null {
  if (!sealed) return null;
  const parts = sealed.split(".");
  if (parts.length !== 5 || parts[0] !== VERSION) return null;
  const [, saltB64, ivB64, tagB64, ctB64] = parts as [string, string, string, string, string];
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      key(Buffer.from(saltB64, "base64url")),
      Buffer.from(ivB64, "base64url")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(ctB64, "base64url")),
      decipher.final()
    ]).toString("utf8");
  } catch {
    return null;
  }
}
