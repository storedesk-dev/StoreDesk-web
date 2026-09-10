import { HowItWorksClient } from "./HowItWorksClient";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "How StoreDesk works",
  description:
    "Four steps on hardware you already own: install on the back-office PC, connect your Verifone Commander, add what your suppliers charge, and scan on the shop floor.",
  path: "/how-it-works"
});

export default function HowItWorksPage() {
  return <HowItWorksClient />;
}
