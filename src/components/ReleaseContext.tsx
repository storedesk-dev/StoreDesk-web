"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { LatestRelease } from "@/lib/release";

/**
 * The released version, fetched once in the root layout (a server component) and handed to the
 * client parts of the site — the footer's "StoreDesk 0.0.7 · What's new", and anything else that
 * should say what is current.
 *
 * It is context rather than a prop on every page because the footer is a client component rendered
 * from three different shells; and it is fetched in the layout rather than in the footer because a
 * client fetch would show the wrong version for a moment on every page load, and would not reach
 * the structured data search engines read.
 *
 * Null means the downloads site could not be read. Everything that uses it renders nothing in that
 * case: a version we are not sure about is worse than no version.
 */
const ReleaseContext = createContext<LatestRelease | null>(null);

export function ReleaseProvider({ release, children }: { release: LatestRelease | null; children: ReactNode }) {
  return <ReleaseContext.Provider value={release}>{children}</ReleaseContext.Provider>;
}

export function useRelease(): LatestRelease | null {
  return useContext(ReleaseContext);
}
