import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "StoreDesk privacy — store data stays on the backoffice Worker PC."
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
