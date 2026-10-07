import { ImageResponse } from "next/og";

export const alt = "Lens — tag @justasklens. The answer is stamped on Solana.";
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
          backgroundColor: "#0e1210",
          color: "#f4f6f3",
          padding: "72px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px", fontSize: "32px" }}>
          <div
            style={{
              width: "48px",
              height: "48px",
              borderRadius: "24px",
              border: "3px solid #3ddc97",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#3ddc97",
              fontSize: "22px",
            }}
          >
            •
          </div>
          Lens
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "980px" }}>
          <div style={{ fontSize: "64px", lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            Tag @justasklens under any Solana coin.
          </div>
          <div style={{ fontSize: "28px", color: "#c5cfc8" }}>
            Lens checks the risk, stamps the answer on Solana, and keeps a public track record.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
