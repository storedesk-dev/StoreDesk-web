"use client";

import Link from "next/link";
import { Suspense } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { api } from "../../_lib/api";
import { relativeTime } from "../../_lib/format";
import { ErrorBanner, Spinner, TabPanel, Tabs, useLoad } from "../../_components/ui";
import { PcChip, StoreLicenseChip, StoreStatusChip, pcState } from "../../_components/status";
import type { StoreTabProps } from "./_tabs/shared";
import { StoreOverviewTab } from "./_tabs/StoreOverviewTab";
import { FeaturesTab } from "./_tabs/FeaturesTab";
import { RegisterTab } from "./_tabs/RegisterTab";
import { PcPhonesTab } from "./_tabs/PcPhonesTab";
import { AccessPreviewTab } from "./_tabs/AccessPreviewTab";
import { LicenseTab } from "./_tabs/LicenseTab";
import { RolesTab } from "./_tabs/RolesTab";

type TabKey = "overview" | "license" | "features" | "register" | "pc" | "roles" | "access";
const TAB_KEYS: TabKey[] = ["overview", "license", "features", "register", "pc", "roles", "access"];

export default function StorePage() {
  return (
    <Suspense fallback={<Spinner />}>
      <StoreDetail />
    </Suspense>
  );
}

function StoreDetail() {
  const { storeId } = useParams<{ storeId: string }>();
  const search = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  // A store answers on its own id, with nothing above it to fetch alongside (D-22).
  const detail = useLoad(async () => ({ store: (await api.getStore(storeId)).store }), [storeId]);

  // Integrations are switches on the Features tab now; old links land there.
  const rawTab = search.get("tab");
  const requested = (rawTab === "integrations" ? "features" : rawTab) as TabKey | null;
  const tab: TabKey = requested && TAB_KEYS.includes(requested) ? requested : "overview";
  const setTab = (key: TabKey) => router.replace(`${pathname}?tab=${key}`, { scroll: false });

  if (detail.error && !detail.data) {
    return (
      <div className="space-y-4">
        <Link href="/admin/stores" className="inline-flex items-center gap-1 text-[13px] font-semibold text-slate-500 hover:text-[#111827]">
          <ChevronLeft className="h-4 w-4" aria-hidden /> Stores
        </Link>
        <ErrorBanner error={detail.error} onRetry={detail.reload} />
      </div>
    );
  }
  if (!detail.data) return <Spinner />;

  const { store } = detail.data;
  const props: StoreTabProps = { storeId, store, refreshStore: () => void detail.reload() };
  const state = pcState(store.installation);

  return (
    <div>
      <Link href="/admin/stores" className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-slate-500 hover:text-[#111827]">
        <ChevronLeft className="h-4 w-4" aria-hidden /> Stores
      </Link>

      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="truncate text-[22px] font-extrabold tracking-tight">
              {store.storeNumber ? `Store ${store.storeNumber} · ` : ""}
              {store.name}
            </h1>
            <StoreStatusChip status={store.status} />
            <StoreLicenseChip license={store.license} />
          </div>
          {store.address ? <p className="mt-1 text-sm text-slate-600">{store.address}</p> : null}
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <span className="font-semibold">PC:</span>
          <PcChip installation={store.installation} />
          {store.installation?.lastSeenAt && (state === "online" || state === "offline") ? (
            <span className="sd-num">seen {relativeTime(store.installation.lastSeenAt)}</span>
          ) : null}
        </div>
      </div>

      <Tabs<TabKey>
        label="Store sections"
        active={tab}
        onChange={setTab}
        tabs={[
          { key: "overview", label: "Overview" },
          { key: "license", label: "License" },
          { key: "features", label: "Features" },
          { key: "register", label: "Register" },
          { key: "pc", label: "PC & phones" },
          { key: "roles", label: "Roles" },
          { key: "access", label: "Access preview" }
        ]}
      />
      <TabPanel id={tab}>
        {tab === "overview" ? <StoreOverviewTab {...props} /> : null}
        {tab === "license" ? <LicenseTab {...props} /> : null}
        {tab === "features" ? <FeaturesTab {...props} /> : null}
        {tab === "register" ? <RegisterTab {...props} /> : null}
        {tab === "pc" ? <PcPhonesTab {...props} /> : null}
        {tab === "roles" ? <RolesTab {...props} /> : null}
        {tab === "access" ? <AccessPreviewTab {...props} /> : null}
      </TabPanel>
    </div>
  );
}
