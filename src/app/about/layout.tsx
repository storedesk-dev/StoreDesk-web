import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "About",
  description: "Why StoreDesk exists — edge-first c-store ops built by storedesk-dev."
};

export default function AboutLayout({ children }: { children: React.ReactNode }) {
  return children;
}
