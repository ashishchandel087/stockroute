import { ImageResponse } from "next/og";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }];
}

/** App icon for the home screen (PNG generated at build time). */
export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size: raw } = await ctx.params;
  const size = raw === "512" ? 512 : 192;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#1f63dc",
          color: "white",
          fontSize: size * 0.42,
          fontWeight: 700,
          letterSpacing: -size * 0.01,
        }}
      >
        SR
      </div>
    ),
    { width: size, height: size },
  );
}
