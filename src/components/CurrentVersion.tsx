"use client";

import { useRelease } from "@/components/ReleaseContext";

/**
 * What is published right now, in the footer. It comes from the downloads site through the layout
 * (components/ReleaseContext), so it is never a number someone has to remember to edit; when that
 * read fails it renders nothing rather than a stale version.
 */
export function CurrentVersion() {
  const release = useRelease();
  if (!release) return null;
  return (
    <p className="sd-num shrink-0 text-[14px] text-[var(--stage-muted)]">
      StoreDesk {release.version}
      {release.channel === "beta" ? " (beta)" : ""}.{" "}
      <a href={release.notesUrl} className="font-semibold text-white underline decoration-white/40 underline-offset-4 hover:decoration-white">
        What&rsquo;s new
      </a>
    </p>
  );
}
