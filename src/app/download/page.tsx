import { DownloadClient } from "./DownloadClient";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Download StoreDesk",
  description:
    "StoreDesk Desktop and Service for Windows, and StoreDesk Mobile for Android. Install on the back-office PC first, then add the phone app.",
  path: "/download"
});

/**
 * The version, size and SHA-256 come from the release the download site is actually serving
 * (downloads.storedesk.net). The root layout reads it once for the whole site and hands it down
 * through ReleaseContext, so this page has nothing to fetch and nothing to edit for a release.
 */
export default function DownloadPage() {
  return <DownloadClient />;
}
