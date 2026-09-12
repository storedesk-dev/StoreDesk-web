import { legacySignInGone } from "@/lib/legacy-sign-in";

/**
 * Turned off: 410 GONE. Both apps sign in at the store server
 * (`POST /api/auth/v1/login`); the phone uses the control plane only for the
 * org-tag lookup. See lib/legacy-sign-in.ts.
 */
export async function POST() {
  return legacySignInGone();
}
