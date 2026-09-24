/**
 * The links an e-mail sends somebody to.
 *
 * **No `"use client"` here, deliberately.** This is called while rendering a message on the server,
 * and a module marked as client-only cannot be called from the server at all — Next answers
 * "Attempted to call linkWithCode() from the server but linkWithCode is on the client", which the
 * control plane then reports as the far less helpful "Control plane temporarily unavailable".
 * The hook that reads the code back out lives in `use-code-from-link.ts`, which is client-only
 * because it touches `window`. They are two halves of one idea and they belong in two files.
 *
 * The code rides in the fragment. Everything after `#` is never sent to a server, never reaches a
 * proxy and never appears in a `Referer` header — so it cannot land in a request log, which is
 * exactly the leak that was removed from the password-reset route.
 */
export function linkWithCode(base: string, code: string): string {
  return `${base}#c=${encodeURIComponent(code)}`;
}
