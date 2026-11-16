import { ImageResponse } from "next/og";
export const alt = "north. Comece a investir sabendo o que faz";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export default function Image() {
  return new ImageResponse(
    <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "#efede7", color: "#12110e" }}>
      <div style={{ fontSize: 64, fontWeight: 800, letterSpacing: -3 }}>north.</div>
      <div style={{ display: "flex", flexDirection: "column" }}>
        <div style={{ fontSize: 92, fontWeight: 800, letterSpacing: -4, lineHeight: 1 }}>Comece a investir sabendo o que faz.</div>
        <div style={{ marginTop: 28, fontSize: 32, color: "#6b6659" }}>Educação financeira, no seu ritmo.</div>
      </div>
      <div style={{ display: "flex", gap: 12 }}>{["#f2c9d0", "#e9de9e", "#a8e2dc", "#d9cdee", "#f2d3b6"].map((c) => <div key={c} style={{ width: 120, height: 14, borderRadius: 7, background: c }} />)}</div>
    </div>, size);
}
