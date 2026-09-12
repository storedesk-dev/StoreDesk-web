import { legacySignInGone } from "@/lib/legacy-sign-in";

/**
 * Turned off: 410 GONE. Store servers issue sessions themselves and refuse
 * control-plane-issued ones. See lib/legacy-sign-in.ts.
 */
export async function POST() {
  return legacySignInGone();
}
