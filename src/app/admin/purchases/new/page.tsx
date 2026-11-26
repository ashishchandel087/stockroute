import { asc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { products, suppliers, warehouses } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui";
import { PurchaseForm } from "../purchase-form";

export default async function NewPurchasePage() {
  await requireRole("admin");
  const [ps, whs, sups] = await Promise.all([
    db
      .select({ id: products.id, name: products.name, sku: products.sku, unit: products.unit, caseSize: products.caseSize })
      .from(products)
      .where(eq(products.active, true))
      .orderBy(asc(products.name)),
    db.select({ id: warehouses.id, name: warehouses.name }).from(warehouses).where(eq(warehouses.active, true)),
    db.select({ name: suppliers.name }).from(suppliers).orderBy(asc(suppliers.name)),
  ]);
  return (
    <div className="max-w-5xl">
      <PageHeader title="New purchase" sub="Goods received from a supplier. Stock is added to the chosen warehouse." />
      <PurchaseForm products={ps} warehouses={whs} suppliers={sups.map((s) => s.name)} />
    </div>
  );
}
