import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { SITE } from "@/lib/site";

/** The share card: 1200×630, the size every major network crops to. */
export const alt = `${SITE.name} — ${SITE.tagline}`;
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpengraphImage() {
  const mark = await readFile(join(process.cwd(), "public/brand/logo-mark.png"));
  const markSrc = `data:image/png;base64,${mark.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "72px 80px",
          background: "linear-gradient(135deg, #FFFFFF 0%, #EEF4FF 55%, #E8FAF3 100%)",
          color: "#17202A"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 22 }}>
          <img src={markSrc} width={84} height={84} alt="" />
          <div
            style={{
              fontSize: 44,
              fontWeight: 800,
              letterSpacing: 2,
              backgroundImage: "linear-gradient(90deg, #2859C0, #368CA5, #46B088)",
              backgroundClip: "text",
              color: "transparent"
            }}
          >
            STORE DESK
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
          <div style={{ fontSize: 68, fontWeight: 800, lineHeight: 1.04, letterSpacing: -2, maxWidth: 980 }}>
            Know what you make on every item in the store.
          </div>
          <div style={{ fontSize: 30, color: "#4F5D73", maxWidth: 960 }}>
            Price book, supplier costs and register sales on your back-office PC. Works with Verifone Commander.
          </div>
        </div>
        <div style={{ display: "flex", height: 10, borderRadius: 999, background: "linear-gradient(90deg, #1A63F4, #00A87B)" }} />
      </div>
    ),
    size
  );
}
