import { ImageResponse } from "next/og";

export const alt = "Zing Hackathon by Skillglider: ₹4 Lakh Prize Pool";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          padding: "80px",
          background: "#010109",
          backgroundImage:
            "radial-gradient(circle at 15% 15%, rgba(37,89,251,0.35), transparent 55%), radial-gradient(circle at 85% 85%, rgba(68,119,239,0.25), transparent 55%)",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 14,
            marginBottom: 36,
          }}
        >
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: "#2559FB",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 32,
              fontWeight: 700,
              color: "#F8FAFF",
            }}
          >
            Z
          </div>
          <span style={{ fontSize: 28, color: "#A4BFF6", fontWeight: 600, letterSpacing: -0.5 }}>SKILLGLIDER</span>
        </div>

        <div style={{ display: "flex", fontSize: 76, fontWeight: 700, color: "#F8FAFF", lineHeight: 1.05, letterSpacing: -2 }}>
          Zing Hackathon
        </div>

        <div style={{ display: "flex", marginTop: 28, fontSize: 34, color: "#A4BFF6", fontWeight: 500 }}>
          Build your own solution. Compete across three rounds.
        </div>

        <div
          style={{
            display: "flex",
            marginTop: 48,
            alignItems: "center",
            gap: 16,
          }}
        >
          <div
            style={{
              display: "flex",
              padding: "14px 28px",
              borderRadius: 999,
              background: "rgba(37,89,251,0.18)",
              border: "2px solid #2559FB",
              fontSize: 30,
              fontWeight: 700,
              color: "#F8FAFF",
            }}
          >
            ₹4 Lakh Prize Pool
          </div>
        </div>
      </div>
    ),
    { ...size },
  );
}
