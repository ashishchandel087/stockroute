import { apiUser } from "@/lib/auth";
import { getShopAccount } from "@/lib/sync";

/** One shop's bills, payments, recent orders and photo, for the sales app. */
export async function GET(_req: Request, ctx: RouteContext<"/api/sales/shops/[id]">) {
  const user = await apiUser("salesman", "admin");
  if (!user) return Response.json({ error: "unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const account = await getShopAccount(id);
  if (!account) return Response.json({ error: "not found" }, { status: 404 });
  return Response.json(account, { headers: { "Cache-Control": "no-store" } });
}
