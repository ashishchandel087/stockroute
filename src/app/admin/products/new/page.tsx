import { asc } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { products, retailerTypes } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "../product-form";

export default async function NewProductPage() {
  await requireRole("admin");
  const [types, cats] = await Promise.all([
    db.select().from(retailerTypes).orderBy(asc(retailerTypes.name)),
    db.selectDistinct({ c: products.category }).from(products),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Add product" />
      <ProductForm types={types} typePrices={{}} categories={cats.map((c) => c.c).filter(Boolean) as string[]} />
    </div>
  );
}
