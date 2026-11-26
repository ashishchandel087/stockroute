import type { Metadata } from "next";
import { SalesApp } from "./sales-app";

export const metadata: Metadata = { title: "Sales" };

/**
 * The salesman app. This page is static (no server data) so the service worker can
 * cache it and it opens with no internet. All data comes from the phone's storage
 * and syncs through /api/sales/*. Access is guarded by the proxy and by those APIs.
 */
export default function SalesPage() {
  return <SalesApp />;
}
