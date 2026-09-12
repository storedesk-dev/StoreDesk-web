import { NextResponse } from "next/server";

/**
 * The control plane no longer signs app users in. Both apps sign in at the
 * store server (docs/design/store-sign-in-and-sync.md), and store servers
 * refuse sessions minted here. The old endpoints answer 410 and do no work:
 * no body read, no password check, no session.
 */
export const LEGACY_SIGN_IN_GONE = {
  error: { code: "GONE", message: "Sign in at your store: the app does this for you." }
} as const;

export function legacySignInGone() {
  return NextResponse.json(LEGACY_SIGN_IN_GONE, { status: 410 });
}
