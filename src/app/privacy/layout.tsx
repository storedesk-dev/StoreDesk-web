import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "StoreDesk privacy — your store's catalogue, prices and sales stay on the PC in your back office."
};

export default function PrivacyLayout({ children }: { children: React.ReactNode }) {
  return children;
}
