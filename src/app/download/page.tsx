import { DownloadClient } from "./DownloadClient";
import { pageMetadata } from "@/lib/metadata";
import { fetchWindowsInstallerSha256 } from "@/lib/release";

export const metadata = pageMetadata({
  title: "Download StoreDesk",
  description:
    "StoreDesk for Windows and Android. Install on the back-office PC first, then add the phone app for the shop floor.",
  path: "/download"
});

/** The installer's SHA-256 is read from the `.sha256` file the release publishes beside it, at most hourly. */
export const revalidate = 3600;

export default async function DownloadPage() {
  const windowsSha256 = await fetchWindowsInstallerSha256();
  return <DownloadClient windowsSha256={windowsSha256} />;
}
