import Link from "next/link";
import { cookies } from "next/headers";
import { ADMIN_COOKIE } from "@/lib/admin-auth";

export default async function NotFound() {
  const cookieStore = await cookies();
  const hasAdminCookie = cookieStore.has(ADMIN_COOKIE);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-[var(--surface)] text-center px-4">
      <h1 className="text-6xl font-extrabold tracking-tight text-[var(--sd-blue)]">404</h1>
      <h2 className="mt-4 text-2xl font-bold tracking-tight text-[var(--foreground)]">
        Page not found
      </h2>
      <p className="mt-2 max-w-md text-[var(--muted)]">
        Sorry, we couldn&apos;t find the page you&apos;re looking for. It might have been moved or doesn&apos;t exist.
      </p>
      
      <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
        <Link
          href="/"
          className="rounded-xl border border-[var(--border)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--foreground)] shadow-sm hover:bg-slate-50 transition-colors"
        >
          Go back home
        </Link>
        {hasAdminCookie && (
          <Link
            href="/admin"
            className="rounded-xl bg-[var(--sd-blue)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-[var(--sd-blue-shadow)] transition-colors"
          >
            Admin Dashboard
          </Link>
        )}
      </div>
    </main>
  );
}
