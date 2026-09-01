"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard } from "lucide-react";
import Image from "next/image";

export function AdminSidebar() {
  const pathname = usePathname();
  
  const isActive = (href: string) => {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  };

  return (
    <aside className="w-64 border-r border-[var(--border)] bg-white flex flex-col">
      <div className="p-6">
        <Link href="/admin" className="flex items-center">
          <Image src="/brand/logo-lockup-horizontal.svg" alt="StoreDesk" width={200} height={40} className="h-10 w-auto object-contain" />
        </Link>
      </div>
      <nav className="space-y-2 px-4 py-2 flex-1">
        <Link
          href="/admin"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
            isActive("/admin")
              ? "bg-[#1A63F4]/10 text-[#1A63F4]"
              : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
          }`}
        >
          <LayoutDashboard className={`h-4 w-4 ${isActive("/admin") ? "text-[#1A63F4]" : ""}`} />
          Dashboard
        </Link>
        <Link
          href="/admin/organizations"
          className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-semibold transition-colors ${
            isActive("/admin/organizations")
              ? "bg-[#1A63F4]/10 text-[#1A63F4]"
              : "text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)]"
          }`}
        >
          <Building2 className={`h-4 w-4 ${isActive("/admin/organizations") ? "text-[#1A63F4]" : ""}`} />
          Organizations
        </Link>
      </nav>
    </aside>
  );
}
