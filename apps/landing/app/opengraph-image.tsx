import { ImageResponse } from "next/og";

export const alt = "Lens: the AI crypto analyst on X that can't lie about its record.";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

function Pill({ label, color }: { label: string; color: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 18px",
        borderRadius: 999,
        border: `2px solid ${color}`,
        color,
        fontSize: 26,
      }}
    >
      <div style={{ width: 10, height: 10, borderRadius: 10, background: color }} />
      {label}
    </div>
  );
}

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
          padding: 72,
          color: "#f5f5f4",
          backgroundColor: "#050506",
          backgroundImage:
            "radial-gradient(circle at 15% 10%, rgba(153,69,255,0.22), transparent 45%), radial-gradient(circle at 90% 95%, rgba(20,241,149,0.16), transparent 45%)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16, fontSize: 34, fontWeight: 600 }}>
          <div
            style={{
              width: 48,
              height: 48,
              borderRadius: 48,
              border: "3px solid #f5f5f4",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <div style={{ width: 14, height: 14, borderRadius: 14, background: "#f5f5f4" }} />
          </div>
          Lens
        </div>
        <div style={{ display: "flex", fontSize: 72, lineHeight: 1.05, letterSpacing: -2, fontWeight: 600, maxWidth: 980 }}>
          The AI crypto analyst on X that can&apos;t lie about its record.
        </div>
        <div style={{ display: "flex", gap: 16 }}>
          <Pill label="LOW" color="#34d399" />
          <Pill label="HIGH" color="#f43f5e" />
          <div style={{ display: "flex", alignItems: "center", fontSize: 24, color: "#9a9a98", marginLeft: 12 }}>
            Proof written to Solana before every post
          </div>
        </div>
      </div>
    ),
    size,
  );
}
