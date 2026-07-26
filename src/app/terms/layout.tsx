import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms",
  description: "StoreDesk terms for Worker, Desktop, and Mobile at store locations."
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
