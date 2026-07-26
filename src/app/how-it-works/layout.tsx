import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How it works",
  description:
    "Install StoreDesk Worker on the backoffice PC, run Desktop and Mobile against the local backend. Works with Verifone Commander."
};

export default function HowItWorksLayout({ children }: { children: React.ReactNode }) {
  return children;
}
