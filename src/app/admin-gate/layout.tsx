import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Admin login",
  robots: { index: false, follow: false }
};

export default function AdminGateLayout({ children }: { children: React.ReactNode }) {
  return children;
}
