import { LandingPage } from "@/components/LandingPage";
import { pageMetadata } from "@/lib/metadata";
import { SITE } from "@/lib/site";

export const metadata = pageMetadata({
  title: "StoreDesk: back-office software for convenience stores",
  description: SITE.summary,
  path: "/",
  absoluteTitle: true
});

export default function HomePage() {
  return <LandingPage />;
}
