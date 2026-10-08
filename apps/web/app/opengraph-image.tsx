import { ImageResponse } from "next/og";
import { publicConfig } from "@/lib/public-config";

export const alt = "Lens: is this Solana token risky? The answer is stamped on Solana.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function OpenGraphImage() {
  const { xBotHandle } = await publicConfig();
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
              borderRadius: "48px",
              border: "3px solid #f5f5f4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: "14px", height: "14px", borderRadius: "14px", background: "#f5f5f4" }} />
          </div>
          Lens
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: "18px", maxWidth: "980px" }}>
          <div style={{ fontSize: "64px", lineHeight: 1.05, letterSpacing: "-0.03em" }}>
            Is this Solana token risky? Ask @{xBotHandle}.
          </div>
          <div style={{ fontSize: "28px", color: "#c5cfc8" }}>
            Every answer is stamped on Solana and kept on a public record.
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
