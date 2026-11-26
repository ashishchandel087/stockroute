import { and, asc, eq, inArray, ne } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { products, retailerPrices, retailers, typePrices, users } from "@/lib/db/schema";
import { getBalances } from "@/lib/ledger";
import { PageHeader } from "@/components/ui";
import { OfficeOrderForm } from "./office-order-form";

export default async function NewOfficeOrderPage() {
  const me = await requireRole("admin");
  const [shops, prods, tps, rps, bookers, balances] = await Promise.all([
    db
      .select({
        id: retailers.id,
        name: retailers.name,
        area: retailers.area,
        typeId: retailers.typeId,
        status: retailers.status,
        creditLimit: retailers.creditLimit,
      })
      .from(retailers)
      .where(ne(retailers.status, "inactive"))
      .orderBy(asc(retailers.name)),
    db
      .select({ id: products.id, name: products.name, sku: products.sku, unit: products.unit, caseSize: products.caseSize, basePrice: products.basePrice })
      .from(products)
      .where(eq(products.active, true))
      .orderBy(asc(products.name)),
    db.select({ productId: typePrices.productId, typeId: typePrices.typeId, price: typePrices.price }).from(typePrices),
    db.select({ productId: retailerPrices.productId, retailerId: retailerPrices.retailerId, price: retailerPrices.price }).from(retailerPrices),
    db
      .select({ id: users.id, name: users.name })
      .from(users)
      .where(and(eq(users.active, true), inArray(users.role, ["admin", "salesman"])))
      .orderBy(asc(users.name)),
    getBalances(),
  ]);
  return (
    <div className="max-w-4xl">
      <PageHeader title="New order" sub="Book an order from the office, e.g. when a retailer phones in" />
      <OfficeOrderForm
        shops={shops.map((s) => ({ ...s, outstanding: balances.get(s.id)?.outstanding ?? 0, overdue: balances.get(s.id)?.overdue ?? 0 }))}
        products={prods}
        typePrices={tps}
        retailerPrices={rps}
        bookers={bookers}
        meId={me.id}
      />
    </div>
  );
}
