import { OG_SIZE, ogCard } from "@/components/OgCard";

/** StoreDesk Lottery's own share card, with the real rack. */
export const alt = "StoreDesk Lottery: the instant-ticket rack in a demo store";
export const size = OG_SIZE;
export const contentType = "image/png";

export default function OpengraphImage() {
  return ogCard({
    headline: "The lottery rack, counted by scanner.",
    subline: "StoreDesk Lottery: receive packs, close each shift by scanning, and see what the drawer owes.",
    screenshot: "screenshots/lottery-rack.png"
  });
}
