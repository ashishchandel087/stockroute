import { apiUser } from "@/lib/auth";
import { ingestItem } from "@/lib/sync";
import type { OutboxItem, SyncResult } from "@/lib/sync-types";

/**
 * Uploads work captured on the phone (possibly offline): new/edited shops, orders,
 * order edits and cancellations, payments. Items are applied in the order they were
 * made on the phone, so a new shop is created before the order placed for it.
 */
export async function POST(req: Request) {
  const user = await apiUser("salesman", "admin");
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });

  let body: { items?: OutboxItem[] };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad json" }, { status: 400 });
  }
  const items = Array.isArray(body.items) ? body.items.slice(0, 200) : [];

  const results: SyncResult[] = [];
  const failedShops = new Set<string>();
  for (const item of items) {
    // If a new shop failed, hold back everything that depends on it
    if (item.kind !== "retailer" && failedShops.has(item.retailerId)) {
      results.push({ id: String(item.id), ok: false, error: "Waiting for the shop to be saved" });
      continue;
    }
    const r = await ingestItem(user, item);
    if (!r.ok && item.kind === "retailer" && item.mode === "create") failedShops.add(item.retailerId);
    results.push(r);
  }
  return Response.json({ results }, { headers: { "Cache-Control": "no-store" } });
}
