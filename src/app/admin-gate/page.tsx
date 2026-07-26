import { Suspense } from "react";
import AdminGateClient from "./AdminGateClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[var(--surface)] text-[var(--muted)]">
          Loading…
        </main>
      }
    >
      <AdminGateClient />
    </Suspense>
  );
}
