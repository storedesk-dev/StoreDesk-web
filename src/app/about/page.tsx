import { AboutClient } from "./AboutClient";
import { pageMetadata } from "@/lib/metadata";

export const metadata = pageMetadata({
  title: "Why we built StoreDesk",
  description:
    "Back-office software built from the counter out. Your sales data stays in your store, and it keeps working when the internet does not.",
  path: "/about"
});

export default function AboutPage() {
  return <AboutClient />;
}
