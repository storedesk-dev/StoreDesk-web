/* eslint-disable @next/next/no-img-element -- ImageResponse renders plain <img>; next/image does not apply here. */
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

/**
 * The 1200×630 share card: the headline on white, a real screenshot on the navy stage beside it.
 * Used by the site-wide card and by the pages that have their own (StoreDesk Lottery).
 */
export const OG_SIZE = { width: 1200, height: 630 };

async function dataUri(path: string) {
  const bytes = await readFile(join(process.cwd(), "public", path));
  return `data:image/png;base64,${bytes.toString("base64")}`;
}

export async function ogCard({ headline, subline, screenshot }: { headline: string; subline: string; screenshot: string }) {
  const [mark, shot] = await Promise.all([dataUri("brand/logo-mark.png"), dataUri(screenshot)]);

  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", background: "#FFFFFF", color: "#122033" }}>
        <div style={{ width: 560, display: "flex", flexDirection: "column", justifyContent: "space-between", padding: "64px 48px 64px 64px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <img src={mark} width={60} height={60} alt="" />
            <div style={{ display: "flex", fontSize: 38, fontWeight: 800, letterSpacing: -1 }}>
              <span>Store</span>
              <span style={{ color: "#00875F" }}>Desk</span>
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.05, letterSpacing: -1.5 }}>{headline}</div>
            <div style={{ fontSize: 26, lineHeight: 1.3, color: "#475569" }}>{subline}</div>
          </div>
        </div>
        <div style={{ flex: 1, display: "flex", background: "#0B1424", overflow: "hidden", paddingTop: 64, paddingLeft: 40 }}>
          <img src={shot} width={900} height={562} alt="" style={{ borderRadius: 14 }} />
        </div>
      </div>
    ),
    OG_SIZE
  );
}
