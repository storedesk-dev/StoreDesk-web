import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Contact",
  description: "Email storedesk.dev@gmail.com for Worker install, Desktop, and Mobile setup help."
};

export default function ContactLayout({ children }: { children: React.ReactNode }) {
  return children;
}
