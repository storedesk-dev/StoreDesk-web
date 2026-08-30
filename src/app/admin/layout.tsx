import type { Metadata } from "next";
import Link from "next/link";
import { Building2, Users, LayoutDashboard } from "lucide-react";

export const metadata: Metadata = {
  title: "Admin | StoreDesk Control Plane",
  description: "StoreDesk license admin",
  robots: { index: false, follow: false }
};

import AdminHeader from "./AdminHeader";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--surface)] text-[var(--foreground)]">
      {/* Sidebar */}
      <aside className="w-64 border-r border-[var(--border)] bg-white flex flex-col">
        <div className="p-6">
          <Link href="/admin" className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-[var(--sd-blue)]" />
            <span className="font-bold tracking-tight text-lg">Control Plane</span>
          </Link>
        </div>
        <nav className="space-y-1 px-3 py-4 flex-1">
          <Link
            href="/admin"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </Link>
          <Link
            href="/admin/organizations"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
          >
            <Building2 className="h-4 w-4" />
            Organizations
          </Link>
          <Link
            href="/admin/users"
            className="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
          >
            <Users className="h-4 w-4" />
            AppUsers
          </Link>
        </nav>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <AdminHeader />
        
        <main className="flex-1 overflow-auto bg-[var(--surface)]">
          <div className="mx-auto max-w-7xl p-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
