import { legacySignInGone } from "@/lib/legacy-sign-in";

/**
 * Turned off: 410 GONE. This was a one-call wrapper over the old control-plane
 * login and session pair, which are gone too; both apps now sign in at the
 * store server. See lib/legacy-sign-in.ts.
 */
export async function POST() {
  return legacySignInGone();
}
