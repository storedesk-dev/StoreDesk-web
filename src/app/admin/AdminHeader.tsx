"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import { ChevronRight, UserCircle } from "lucide-react";
import Image from "next/image";

export default function AdminHeader() {
  const pathname = usePathname();
  
  // Basic breadcrumb generation based on URL segments
  const segments = pathname.split("/").filter(Boolean);
  
  const breadcrumbs = segments.map((segment, index) => {
    const url = `/${segments.slice(0, index + 1).join("/")}`;
    
    // Format the segment name (capitalize, replace dashes, handle IDs loosely)
    let label = segment.charAt(0).toUpperCase() + segment.slice(1);
    if (label.length > 20) {
      // It's likely an ID (like orgId or storeId), let's just truncate it or say "Details"
      label = label.slice(0, 8) + "...";
    }
    
    return { label, url };
  });

  return (
    <header className="sticky top-0 z-10 flex h-16 w-full items-center justify-between border-b border-[var(--border)] bg-white/80 px-6 backdrop-blur-md">
      <div className="flex items-center gap-4">
        {/* Brand Logo (Horizontal) */}
        <div className="hidden sm:flex items-center gap-2 pr-4 border-r border-[var(--border)]">
          <Image
            src="/brand/logo-lockup-horizontal.svg"
            alt="StoreDesk"
            width={160}
            height={36}
            className="h-9 w-auto object-contain"
            priority
          />
        </div>

        {/* Dynamic Breadcrumbs */}
        <nav className="flex items-center space-x-2 text-sm font-medium text-[var(--muted)]">
          {breadcrumbs.map((crumb, index) => {
            const isLast = index === breadcrumbs.length - 1;
            return (
              <div key={crumb.url} className="flex items-center gap-2">
                {index > 0 && <ChevronRight className="h-4 w-4 text-[var(--border)]" />}
                {isLast ? (
                  <span className="text-[var(--foreground)] font-semibold">{crumb.label}</span>
                ) : (
                  <Link href={crumb.url} className="hover:text-[var(--sd-blue)] transition-colors">
                    {crumb.label}
                  </Link>
                )}
              </div>
            );
          })}
        </nav>
      </div>

      <div className="flex items-center gap-4">
        {/* Profile / Admin Actions */}
        <button className="flex items-center gap-2 rounded-full p-1 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--foreground)] transition-colors">
          <UserCircle className="h-6 w-6" />
        </button>
      </div>
    </header>
  );
}
