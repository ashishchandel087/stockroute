import { apiUser } from "@/lib/auth";
import { buildCatalog } from "@/lib/sync";

/** Catalog for the offline sales app: products, prices, shops, dues and my orders. */
export async function GET() {
  const user = await apiUser("salesman", "admin");
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const catalog = await buildCatalog(user);
  return Response.json(catalog, { headers: { "Cache-Control": "no-store" } });
}
