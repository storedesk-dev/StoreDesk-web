import { DownloadClient } from "./DownloadClient";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Download StoreDesk",
  description:
    "StoreDesk for Windows and Android. Install on the back-office PC first, then add the phone app for the shop floor.",
  path: "/download"
});

export default function DownloadPage() {
  return <DownloadClient />;
}
