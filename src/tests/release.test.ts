import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";
import {
  LATEST_RELEASE_TAG,
  WINDOWS_CHECKSUM_URL,
  WINDOWS_INSTALLER_URL,
  fetchWindowsInstallerSha256,
  parseSha256File
} from "@/lib/release";

/**
 * The unsigned Windows installer's SHA-256 on the download page: read from the
 * `.sha256` file the tag build publishes beside the installer, never
 * hard-coded, and a link to that file when it can't be read.
 */

const HASH = "3f5a9c0e1b2d4c6e8f0a1b2c3d4e5f60718293a4b5c6d7e8f9a0b1c2d3e4f5a6";

describe("parseSha256File", () => {
  it.each([
    [`${HASH}  StoreDesk Windows Setup.exe\n`, HASH],
    [`${HASH} *StoreDesk Windows Setup.exe`, HASH],
    [HASH, HASH],
    [`\r\nSHA256  ${HASH.toUpperCase()}  C:\\Users\\x\\StoreDesk Windows Setup.exe\r\n`, HASH],
    ["not a checksum", null],
    [`${HASH}ab  too long`, null],
    ["", null]
  ])("%j → %j", (text, expected) => {
    expect(parseSha256File(text)).toBe(expected);
  });
});

describe("the checksum file", () => {
  it("sits beside the installer in the same release", () => {
    expect(WINDOWS_INSTALLER_URL).toContain(`/releases/download/${LATEST_RELEASE_TAG}/`);
    expect(WINDOWS_CHECKSUM_URL).toBe(`${WINDOWS_INSTALLER_URL}.sha256`);
  });

  it("is read from the release, with a fallback when it can't be", async () => {
    const ok = vi.fn(async (url: string) => {
      void url;
      return new Response(`${HASH.toUpperCase()}  StoreDesk Windows Setup.exe\n`, { status: 200 });
    });
    expect(await fetchWindowsInstallerSha256(ok as unknown as typeof fetch)).toBe(HASH);
    expect(ok.mock.calls[0][0]).toBe(WINDOWS_CHECKSUM_URL);

    const missing = vi.fn(async () => new Response("Not Found", { status: 404 }));
    expect(await fetchWindowsInstallerSha256(missing as unknown as typeof fetch)).toBeNull();

    const offline = vi.fn(async () => {
      throw new TypeError("fetch failed");
    });
    expect(await fetchWindowsInstallerSha256(offline as unknown as typeof fetch)).toBeNull();

    const garbage = vi.fn(async () => new Response("<html>oops</html>", { status: 200 }));
    expect(await fetchWindowsInstallerSha256(garbage as unknown as typeof fetch)).toBeNull();
  });

  it("no hash is hard-coded on the download page", () => {
    for (const file of ["src/app/download/page.tsx", "src/app/download/DownloadClient.tsx", "src/lib/release.ts"]) {
      expect(readFileSync(join(process.cwd(), file), "utf8")).not.toMatch(/[a-fA-F0-9]{64}/);
    }
  });
});
