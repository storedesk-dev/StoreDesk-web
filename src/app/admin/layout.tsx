import type { Metadata } from "next";
import { AdminSidebar } from "./AdminSidebar";
import AdminHeader from "./AdminHeader";

export const metadata: Metadata = {
  title: "Admin | StoreDesk Control Plane",
  description: "StoreDesk license admin",
  robots: { index: false, follow: false }
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-[var(--surface)] text-[var(--foreground)]">
      <AdminSidebar />
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
