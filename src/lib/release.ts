/**
 * The published desktop and phone release the download page offers (GitHub
 * release assets). Update `LATEST_RELEASE_TAG` before every release tag.
 *
 * The installer is unsigned (no code-signing certificate), so the tag build
 * publishes `StoreDesk Windows Setup.exe.sha256` beside it and the download
 * page shows that SHA-256 — read from the file, never written here.
 */

export const LATEST_RELEASE_TAG = "v0.0.4";

export const RELEASE_BASE = `https://github.com/TRUPALIX9/StoreDesk/releases/download/${LATEST_RELEASE_TAG}`;

/** GitHub turns the spaces in "StoreDesk Windows Setup.exe" into dots. */
export const WINDOWS_INSTALLER_FILE = "StoreDesk.Windows.Setup.exe";
export const WINDOWS_INSTALLER_URL = `${RELEASE_BASE}/${WINDOWS_INSTALLER_FILE}`;
/** Beside the installer: "StoreDesk Windows Setup.exe.sha256". */
export const WINDOWS_CHECKSUM_URL = `${WINDOWS_INSTALLER_URL}.sha256`;
export const ANDROID_APK_URL = `${RELEASE_BASE}/app-release.apk`;

const SHA256 = /(?:^|[^a-fA-F0-9])([a-fA-F0-9]{64})(?![a-fA-F0-9])/;

/** The hash in a `.sha256` file (`<hash>  <name>`, `<hash> *<name>`, a bare hash, or PowerShell's uppercase), lower case. */
export function parseSha256File(text: string): string | null {
  const match = SHA256.exec(text);
  return match ? match[1].toLowerCase() : null;
}

/**
 * The Windows installer's SHA-256 from the `.sha256` file beside it. Null
 * when it can't be read (not published yet, GitHub unreachable): the page
 * then links to the file instead. Never throws; gives up after 3 s.
 */
export async function fetchWindowsInstallerSha256(fetchImpl: typeof fetch = fetch): Promise<string | null> {
  try {
    const res = await fetchImpl(WINDOWS_CHECKSUM_URL, {
      signal: AbortSignal.timeout(3_000),
      // Re-read hourly, not on every request.
      next: { revalidate: 3600 }
    } as RequestInit);
    if (!res.ok) return null;
    return parseSha256File((await res.text()).slice(0, 2_000));
  } catch {
    return null;
  }
}
