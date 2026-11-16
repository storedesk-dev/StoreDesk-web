import { pageMetadata } from "@/lib/metadata";
import { ProductDetail } from "../ProductDetail";
import { PRODUCTS } from "../products";

export const metadata = pageMetadata({
  title: "StoreDesk Service: runs on your back-office PC",
  description:
    "The background program on the back-office PC. It keeps your store data on that PC, reads the Verifone Commander, and keeps working with the internet down.",
  path: "/product/service",
  absoluteTitle: true
});

/**
 * What talks to what. StoreDesk Service has no screen of its own to show, so the hero shows its
 * place in the store instead: one PC in the middle, everything else connected to it.
 */
const LINKS = [
  { name: "Verifone Commander", how: "Over the store network" },
  { name: "StoreDesk Desktop", how: "On the same PC" },
  { name: "StoreDesk Mobile", how: "Through a secure tunnel, or the store Wi-Fi" },
  { name: "StoreDesk Lottery", how: "Each closed day's lottery cash, if you run it" }
];

function ServiceMap() {
  return (
    <div className="sd-stage rounded-[var(--radius-lg)] p-6 sm:p-8">
      <div className="rounded-[var(--radius-md)] border-2 border-[var(--green)] bg-[var(--stage-raised)] p-5">
        <p className="text-[14px] text-[var(--stage-muted)]">The back-office PC</p>
        <p className="mt-1 text-[22px] font-extrabold text-white">StoreDesk Service</p>
        <p className="mt-1 text-[16px] text-[var(--stage-muted)]">Price book, costs and sales history stay here.</p>
      </div>
      <ul className="mt-4 space-y-3 border-l-2 border-dashed border-white/25 pl-5">
        {LINKS.map((link) => (
          <li key={link.name} className="rounded-[var(--radius-md)] bg-[var(--stage-raised)] px-4 py-3">
            <p className="text-[17px] font-bold text-white">{link.name}</p>
            <p className="text-[15px] text-[var(--stage-muted)]">{link.how}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function ServicePage() {
  return (
    <ProductDetail
      product={PRODUCTS.service}
      title="StoreDesk Service: the part that runs your store"
      aside={<ServiceMap />}
    />
  );
}
