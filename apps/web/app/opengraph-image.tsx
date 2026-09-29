import { ImageResponse } from "next/og";

export const alt = "Lens — tag @askLens for an instant, provable Solana risk check";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          backgroundColor: "#07080d",
          color: "#f4f6fb",
          padding: "72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "28px",
              border: "4px solid #34d399",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#34d399",
              fontSize: "28px",
            }}
          >
            •
          </div>
          <div style={{ fontSize: "28px", letterSpacing: "0.28em" }}>LENS</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxWidth: "920px" }}>
          <div style={{ fontSize: "62px", fontWeight: 700, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            Instant, provable risk checks for any Solana coin.
          </div>
          <div style={{ fontSize: "28px", color: "#9aa3b5" }}>Tag @askLens on X. The memo lands before the reply.</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
