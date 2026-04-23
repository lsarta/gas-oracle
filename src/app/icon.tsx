import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

async function loadInter() {
  const file = path.join(
    process.cwd(),
    "node_modules/@fontsource/inter/files/inter-latin-500-normal.woff",
  );
  return readFile(file);
}

// The "g" has a descender; geometric centering looks bottom-heavy.
// paddingBottom shifts the rendered glyph up so the visible mass
// (cap-top to descender-bottom) sits in the middle of the icon.
export default async function Icon() {
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
          fontSize: 30,
          lineHeight: 1,
          paddingBottom: 6,
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
