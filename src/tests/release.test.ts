import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  DOWNLOADS_BASE,
  fetchLatestRelease,
  formatReleaseDate,
  formatSize,
  notesUrlFor,
  parseChannelVersion,
  parseSha256File,
  releaseFromManifest
} from "@/lib/release";
import { DOCS_BASE } from "@/lib/site";
import { jsonLdScript } from "@/lib/json-ld";

/**
 * The download page offers what downloads.storedesk.net is actually serving. It used to name a
 * GitHub release tag that was bumped by hand — it said v0.0.4 while 0.0.7 was out — and those URLs
 * stopped working for the public when the repos went private (D-15).
 */

const HASH = "3f5a9c0e1b2d4c6e8f0a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6";
const APK_HASH = "aa11bb22cc33dd44ee55ff6677889900aabbccddeeff00112233445566778899";

const manifest = (version = "0.0.7") => ({
  version,
  releaseDate: "2026-09-16T02:39:18.808Z",
  files: [
    {
      kind: "desktop",
      name: `StoreDesk-Setup-${version}.exe`,
      key: `releases/${version}/installer/StoreDesk-Setup-${version}.exe`,
      url: `${DOWNLOADS_BASE}/releases/${version}/installer/StoreDesk-Setup-${version}.exe`,
      size: 152761254,
      sha256: HASH
    },
    {
      kind: "mobile",
      name: `storedesk-mobile-${version}.apk`,
      key: `releases/${version}/android/storedesk-mobile-${version}.apk`,
      url: `${DOWNLOADS_BASE}/releases/${version}/android/storedesk-mobile-${version}.apk`,
      size: 65195378,
      sha256: APK_HASH
    }
  ]
});

/**
 * An R2 that serves the given keys and 404s everything else. `notesFor` are the versions the guide
 * has a release-notes page for; every other docs URL 404s, which is the real situation between
 * publishing a version and writing its notes.
 */
function bucket(objects: Record<string, string>, notesFor: string[] = []) {
  return vi.fn(async (url: string | URL) => {
    const full = String(url);
    if (full.startsWith(DOCS_BASE)) {
      const ok = notesFor.some((version) => full.endsWith(`/t/release.${version}`));
      return new Response(null, { status: ok ? 200 : 404 });
    }
    const key = full.replace(`${DOWNLOADS_BASE}/`, "");
    return key in objects ? new Response(objects[key], { status: 200 }) : new Response("Not Found", { status: 404 });
  }) as unknown as typeof fetch;
}

describe("parseChannelVersion", () => {
  it.each([
    ["version: 0.0.7\nfiles:\n  - url: x\n", "0.0.7"],
    ["files:\n  - url: x\n", null],
    ["version: latest\n", null],
    ["<!doctype html><title>Not Found</title>", null],
    ["", null]
  ])("%j → %j", (yaml, expected) => {
    expect(parseChannelVersion(yaml)).toBe(expected);
  });
});

describe("releaseFromManifest", () => {
  it("reads the Windows installer and the APK out of a release", () => {
    const release = releaseFromManifest(manifest(), "beta");
    expect(release).toMatchObject({ channel: "beta", version: "0.0.7" });
    expect(release?.windows).toEqual({
      name: "StoreDesk-Setup-0.0.7.exe",
      url: `${DOWNLOADS_BASE}/releases/0.0.7/installer/StoreDesk-Setup-0.0.7.exe`,
      size: 152761254,
      sha256: HASH
    });
    expect(release?.android?.sha256).toBe(APK_HASH);
  });

  it("ignores the blockmap, the Play bundle and the notes", () => {
    const withExtras = manifest();
    withExtras.files.push({ kind: "bundle", name: "a.aab", key: "k", url: `${DOWNLOADS_BASE}/k`, size: 1, sha256: HASH });
    const release = releaseFromManifest(withExtras, "beta");
    expect(release?.windows?.name).toBe("StoreDesk-Setup-0.0.7.exe");
    expect(release?.android?.name).toBe("storedesk-mobile-0.0.7.apk");
  });

  it("refuses a file pointed anywhere but our own bucket", () => {
    // The manifest arrives over the network; a download button must not follow a URL just because a
    // response said so.
    const hijacked = manifest();
    hijacked.files[0].url = "https://example.invalid/StoreDesk-Setup-0.0.7.exe";
    expect(releaseFromManifest(hijacked, "beta")?.windows).toBeNull();
  });

  it.each([
    ["not an object", null],
    [{}, null],
    [{ version: "0.0.7" }, null],
    [{ version: "latest", files: [] }, null],
    [{ version: "0.0.7", files: [] }, null]
  ])("refuses %j", (input, expected) => {
    expect(releaseFromManifest(input, "beta")).toBe(expected);
  });

  it("refuses a file missing its size or checksum", () => {
    const short = manifest();
    delete (short.files[0] as { sha256?: string }).sha256;
    expect(releaseFromManifest(short, "beta")?.windows).toBeNull();
  });
});

describe("the release the download page offers", () => {
  it("is stable when there is one", async () => {
    const fetchImpl = bucket({
      "desktop/stable/latest.yml": "version: 0.0.7\n",
      "releases/0.0.7/release.json": JSON.stringify(manifest())
    });
    const release = await fetchLatestRelease(fetchImpl);
    expect(release).toMatchObject({ channel: "stable", version: "0.0.7" });
  });

  it("falls back to beta while stable is empty", async () => {
    // Where the bucket actually is today: beta serves 0.0.7 and stable has nothing.
    const release = await fetchLatestRelease(
      bucket({ "desktop/beta/latest.yml": "version: 0.0.7\n", "releases/0.0.7/release.json": JSON.stringify(manifest()) })
    );
    expect(release).toMatchObject({ channel: "beta", version: "0.0.7" });
  });

  it("prefers stable over beta when both are published", async () => {
    const release = await fetchLatestRelease(
      bucket({
        "desktop/stable/latest.yml": "version: 0.0.6\n",
        "desktop/beta/latest.yml": "version: 0.0.7\n",
        "releases/0.0.6/release.json": JSON.stringify(manifest("0.0.6")),
        "releases/0.0.7/release.json": JSON.stringify(manifest("0.0.7"))
      })
    );
    expect(release).toMatchObject({ channel: "stable", version: "0.0.6" });
  });

  it("is null when the bucket is empty, unreachable or serving nonsense", async () => {
    expect(await fetchLatestRelease(bucket({}))).toBeNull();
    expect(await fetchLatestRelease(bucket({ "desktop/beta/latest.yml": "version: 0.0.7\n" }))).toBeNull();
    expect(
      await fetchLatestRelease(bucket({ "desktop/beta/latest.yml": "version: 0.0.7\n", "releases/0.0.7/release.json": "<html>" }))
    ).toBeNull();
    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    }) as unknown as typeof fetch;
    expect(await fetchLatestRelease(offline)).toBeNull();
  });
});

describe("where the release notes link goes", () => {
  it("is the version's own page when the guide has one", () => {
    expect(notesUrlFor("0.0.7", true)).toBe(`${DOCS_BASE}/t/release.0.0.7`);
  });

  it("is the notes index when it does not", () => {
    // A version reaches the downloads site before its notes are written; "What's new in 0.0.8"
    // landing on a 404 is worse than landing on the list.
    expect(notesUrlFor("0.0.8", false)).toBe(`${DOCS_BASE}/t/release.latest`);
  });

  it("is checked against the guide, not assumed", async () => {
    const objects = { "desktop/beta/latest.yml": "version: 0.0.7\n", "releases/0.0.7/release.json": JSON.stringify(manifest()) };
    const withNotes = await fetchLatestRelease(bucket(objects, ["0.0.7"]));
    expect(withNotes?.notesUrl).toBe(`${DOCS_BASE}/t/release.0.0.7`);

    const withoutNotes = await fetchLatestRelease(bucket(objects, []));
    expect(withoutNotes?.notesUrl).toBe(`${DOCS_BASE}/t/release.latest`);
  });
});

describe("what the page prints", () => {
  it("shows a size a store owner can read", () => {
    expect(formatSize(152761254)).toBe("152.8 MB");
    expect(formatSize(65195378)).toBe("65.2 MB");
  });

  it("shows a date, and nothing when there isn't one", () => {
    expect(formatReleaseDate("2026-09-16T02:39:18.808Z")).toBe("16 September 2026");
    expect(formatReleaseDate("")).toBe("");
    expect(formatReleaseDate("not a date")).toBe("");
  });
});

describe("parseSha256File", () => {
  it.each([
    [`${HASH}  StoreDesk-Setup-0.0.7.exe\n`, HASH],
    [`${HASH} *StoreDesk-Setup-0.0.7.exe`, HASH],
    [HASH, HASH],
    [`\r\nSHA256  ${HASH.toUpperCase()}  C:\\Users\\x\\StoreDesk-Setup-0.0.7.exe\r\n`, HASH],
    ["not a checksum", null],
    [`${HASH}ab  too long`, null],
    ["", null]
  ])("%j → %j", (text, expected) => {
    expect(parseSha256File(text)).toBe(expected);
  });
});

/** The file with its comments removed: prose about the old GitHub links is not a link. */
function codeOnly(file: string): string {
  return readFileSync(join(process.cwd(), file), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
}

const DOWNLOAD_PAGE_FILES = ["src/app/download/page.tsx", "src/app/download/DownloadClient.tsx", "src/lib/release.ts"];

describe("the download page", () => {
  it("hard-codes no checksum and no version", () => {
    // Both come from the release itself, so shipping one edits nothing here. The lookbehind keeps a
    // dotted quad out of it: 192.168.31.11 in the setup steps is an address, not a version.
    for (const file of DOWNLOAD_PAGE_FILES) {
      const code = codeOnly(file);
      expect(code, `${file} has a checksum in it`).not.toMatch(/[a-fA-F0-9]{64}/);
      expect(code, `${file} has a version in it`).not.toMatch(/(?<![\d.])\d+\.\d+\.\d+(?![\d.])/);
    }
  });

  it("no longer points at the private GitHub repo's releases", () => {
    for (const file of DOWNLOAD_PAGE_FILES) {
      expect(codeOnly(file), `${file} still links to GitHub`).not.toContain("github.com");
    }
  });

  it("offers only files from the downloads site", () => {
    expect(codeOnly("src/lib/release.ts")).toContain("startsWith(`${DOWNLOADS_BASE}/`)");
  });
});

describe("what a manifest is allowed to put on the page", () => {
  // The manifest is fetched over the network and some of its fields reach a
  // <script type="application/ld+json"> block in the root layout, which wraps the admin console too.
  it("escapes anything that could close the structured-data script block", () => {
    const out = jsonLdScript({ releaseDate: "2026-09-16</" + "script><" + "script>alert(1)</" + "script>" });
    expect(out).not.toMatch(/[<>]/);
    expect(JSON.parse(out).releaseDate).toContain("script");
  });

  it("escapes the separators that are line breaks to a JavaScript parser", () => {
    const out = jsonLdScript({ a: String.fromCharCode(0x2028), b: String.fromCharCode(0x2029) });
    expect(out).not.toContain(String.fromCharCode(0x2028));
    expect(out).not.toContain(String.fromCharCode(0x2029));
    expect(JSON.parse(out).a).toBe(String.fromCharCode(0x2028));
  });

  it("drops a release date that is not a date", () => {
    const bad = manifest();
    (bad as { releaseDate: string }).releaseDate = "2026-09-16</" + "script>";
    expect(releaseFromManifest(bad, "beta")?.releaseDate).toBe("");
  });

  it("drops a file whose URL is on our host but is not a key", () => {
    const bad = manifest();
    bad.files[0].url = `${DOWNLOADS_BASE}/releases/0.0.7/"><` + "script>alert(1)</" + "script>";
    expect(releaseFromManifest(bad, "beta")?.windows).toBeNull();
  });

  it("drops a file whose name, size or checksum is not the shape it claims", () => {
    const badName = manifest();
    badName.files[0].name = "Setup<" + "script>.exe";
    expect(releaseFromManifest(badName, "beta")?.windows).toBeNull();

    const badHash = manifest();
    badHash.files[0].sha256 = "not-a-hash";
    expect(releaseFromManifest(badHash, "beta")?.windows).toBeNull();

    const badSize = manifest();
    badSize.files[0].size = -1;
    expect(releaseFromManifest(badSize, "beta")?.windows).toBeNull();
  });
});
