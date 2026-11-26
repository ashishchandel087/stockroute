import { ImageResponse } from "next/og";
import { brandMarkDataUrl } from "@/lib/brand-mark";

// iPhone "Add to Home Screen" icon. iOS rounds the corners itself.
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    // eslint-disable-next-line jsx-a11y/alt-text
    <img src={brandMarkDataUrl({ rounded: false })} width={180} height={180} />,
    size,
  );
}
