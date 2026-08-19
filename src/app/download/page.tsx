import type { Metadata } from "next";
import { DownloadClient } from "./DownloadClient";

export const metadata: Metadata = {
  title: "Download StoreDesk Desktop and Mobile",
  description: "Download the StoreDesk Windows PC setup and the Android Mobile APK.",
  keywords: ["StoreDesk Install", "StoreDesk Download", "StoreDesk setup", "StoreDesk Desktop", "StoreDesk Mobile"]
};

export default function DownloadPage() {
  return <DownloadClient />;
}
