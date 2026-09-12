"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { Building2, LayoutDashboard, LogOut, Search } from "lucide-react";
import { api, type OrganizationSummary } from "../_lib/api";
import { cx } from "./ui";
import { OrgStatusChip } from "./status";

const NAV = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/organizations", label: "Organizations", icon: Building2, exact: false }
];

export function AdminShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    setSigningOut(true);
    try {
      await api.signOut();
    } catch {
      /* the cookie is cleared either way on the next request */
    }
    router.replace("/admin-gate");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen bg-[#F6F8FB] text-[#111827]">
      <a
        href="#admin-main"
        className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-white focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:shadow"
      >
        Skip to content
      </a>
      <aside className="sticky top-0 hidden h-screen w-56 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <Link href="/admin" className="flex h-14 items-center gap-2 border-b border-slate-100 px-4">
          <Image src="/brand/logo-lockup-horizontal.svg" alt="StoreDesk" width={140} height={30} className="h-7 w-auto" priority />
        </Link>
        <div className="px-4 pb-1 pt-4 text-[10.5px] font-bold uppercase tracking-[0.14em] text-slate-400">Control plane</div>
        <nav aria-label="Admin" className="flex-1 space-y-0.5 px-2">
          {NAV.map((item) => {
            const active = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cx(
                  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1A63F4]",
                  active ? "bg-[#1A63F4]/10 text-[#0E43D8]" : "text-slate-600 hover:bg-slate-100 hover:text-[#111827]"
                )}
              >
                <Icon className="h-4 w-4" aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-100 p-2">
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 hover:text-[#111827] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#1A63F4] disabled:opacity-60"
          >
            <LogOut className="h-4 w-4" aria-hidden />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur md:px-6">
          <Link href="/admin" className="text-sm font-extrabold tracking-tight md:hidden">
            StoreDesk admin
          </Link>
          <nav aria-label="Admin (small screens)" className="flex gap-3 text-sm font-semibold text-slate-600 md:hidden">
            {NAV.map((item) => (
              <Link key={item.href} href={item.href} className="hover:text-[#0E43D8]">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden text-[13px] font-semibold text-slate-500 md:block">StoreDesk admin</div>
          <div className="ml-auto w-full max-w-sm">
            <OrgSearch />
          </div>
          <button
            type="button"
            onClick={signOut}
            className="rounded-md p-2 text-slate-500 hover:bg-slate-100 md:hidden"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </header>
        <main id="admin-main" className="flex-1 px-4 py-6 md:px-8">
          <div className="mx-auto w-full max-w-[1200px]">{children}</div>
        </main>
      </div>
    </div>
  );
}

/** Global search: organizations by name or org tag. Loads the list on first focus. */
function OrgSearch() {
  const router = useRouter();
  const pathname = usePathname();
  const [query, setQuery] = useState("");
  const [orgs, setOrgs] = useState<OrganizationSummary[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const listId = useId();
  const boxRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setOpen(false);
    setQuery("");
  }, [pathname]);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!boxRef.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function ensureLoaded() {
    if (orgs || failed) return;
    try {
      const data = await api.listOrganizations();
      setOrgs(data.organizations ?? []);
    } catch {
      setFailed(true);
    }
  }

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !orgs) return [];
    return orgs
      .filter((o) => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q))
      .slice(0, 8);
  }, [orgs, query]);

  function go(org: OrganizationSummary) {
    setOpen(false);
    setQuery("");
    router.push(`/admin/organizations/${encodeURIComponent(org.organizationId)}`);
  }

  const showList = open && query.trim().length > 0;

  return (
    <div ref={boxRef} className="relative">
      <label htmlFor={`${listId}-input`} className="sr-only">
        Search organizations by name or org tag
      </label>
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
      <input
        id={`${listId}-input`}
        type="search"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={showList && results[active] ? `${listId}-${active}` : undefined}
        placeholder="Search organizations by name or tag"
        autoComplete="off"
        value={query}
        onFocus={() => {
          void ensureLoaded();
          setOpen(true);
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter" && results[active]) {
            e.preventDefault();
            go(results[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="h-9 w-full rounded-md border border-slate-300 bg-slate-50 pl-8 pr-3 text-sm placeholder:text-slate-400 focus:border-[#1A63F4] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#1A63F4]/25"
      />
      {showList ? (
        <ul
          id={listId}
          role="listbox"
          aria-label="Organizations"
          className="absolute right-0 top-full z-30 mt-1 max-h-80 w-full overflow-y-auto rounded-md border border-slate-200 bg-white py-1 shadow-lg"
        >
          {failed ? (
            <li className="px-3 py-2 text-sm text-red-600">Couldn&apos;t load organizations.</li>
          ) : !orgs ? (
            <li className="px-3 py-2 text-sm text-slate-500">Loading…</li>
          ) : results.length === 0 ? (
            <li className="px-3 py-2 text-sm text-slate-500">No organization matches “{query.trim()}”.</li>
          ) : (
            results.map((org, i) => (
              <li
                key={org.organizationId}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                onMouseEnter={() => setActive(i)}
                onMouseDown={(e) => {
                  e.preventDefault();
                  go(org);
                }}
                className={cx(
                  "flex cursor-pointer items-center justify-between gap-2 px-3 py-2 text-sm",
                  i === active ? "bg-blue-50" : ""
                )}
              >
                <span className="min-w-0">
                  <span className="block truncate font-semibold">{org.name}</span>
                  <span className="block truncate font-mono text-[11.5px] text-slate-500">{org.slug}</span>
                </span>
                <OrgStatusChip status={org.status} />
              </li>
            ))
          )}
        </ul>
      ) : null}
    </div>
  );
}
