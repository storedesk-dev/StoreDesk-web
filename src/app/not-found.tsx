import Link from "next/link";
import { cookies } from "next/headers";
import { PageFrame, primaryButton, textLink } from "@/components/PageHero";
import { adminCookieName } from "@/lib/admin-auth";
import { PRODUCT_NAV } from "@/lib/site";

export default async function NotFound() {
  const cookieStore = await cookies();
  const hasAdminCookie = cookieStore.has(adminCookieName());

  return (
    <PageFrame>
      <div className="mx-auto max-w-3xl px-4 py-20 sm:px-6">
        <p className="sd-label">404</p>
        <h1 className="sd-h1 mt-3">This page is not here</h1>
        <p className="sd-lede mt-5">It may have moved. These are the pages people usually want.</p>
        <ul className="mt-8 divide-y divide-[var(--line)] border-y border-[var(--line)]">
          {PRODUCT_NAV.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="flex min-h-12 items-center text-[17px] font-semibold text-[var(--blue-ink)] hover:underline">
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
        <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-2">
          <Link href="/" className={primaryButton}>
            Go to the home page
          </Link>
          {hasAdminCookie ? (
            <Link href="/admin" className={textLink}>
              Admin dashboard
            </Link>
          ) : null}
        </div>
      </div>
    </PageFrame>
  );
}
