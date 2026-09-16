/**
 * The release the download page offers, read from Cloudflare R2 at
 * `downloads.storedesk.net` — the same files an installed StoreDesk updates from.
 *
 * It used to be a hard-coded GitHub release tag. That broke twice over: the tag was
 * bumped by hand and fell behind (it still said v0.0.4 at 0.0.7), and every repo went
 * private (D-15), so the `github.com/.../releases/download/...` links 404 for anyone who
 * isn't a collaborator. Nothing here names a version: the channel feed says which one is
 * current, and `release.json` beside it says what the files are.
 *
 * Layout, written by `scripts/release/r2-publish.mjs`:
 *   desktop/<channel>/latest.yml      the electron-updater feed; its `version` is the channel's
 *   mobile/<channel>/latest.json      the phone's feed
 *   releases/<version>/release.json   every file's URL, size and SHA-256
 *
 * The installer is not code-signed (D-12), so its SHA-256 is what a store checks; it comes
 * from `release.json` and is never written here.
 */

import { DOCS_BASE } from "./site";

export const DOWNLOADS_BASE = "https://downloads.storedesk.net";

/** Newest first: the download page offers `stable`, and falls back to `beta` until there is one. */
export const CHANNELS = ["stable", "beta"] as const;
export type ReleaseChannel = (typeof CHANNELS)[number];

export interface ReleaseFile {
  name: string;
  url: string;
  /** Bytes, as published. */
  size: number;
  sha256: string;
}

export interface LatestRelease {
  channel: ReleaseChannel;
  version: string;
  /** ISO 8601, when it was published. */
  releaseDate: string;
  windows: ReleaseFile | null;
  android: ReleaseFile | null;
  /**
   * The user guide's notes for this version when it has its own page, otherwise the notes index.
   * Checked rather than assumed: a version is published to R2 before its notes are written, and a
   * "What's new in 0.0.8" that 404s is worse than one that lands on the list.
   */
  notesUrl: string;
}

const SHA256 = /(?:^|[^a-fA-F0-9])([a-fA-F0-9]{64})(?![a-fA-F0-9])/;
const SEMVER = /^\d+\.\d+\.\d+$/;
/** ISO 8601, as `release.json` writes it (`new Date().toISOString()`). */
const ISO_DATE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
/** The characters an object key in our own bucket can contain (r2-publish's SAFE_KEY, plus the base URL). */
const SAFE_PATH = /^[A-Za-z0-9._\/-]+$/;

/** The hash in a `.sha256` file (`<hash>  <name>`, `<hash> *<name>`, a bare hash, or PowerShell's uppercase), lower case. */
export function parseSha256File(text: string): string | null {
  const match = SHA256.exec(text);
  return match ? match[1].toLowerCase() : null;
}

/** The version a channel's `latest.yml` serves, or null when the feed is missing or not a feed. */
export function parseChannelVersion(yaml: string): string | null {
  const version = yaml.match(/^version:[ \t]*(\S+)[ \t]*$/m)?.[1];
  return version && SEMVER.test(version) ? version : null;
}

interface ManifestFile {
  kind?: string;
  name?: string;
  url?: string;
  size?: number;
  sha256?: string;
}

function fileOfKind(files: ManifestFile[], kind: string): ReleaseFile | null {
  const found = files.find((file) => file.kind === kind);
  if (!found?.url || !found.name || !found.sha256 || typeof found.size !== "number") return null;
  // A manifest is fetched over the network, so nothing in it is trusted for its shape. The host has
  // to be our own bucket, and the rest of the URL has to look like one of its keys: checking only
  // the prefix would leave everything after it free text, which then reaches a download button and
  // the page's structured data.
  if (!found.url.startsWith(`${DOWNLOADS_BASE}/`)) return null;
  if (!SAFE_PATH.test(found.url.slice(DOWNLOADS_BASE.length + 1))) return null;
  if (!SAFE_PATH.test(found.name)) return null;
  if (!/^[a-fA-F0-9]{64}$/.test(found.sha256)) return null;
  if (!Number.isSafeInteger(found.size) || found.size <= 0) return null;
  return { name: found.name, url: found.url, size: found.size, sha256: found.sha256.toLowerCase() };
}

/** Where this version's release notes live, given whether it has a page of its own. */
export function notesUrlFor(version: string, hasOwnPage: boolean): string {
  return hasOwnPage ? `${DOCS_BASE}/t/release.${version}` : `${DOCS_BASE}/t/release.latest`;
}

/** A release from the `release.json` beside its files. Null when the manifest is not one. */
export function releaseFromManifest(manifest: unknown, channel: ReleaseChannel, hasOwnNotes = false): LatestRelease | null {
  if (!manifest || typeof manifest !== "object") return null;
  const { version, releaseDate, files } = manifest as { version?: string; releaseDate?: string; files?: ManifestFile[] };
  if (!version || !SEMVER.test(version) || !Array.isArray(files)) return null;
  const windows = fileOfKind(files, "desktop");
  const android = fileOfKind(files, "mobile");
  if (!windows && !android) return null;
  // An unparseable date is dropped rather than passed on: it is shown to readers and published as
  // `datePublished` in the structured data.
  const published = releaseDate && ISO_DATE.test(releaseDate) ? releaseDate : "";
  return { channel, version, releaseDate: published, windows, android, notesUrl: notesUrlFor(version, hasOwnNotes) };
}

/** Bytes as the download page shows them: "152.8 MB". */
export function formatSize(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

/** "16 September 2026", or "" when there is no date. */
export function formatReleaseDate(iso: string): string {
  if (!iso) return "";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
}

/** Re-read hourly, not on every request. */
const CACHE = { next: { revalidate: 3600 } } as RequestInit;

/**
 * How long one request may take, and how long the whole lookup may take.
 *
 * The root layout awaits this, so every page of the site — the admin console included — waits for
 * it. Worst case is four requests (a channel feed that 404s, the next channel's feed, its manifest,
 * and the notes check), and a failed fetch is not cached, so a downloads site that stops answering
 * would be paid for on every render. A per-request timeout alone does not bound that; the deadline
 * below does.
 */
const REQUEST_TIMEOUT_MS = 2_000;
const TOTAL_BUDGET_MS = 4_000;

async function getText(url: string, fetchImpl: typeof fetch, deadline: number): Promise<string | null> {
  if (Date.now() >= deadline) return null;
  try {
    const res = await fetchImpl(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS), ...CACHE });
    return res.ok ? await res.text() : null;
  } catch {
    return null;
  }
}

/** Whether the guide has a release-notes page for this version. Never throws; false when unsure. */
async function hasOwnNotes(version: string, fetchImpl: typeof fetch, deadline: number): Promise<boolean> {
  if (Date.now() >= deadline) return false;
  try {
    const res = await fetchImpl(`${DOCS_BASE}/t/release.${version}`, {
      method: "HEAD",
      redirect: "follow",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...CACHE
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * The newest published release: `stable` when there is one, otherwise `beta`. Null when the bucket
 * can't be read — the page then says so and links to the downloads site rather than offering a
 * button that goes nowhere. Never throws.
 */
export async function fetchLatestRelease(fetchImpl: typeof fetch = fetch): Promise<LatestRelease | null> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  for (const channel of CHANNELS) {
    const feed = await getText(`${DOWNLOADS_BASE}/desktop/${channel}/latest.yml`, fetchImpl, deadline);
    const version = feed ? parseChannelVersion(feed) : null;
    if (!version) continue;
    const manifest = await getText(`${DOWNLOADS_BASE}/releases/${version}/release.json`, fetchImpl, deadline);
    if (!manifest) continue;
    try {
      const release = releaseFromManifest(JSON.parse(manifest), channel, await hasOwnNotes(version, fetchImpl, deadline));
      if (release) return release;
    } catch {
      // Not JSON: try the next channel.
    }
  }
  return null;
}
