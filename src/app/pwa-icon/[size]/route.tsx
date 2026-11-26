import { ImageResponse } from "next/og";
import { brandMarkDataUrl } from "@/lib/brand-mark";

export function generateStaticParams() {
  return [{ size: "192" }, { size: "512" }, { size: "maskable" }];
}

/**
 * Home-screen icons for the installed app (PNGs made at build time).
 * "maskable" is square-edged: Android cuts it to the phone's own icon shape.
 */
export async function GET(_req: Request, ctx: RouteContext<"/pwa-icon/[size]">) {
  const { size: raw } = await ctx.params;
  const size = raw === "192" ? 192 : 512;
  const src = brandMarkDataUrl({ rounded: raw !== "maskable" });
  return new ImageResponse(
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    <img src={src} width={size} height={size} />,
    { width: size, height: size },
  );
}
