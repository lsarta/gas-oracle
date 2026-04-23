import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const alt = "Gyasss — get paid to confirm gas prices";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

async function loadInter() {
  const dir = path.join(process.cwd(), "node_modules/@fontsource/inter/files");
  const [w400, w500] = await Promise.all([
    readFile(path.join(dir, "inter-latin-400-normal.woff")),
    readFile(path.join(dir, "inter-latin-500-normal.woff")),
  ]);
  return { w400, w500 };
}

export default async function OG() {
  const { w400, w500 } = await loadInter();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          background: "#0A0A0A",
          color: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: 80,
          fontFamily: "Inter",
        }}
      >
        <div
          style={{
            fontFamily: "Inter",
            fontWeight: 500,
            fontSize: 200,
            lineHeight: 1,
            letterSpacing: -8,
            color: "#059669",
            display: "flex",
          }}
        >
          gyasss
        </div>

        <div
          style={{
            marginTop: 32,
            fontFamily: "Inter",
            fontWeight: 400,
            fontSize: 28,
            lineHeight: 1.3,
            color: "#A1A1AA",
            display: "flex",
            textAlign: "center",
          }}
        >
          The pricing oracle for the agentic economy.
        </div>

        <div
          style={{
            position: "absolute",
            right: 80,
            bottom: 56,
            fontFamily: "Inter",
            fontWeight: 400,
            fontSize: 18,
            color: "#71717A",
            display: "flex",
          }}
        >
          Built on Circle Nanopayments · Arc
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [
        { name: "Inter", data: w400, style: "normal", weight: 400 },
        { name: "Inter", data: w500, style: "normal", weight: 500 },
      ],
    },
  );
}
