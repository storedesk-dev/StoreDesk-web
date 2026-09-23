"use client";

import { useEffect, useState } from "react";

/**
 * Read a one-time code out of the link somebody clicked in an e-mail, then take it out of the
 * address bar.
 *
 * **Why the fragment and not a query string.** Everything after `#` is never sent to the server:
 * not to ours, not through a proxy, and not in a `Referer` header when the page later loads
 * anything. A `?code=` would be written into Vercel's request log on every click — which is exactly
 * the leak we removed from the password-reset route, and putting it in the URL would put it
 * straight back somewhere harder to notice.
 *
 * **Why the code is not spent on arrival.** Corporate mail security — Defender Safe Links, Mimecast,
 * Barracuda — fetches every link in a message before the person ever sees it. A token consumed by
 * that GET is a token already dead when its owner clicks, and they are told their link is invalid
 * with no way to tell why. So arriving only fills the form in; the code is spent when a human
 * submits it.
 *
 * `replaceState` then clears the fragment so the code is not sitting in the address bar of a shared
 * back-office PC, and is not carried into browser history or a bookmark.
 */
export function useCodeFromLink(): string | null {
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.location.hash;
    if (!raw.startsWith("#")) return;
    const found = new URLSearchParams(raw.slice(1)).get("c");
    if (!found) return;

    setCode(found);
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
  }, []);

  return code;
}

/** The link an e-mail sends somebody to. The code rides in the fragment, for the reasons above. */
export function linkWithCode(base: string, code: string): string {
  return `${base}#c=${encodeURIComponent(code)}`;
}
