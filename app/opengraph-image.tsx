import { ImageResponse } from "next/og";

export const runtime = "edge";
export const alt = "XORR Finance — Buy Now, Pay Never";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          background: "#05080f",
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          fontFamily: "monospace",
          border: "8px solid #a6f24a",
          padding: "40px",
        }}
      >
        {/* Terminal Header */}
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            alignItems: "center",
            position: "absolute",
            top: "40px",
            left: "40px",
            right: "40px",
            color: "rgba(255, 255, 255, 0.3)",
            fontSize: "20px",
            letterSpacing: "4px",
          }}
        >
          <span>XORR // PRIVATE_CREDIT_PROTOCOL</span>
          <span>STATUS: ACTIVE</span>
        </div>

        {/* Brand Content */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "24px",
          }}
        >
          <div
            style={{
              fontSize: "96px",
              fontWeight: 900,
              color: "#ffffff",
              letterSpacing: "-4px",
              display: "flex",
              alignItems: "center",
            }}
          >
            XORR <span style={{ color: "#a6f24a", marginLeft: "16px" }}>FINANCE</span>
          </div>

          <div
            style={{
              fontSize: "40px",
              color: "#a6f24a",
              fontWeight: "bold",
              letterSpacing: "1px",
            }}
          >
            Buy Now, Pay Never.
          </div>

          <div
            style={{
              fontSize: "22px",
              color: "rgba(255, 255, 255, 0.4)",
              marginTop: "16px",
              maxWidth: "800px",
              textAlign: "center",
            }}
          >
            Private consumer credit on Sui — BNPL, lending, and a credit score that never leaves a TEE.
          </div>
        </div>

        {/* Footer */}
        <div
          style={{
            display: "flex",
            width: "100%",
            justifyContent: "space-between",
            position: "absolute",
            bottom: "40px",
            left: "40px",
            right: "40px",
            color: "rgba(255, 255, 255, 0.2)",
            fontSize: "16px",
          }}
        >
          <span>SECURED BY CONFIDENTIAL TEE ENCLAVE</span>
          <span>APP.XORR.FINANCE</span>
        </div>
      </div>
    ),
    {
      ...size,
    }
  );
}
