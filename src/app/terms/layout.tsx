import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms",
  description: "The terms for StoreDesk Desktop, StoreDesk Mobile and the StoreDesk Service in your store."
};

export default function TermsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
