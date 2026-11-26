import { notFound } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { requireRole } from "@/lib/auth";
import { db } from "@/lib/db/client";
import { products, retailerTypes, typePrices } from "@/lib/db/schema";
import { PageHeader } from "@/components/ui";
import { ProductForm } from "../product-form";

export default async function EditProductPage({ params }: PageProps<"/admin/products/[id]">) {
  await requireRole("admin");
  const { id } = await params;
  const [product] = await db.select().from(products).where(eq(products.id, id));
  if (!product) notFound();
  const [types, tps, cats] = await Promise.all([
    db.select().from(retailerTypes).orderBy(asc(retailerTypes.name)),
    db.select().from(typePrices).where(eq(typePrices.productId, id)),
    db.selectDistinct({ c: products.category }).from(products),
  ]);
  return (
    <div className="max-w-3xl">
      <PageHeader title={product.name} sub={product.sku} />
      <ProductForm
        product={product}
        types={types}
        typePrices={Object.fromEntries(tps.map((t) => [t.typeId, t.price]))}
        categories={cats.map((c) => c.c).filter(Boolean) as string[]}
      />
    </div>
  );
}
