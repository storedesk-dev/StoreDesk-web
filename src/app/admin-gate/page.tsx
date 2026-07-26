import { Suspense } from "react";
import AdminGateClient from "./AdminGateClient";

export default function Page() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#050608] text-white/50">
          Loading…
        </main>
      }
    >
      <AdminGateClient />
    </Suspense>
  );
}
