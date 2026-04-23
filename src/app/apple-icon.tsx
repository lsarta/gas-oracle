import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

async function loadInter() {
  const file = path.join(
    process.cwd(),
    "node_modules/@fontsource/inter/files/inter-latin-500-normal.woff",
  );
  return readFile(file);
}

export default async function AppleIcon() {
  const inter = await loadInter();
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#FFFFFF",
          color: "#059669",
          fontFamily: "Inter",
          fontWeight: 500,
          fontSize: 168,
          lineHeight: 1,
          paddingBottom: 32,
          borderRadius: 40,
        }}
      >
        g
      </div>
    ),
    {
      ...size,
      fonts: [{ name: "Inter", data: inter, style: "normal", weight: 500 }],
    },
  );
}
