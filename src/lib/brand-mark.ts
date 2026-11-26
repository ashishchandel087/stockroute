/**
 * StockRoute app icon: a white stock box on the brand blue.
 * One drawing for every icon (browser tab, home screen, iPhone), so they always match.
 */
export const BRAND_BLUE = "#1f63dc";

/**
 * @param rounded  rounded corners (browser tab, Android "any" icon). Leave false where the
 *                 phone crops the icon itself (iPhone, Android "maskable").
 */
export function brandMarkSvg({ rounded }: { rounded: boolean }) {
  const bg = rounded
    ? `<rect width="512" height="512" rx="112" fill="${BRAND_BLUE}"/>`
    : `<rect width="512" height="512" fill="${BRAND_BLUE}"/>`;
  // Box faces, separated by thin blue lines; the side faces are shaded for depth.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">${bg}<g stroke="${BRAND_BLUE}" stroke-width="12" stroke-linejoin="round"><polygon points="256,118 376,182 256,246 136,182" fill="#ffffff"/><polygon points="136,182 256,246 256,386 136,322" fill="#ffffff" fill-opacity="0.82"/><polygon points="256,246 376,182 376,322 256,386" fill="#ffffff" fill-opacity="0.6"/></g><path d="M196 150 L316 214" stroke="${BRAND_BLUE}" stroke-width="14" stroke-linecap="round" stroke-opacity="0.35"/></svg>`;
}

/** The icon as a data URL, for drawing it into a PNG with ImageResponse. */
export function brandMarkDataUrl(opts: { rounded: boolean }) {
  return `data:image/svg+xml;base64,${Buffer.from(brandMarkSvg(opts)).toString("base64")}`;
}
